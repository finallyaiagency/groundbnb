import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0012_factor_service.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0012_factor_service_down.sql', import.meta.url), 'utf8');
const activityGuard = readFileSync(new URL('../db/migrations/0010_factor_recovery_activity.sql', import.meta.url), 'utf8');

test('0012 pins exact synthetic 0001–0011 baseline and leaves app roles unexpanded', () => {
  for (const sql of [up, down]) {
    assert.match(sql, /current_database\(\)<>'groundbnb'/);
    assert.match(sql, /session_user<>'neondb_owner'/);
    assert.match(sql, /br-rough-flower-b8lerkcf/);
    assert.match(sql, /br-bitter-hall-b8ibnrfy/);
    assert.match(sql, /groundbnb_local_app/);
    assert.match(sql, /groundbnb_preview_app/);
    for (const receipt of [
      '0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors', '0010_factor_recovery_activity',
      '0011_membership_reader',
    ]) assert.ok(sql.includes(`version='${receipt}'`), receipt);
    assert.match(sql, /email=e\.kind \|\| '-01@example\.test'/);
    assert.match(sql, /"emailVerified"=true/);
    assert.match(sql, /default_transaction_read_only=on/);
    assert.match(sql, /statement_timeout=5s/);
    assert.match(sql, /IS DISTINCT FROM true/);
    assert.match(sql, /has_function_privilege/);
    assert.match(sql, /has_table_privilege/);
    assert.match(sql, /has_sequence_privilege/);
    assert.match(sql, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN has_table_privilege/);
    assert.match(sql, /CASE WHEN c\.relkind='S' THEN has_sequence_privilege/);
    assert.match(sql, /proargtypes='25 25 2950 20 3802 3802'::oidvector/);
    assert.match(sql, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
    assert.doesNotMatch(sql, /^\s*(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/im);
  }
  assert.match(up, /receipt_count IS DISTINCT FROM 11/);
  assert.match(down, /receipt_count IS DISTINCT FROM 12/);
  assert.match(up, /exact pinned local\/preview 0001-0011 baseline/);
  assert.match(down, /exact pinned local\/preview 0001-0012 baseline/);
});

test('five closed SECURITY DEFINER entrypoints and private immutable receipt storage are prepared', () => {
  for (const functionName of [
    'read_factor_challenge_state', 'record_factor_challenge_attempt', 'consume_factor_totp_candidate',
    'consume_factor_recovery_candidate', 'read_factor_operation_receipt',
  ]) {
    assert.match(up, new RegExp(`CREATE FUNCTION groundbnb\\.${functionName}\\(`));
    assert.match(up, new RegExp(`REVOKE ALL ON FUNCTION groundbnb\\.${functionName}\\(`));
    assert.match(down, new RegExp(`DROP FUNCTION groundbnb\\.${functionName}\\(`));
  }
  assert.match(up, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp/);
  assert.match(up, /CREATE TABLE groundbnb\.factor_challenge_operations/);
  assert.match(up, /ENABLE ROW LEVEL SECURITY/);
  assert.match(up, /REVOKE ALL ON groundbnb\.factor_challenge_operations FROM PUBLIC/);
  assert.match(up, /Factor challenge operation receipts are immutable/);
  assert.match(up, /operation_kind IN \('attempt','totp','recovery'\)/);
  assert.match(up, /status IN \('accepted','rejected','unavailable'\)/);
  assert.match(up, /factor operation table and functions must remain private pending a separate grant/i);
  assert.match(up, /acl\.grantee<>p\.proowner AND acl\.privilege_type='EXECUTE'/);
});

test('every identity path binds the provider session and current owner before factor state', () => {
  assert.match(up, /FROM neon_auth\.session s/);
  assert.match(up, /s\.id=p_session_id::uuid AND s\."userId"=p_subject::uuid/);
  assert.match(up, /FOR UPDATE OF s/);
  assert.match(up, /s\."expiresAt"/);
  assert.doesNotMatch(up, /s\.token|"token"\s+INTO/i);
  assert.match(up, /i\.issuer=p_issuer AND i\.subject=p_subject AND i\.revoked_at IS NULL/);
  assert.match(up, /a\.status='active'/);
  assert.match(up, /a\.role IN \('owner','admin'\)/);
  assert.match(up, /session_expiry<p_session_expires_at/);
  assert.match(up, /p_session_expires_at<=clock_timestamp\(\)/);
  assert.match(up, /_factor_lock_identity\(p_issuer,p_subject,p_session_id,p_session_expires_at,true\)/);
  assert.match(up, /_factor_lock_identity\(p_issuer,p_subject,p_session_id,p_session_expires_at,false\)/);
});

test('writer calls enforce exact 5 per 900 second UTC account-wide policy and bind one-use sources', () => {
  assert.match(up, /p_max_failures IS DISTINCT FROM 5/);
  assert.match(up, /p_window_seconds IS DISTINCT FROM 900/);
  assert.match(up, /date_bin\(interval '15 minutes'/);
  assert.match(up, /_factor_bucket_fingerprint\(\)/);
  assert.match(up, /sum\(w\.attempt_count\)/);
  assert.match(up, /factor_attempt_windows/);
  assert.match(up, /accepted_factor_steps/);
  assert.match(up, /p_matched_step<current_step-1 OR p_matched_step>current_step\+1/);
  assert.match(up, /consumed_at IS NULL FOR UPDATE/);
  assert.match(up, /UPDATE groundbnb\.privileged_recovery_records SET consumed_at=clock_timestamp\(\)/);
  assert.match(up, /challenge_method,\s*recovery_id/);
  assert.match(up, /factor_attestations\(account_id,factor_id,security_epoch,challenge_method,accepted_step/);
  assert.match(up, /VALUES\(account_uuid,p_factor_id,p_epoch,'totp',p_matched_step/);
  assert.match(up, /VALUES\(account_uuid,p_factor_id,p_epoch,'recovery',p_recovery_id/);
  assert.match(up, /source_time,issued_time,expires_time/);
  assert.match(up, /LEAST\(issued_time\+interval '12 hours',p_session_expires_at\)/);
  assert.match(up, /privileged_factor_audit/);
});

test('a fresh challenge advances existing same-session activity through the 0010 guard', () => {
  const upserts = up.match(/ON CONFLICT\(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch\)\s+DO UPDATE SET attestation_id=EXCLUDED\.attestation_id,\s+last_activity_at=EXCLUDED\.last_activity_at,updated_at=clock_timestamp\(\)/g) ?? [];
  assert.equal(upserts.length, 2, 'both TOTP and recovery refresh the existing activity tuple');
  assert.match(up, /privileged_session_activity\s*\([\s\S]*?ON CONFLICT\(account_id,identity_issuer,identity_subject,managed_session_id,security_epoch\)/);
  assert.match(activityGuard, /NEW\.attestation_id IS DISTINCT FROM OLD\.attestation_id/);
});

test('receipt reads are owner/session/method scoped and failed rollback preserves all pre-existing history', () => {
  assert.match(up, /r\.account_id=account_uuid AND r\.identity_issuer=p_issuer AND r\.identity_subject=p_subject/);
  assert.match(up, /r\.managed_session_id=p_session_id AND r\.method=p_method/);
  assert.match(up, /'status',receipt_status/);
  assert.match(up, /'not_found'/);
  for (const table of [
    'factor_challenge_operations', 'account_security_epochs', 'security_epoch_events',
    'privileged_factor_enrollments', 'privileged_recovery_records', 'accepted_factor_steps',
    'privileged_factor_attestations', 'factor_attempt_windows', 'privileged_factor_audit',
    'privileged_session_activity',
  ]) assert.match(down, new RegExp(`EXISTS\\(SELECT 1 FROM groundbnb\\.${table}\\)`), table);
  assert.match(down, /Rollback refused: factor history or operation receipts would be lost/);
  assert.doesNotMatch(down, /^\s*(?:CASCADE|TRUNCATE)\b/im);
});

test('SQL remains dormant and both directions retain the exact migration receipt boundary', () => {
  assert.match(up, /INSERT INTO groundbnb\.schema_migrations\(version\) VALUES\('0012_factor_service'\)/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0012_factor_service'/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\._factor_lock_identity\(text,text,text,timestamptz,boolean\) FROM PUBLIC/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\._factor_bucket_fingerprint\(\) FROM PUBLIC/);
  assert.doesNotMatch(up, /^\s*(?:GRANT|CREATE\s+ROLE|ALTER\s+ROLE|PASSWORD)\b/im);
});
