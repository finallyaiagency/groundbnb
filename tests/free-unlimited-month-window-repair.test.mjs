import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repair = readFileSync(new URL('../db/operations/repair-m1-free-unlimited-month-window.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migrations/0008_provider_reservations.sql', import.meta.url), 'utf8');

test('repair is guarded to the pinned synthetic 0001–0009 database and preserves the paused/private boundary', () => {
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

test('repair permits only configured or unlimited windows, while retaining the not-configured refusal and configured cap check', () => {
  const reserve = migration.split('CREATE FUNCTION groundbnb.reserve_provider_attempt')[1]
    .split('CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched')[0];
  assert.match(reserve, /IF window_row\.limit_state<>'configured' THEN RETURN jsonb_build_object\('ok',false,'category','window_unconfigured'\); END IF;/);
  assert.match(reserve, /IF window_row\.spent_usd\+window_row\.pending_usd\+cost_max>window_row\.cap_usd-window_row\.held_usd THEN/);
  assert.match(repair, /old_guard constant text := 'IF window_row\.limit_state<>''configured'' THEN/);
  assert.match(repair, /new_guard constant text := 'IF \(window_row\.limit_state=''unlimited'' AND NOT \(window_row\.scope_kind=''account'' AND window_row\.scope_key=account_uuid::text AND window_row\.period_kind=''calendar_month'' AND selected_plan\.plan_key=''free'' AND plan_row\.account_period=''day''\)\) OR window_row\.limit_state NOT IN \(''configured'',''unlimited''\) THEN/);
  assert.match(repair, /new_cap_check constant text := 'IF window_row\.limit_state=''configured'' AND window_row\.spent_usd/);
  assert.match(repair, /position\(expected_alias IN function_definition\)=0/);
  assert.match(repair, /position\(new_guard IN pg_get_functiondef\(function_oid\)\)=0/);
  assert.match(repair, /position\(old_guard IN pg_get_functiondef\(function_oid\)\)>0/);
});

test('repair preserves function signature, owner, ACL, configuration, and security-definer mode', () => {
  assert.match(repair, /reserve_provider_attempt\(text,text,uuid,uuid,text,text,uuid,jsonb\)'::regprocedure/);
  assert.match(repair, /SELECT p\.proowner,p\.proacl,p\.proconfig INTO STRICT original_owner,original_acl,original_config[\s\S]*?p\.prosecdef/);
  assert.match(repair, /function_definition:=pg_get_functiondef\(function_oid\)/);
  assert.match(repair, /EXECUTE function_definition/);
  assert.match(repair, /p\.proowner FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_owner/);
  assert.match(repair, /p\.proacl FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_acl/);
  assert.match(repair, /p\.proconfig FROM pg_proc p WHERE p\.oid=function_oid\) IS DISTINCT FROM original_config/);
});
