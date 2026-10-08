import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../db/operations/verify-m1-profile-expanded.sql', import.meta.url), 'utf8');

// These checks validate the operator script's prepared safeguards and coverage only; they do not execute SQL.
test('operator script is pinned, receipt-guarded, transaction-scoped, and rollback-only', () => {
  assert.match(sql, /^-- Prepared operator acceptance/m);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /current_database\(\)<>'groundbnb'/);
  assert.match(sql, /session_user<>'neondb_owner'/);
  assert.match(sql, /br-rough-flower-b8lerkcf/);
  assert.match(sql, /br-bitter-hall-b8ibnrfy/);
  assert.match(sql, /count\(\*\) FROM groundbnb\.schema_migrations\) IS DISTINCT FROM 9/);
  assert.match(sql, /count\(\*\) FROM groundbnb\.schema_migrations WHERE version=ANY\(ARRAY\[/);
  for (const migration of ['0001_environment', '0002_profile_foundation', '0003_profile_domain',
    '0004_profile_operation_status', '0005_profile_records', '0006_profile_transfer',
    '0007_membership_foundation', '0008_provider_reservations', '0009_privileged_factors']) {
    assert.ok(sql.includes(migration), `missing receipt guard for ${migration}`);
  }
  assert.match(sql, /email=environment_row\.kind \|\| '-01@example\.test' AND "emailVerified"=true/);
  assert.match(sql.trimEnd(), /SELECT 'M1_PROFILE_EXPANDED_OPERATOR_PASS' AS marker;\s*ROLLBACK;$/);
  assert.doesNotMatch(sql, /RAISE NOTICE|\bCOPY\b|\bCOMMIT\s*;/i);
});

test('profile field checks cover integer bounds, currency choice, UTF-8, operation replay, conflict, and newer canonical state', () => {
  assert.match(sql, /'value',1,'answered',true/);
  assert.match(sql, /"travelerCount":\{"value":999/);
  assert.match(sql, /"travelerCount":\{"value":0/);
  assert.match(sql, /"travelerCount":\{"value":1000/);
  assert.match(sql, /'budgetCurrency',jsonb_build_object\('value','USD'/);
  assert.match(sql, /"budgetCurrency":\{"value":"ZZZ"/);
  assert.match(sql, /Café/);
  assert.match(sql, /東京/);
  assert.match(sql, /read_profile_operation\(binding\.issuer,binding\.subject,first_operation\)/);
  assert.match(sql, /Changed profile operation reuse was accepted/);
  assert.match(sql, /Stale profile conflict comparison failed/);
  assert.match(sql, /Status did not preserve original acknowledgment after a newer profile revision/);
  assert.match(sql, /status_result->'profile'->>'revision' IS DISTINCT FROM/);
  assert.match(sql, /\(current_profile->>'revision'\)::bigint IS NULL/);
  assert.match(sql, /\(latest_profile->>'revision'\)::bigint IS NULL/);
  assert.match(sql, /latest_revision IS DISTINCT FROM \(current_profile->>'revision'\)::bigint/);
});

test('records and transfer assertions cover atomic saves, tombstones, status replay, conflicts, and authority isolation', () => {
  assert.match(sql, /groundbnb\.save_profile_records\(/);
  assert.match(sql, /Atomic vehicle\/note record save failed/);
  assert.match(sql, /gallons\/hour/);
  assert.match(sql, /groundbnb\.save_profile_transfer\(/);
  assert.match(sql, /Atomic profile transfer fields\/note save failed/);
  assert.match(sql, /Original transfer status acknowledgment failed/);
  assert.match(sql, /Transfer status replaced or misreported a newer current profile/);
  assert.match(sql, /Original records acknowledgment changed after a newer profile revision/);
  assert.match(sql, /Changed records operation reuse was accepted/);
  assert.match(sql, /Changed transfer operation reuse was accepted/);
  assert.match(sql, /Profile note tombstone was not retained/);
  assert.match(sql, /Removed note was recreated or changed/);
  assert.match(sql, /Foreign records issuer was accepted/);
  assert.match(sql, /Foreign transfer issuer was accepted/);
  assert.match(sql, /Unmapped profile subject was accepted/);
  assert.match(sql, /synthetic-expanded-transaction-only-other/);
  assert.match(sql, /Foreign account status query exposed another account operation/);
});

test('acknowledgment failure injection checks full rollback without disabling any guard', () => {
  assert.match(sql, /CREATE FUNCTION pg_temp\.reject_expanded_profile_ack\(\)/);
  assert.match(sql, /CREATE TRIGGER synthetic_expanded_profile_ack_failure BEFORE INSERT ON groundbnb\.profile_operations/);
  assert.match(sql, /EXCEPTION WHEN SQLSTATE 'P0001'/);
  assert.match(sql, /SQLERRM IS DISTINCT FROM 'synthetic expanded-profile acknowledgment failure' THEN RAISE/);
  assert.match(sql, /after_profile IS DISTINCT FROM before_profile/);
  assert.match(sql, /Failed acknowledgment did not roll back profile and transfer note/);
  assert.doesNotMatch(sql, /DISABLE TRIGGER|DROP TRIGGER|DROP CONSTRAINT/i);
});
