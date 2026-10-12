export const M0_PROBE_ROLES = Object.freeze({
  production: 'groundbnb_production_probe',
  preview: 'groundbnb_preview_probe',
  local: 'groundbnb_local_probe',
  recovery: 'groundbnb_recovery_reader',
});

// Metadata only: never read identity fixtures, auth payloads, or recovery events.
export const M0_IDENTITY_QUERY = `
SELECT e.kind, e.branch_id, current_database() AS database_name,
       current_user AS role_name,
       EXISTS (SELECT 1 FROM groundbnb.schema_migrations
               WHERE version = '0001_environment') AS baseline_present,
       (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb
        AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND NOT r.rolinherit AND r.rolconnlimit = 4
        AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
        AND r.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']
        AND NOT has_database_privilege(r.oid, current_database(), 'CREATE')
        AND NOT has_schema_privilege(r.oid, 'groundbnb', 'CREATE')
        AND has_table_privilege(r.oid, 'groundbnb.environment_identity', 'SELECT')
        AND has_table_privilege(r.oid, 'groundbnb.schema_migrations', 'SELECT')
        AND NOT has_table_privilege(r.oid, 'groundbnb.environment_identity', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT has_table_privilege(r.oid, 'groundbnb.schema_migrations', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT has_table_privilege(r.oid, 'groundbnb.synthetic_identities', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'neon_auth' AND c.relname IN ('user','session','account')
            AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        )) AS privileges_safe
FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname = current_user
WHERE e.singleton`;

async function queryNeon(connectionString, query) {
  // Lazy initialization permits builds without credentials. No global client or retries.
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  const [rows] = await sql.transaction([sql.query(query)], {
    readOnly: true,
    fetchOptions: { signal: AbortSignal.timeout(8000), cache: 'no-store' },
  });
  return rows;
}

/** Direct credential/metadata check; catalog assertions do not prove session isolation. */
export async function probeDatabase(env, query = queryNeon) {
  try {
    const url = new URL(env.GROUND_DATABASE_URL);
    const role = M0_PROBE_ROLES[env.GROUND_ENV];
    const allowedOptions = { sslmode: ['require', 'verify-full'], channel_binding: ['require'] };
    const unsafeOptions = [...url.searchParams].some(([key, value]) =>
      !allowedOptions[key]?.includes(value) || url.searchParams.getAll(key).length !== 1);
    if (!role || !['postgres:', 'postgresql:'].includes(url.protocol)
        || decodeURIComponent(url.username) !== role || !url.password
        || url.pathname !== '/groundbnb' || url.hash || unsafeOptions
        || (url.port && url.port !== '5432')
        || !url.hostname.endsWith('.neon.tech')
        || url.hostname !== env.GROUND_DATABASE_HOST
        || !env.GROUND_DATABASE_BRANCH_ID) return { ok: false };
    const rows = await query(env.GROUND_DATABASE_URL, M0_IDENTITY_QUERY);
    if (!Array.isArray(rows) || rows.length !== 1) return { ok: false };
    const row = rows[0];
    if (row?.kind !== env.GROUND_ENV || row.branch_id !== env.GROUND_DATABASE_BRANCH_ID
        || row.database_name !== 'groundbnb' || row.role_name !== role
        || row.baseline_present !== true || row.privileges_safe !== true) return { ok: false };
    return { ok: true, branchId: row.branch_id };
  } catch {
    // Driver errors can include credentials/SQL. Return no raw error or logs.
    return { ok: false };
  }
}
