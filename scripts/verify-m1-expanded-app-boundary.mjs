import { neon } from '@neondatabase/serverless';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { factorCredentialCatalogQuery } from '../lib/factor-credential-catalog.mjs';

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
const ENROLLMENT_FUNCTIONS = Object.freeze([
  'groundbnb.read_factor_enrollment_context(text,text,text,timestamptz)',
  'groundbnb.read_pending_factor_for_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,bigint)',
  'groundbnb.begin_factor_enrollment(text,text,text,timestamptz,uuid,bigint,bigint,uuid,uuid,bytea,text,jsonb)',
  'groundbnb.record_factor_enrollment_attempt(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,text)',
  'groundbnb.verify_factor_enrollment(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,bytea,bigint)',
  'groundbnb.read_factor_enrollment_receipt(text,text,text,timestamptz,uuid,text,uuid,uuid,bigint)',
  'groundbnb.record_factor_enrollment_material_release(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea)',
  'groundbnb.read_factor_enrollment_material_receipt(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid)',
]);
const SEED_TRIGGER_FUNCTION = "to_regprocedure('groundbnb.refuse_production_synthetic_seed()')";
const SAFE_ENROLLMENT_SQL_IDENTIFIERS = new Set([
  'check','isfinite','created_at','completed_at','operation_kind','any','array','text','status',
  'pending','rejected','verified','begin','verify','resume','released','begin_operation_id','is','not',
  'null','and','or','outcome','enrollment_material_released','rate_limited',
]);
const SAFE_ENROLLMENT_SQL_LITERALS = new Set([
  'pending','rejected','verified','begin','verify','resume','released','enrollment_material_released','rate_limited',
]);

function safeEnrollmentConstraintDefinition(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 800) return false;
  const token = /\s*('[^']*(?:''[^']*)*'|[A-Za-z_][A-Za-z0-9_]*|::|[()<>=,\[\]])/y;
  let offset = 0;
  while (offset < value.length) {
    token.lastIndex = offset;
    const match = token.exec(value);
    if (!match) return false;
    const part = match[1];
    if (part.startsWith("'")) {
      if (!SAFE_ENROLLMENT_SQL_LITERALS.has(part.slice(1, -1).replaceAll("''", "'"))) return false;
    } else if (/^[A-Za-z_]/.test(part) && !SAFE_ENROLLMENT_SQL_IDENTIFIERS.has(part.toLowerCase())) return false;
    offset = token.lastIndex;
  }
  return offset === value.length;
}

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
  const mode = parsed?.mode ?? 'verify';
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.keys(parsed).length !== (Object.hasOwn(parsed, 'mode') ? 4 : 3) ||
      !Object.hasOwn(parsed, 'kind') || !Object.hasOwn(parsed, 'password') || !Object.hasOwn(parsed, 'baseline') ||
      !['verify','constraint_metadata'].includes(mode) || (Object.hasOwn(parsed, 'mode') && typeof parsed.mode !== 'string')) throw new Error();
  const kind = parsed.kind;
  const baseline = parsed.baseline;
  let password = parsed.password;
  parsed.password = '';
  if (typeof kind !== 'string' || !Object.hasOwn(PROFILE_TARGETS, kind) ||
      !Object.hasOwn(MEMBERSHIP_PROBE_ISSUERS, kind) || !Object.hasOwn(FACTOR_ROLES, kind)) throw new Error();
  const target = PROFILE_TARGETS[kind];
  const issuer = MEMBERSHIP_PROBE_ISSUERS[kind];
  const factorRole = FACTOR_ROLES[kind];
  if (!target || !issuer || !factorRole || typeof password !== 'string' || password.length < 1 ||
      password.length > 2048 || !['12','13','14','15'].includes(baseline)) throw new Error();
  if (mode === 'constraint_metadata' && !['14','15'].includes(baseline)) throw new Error();

  const expectedReceipts = baseline === '15'
    ? [...RECEIPTS_12, '0013_factor_service_principal', '0014_factor_enrollment', '0015_factor_enrollment_resume']
    : baseline === '14' ? [...RECEIPTS_12, '0013_factor_service_principal', '0014_factor_enrollment']
      : baseline === '13' ? [...RECEIPTS_12, '0013_factor_service_principal'] : [...RECEIPTS_12];
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
  if (mode === 'constraint_metadata') {
    const constraintNames = baseline === '14'
      ? ['factor_enrollment_operations_check','factor_enrollment_operations_operation_kind_check',
        'factor_enrollment_operations_status_check','factor_enrollment_operations_check1']
      : ['factor_enrollment_operations_check','factor_enrollment_operations_resume_begin_check',
        'factor_enrollment_operations_operation_kind_check','factor_enrollment_operations_status_check',
        'factor_enrollment_operations_resume_check','privileged_factor_audit_resume_operation_check',
        'privileged_factor_audit_outcome_check'];
    const metadataQuery = `SELECT e.kind,e.branch_id,current_database() AS database_name,current_user AS role_name,
      (SELECT count(*) FROM groundbnb.schema_migrations) AS receipt_count,
      (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(${receiptArraySql})) AS known_receipt_count,
      n.nspname || '.' || rel.relname AS table_name,c.conname,c.contype,c.convalidated,
      pg_get_constraintdef(c.oid) AS definition
      FROM groundbnb.environment_identity e JOIN pg_constraint c ON
        (c.conrelid=to_regclass('groundbnb.factor_enrollment_operations') AND c.conname=ANY($1::text[])) OR
        (c.conrelid=to_regclass('groundbnb.privileged_factor_audit') AND c.conname=ANY($1::text[]))
      JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_namespace n ON n.oid=rel.relnamespace
      WHERE e.singleton ORDER BY table_name,c.conname`;
    phase = 'schema_metadata';
    const [, rows] = await sql.transaction([
      sql.query('SET TRANSACTION READ ONLY'),
      sql.query(metadataQuery, [constraintNames]),
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' } });
    phase = 'factor_catalog';
    const [, factorCatalogRows] = await sql.transaction([
      sql.query('SET TRANSACTION READ ONLY'),
      sql.query(factorCredentialCatalogQuery(false), [factorRole]),
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' } });
    const expectedCount = Number(baseline);
    const exactReceipts = rows?.length === constraintNames.length && rows.every(row =>
      (row.receipt_count === expectedCount || row.receipt_count === String(expectedCount)) &&
      (row.known_receipt_count === expectedCount || row.known_receipt_count === String(expectedCount)));
    const definitions = rows?.map(row => ({ table: row.table_name, name: row.conname, definition: row.definition }));
    const safeDefinitions = rows?.length === constraintNames.length && rows.every(row =>
      (row.table_name === 'groundbnb.factor_enrollment_operations' || row.table_name === 'groundbnb.privileged_factor_audit') &&
      constraintNames.includes(row.conname) && row.contype === 'c' && row.convalidated === true &&
      safeEnrollmentConstraintDefinition(row.definition));
    const targetMatches = rows?.length === constraintNames.length && rows.every(row =>
      row.kind === kind && row.branch_id === target.branch && row.database_name === 'groundbnb' && row.role_name === target.role);
    const exactNames = rows?.length === constraintNames.length &&
      new Set(rows.map(row => row.conname)).size === constraintNames.length &&
      constraintNames.every(name => rows.some(row => row.conname === name));
    const factorCatalog = factorCatalogRows?.[0];
    const factorCatalogSafe = factorCatalogRows?.length === 1 &&
      factorCatalog?.database_name === 'groundbnb' && factorCatalog?.connected_role === target.role &&
      factorCatalog?.role_name === factorRole && factorCatalog?.role_attributes_safe === true &&
      factorCatalog?.creator_membership_exact === true && factorCatalog?.database_schema_boundary === true &&
      factorCatalog?.effective_function_set_exact === true && factorCatalog?.function_acl_exact === true &&
      factorCatalog?.synthetic_seed_trigger_exact === true && factorCatalog?.no_direct_table_privileges === true &&
      factorCatalog?.no_sequence_privileges === true;
    const metadataReady = Boolean(exactReceipts && safeDefinitions && targetMatches && exactNames && factorCatalogSafe);
    result = {
      ok: metadataReady,
      mode,
      kind,
      baseline,
      database: 'groundbnb',
      branchId: target.branch,
      role: target.role,
      receiptCount: expectedCount,
      phase: metadataReady ? 'complete' : 'catalog',
      category: metadataReady ? undefined : 'boundary',
      metadataReadOnly: true,
      metadataObservationOnly: true,
      checks: 'constraint_catalog_metadata_only',
      factorCatalog: metadataReady ? {
        roleName: factorCatalog.role_name,
        connectedRole: factorCatalog.connected_role,
        roleAttributesSafe: factorCatalog.role_attributes_safe,
        creatorMembershipExact: factorCatalog.creator_membership_exact,
        databaseSchemaBoundary: factorCatalog.database_schema_boundary,
        effectiveFunctionSetExact: factorCatalog.effective_function_set_exact,
        functionAclExact: factorCatalog.function_acl_exact,
        syntheticSeedTriggerExact: factorCatalog.synthetic_seed_trigger_exact,
        noDirectTablePrivileges: factorCatalog.no_direct_table_privileges,
        noSequencePrivileges: factorCatalog.no_sequence_privileges,
      } : undefined,
      definitions: metadataReady ? definitions : [],
    };
  } else {
  const normalizedConstraintDef = "lower(regexp_replace(pg_get_constraintdef(c.oid),'[[:space:]]+','','g'))";
  const query = `SELECT e.kind,e.branch_id,current_database() AS database_name,current_user AS role_name,
    (SELECT count(*) FROM groundbnb.schema_migrations) AS receipt_count,
    (SELECT count(*) FROM groundbnb.schema_migrations WHERE version=ANY(${receiptArraySql})) AS known_receipt_count,
    (SELECT count(*) FROM groundbnb.schema_migrations WHERE version='0013_factor_service_principal') AS factor_receipt_count,
    r.rolcanlogin AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR
      r.rolbypassrls OR r.rolinherit) AND r.rolconnlimit=4 AND
      (r.rolconfig @> ARRAY['default_transaction_read_only=on','statement_timeout=5s']) IS TRUE AND
      NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS attributes_safe,
    (SELECT count(*) FROM pg_auth_members m WHERE m.roleid=r.oid)=1 AND
      EXISTS(SELECT 1 FROM pg_auth_members m
        JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
        JOIN pg_roles grantor_role ON grantor_role.rolname='cloud_admin'
        WHERE m.member=owner_role.oid AND m.roleid=r.oid AND m.grantor=grantor_role.oid AND
          m.admin_option IS TRUE AND m.inherit_option IS FALSE AND m.set_option IS FALSE)
      AS ordinary_app_creator_membership_exact,
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
      WHERE n.nspname='groundbnb' AND has_function_privilege(r.oid,p.oid,'EXECUTE') AND p.oid NOT IN (
        to_regprocedure('groundbnb.read_profile(text,text)'),
        to_regprocedure('groundbnb.save_profile(text,text,uuid,bigint,jsonb)'),
        to_regprocedure('groundbnb.read_profile_operation(text,text,uuid)'),
        to_regprocedure('groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)'),
        to_regprocedure('groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)'),
        to_regprocedure('groundbnb.read_membership(text,text)'),${SEED_TRIGGER_FUNCTION})) AS no_extra_functions,
    EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_language l ON l.oid=p.prolang JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
      WHERE p.oid=${SEED_TRIGGER_FUNCTION} AND n.nspname='groundbnb' AND p.prorettype='trigger'::regtype AND
        l.lanname='plpgsql' AND p.proowner=owner_role.oid AND p.prosecdef IS FALSE AND p.proconfig IS NULL AND
        (SELECT count(*)=1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          JOIN pg_namespace tn ON tn.oid=c.relnamespace WHERE tn.nspname='groundbnb' AND
            c.relname='synthetic_identities' AND NOT t.tgisinternal) AND
        EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          JOIN pg_namespace tn ON tn.oid=c.relnamespace WHERE tn.nspname='groundbnb' AND
            c.relname='synthetic_identities' AND t.tgname='synthetic_seed_guard' AND
            t.tgfoid=p.oid AND t.tgtype=23 AND t.tgenabled='O') AND
        EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE' AND NOT acl.is_grantable) AND
        NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
          WHERE (acl.grantee<>0 AND acl.grantee<>p.proowner) OR acl.privilege_type<>'EXECUTE' OR
            (acl.grantee=0 AND acl.is_grantable)) AND
        NOT EXISTS(SELECT 1 FROM pg_proc other JOIN pg_namespace onamespace ON onamespace.oid=other.pronamespace
          WHERE onamespace.nspname='groundbnb' AND other.prorettype='trigger'::regtype AND other.oid<>p.oid AND
            has_function_privilege(r.oid,other.oid,'EXECUTE'))) AS synthetic_seed_trigger_exact,
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
      NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=f.oid) AND
      (SELECT count(*) FROM pg_auth_members m WHERE m.roleid=f.oid)=1 AND
      EXISTS(SELECT 1 FROM pg_auth_members m
        JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
        JOIN pg_roles grantor_role ON grantor_role.rolname='cloud_admin'
        WHERE m.member=owner_role.oid AND m.roleid=f.oid AND m.grantor=grantor_role.oid AND
          m.admin_option IS TRUE AND m.inherit_option IS FALSE AND m.set_option IS FALSE)) AS factor_creator_membership_exact,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND
      ${FACTOR_FUNCTIONS.map(signature => `has_function_privilege(f.oid,'${signature}','EXECUTE')`).join(' AND ')} AND
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='groundbnb' AND has_function_privilege(f.oid,p.oid,'EXECUTE') AND
          p.oid<>${SEED_TRIGGER_FUNCTION})=5 AND
      (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=f.oid)=5 AND
      NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=f.oid AND
          (acl.privilege_type<>'EXECUTE' OR acl.is_grantable OR p.oid NOT IN (
            ${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')})))) AS factor_five_functions,
    EXISTS(SELECT 1 FROM pg_roles f WHERE f.rolname=$3 AND NOT EXISTS(
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='groundbnb' AND has_function_privilege(f.oid,p.oid,'EXECUTE') AND p.oid NOT IN (
        ${FACTOR_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')},${SEED_TRIGGER_FUNCTION}))) AS factor_no_extra_functions,
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
    ,CASE WHEN $4 IN ('14','15') THEN
      (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
        AND c.contype='c' AND c.conname='factor_enrollment_operations_check' AND c.convalidated AND
        ${normalizedConstraintDef}='check((isfinite(created_at)andisfinite(completed_at)and(completed_at>=created_at)))') AND
      CASE WHEN $4='14' THEN
        (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
          AND c.contype='c' AND c.conname='factor_enrollment_operations_operation_kind_check' AND c.convalidated AND
          ${normalizedConstraintDef}='check((operation_kind=any(array[''begin''::text,''verify''::text])))') AND
        (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
          AND c.contype='c' AND c.conname='factor_enrollment_operations_status_check' AND c.convalidated AND
          ${normalizedConstraintDef}='check((status=any(array[''pending''::text,''rejected''::text,''verified''::text])))') AND
        (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
          AND c.contype='c' AND c.conname='factor_enrollment_operations_check1' AND c.convalidated AND
          ${normalizedConstraintDef}='check((((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))))')
      ELSE
        (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
          AND c.contype='c' AND c.conname='factor_enrollment_operations_resume_check' AND c.convalidated AND
          ${normalizedConstraintDef}='check(((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))or((operation_kind=''resume''::text)and(status=any(array[''rejected''::text,''released''::text]))))')
      END
      ELSE true END AS enrollment_base_constraints,
    CASE WHEN $4='15' THEN
      (SELECT count(*)=8 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='groundbnb' AND p.oid IN (${ENROLLMENT_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')})) AND
      NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='groundbnb' AND p.oid IN (${ENROLLMENT_FUNCTIONS.map(signature => `to_regprocedure('${signature}')`).join(',')}) AND
          (p.proowner<>(SELECT oid FROM pg_roles WHERE rolname='neondb_owner') OR p.prosecdef IS DISTINCT FROM true OR
           p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] OR
           has_function_privilege(r.oid,p.oid,'EXECUTE') OR has_function_privilege((SELECT oid FROM pg_roles WHERE rolname=$3),p.oid,'EXECUTE') OR
           EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
             WHERE acl.grantee=0 OR acl.grantee<>p.proowner OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable)))
      ELSE true END AS enrollment_functions_private,
    CASE WHEN $4='15' THEN
      (SELECT count(*)=9 FROM pg_constraint c WHERE
        (c.conrelid=to_regclass('groundbnb.factor_enrollment_operations') AND c.conname IN (
          'factor_enrollment_operations_begin_operation_fk','factor_enrollment_operations_resume_begin_check',
          'factor_enrollment_operations_operation_begin_key','factor_enrollment_operations_operation_kind_check',
          'factor_enrollment_operations_status_check','factor_enrollment_operations_resume_check')) OR
        (c.conrelid='groundbnb.privileged_factor_audit'::regclass AND c.conname IN (
          'privileged_factor_audit_resume_operation_fk','privileged_factor_audit_resume_operation_check',
          'privileged_factor_audit_outcome_check'))) AND
      NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE
        ((c.conrelid=to_regclass('groundbnb.factor_enrollment_operations') AND c.conname IN (
          'factor_enrollment_operations_begin_operation_fk','factor_enrollment_operations_resume_begin_check',
          'factor_enrollment_operations_operation_begin_key','factor_enrollment_operations_operation_kind_check',
          'factor_enrollment_operations_status_check','factor_enrollment_operations_resume_check')) OR
         (c.conrelid='groundbnb.privileged_factor_audit'::regclass AND c.conname IN (
          'privileged_factor_audit_resume_operation_fk','privileged_factor_audit_resume_operation_check',
          'privileged_factor_audit_outcome_check'))) AND
        (NOT c.convalidated OR
         (c.conname IN ('factor_enrollment_operations_begin_operation_fk','privileged_factor_audit_resume_operation_fk') AND c.contype<>'f') OR
         (c.conname='factor_enrollment_operations_operation_begin_key' AND c.contype<>'u') OR
         (c.contype='c' AND (
          (c.conname='factor_enrollment_operations_resume_begin_check' AND
            ${normalizedConstraintDef}<>'check(((operation_kind=''resume''::text)and(begin_operation_idisnotnull))or((operation_kind=any(array[''begin''::text,''verify''::text]))and(begin_operation_idisnull)))') OR
          (c.conname='factor_enrollment_operations_operation_kind_check' AND
            ${normalizedConstraintDef}<>'check((operation_kind=any(array[''begin''::text,''verify''::text,''resume''::text])))') OR
          (c.conname='factor_enrollment_operations_status_check' AND
            ${normalizedConstraintDef}<>'check((status=any(array[''pending''::text,''rejected''::text,''verified''::text,''released''::text])))') OR
          (c.conname='factor_enrollment_operations_resume_check' AND
            ${normalizedConstraintDef}<>'check(((operation_kind=''begin''::text)and(status=''pending''::text))or((operation_kind=''verify''::text)and(status=any(array[''rejected''::text,''verified''::text])))or((operation_kind=''resume''::text)and(status=any(array[''rejected''::text,''released''::text]))))') OR
          (c.conname='privileged_factor_audit_resume_operation_check' AND
            ${normalizedConstraintDef}<>'check(((resume_operation_idisnull)and(begin_operation_idisnull)and(outcome<>''enrollment_material_released''::text))or((resume_operation_idisnotnull)and(begin_operation_idisnotnull)and(outcome=any(array[''enrollment_material_released''::text,''rate_limited''::text]))))') OR
           (c.conname='privileged_factor_audit_outcome_check' AND
             ${normalizedConstraintDef}<>'check((outcome=any(array[''challenge_accepted''::text,''challenge_rejected''::text,''recovery_consumed''::text,''enrollment_started''::text,''enrollment_verified''::text,''enrollment_material_released''::text,''factor_revoked''::text,''factor_reset''::text,''rate_limited''::text,''attestation_revoked''::text])))'))))) OR
      NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
        AND c.conname='factor_enrollment_operations_begin_operation_fk' AND c.contype='f' AND c.convalidated AND
        c.confrelid=to_regclass('groundbnb.factor_enrollment_operations') AND c.confdeltype='r' AND
        c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='begin_operation_id' AND NOT attisdropped)]::smallint[] AND
        c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='operation_id' AND NOT attisdropped)]::smallint[]) OR
      NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass('groundbnb.factor_enrollment_operations')
        AND c.conname='factor_enrollment_operations_operation_begin_key' AND c.contype='u' AND c.convalidated AND
        c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='operation_id' AND NOT attisdropped),
                       (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='begin_operation_id' AND NOT attisdropped)]::smallint[]) OR
      NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='groundbnb.privileged_factor_audit'::regclass
        AND c.conname='privileged_factor_audit_resume_operation_fk' AND c.contype='f' AND c.convalidated AND
        c.confrelid=to_regclass('groundbnb.factor_enrollment_operations') AND c.confdeltype='r' AND
        c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='resume_operation_id' AND NOT attisdropped),
                       (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='begin_operation_id' AND NOT attisdropped)]::smallint[] AND
        c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='operation_id' AND NOT attisdropped),
                        (SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='begin_operation_id' AND NOT attisdropped)]::smallint[]) OR
      NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_roles owner_role ON owner_role.rolname='neondb_owner'
        WHERE c.oid=to_regclass('groundbnb.factor_enrollment_operations') AND n.nspname='groundbnb' AND
          c.relrowsecurity IS TRUE AND c.relforcerowsecurity IS FALSE AND
          NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl
            WHERE acl.grantee=0 OR acl.grantee<>owner_role.oid OR acl.is_grantable))
      ELSE true END AS enrollment_resume_constraints
    FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname=current_user WHERE e.singleton`;
  const transactionQueries = [
    sql.query('SET TRANSACTION READ WRITE'),
    sql.query(query, [issuer, UNMAPPED_SUBJECT, factorRole, baseline]),
  ];
  if (baseline !== '12') transactionQueries.push(sql.query(factorCredentialCatalogQuery(false), [factorRole]));
  const transactionResults = await sql.transaction(transactionQueries, {
    readOnly: false,
    fetchOptions: { signal: AbortSignal.timeout(10000), cache: 'no-store' },
  });
  const rows = transactionResults?.[1];
  const factorCatalogRows = transactionResults?.[2];
  phase = 'catalog';
  const row = rows?.[0];
  const targetMatches = row?.kind === kind && row?.branch_id === target.branch &&
    row?.database_name === 'groundbnb' && row?.role_name === target.role;
  const expectedReceiptCount = Number(baseline);
  const exactReceipts = [row?.receipt_count, row?.known_receipt_count].every(value =>
    value === expectedReceiptCount || value === String(expectedReceiptCount));
  const commonChecks = ['attributes_safe','ordinary_app_creator_membership_exact','metadata_select_only','private_tables_denied','sequences_denied',
    'six_functions_allowed','no_extra_functions','synthetic_seed_trigger_exact','create_denied','unmapped_subject_denied'];
  const factorChecks = baseline !== '12'
    ? ['factor_receipt','factor_principal_present','factor_principal_attributes','factor_creator_membership_exact','factor_five_functions',
      'factor_no_extra_functions','factor_no_data_privileges']
    : ['factor_principal_absent'];
  const factorStateMatches = baseline !== '12'
    ? row?.factor_receipt === true && (row?.factor_receipt_count === 1 || row?.factor_receipt_count === '1')
    : row?.factor_receipt === false && (row?.factor_receipt_count === 0 || row?.factor_receipt_count === '0');
  const factorCatalog = factorCatalogRows?.[0];
  const factorCatalogMatches = baseline === '12' || (factorCatalogRows?.length === 1 &&
    factorCatalog?.database_name === 'groundbnb' && factorCatalog?.connected_role === target.role &&
    factorCatalog?.role_name === factorRole && factorCatalog?.role_attributes_safe === true &&
    factorCatalog?.creator_membership_exact === true && factorCatalog?.database_schema_boundary === true &&
    factorCatalog?.effective_function_set_exact === true && factorCatalog?.function_acl_exact === true &&
    factorCatalog?.synthetic_seed_trigger_exact === true && factorCatalog?.no_direct_table_privileges === true &&
    factorCatalog?.no_sequence_privileges === true);
  const enrollmentChecks = baseline === '15'
    ? ['enrollment_base_constraints','enrollment_functions_private','enrollment_resume_constraints']
    : baseline === '14' ? ['enrollment_base_constraints'] : [];
  const checks = [...commonChecks, ...factorChecks, ...enrollmentChecks];
  const ok = rows?.length === 1 && targetMatches && exactReceipts && factorStateMatches &&
    factorCatalogMatches && checks.every(key => row[key] === true);
  result = {
    ok,
      mode,
    kind,
    baseline,
    branchId: target.branch,
    role: target.role,
    phase: ok ? 'complete' : 'catalog',
    category: ok ? undefined : 'boundary',
    checks: ok ? 'nonmutating_app_acl_catalog_membership_probe' : 'failed',
    failedChecks: ok ? [] : [
      ...(!targetMatches ? ['target_pin'] : []), ...(!exactReceipts || !factorStateMatches ? ['receipt_count'] : []),
      ...(!factorCatalogMatches ? ['factor_catalog'] : []),
      ...checks.filter(key => row?.[key] !== true),
    ],
  };
  }
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
