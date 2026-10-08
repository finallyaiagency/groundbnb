import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../db/operations/verify-m1-factor-service-context.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migrations/0010_factor_recovery_activity.sql', import.meta.url), 'utf8');

test('0010 operator acceptance is exact-baseline, pinned, synthetic, and rollback-only', () => {
  assert.match(sql, /current_database\(\)<>'groundbnb'/);
  assert.match(sql, /session_user<>'neondb_owner'/);
  assert.match(sql, /count\(\*\) FROM groundbnb\.schema_migrations\)<>10/);
  assert.match(sql, /count\(\*\) FROM neon_auth\."user"\)<>1/);
  assert.match(sql, /c\.relrowsecurity AND NOT c\.relforcerowsecurity/);
  assert.match(sql, /has_function_privilege\(app_oid,p\.oid,'EXECUTE'\)/);
  assert.match(sql, /acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
  assert.match(sql, /_guard_factor_attestation_method/);
  assert.match(sql, /_validate_factor_attestation_source/);
  assert.match(sql, /_guard_privileged_session_activity/);
  assert.match(sql, /"keyId":"synthetic-operator-only"/);
  assert.match(sql, /^--[^\n]*\nBEGIN;/);
  assert.match(sql, /ROLLBACK;\s*$/);
  assert.doesNotMatch(sql, /\b(?:COMMIT|GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/i);
});

test('operator checks direct verified-insert rejection and recovery-bound activity', () => {
  assert.match(sql, /SQLERRM|MESSAGE_TEXT/);
  assert.match(sql, /observed_error='Factor enrollment must begin pending'/);
  assert.match(sql, /challenge_method='recovery'/);
  assert.match(sql, /consumed_at=clock_timestamp\(\)[\s\S]*RETURNING consumed_at INTO STRICT source_at/);
  assert.match(sql, /accepted_step IS NULL/);
  assert.match(sql, /Consumed recovery did not create its bound challenge attestation/);
  assert.match(sql, /Exact attestation activity context was not retained/);
  assert.match(sql, /Fresh challenge did not replace the bound activity attestation/);
  assert.match(migration, /factor_enrollment_history_guard BEFORE INSERT OR UPDATE OR DELETE/);
  assert.match(migration, /source_verified_at IS DISTINCT FROM NEW\.factor_verified_at/);
  assert.match(migration, /NEW\.attestation_id IS DISTINCT FROM OLD\.attestation_id AND/);
  assert.match(migration, /OLD\.last_activity_at<=observed_now-interval '30 minutes' AND NEW\.attestation_id=OLD\.attestation_id/);
  assert.match(migration, /FOREIGN KEY\(attestation_id,account_id,identity_issuer,identity_subject,managed_session_id,security_epoch\)/);
});
