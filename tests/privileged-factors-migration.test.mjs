import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0009_privileged_factors.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0009_privileged_factors_down.sql', import.meta.url), 'utf8');
const tables = [
  'account_security_epochs', 'security_epoch_events', 'privileged_factor_enrollments',
  'privileged_recovery_records', 'accepted_factor_steps', 'privileged_factor_attestations',
  'factor_attempt_windows', 'privileged_factor_audit',
];
const helpers = [
  '_guard_security_epoch', '_guard_factor_enrollment_history', '_guard_recovery_consumption',
  '_guard_accepted_factor_step', '_guard_factor_attestation', '_guard_factor_attempt_window',
  '_privileged_factor_audit_append_only', '_require_factor_epoch_event', '_serialize_factor_attempt_window',
];

test('up and down pin the database, exact branches, 0001-0008, sole synthetic fixture, and app ACL baseline', () => {
  for (const sql of [up, down]) {
    for (const pin of [
      "current_database()<>'groundbnb'", 'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy',
      'groundbnb_local_app', 'groundbnb_preview_app',
      ...['0001_environment', '0002_profile_foundation', '0003_profile_domain',
        '0004_profile_operation_status', '0005_profile_records', '0006_profile_transfer',
        '0007_membership_foundation', '0008_provider_reservations'].map(version => `version='${version}'`),
      "email=e.kind || '-01@example.test'", '"emailVerified"=true', 'pg_auth_members',
      'default_transaction_read_only=on', 'statement_timeout=5s', 'has_database_privilege',
      'has_schema_privilege', 'has_table_privilege', 'groundbnb.read_profile(text,text)',
      'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)',
    ]) assert.ok(sql.includes(pin), pin);
    assert.doesNotMatch(sql, /^\s*(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE)\b/im);
    assert.doesNotMatch(sql, /\b(?:PASSWORD|LOGIN|NOLOGIN)\b/i);
  }
  assert.ok(up.includes("EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors')"));
  assert.ok(down.includes("NOT EXISTS(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0009_privileged_factors')"));
});

test('factor tables bind owner, epoch, factor, step, identity, and session with restrictive keys', () => {
  for (const table of tables) assert.match(up, new RegExp(`CREATE TABLE groundbnb\\.${table}\\s*\\(`));
  assert.match(up, /account_id uuid PRIMARY KEY REFERENCES groundbnb\.accounts\(id\) ON DELETE RESTRICT/);
  assert.match(up, /FOREIGN KEY\(factor_id,account_id,security_epoch\)[\s\S]*?REFERENCES groundbnb\.privileged_factor_enrollments\(factor_id,account_id,security_epoch\) ON DELETE RESTRICT/);
  assert.match(up, /PRIMARY KEY\(account_id,factor_id,security_epoch,accepted_step\)/);
  assert.match(up, /UNIQUE\(account_id,factor_id,security_epoch,accepted_step\)/);
  assert.doesNotMatch(up, /UNIQUE\(identity_issuer,identity_subject,managed_session_id,security_epoch\)/);
  assert.match(up, /FOREIGN KEY\(identity_issuer,identity_subject,account_id\)[\s\S]*?REFERENCES groundbnb\.account_identities\(issuer,subject,account_id\) ON DELETE RESTRICT/);
  assert.match(up, /CREATE UNIQUE INDEX account_identity_owner_binding_idx[\s\S]*?ON groundbnb\.account_identities\(issuer,subject,account_id\)/);
  assert.match(up, /CHECK \(security_epoch>=0\)/);
  assert.match(up, /CHECK \(accepted_step>=0\)/);
  assert.match(up, /CREATE UNIQUE INDEX privileged_factor_one_live_per_epoch_idx[\s\S]*?WHERE state IN \('pending','verified'\)/);
});

test('enrollment uses the closed v1 encrypted envelope and recovery records match salted digest storage', () => {
  assert.match(up, /encrypted_secret jsonb NOT NULL/);
  assert.ok(up.includes("(encrypted_secret - ARRAY['version','keyId','nonce','ciphertext','tag'])='{}'::jsonb"));
  assert.doesNotMatch(up, /jsonb_object_length/);
  assert.match(up, /encrypted_secret \?& ARRAY\['version','keyId','nonce','ciphertext','tag'\]/);
  assert.match(up, /encrypted_secret->'version'='1'::jsonb/);
  assert.match(up, /encrypted_secret->>'keyId'=envelope_key_id/);
  assert.match(up, /encrypted_secret->>'nonce' ~ '\^\[A-Za-z0-9_-\]\{16\}\$'/);
  assert.match(up, /encrypted_secret->>'ciphertext' ~ '\^\[A-Za-z0-9_-\]\{43,138\}\$'/);
  assert.match(up, /encrypted_secret->>'tag' ~ '\^\[A-Za-z0-9_-\]\{22\}\$'/);
  assert.match(up, /digest_version smallint NOT NULL CHECK \(digest_version=1\)/);
  assert.match(up, /salt bytea NOT NULL CHECK \(octet_length\(salt\)=16\)/);
  assert.match(up, /recovery_digest bytea NOT NULL CHECK \(octet_length\(recovery_digest\)=32\)/);
  assert.doesNotMatch(up, /^\s*(?:secret|submitted_code|recovery_code|session_token)\s+text\b/im);
});

test('finite time, one-way state, replay uniqueness, rate history, and audit append-only guards are prepared', () => {
  for (const value of ['isfinite(updated_at)', 'isfinite(occurred_at)', 'isfinite(created_at)',
    'isfinite(verified_at)', 'isfinite(revoked_at)', 'isfinite(accepted_at)', 'isfinite(expires_at)',
    'new_epoch=previous_epoch+1', 'UNIQUE(account_id,new_epoch)', 'OLD.state=\'revoked\'',
    'Recovery records may be consumed once', 'Accepted factor steps are immutable',
    'Factor attestations may only be revoked once', 'Factor rate-limit state cannot be reset or shortened',
    'Privileged factor audit history is append-only', 'security_epoch_events_append_only']) {
    assert.ok(up.includes(value), value);
  }
  assert.match(up, /PRIMARY KEY\(account_id,factor_id,security_epoch,accepted_step\)/);
  assert.match(up, /verified_at>=created_at/);
  assert.match(up, /revoked_at>=created_at AND[\s\S]*revoked_at>=verified_at/);
  assert.match(up, /CREATE CONSTRAINT TRIGGER security_epoch_event_required[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(up, /CREATE CONSTRAINT TRIGGER security_epoch_event_current[\s\S]*AFTER INSERT[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(up, /CREATE CONSTRAINT TRIGGER factor_revocation_epoch_required[\s\S]*AFTER INSERT OR UPDATE[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(up, /Active factor enrollment must use the current account epoch/);
  assert.match(up, /current_epoch<=OLD\.security_epoch[\s\S]*reason IN \('factor_revocation','factor_reset'\)/);
  assert.match(up, /CREATE TRIGGER factor_attempt_window_serialized[\s\S]*BEFORE INSERT ON/);
  assert.match(up, /FROM groundbnb\.accounts WHERE id=NEW\.account_id FOR UPDATE/);
  assert.match(up, /w\.window_started_at<NEW\.window_ends_at AND NEW\.window_started_at<w\.window_ends_at/);
  assert.doesNotMatch(up, /'infinity'::timestamptz/i);
});

test('all new tables enable RLS without FORCE or policies, and no app or public grants are added', () => {
  for (const table of tables) assert.match(up, new RegExp(`ALTER TABLE groundbnb\\.${table} ENABLE ROW LEVEL SECURITY`));
  assert.doesNotMatch(up, /FORCE ROW LEVEL SECURITY|CREATE POLICY/i);
  assert.match(up, /REVOKE ALL ON groundbnb\.account_security_epochs,[\s\S]*FROM PUBLIC/);
  for (const helper of helpers) assert.match(up, new RegExp(`REVOKE ALL ON FUNCTION groundbnb\\.${helper}\\(\\) FROM PUBLIC`));
  assert.match(up, /has_function_privilege\(app_oid,p\.oid,'EXECUTE'\)/);
  assert.match(up, /has_table_privilege\(app_oid,c\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\)/);
});

test('rollback refuses any factor/security history and drops only owned structures', () => {
  for (const table of tables) {
    assert.match(down, new RegExp(`EXISTS\\(SELECT 1 FROM groundbnb\\.${table}\\)`));
    assert.match(down, new RegExp(`DROP TABLE groundbnb\\.${table}`));
  }
  for (const helper of helpers) assert.match(down, new RegExp(`DROP FUNCTION groundbnb\\.${helper}\\(\\)`));
  assert.match(down, /Rollback refused: privileged factor, recovery, rate, epoch, or audit history would be lost/);
  assert.match(down, /DROP INDEX groundbnb\.account_identity_owner_binding_idx/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0009_privileged_factors'/);
  assert.doesNotMatch(down, /^\s*(?:CASCADE|TRUNCATE)\b/im);
  assert.doesNotMatch(down, /DELETE FROM groundbnb\.(accounts|account_identities|profiles|profile_answers)/i);
});
