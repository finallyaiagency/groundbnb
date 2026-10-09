import { neon } from '@neondatabase/serverless';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';

const MEMBERSHIP_PROBE_ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const UNMAPPED_SUBJECT = 'm1-q011-unmapped-subject-boundary-probe';

let input = '';
let phase = 'input';
let result = { ok: false, phase, category: 'input' };
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 4096) throw new Error();
  }
  const parsed = JSON.parse(input);
  input = '';
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.keys(parsed).length !== 2 || !Object.hasOwn(parsed, 'kind') || !Object.hasOwn(parsed, 'password')) throw new Error();
  const kind = parsed?.kind;
  let password = parsed?.password;
  parsed.password = '';
  const target = PROFILE_TARGETS[kind];
  const issuer = MEMBERSHIP_PROBE_ISSUERS[kind];
  if (!target || !issuer || typeof password !== 'string' || password.length < 1 || password.length > 2048) throw new Error();

  const url = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
  url.username = target.role;
  url.password = password;
  let connectionString = url.href;
  password = '';
  url.password = '';

  phase = 'connection';
  const sql = neon(connectionString);
  connectionString = '';
  const query = `SELECT e.kind,e.branch_id,current_database() AS database_name,current_user AS role_name,
    (SELECT count(*) FROM groundbnb.schema_migrations) AS receipt_count,
    (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(ARRAY[
      '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
      '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
      '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
      '0011_membership_reader','0012_factor_service'])) AS known_receipt_count,
    r.rolcanlogin AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR
      r.rolbypassrls OR r.rolinherit) AND r.rolconnlimit=4 AND
      (r.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS TRUE AND
      NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS attributes_safe,
    has_table_privilege(r.oid,'groundbnb.environment_identity','SELECT') AND
      has_table_privilege(r.oid,'groundbnb.schema_migrations','SELECT') AND
      NOT has_table_privilege(r.oid,'groundbnb.environment_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AND
      NOT has_table_privilege(r.oid,'groundbnb.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS metadata_select_only,
    NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE ((n.nspname='groundbnb' AND c.relkind IN ('r','p','v','m','f') AND
          c.relname NOT IN ('environment_identity','schema_migrations')) OR
        (n.nspname='neon_auth' AND c.relkind IN ('r','p','v','m','f')))
        AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
          has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') ELSE false END) AS private_tables_denied,
    NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='groundbnb' AND c.relkind='S' AND
        CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE false END) AS sequences_denied,
    has_function_privilege(r.oid,'groundbnb.read_profile(text,text)','EXECUTE') AND
      has_function_privilege(r.oid,'groundbnb.save_profile(text,text,uuid,bigint,jsonb)','EXECUTE') AND
      has_function_privilege(r.oid,'groundbnb.read_profile_operation(text,text,uuid)','EXECUTE') AND
      has_function_privilege(r.oid,'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') AND
      has_function_privilege(r.oid,'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)','EXECUTE') AND
      has_function_privilege(r.oid,'groundbnb.read_membership(text,text)','EXECUTE') AS six_functions_allowed,
    NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND has_function_privilege(r.oid,p.oid,'EXECUTE') AND p.oid NOT IN (
        to_regprocedure('groundbnb.read_profile(text,text)'),
        to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)'),
        to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)'),
        to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)'),
        to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)'),
        to_regprocedure('groundbnb.read_membership(text,text)'))) AS no_extra_functions,
    NOT has_database_privilege(r.oid,current_database(),'CREATE') AND
      NOT has_schema_privilege(r.oid,'groundbnb','CREATE') AS create_denied,
    groundbnb.read_membership($1,$2)=jsonb_build_object('ok',false,'category','auth') AS unmapped_subject_denied
    FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname=current_user WHERE e.singleton`;
  const [, rows] = await sql.transaction([
    sql.query('SET TRANSACTION READ WRITE'),
    sql.query(query, [issuer, UNMAPPED_SUBJECT]),
  ], {
    readOnly: false,
    fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' },
  });
  phase = 'catalog';
  const row = rows?.[0];
  const targetMatches = row?.kind === kind && row?.branch_id === target.branch &&
    row?.database_name === 'groundbnb' && row?.role_name === target.role;
  const exactReceipts = [row?.receipt_count, row?.known_receipt_count].every(value => value === 12 || value === '12');
  const checks = ['attributes_safe','metadata_select_only','private_tables_denied','sequences_denied',
    'six_functions_allowed','no_extra_functions','create_denied','unmapped_subject_denied'];
  const ok = rows?.length === 1 && targetMatches && exactReceipts && checks.every(key => row[key] === true);
  result = {
    ok,
    kind,
    branchId: target.branch,
    role: target.role,
    phase: ok ? 'complete' : 'catalog',
    category: ok ? undefined : 'boundary',
      checks: ok ? 'nonmutating_app_acl_catalog_membership_probe' : 'failed',
    failedChecks: ok ? [] : [
      ...(!targetMatches ? ['target_pin'] : []), ...(!exactReceipts ? ['receipt_count'] : []),
      ...checks.filter(key => row?.[key] !== true),
    ],
  };
} catch (error) {
  const category = phase === 'input' ? 'input' : error?.code === '28P01' ? 'auth' :
    error?.code === '25006' ? 'query' :
    error?.code === '42501' ? 'permission' : error?.code === '57014' || error?.name === 'TimeoutError' ? 'timeout' :
    error?.code?.startsWith('42') ? 'query' :
    ['ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(error?.cause?.code) ? 'network' : 'unknown';
  result = { ok: false, phase, category,
    sqlState: ['25006','42883','42703','42P01','42601','42702','42809','42704'].includes(error?.code) ? error.code : undefined };
} finally {
  input = '';
}
process.stdout.write(JSON.stringify(result));
process.exitCode = result.ok ? 0 : 1;
