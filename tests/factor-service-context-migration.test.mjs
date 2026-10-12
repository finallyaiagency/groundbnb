import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0010_factor_recovery_activity.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0010_factor_recovery_activity_down.sql', import.meta.url), 'utf8');
const base = readFileSync(new URL('../db/migrations/0009_privileged_factors.sql', import.meta.url), 'utf8');

test('0010 up/down pin the exact synthetic environment, complete prior receipts, fixture, and ACL baseline', () => {
  for (const sql of [up, down]) {
    for (const pin of [
      "current_database()<>'groundbnb'", 'br-rough-flower-b8lerkcf',
      'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
      ...Array.from({ length: sql === up ? 9 : 10 }, (_, index) => `version='${String(index + 1).padStart(4, '0')}_${[
        'environment', 'profile_foundation', 'profile_domain', 'profile_operation_status',
        'profile_records', 'profile_transfer', 'membership_foundation', 'provider_reservations',
        'privileged_factors', 'factor_recovery_activity',
      ][index]}'`),
      "email=e.kind || '-01@example.test'", '"emailVerified"=true',
      'has_database_privilege', 'has_schema_privilege', 'has_table_privilege',
    ]) assert.ok(sql.includes(pin), pin);
    assert.doesNotMatch(sql, /^\s*(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/im);
  }
  assert.match(up, /count\(\*\) FROM groundbnb\.schema_migrations\)<>9/);
  assert.match(down, /count\(\*\) FROM groundbnb\.schema_migrations\)<>10/);
  assert.match(up, /exact 0001-0009 baseline and no prior 0010/);
  assert.match(down, /migrations 0001-0010 applied/);
  assert.match(up, /INSERT INTO groundbnb\.schema_migrations\(version\) VALUES\('0010_factor_recovery_activity'\)/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0010_factor_recovery_activity'/);
});

test('existing TOTP rows remain valid; source method and recovery row are exclusive and immutable', () => {
  assert.match(up, /ADD COLUMN challenge_method text NOT NULL DEFAULT 'totp'/);
  assert.match(up, /ALTER COLUMN challenge_method DROP DEFAULT/);
  assert.match(up, /ALTER COLUMN accepted_step DROP NOT NULL/);
  assert.match(up, /challenge_method='totp' AND accepted_step IS NOT NULL AND recovery_id IS NULL/);
  assert.match(up, /challenge_method='recovery' AND accepted_step IS NULL AND recovery_id IS NOT NULL/);
  assert.match(up, /FOREIGN KEY\(recovery_id,account_id,factor_id,security_epoch\)[\s\S]*?REFERENCES groundbnb\.privileged_recovery_records\(recovery_id,account_id,factor_id,security_epoch\)/);
  assert.match(up, /factor_attestation_recovery_one_use UNIQUE\(recovery_id\)/);
  assert.match(up, /Factor challenge source is immutable after issuance/);
  assert.match(up, /source_verified_at IS DISTINCT FROM NEW\.factor_verified_at/);
  assert.match(up, /accepted_at INTO source_verified_at FROM groundbnb\.accepted_factor_steps/);
  assert.match(up, /consumed_at INTO source_verified_at FROM groundbnb\.privileged_recovery_records/);
  assert.match(up, /current_epoch<>NEW\.security_epoch OR factor_state IS DISTINCT FROM 'verified'/);
  assert.match(up, /CREATE CONSTRAINT TRIGGER factor_attestation_source_valid[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
});

test('0010 wires pending-only enrollment guard for inserts and restores it on rollback', () => {
  assert.match(up, /DROP TRIGGER factor_enrollment_history_guard ON groundbnb\.privileged_factor_enrollments/);
  assert.match(up, /CREATE TRIGGER factor_enrollment_history_guard BEFORE INSERT OR UPDATE OR DELETE/);
  assert.match(base, /Factor enrollment must begin pending/);
  assert.match(down, /CREATE TRIGGER factor_enrollment_history_guard BEFORE UPDATE OR DELETE/);
});

test('session activity binds the exact challenge context, current factor epoch, freshness, and inactivity', () => {
  assert.match(up, /CREATE TABLE groundbnb\.privileged_session_activity\s*\(/);
  assert.match(up, /PRIMARY KEY\(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch\)/);
  assert.match(up, /FOREIGN KEY\(attestation_id,account_id,identity_issuer,identity_subject,managed_session_id,security_epoch\)/);
  assert.match(up, /NEW\.last_activity_at<=OLD\.last_activity_at/);
  assert.match(up, /OLD\.last_activity_at<=observed_now-interval '30 minutes'/);
  assert.match(up, /NEW\.attestation_id=OLD\.attestation_id/);
  assert.match(up, /NEW\.attestation_id IS DISTINCT FROM OLD\.attestation_id AND/);
  assert.match(up, /attestation_row\.issued_at<OLD\.last_activity_at/);
  assert.match(up, /Expired idle session requires a fresh challenge before activity resumes/);
  assert.match(up, /attestation_row\.factor_verified_at<observed_now-interval '12 hours'/);
  assert.match(up, /NEW\.last_activity_at>attestation_row\.factor_verified_at\+interval '12 hours'/);
  assert.match(up, /observed_now>=attestation_row\.issued_at\+interval '30 minutes'/);
  assert.match(up, /Privileged activity timestamps cannot be future-dated/);
  assert.match(up, /Privileged session activity history is retained/);
});

test('new activity storage remains private and rollback refuses any recovery/activity history', () => {
  assert.match(up, /ALTER TABLE groundbnb\.privileged_session_activity ENABLE ROW LEVEL SECURITY/);
  assert.match(up, /REVOKE ALL ON groundbnb\.privileged_session_activity FROM PUBLIC/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\._guard_privileged_session_activity\(\) FROM PUBLIC/);
  assert.match(up, /has_function_privilege\(app_oid,'groundbnb\._validate_factor_attestation_source\(\)','EXECUTE'\)/);
  assert.doesNotMatch(up, /FORCE ROW LEVEL SECURITY|CREATE POLICY/i);
  assert.match(down, /EXISTS\(SELECT 1 FROM groundbnb\.privileged_session_activity\)/);
  assert.match(down, /challenge_method='recovery'/);
  assert.match(down, /accepted_step SET NOT NULL/);
  assert.match(down, /DROP TABLE groundbnb\.privileged_session_activity/);
  assert.doesNotMatch(down, /\bCASCADE\b/i);
});
