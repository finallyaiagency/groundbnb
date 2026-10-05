import { probeDatabase, M0_PROBE_ROLES } from '../lib/database-probe.mjs';

export const M0_DIRECT_TARGETS = Object.freeze({
  local: { host: 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech', branchId: 'br-rough-flower-b8lerkcf' },
  production: { host: 'ep-snowy-morning-b8ax7lm3-pooler.c-14.us-east-1.aws.neon.tech', branchId: 'br-small-meadow-b8lh69jr' },
  recovery: { host: 'ep-shy-sunset-b8ftbxnu-pooler.c-14.us-east-1.aws.neon.tech', branchId: 'br-round-field-b8d4v5o4' },
});

// Password arrives through stdin, never command arguments or a file.
let input = '';
let result = { ok: false, reason: 'input_or_connection_failed' };
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 4096) throw new Error();
  }
  const { kind, password } = JSON.parse(input);
  input = '';
  const target = M0_DIRECT_TARGETS[kind];
  if (!target || typeof password !== 'string' || !password || password.length > 2048) throw new Error();
  const role = M0_PROBE_ROLES[kind];
  const connection = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
  connection.username = role;
  connection.password = password;
  const check = await probeDatabase({ GROUND_ENV: kind, GROUND_DATABASE_URL: connection.href,
    GROUND_DATABASE_HOST: target.host, GROUND_DATABASE_BRANCH_ID: target.branchId });
  result = { kind, role, branchId: target.branchId, ok: check.ok,
    checks: check.ok ? 'direct_login_metadata_identity_baseline_catalog' : 'failed' };
  if (check.ok && kind === 'recovery') {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(connection.href);
    const [rows] = await sql.transaction([sql.query(`SELECT
      has_table_privilege(current_user, 'recovery_control.events', 'SELECT') AS controls_read,
      NOT has_table_privilege(current_user, 'recovery_control.events', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS controls_no_write`)],
      { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(8000), cache: 'no-store' } });
    result.ok = rows?.length === 1 && rows[0].controls_read === true && rows[0].controls_no_write === true;
    result.checks = result.ok ? 'direct_login_metadata_identity_baseline_catalog_recovery_grants' : 'recovery_grants_failed';
  }
} catch {
  // Never print raw input, URLs, SQL, driver messages or stack traces.
  result = { ok: false, reason: 'input_or_connection_failed' };
} finally {
  input = '';
}
process.stdout.write(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
