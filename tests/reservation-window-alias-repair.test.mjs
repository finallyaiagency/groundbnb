import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repair = readFileSync(new URL('../db/operations/repair-m1-reservation-window-alias.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migrations/0008_provider_reservations.sql', import.meta.url), 'utf8');

test('repair is restricted to the exact pinned synthetic 0001–0009 baseline', () => {
  for (const value of [
    "current_database() IS DISTINCT FROM 'groundbnb'", "session_user IS DISTINCT FROM 'neondb_owner'",
    'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
    '(SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 9',
    ...['0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors'].map(version => `'${version}'`),
    'sole verified synthetic Auth fixture', 'email=e.kind ||', '"emailVerified"=true',
    'sole active synthetic application identity', "WHERE singleton) IS DISTINCT FROM 'paused'",
    "EXISTS(SELECT 1 FROM groundbnb.provider_rate_versions WHERE status='active')",
    "EXISTS(SELECT 1 FROM groundbnb.provider_financial_limit_versions WHERE status='active')",
    'default_transaction_read_only=on', 'statement_timeout=5s', 'has_table_privilege', 'has_function_privilege',
  ]) assert.ok(repair.includes(value), value);
  assert.match(repair, /BEGIN;[\s\S]*?COMMIT;/);
  assert.doesNotMatch(repair, /\b(?:GRANT|REVOKE|ALTER\s+ROLE|INSERT\s+INTO|DELETE\s+FROM|DROP\s+)\b/i);
});

test('repair replaces exactly the reserve function alias collision without changing its owner or ACL', () => {
  const oldAlias = 'AS w(scope text,key text,kind text,period date,state text,cap numeric,held numeric)';
  const newAlias = 'AS usage_key(scope text,key text,kind text,period date,state text,cap numeric,held numeric)';
  const oldJoin = 'ON u.scope_kind=w.scope AND u.scope_key=w.key AND u.period_kind=w.kind AND u.period_key=w.period';
  const newJoin = 'ON u.scope_kind=usage_key.scope AND u.scope_key=usage_key.key AND u.period_kind=usage_key.kind AND u.period_key=usage_key.period';
  const reserve = migration.split('CREATE FUNCTION groundbnb.reserve_provider_attempt')[1]
    .split('CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched')[0];
  assert.ok(reserve.includes(oldAlias));
  assert.ok(reserve.includes(oldJoin));
  assert.ok(repair.includes(`old_alias constant text := '${oldAlias}'`));
  assert.ok(repair.includes(`new_alias constant text := '${newAlias}'`));
  assert.ok(repair.includes(`old_join constant text := '${oldJoin}'`));
  assert.ok(repair.includes(`new_join constant text := '${newJoin}'`));
  assert.match(repair, /function_oid:='groundbnb\.reserve_provider_attempt\(text,text,uuid,uuid,text,text,uuid,jsonb\)'::regprocedure/);
  assert.match(repair, /SELECT p\.proowner,p\.proacl,p\.proconfig INTO STRICT original_owner,original_acl,original_config[\s\S]*?p\.prosecdef/);
  assert.match(repair, /function_definition:=pg_get_functiondef\(function_oid\)/);
  assert.match(repair, /function_definition:=replace\(function_definition,old_alias,new_alias\)/);
  assert.match(repair, /function_definition:=replace\(function_definition,old_join,new_join\)/);
  assert.match(repair, /EXECUTE function_definition/);
  assert.match(repair, /p\.proowner FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_owner/);
  assert.match(repair, /p\.proacl FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_acl/);
  assert.match(repair, /p\.proconfig FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_config/);
  assert.match(repair, /position\(new_alias IN pg_get_functiondef\(function_oid\)\)=0/);
  assert.match(repair, /position\(old_alias IN pg_get_functiondef\(function_oid\)\)>0/);
});
