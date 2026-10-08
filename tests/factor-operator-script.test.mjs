import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../db/operations/verify-m1-privileged-factors.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/migrations/0009_privileged_factors.sql', import.meta.url), 'utf8');

test('operator factor acceptance is pinned, rollback-only, and synthetic-only', () => {
  for (const guard of [
    "current_database()<>'groundbnb'", "session_user<>'neondb_owner'", 'br-rough-flower-b8lerkcf',
    'br-bitter-hall-b8ibnrfy', ...Array.from({ length: 9 }, (_, index) =>
      `version='${String(index + 1).padStart(4, '0')}_${[
        'environment', 'profile_foundation', 'profile_domain', 'profile_operation_status',
        'profile_records', 'profile_transfer', 'membership_foundation', 'provider_reservations',
        'privileged_factors',
      ][index]}'`),
    "email=e.kind || '-01@example.test'", '"emailVerified"=true',
  ]) assert.ok(sql.includes(guard), guard);
  assert.match(sql, /^--[^\n]*\nBEGIN;/);
  assert.match(sql, /ROLLBACK;\s*$/);
  assert.match(sql, /SELECT 'privileged_factor_invariants_passed_rollback_pending' AS result/);
  assert.doesNotMatch(sql, /\b(?:COMMIT|GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/i);
  assert.doesNotMatch(sql, /neon_auth\."session"|session_token|cookie/i);
});

test('operator factor fixtures use closed synthetic envelope and verify owner/epoch constraints', () => {
  assert.match(sql, /"keyId":"synthetic-operator-only"/);
  assert.match(sql, /"nonce":"A{16}"/);
  assert.match(sql, /"ciphertext":"A{43}"/);
  assert.match(sql, /"tag":"A{22}"/);
  assert.match(sql, /non-current factor enrollment epoch was accepted/i);
  assert.match(sql, /cross-owner accepted factor step was accepted/i);
  assert.match(migration, /Active factor enrollment must use the current account epoch/);
});

test('operator checks deferred epoch/revocation events and same-session rechallenge', () => {
  assert.match(sql, /SET CONSTRAINTS ALL IMMEDIATE/);
  assert.match(sql, /SET CONSTRAINTS ALL DEFERRED/);
  assert.match(sql, /Epoch increment without event was accepted/);
  assert.match(sql, /Factor revocation without newer epoch\/event was accepted/);
  assert.match(sql, /'factor_revocation'/);
  assert.match(sql, /Same-session rechallenge did not retain two distinct attestations/);
  assert.match(sql, /Accepted factor step replay created another attestation/);
  assert.match(sql, /17000000/);
  assert.match(sql, /17000001/);
  assert.match(sql, /synthetic-managed-session-a/);
  assert.match(sql, /direct verified-insert[\s\S]*unproven here/i);
});

test('operator proves one-use recovery, account-serialized nonoverlapping windows, and private ACLs', () => {
  assert.match(sql, /consumed_at IS NULL/);
  assert.match(sql, /Recovery row was not one-use/);
  assert.match(sql, /factor rate window was accepted/i);
  assert.match(sql, /factor_attempt_windows[\s\S]*window_started_at,window_ends_at/);
  assert.match(migration, /FROM groundbnb\.accounts WHERE id=NEW\.account_id FOR UPDATE/);
  assert.match(migration, /same owner bucket/);
  assert.match(sql, /has_table_privilege\(app_oid/);
  assert.match(sql, /has_function_privilege\(app_oid/);
  assert.match(sql, /acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
  assert.match(sql, /NOT c\.relrowsecurity OR c\.relforcerowsecurity/);
});
