import { neon } from '@neondatabase/serverless';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';

const MEMBERSHIP_PROBE_ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const FACTOR_ROLES = Object.freeze({
  local: 'groundbnb_local_factor_service',
  preview: 'groundbnb_preview_factor_service',
});
const RECEIPTS_12 = Object.freeze([
  '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
  '0005_profile_records','0006_profile_transfer','0007_membership_foundation',
  '0008_provider_reservations','0009_privileged_factors','0010_factor_recovery_activity',
  '0011_membership_reader','0012_factor_service',
]);
const UNMAPPED_SUBJECT = 'm1-q011-unmapped-subject-boundary-probe';
const FACTOR_FUNCTIONS = Object.freeze([
  'groundbnb.read_factor_challenge_state(text,text,text,timestamptz)',
  'groundbnb.record_factor_challenge_attempt(text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer)',
  'groundbnb.consume_factor_totp_candidate(text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer)',
  'groundbnb.consume_factor_recovery_candidate(text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer)',
  'groundbnb.read_factor_operation_receipt(text,text,text,timestamptz,uuid,text)',
]);

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
      Object.keys(parsed).length !== 3 || !Object.hasOwn(parsed, 'kind') ||
      !Object.hasOwn(parsed, 'password') || !Object.hasOwn(parsed, 'baseline')) throw new Error();
  const kind = parsed.kind;
  const baseline = parsed.baseline;
  let password = parsed.password;
  parsed.password = '';
  const target = PROFILE_TARGETS[kind];
  const issuer = MEMBERSHIP_PROBE_ISSUERS[kind];
  const factorRole = FACTOR_ROLES[kind];
  if (!target || !issuer || !factorRole || typeof password !== 'string' || password.length < 1 ||
      password.length > 2048 || !['12','13'].includes(baseline)) throw new Error();

  const expectedReceipts = baseline === '13' ? [...RECEIPTS_12, '0013_factor_service_principal'] : [...RECEIPTS_12];
  const receiptArraySql = `ARRAY[${expectedReceipts.map(version => `'${version}'`).join(',')}]::text[]`;
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
    (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(${receiptArraySql})) AS known_receipt_count,
    (SELECT count(*) FROM groundbnb.schema_migrations WHERE version='0013_factor_service_principal') AS factor_receipt_count,
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
    groundbnb.read_membership($1,$2)=jsonb_build_object('ok',false,'category','auth') AS unmapped_subject_denied,
    EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0013_factor_service_principal') AS factor_receipt,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$3) AS factor_principal_present,
    NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$3) AS factor_principal_absent,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND f.rolcanlogin IS FALSE AND
      NOT (f.rolsuper OR f.rolcreatedb OR f.rolcreaterole OR f.rolreplication OR f.rolbypassrls OR f.rolinherit) AND
      f.rolconnlimit=2 AND f.rolconfig IS NULL AND
      has_database_privilege(f.oid,current_database(),'CONNECT') AND
      NOT has_database_privilege(f.oid,current_database(),'CREATE') AND
      has_schema_privilege(f.oid,'groundbnb','USAGE') AND NOT has_schema_privilege(f.oid,'groundbnb','CREATE')) AS factor_principal_attributes,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND
      NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=f.oid OR m.roleid=f.oid)) AS factor_principal_unmembered,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND
      ${FACTOR_FUNCTIONS.map(signature => `has_function_privilege(f.oid,'${signature}','EXECUTE')`).join(' AND ')} AND
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
          AND has_function_privilege(f.oid,p.oid,'EXECUTE'))=5 AND
      (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=f.oid)=5 AND
      NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=f.oid AND
          (acl.privilege_type<>'EXECUTE' OR acl.is_grantable OR p.oid NOT IN (
            ${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')})))) AS factor_five_functions,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND NOT EXISTS(
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND has_function_privilege(f.oid,p.oid,'EXECUTE') AND p.oid NOT IN (
        ${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')}))) AS factor_no_extra_functions,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND
      NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('groundbnb','neon_auth') AND c.relkind IN ('r','p','v','m','f','S') AND
          CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
            has_table_privilege(f.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          ELSE has_sequence_privilege(f.oid,c.oid,'USAGE,SELECT,UPDATE') END) AND
      NOT has_function_privilege(f.oid,'groundbnb._factor_lock_identity(text,text,text,timestamptz,boolean)','EXECUTE') AND
      NOT has_function_privilege(f.oid,'groundbnb._factor_bucket_fingerprint()','EXECUTE') AND
      NOT has_function_privilege(f.oid,'groundbnb._guard_factor_challenge_operation()','EXECUTE') AND
      NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=f.oid AND
          NOT (p.oid IN (${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')}))) AND
      NOT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
        aclexplode(COALESCE(c.relacl,acldefault((CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END)::"char",c.relowner))) acl
        WHERE acl.grantee=f.oid) AND
      NOT EXISTS(SELECT 1 FROM pg_namespace s CROSS JOIN LATERAL
        aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl WHERE acl.grantee=f.oid AND
          (s.nspname<>'groundbnb' OR acl.privilege_type<>'USAGE' OR acl.is_grantable)) AND
      (SELECT count(*) FROM pg_namespace s CROSS JOIN LATERAL
        aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) acl
        WHERE s.nspname='groundbnb' AND acl.grantee=f.oid)=1 AND
      NOT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL
        aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
        WHERE d.datname=current_database() AND acl.grantee=f.oid AND
          (acl.privilege_type<>'CONNECT' OR acl.is_grantable)) AND
      (SELECT count(*) FROM pg_database d CROSS JOIN LATERAL
        aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) acl
        WHERE d.datname=current_database() AND acl.grantee=f.oid)=1) AS factor_no_data_privileges
    FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname=current_user WHERE e.singleton`;
  const [, rows] = await sql.transaction([
    sql.query('SET TRANSACTION READ WRITE'),
    sql.query(query, [issuer, UNMAPPED_SUBJECT, factorRole]),
  ], {
    readOnly: false,
    fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' },
  });
  phase = 'catalog';
  const row = rows?.[0];
  const targetMatches = row?.kind === kind && row?.branch_id === target.branch &&
    row?.database_name === 'groundbnb' && row?.role_name === target.role;
  const expectedReceiptCount = baseline === '13' ? 13 : 12;
  const exactReceipts = [row?.receipt_count, row?.known_receipt_count].every(value =>
    value === expectedReceiptCount || value === String(expectedReceiptCount));
  const commonChecks = ['attributes_safe','metadata_select_only','private_tables_denied','sequences_denied',
    'six_functions_allowed','no_extra_functions','create_denied','unmapped_subject_denied'];
  const factorChecks = baseline === '13'
    ? ['factor_receipt','factor_principal_present','factor_principal_attributes','factor_principal_unmembered','factor_five_functions',
      'factor_no_extra_functions','factor_no_data_privileges']
    : ['factor_principal_absent'];
  const factorStateMatches = baseline === '13'
    ? row?.factor_receipt === true && (row?.factor_receipt_count === 1 || row?.factor_receipt_count === '1')
    : row?.factor_receipt === false && (row?.factor_receipt_count === 0 || row?.factor_receipt_count === '0');
  const checks = [...commonChecks, ...factorChecks];
  const ok = rows?.length === 1 && targetMatches && exactReceipts && factorStateMatches &&
    checks.every(key => row[key] === true);
  result = {
    ok,
    kind,
    baseline,
    branchId: target.branch,
    role: target.role,
    phase: ok ? 'complete' : 'catalog',
    category: ok ? undefined : 'boundary',
    checks: ok ? 'nonmutating_app_acl_catalog_membership_probe' : 'failed',
    failedChecks: ok ? [] : [
      ...(!targetMatches ? ['target_pin'] : []), ...(!exactReceipts || !factorStateMatches ? ['receipt_count'] : []),
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
