import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { neon } from '@neondatabase/serverless';

let input = '';
let result = { ok: false };
let phase = 'input';
try {
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 4096) throw new Error(); }
  const { kind, password } = JSON.parse(input);
  input = '';
  const target = PROFILE_TARGETS[kind];
  if (!target || typeof password !== 'string' || !password || password.length > 2048) throw new Error();
  const url = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
  url.username = target.role; url.password = password;
  phase = 'connection';
  const sql = neon(url.href);
  const [rows] = await sql.transaction([sql.query(`SELECT e.kind,e.branch_id,current_database() AS database_name,
    current_user AS role_name,
    EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0002_profile_foundation') AS migration_present,
    r.rolcanlogin AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolinherit)
      AND r.rolconnlimit=4 AND r.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS attributes_safe,
    has_function_privilege(r.oid,'groundbnb.read_profile(text,text)','EXECUTE')
      AND has_function_privilege(r.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') AS functions_allowed,
    NOT has_function_privilege(r.oid,'groundbnb._profile_snapshot(uuid)','EXECUTE')
      AND NOT has_function_privilege(r.oid,'groundbnb._profile_account(text,text)','EXECUTE')
      AND NOT has_function_privilege(r.oid,'groundbnb._valid_profile_patch(jsonb)','EXECUTE') AS helpers_denied,
    NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
      (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m') OR
       n.nspname='groundbnb' AND c.relname IN ('accounts','account_identities','profiles','profile_answers','profile_operations','synthetic_identities'))
      AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS tables_denied,
    NOT has_database_privilege(r.oid,current_database(),'CREATE') AND
      NOT has_schema_privilege(r.oid,'groundbnb','CREATE') AS create_denied
    FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname=current_user WHERE e.singleton`)], {
    readOnly: true, fetchOptions: { signal: AbortSignal.timeout(8000), cache: 'no-store' },
  });
  const row = rows?.[0];
  phase = 'result';
  const ok = rows?.length === 1 && row.kind === kind && row.branch_id === target.branch &&
    row.database_name === 'groundbnb' && row.role_name === target.role &&
    ['migration_present','attributes_safe','functions_allowed','helpers_denied','tables_denied','create_denied'].every(key => row[key] === true);
  result = { kind, role: target.role, branchId: target.branch, ok, phase: ok ? 'complete' : 'result',
    category: ok ? undefined : 'catalog', checks: ok ? 'direct_login_metadata_profile_acl' : 'failed' };
} catch (error) {
  // Only fixed categories leave the worker; never emit arbitrary error messages or URLs.
  const category = phase === 'input' ? 'input' : error?.code === '28P01' ? 'auth' :
    error?.code === '42501' ? 'permission' : error?.name === 'TimeoutError' ? 'timeout' :
    ['ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(error?.cause?.code) ? 'network' : 'unknown';
  result = { ok: false, phase, category };
}
process.stdout.write(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
