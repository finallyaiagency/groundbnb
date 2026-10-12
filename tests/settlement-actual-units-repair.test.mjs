import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repair = readFileSync(new URL('../db/operations/repair-m1-settlement-actual-units.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migrations/0008_provider_reservations.sql', import.meta.url), 'utf8');

test('repair is restricted to pinned synthetic local/preview at exact 0001–0009 baseline', () => {
  for (const value of [
    "current_database() IS DISTINCT FROM 'groundbnb'", "session_user IS DISTINCT FROM 'neondb_owner'",
    'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
    '(SELECT count(*) FROM groundbnb.schema_migrations) IS DISTINCT FROM 9',
    ...['0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors'].map(version => `'${version}'`),
    'sole verified synthetic Auth fixture', 'sole active synthetic application identity',
    "WHERE singleton) IS DISTINCT FROM 'paused'", 'default_transaction_read_only=on', 'statement_timeout=5s',
    'has_table_privilege', 'has_function_privilege',
  ]) assert.ok(repair.includes(value), value);
  assert.match(repair, /BEGIN;[\s\S]*?COMMIT;/);
  assert.doesNotMatch(repair, /\b(?:GRANT|REVOKE|ALTER\s+ROLE|INSERT\s+INTO|DELETE\s+FROM|DROP\s+)\b/i);
});

test('repair changes only the ambiguous parameter use without changing signature, owner, ACL, or function settings', () => {
  const settle = migration.split('CREATE FUNCTION groundbnb.settle_provider_attempt')[1]
    .split('CREATE FUNCTION groundbnb.close_provider_operation')[0];
  assert.ok(settle.includes('DECLARE account_uuid uuid; attempt_row record; operation_row record; actual_cost numeric; receipt jsonb; w record;'));
  assert.match(settle, /SET status='settled',actual_units=actual_units,[\s\S]*?actual_cost_usd=actual_cost/);
  assert.match(repair, /settle_provider_attempt\(text,text,uuid,jsonb,boolean\)'::regprocedure/);
  assert.match(repair, /actual_units_input ALIAS FOR \$4/);
  assert.match(repair, /SET status=''settled'',actual_units=actual_units_input/);
  assert.match(repair, /SELECT p\.proowner,p\.proacl,p\.proconfig INTO STRICT original_owner,original_acl,original_config[\s\S]*?p\.prosecdef/);
  assert.match(repair, /function_definition:=pg_get_functiondef\(function_oid\)/);
  assert.match(repair, /EXECUTE function_definition/);
  assert.match(repair, /p\.proowner FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_owner/);
  assert.match(repair, /p\.proacl FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_acl/);
  assert.match(repair, /p\.proconfig FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_config/);
  assert.match(repair, /position\(new_assignment IN pg_get_functiondef\(function_oid\)\)=0/);
  assert.match(repair, /position\(old_assignment IN pg_get_functiondef\(function_oid\)\)>0/);
});
