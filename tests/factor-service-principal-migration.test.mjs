import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0013_factor_service_principal.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0013_factor_service_principal_down.sql', import.meta.url), 'utf8');
const factor12 = readFileSync(new URL('../db/migrations/0012_factor_service.sql', import.meta.url), 'utf8');
const profile2 = readFileSync(new URL('../db/migrations/0002_profile_foundation.sql', import.meta.url), 'utf8');
const operatorCheck = readFileSync(new URL('../db/operations/verify-m1-factor-principal.sql', import.meta.url), 'utf8');

const factorFunctions = [
  ['read_factor_challenge_state', 'text,text,text,timestamptz'],
  ['record_factor_challenge_attempt', 'text,text,text,timestamptz,uuid,bigint,uuid,text,text,integer,integer'],
  ['consume_factor_totp_candidate', 'text,text,text,timestamptz,uuid,bigint,bigint,uuid,integer,integer'],
  ['consume_factor_recovery_candidate', 'text,text,text,timestamptz,uuid,bigint,uuid,uuid,integer,integer'],
  ['read_factor_operation_receipt', 'text,text,text,timestamptz,uuid,text'],
];
const appFunctions = [
  'groundbnb.read_membership(text,text)',
  'groundbnb.read_profile(text,text)',
  'groundbnb.read_profile_operation(text,text,uuid)',
  'groundbnb.save_profile(text,text,uuid,bigint,jsonb)',
  'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
  'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)',
];

test('0013 pins the exact pinned branches, verified fixture, and full 0001–0012 receipt baseline', () => {
  for (const sql of [up, down]) {
    assert.match(sql, /current_database\(\) IS DISTINCT FROM 'groundbnb'/);
    assert.match(sql, /session_user IS DISTINCT FROM 'neondb_owner'/);
    assert.match(sql, /current_user IS DISTINCT FROM 'neondb_owner'/);
    assert.match(sql, /br-rough-flower-b8lerkcf/);
    assert.match(sql, /br-bitter-hall-b8ibnrfy/);
    assert.match(sql, /groundbnb_local_app/);
    assert.match(sql, /groundbnb_preview_app/);
    assert.match(sql, /groundbnb_local_factor_service/);
    assert.match(sql, /groundbnb_preview_factor_service/);
    assert.match(sql, /email=e\.kind \|\| '-01@example\.test'/);
    assert.match(sql, /"emailVerified"=true/);
    assert.match(sql, /receipt_count IS DISTINCT FROM 12|receipt_count IS DISTINCT FROM 13/);
    for (const receipt of [
      '0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors', '0010_factor_recovery_activity',
      '0011_membership_reader', '0012_factor_service',
    ]) assert.ok(sql.includes(`'${receipt}'`), `missing receipt ${receipt}`);
  }
  assert.match(up, /exact pinned local\/preview 0001-0012 baseline/);
  assert.match(down, /exact pinned local\/preview 0001-0013 baseline/);
  assert.match(up, /VALUES\('0013_factor_service_principal'\)/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0013_factor_service_principal'/);
});

test('only the exact _factor_lock_identity caller pin is extended', () => {
  assert.match(factor12, /session_user NOT IN \(expected_role,'neondb_owner'\)/);
  assert.match(up, /expected_factor_role:=CASE[\s\S]*groundbnb_local_factor_service[\s\S]*groundbnb_preview_factor_service/);
  assert.match(up, /session_user NOT IN \(expected_role,expected_factor_role,'neondb_owner'\)/);
  assert.match(down, /session_user NOT IN \(expected_role,'neondb_owner'\)/);
  for (const sql of [up, down]) {
    assert.match(sql, /CREATE OR REPLACE FUNCTION groundbnb\._factor_lock_identity/);
    assert.match(sql, /SECURITY DEFINER SET search_path=pg_catalog,pg_temp/);
    assert.match(sql, /p_issuer IS DISTINCT FROM expected_issuer/);
    assert.match(sql, /s\.id=p_session_id::uuid AND s\."userId"=p_subject::uuid/);
    assert.match(sql, /FOR UPDATE OF s/);
    assert.match(sql, /i\.issuer=p_issuer AND i\.subject=p_subject AND i\.revoked_at IS NULL/);
    assert.match(sql, /a\.status='active'/);
    assert.match(sql, /a\.role IN \('owner','admin'\)/);
    assert.doesNotMatch(sql, /s\.token|SELECT\s+[^;]*token/i);
    assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION groundbnb\._profile_account/);
  }
  assert.match(profile2, /session_user NOT IN \(role_pin,'neondb_owner'\)/);
  assert.doesNotMatch(up, /_profile_account\([^)]*factor_role/);
});

test('creates only the pinned passwordless NOLOGIN factor capability role', () => {
  assert.match(up, /CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2/);
  assert.match(up, /rolcanlogin OR role_record\.rolsuper OR role_record\.rolcreatedb OR role_record\.rolcreaterole/);
  assert.match(up, /role_record\.rolreplication OR role_record\.rolbypassrls OR role_record\.rolinherit/);
  assert.match(up, /role_record\.rolconnlimit IS DISTINCT FROM 2/);
  assert.match(up, /role_record\.rolconfig IS NOT NULL/);
  assert.match(up, /WHERE member=role_record\.oid OR roleid=role_record\.oid/);
  assert.match(up, /CREATE ROLE %I[\s\S]*?GRANT CONNECT ON DATABASE groundbnb TO %I/);
  assert.match(up, /GRANT USAGE ON SCHEMA groundbnb TO %I/);
  assert.match(up, /GRANT EXECUTE ON FUNCTION[\s\S]*?read_factor_operation_receipt\(text,text,text,timestamptz,uuid,text\) TO %I/);
  assert.doesNotMatch(up, /(?:GRANT|ALTER ROLE)\s+(?:ALL|\w+)\s+TO\s+groundbnb_(?:local|preview)_app/i);
  assert.doesNotMatch(up, /\bPASSWORD\s+|CREATE ROLE groundbnb_(?:local|preview)_app/i);
  assert.match(up, /CREATE ROLE %I NOLOGIN/);
});

test('app ACL is exact six and factor role gets exactly five callable functions', () => {
  assert.match(up, /callable_functions IS DISTINCT FROM ARRAY\[/);
  for (const functionName of appFunctions) assert.ok(up.includes(`'${functionName}'`), `missing ${functionName}`);
  assert.match(up, /has_function_privilege\(app_oid,helper_oid,'EXECUTE'\)/);
  assert.match(up, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(up, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN/);
  assert.match(up, /CASE WHEN c\.relkind='S' THEN/);
  assert.match(up, /has_database_privilege\(app_oid,current_database\(\),'CREATE'\)/);
  assert.match(up, /has_schema_privilege\(app_oid,'groundbnb','CREATE'\)/);
  assert.match(up, /has_table_privilege\(app_oid,'groundbnb\.environment_identity','SELECT'\) IS DISTINCT FROM true/);
  assert.match(up, /has_table_privilege\(app_oid,'groundbnb\.schema_migrations','SELECT'\) IS DISTINCT FROM true/);
  for (const [name, args] of factorFunctions) {
    const signature = `groundbnb.${name}(${args})`;
    assert.ok(up.includes(signature), `missing exact factor signature ${signature}`);
    assert.match(up, new RegExp(`p\\.proname='${name}' AND p\\.proargtypes=`));
  }
  assert.match(up, /has_function_privilege\(role_record\.oid,p\.oid,'EXECUTE'\)/);
  assert.match(up, /IS DISTINCT FROM 5/);
  assert.match(up, /has_table_privilege\(role_record\.oid/);
  assert.match(up, /has_sequence_privilege\(role_record\.oid/);
  assert.match(up, /has_schema_privilege\(role_record\.oid,'groundbnb','CREATE'\)/);
  assert.match(up, /acl\.grantee=0/);
  assert.match(up, /acl\.is_grantable/);
});

test('forward migration preserves private helper ACL and replaces only its caller predicate', () => {
  assert.match(up, /helper_owner IS DISTINCT FROM owner_oid/);
  assert.match(up, /helper_config IS DISTINCT FROM ARRAY\['search_path=pg_catalog, pg_temp'\]::text\[\]/);
  assert.match(up, /helper_acl/);
  assert.match(up, /helper_acl,[\s\S]*?acl\.grantee=0/);
  assert.match(up, /Factor identity helper security or app ACL changed/);
  assert.match(up, /EXECUTE \$ddl\$CREATE OR REPLACE FUNCTION groundbnb\._factor_lock_identity/);
  assert.doesNotMatch(up, /REVOKE ALL ON FUNCTION groundbnb\._factor_lock_identity/);
  assert.match(up, /CREATE ROLE %I NOLOGIN/);
  assert.match(up, /INSERT INTO groundbnb\.schema_migrations/);
});

test('rollback refuses activation, membership, and any factor history before revoking exact grants', () => {
  assert.match(down, /role_record\.rolcanlogin IS DISTINCT FROM false/);
  assert.match(down, /app_record\.rolcanlogin IS DISTINCT FROM true/);
  assert.match(down, /app_record\.rolconfig @> ARRAY\['default_transaction_read_only=on','statement_timeout=5s'\]/);
  assert.match(down, /WHERE member=role_record\.oid OR roleid=role_record\.oid/);
  for (const table of [
    'factor_challenge_operations', 'account_security_epochs', 'security_epoch_events',
    'privileged_factor_enrollments', 'privileged_recovery_records', 'accepted_factor_steps',
    'privileged_factor_attestations', 'factor_attempt_windows', 'privileged_factor_audit',
    'privileged_session_activity',
  ]) assert.match(down, new RegExp(`FROM groundbnb\\.${table}\\)`), table);
  assert.match(down, /Rollback refused: factor principal is active, ACL\/history differs/);
  assert.match(down, /REVOKE EXECUTE ON FUNCTION[\s\S]*?FROM %I/);
  assert.match(down, /REVOKE USAGE ON SCHEMA groundbnb FROM %I/);
  assert.match(down, /REVOKE CONNECT ON DATABASE groundbnb FROM %I/);
  assert.match(down, /DROP ROLE %I/);
  assert.match(down, /session_user NOT IN \(expected_role,'neondb_owner'\)/);
  assert.doesNotMatch(down, /DROP\s+.+\s+CASCADE|^\s*TRUNCATE\b/im);
});

test('static artifacts prepare no credential, login, route, or live execution', () => {
  assert.match(up, /NOLOGIN/);
  assert.doesNotMatch(up, /ALTER ROLE[\s\S]*LOGIN|\bPASSWORD\s+|\bCREATE USER\b|\bDROP DATABASE\b/i);
  assert.doesNotMatch(up, /^\s*(?:\connect|\set)\b/im);
  assert.match(up, /COMMIT;/);
  assert.match(down, /COMMIT;/);
});

test('principal acceptance script is a rollback-only 0013 metadata check and preserves ordinary app baseline', () => {
  assert.match(operatorCheck, /BEGIN;[\s\S]*?DO \$\$[\s\S]*?ROLLBACK;/);
  assert.match(operatorCheck, /current_database\(\) IS DISTINCT FROM 'groundbnb'/);
  assert.match(operatorCheck, /session_user IS DISTINCT FROM 'neondb_owner'/);
  assert.match(operatorCheck, /br-rough-flower-b8lerkcf/);
  assert.match(operatorCheck, /br-bitter-hall-b8ibnrfy/);
  assert.match(operatorCheck, /IS DISTINCT FROM 13/);
  assert.match(operatorCheck, /'0013_factor_service_principal'/);
  for (const functionName of appFunctions) assert.ok(operatorCheck.includes(`'${functionName}'`), `missing ordinary app function ${functionName}`);
  assert.match(operatorCheck, /default_transaction_read_only=on/);
  assert.match(operatorCheck, /app_functions IS DISTINCT FROM ARRAY\[/);
  assert.match(operatorCheck, /factor_record\.rolcanlogin IS DISTINCT FROM false/);
  assert.match(operatorCheck, /has_function_privilege\(factor_oid,'groundbnb\.read_factor_challenge_state/);
  assert.match(operatorCheck, /factor_function_count IS DISTINCT FROM 5/);
  assert.match(operatorCheck, /WHERE acl\.grantee=factor_oid\) IS DISTINCT FROM 5/);
  assert.match(operatorCheck, /EXISTS\(SELECT 1 FROM pg_auth_members WHERE member=factor_oid OR roleid=factor_oid\)/);
  assert.match(operatorCheck, /has_table_privilege\(factor_oid,c\.oid/);
  assert.match(operatorCheck, /has_sequence_privilege\(factor_oid,c\.oid/);
  assert.match(operatorCheck, /_factor_lock_identity/);
  assert.match(operatorCheck, /M1_FACTOR_SERVICE_PRINCIPAL_0013_ROLLBACK_PENDING/);
  assert.doesNotMatch(operatorCheck, /^\s*(?:SET ROLE|INSERT\s+INTO|UPDATE\s+groundbnb|DELETE\s+FROM|CREATE ROLE|GRANT EXECUTE|ALTER ROLE)\b/im);
});
