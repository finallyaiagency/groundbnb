import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const script = readFileSync(new URL('../db/operations/verify-m1-factor-service.sql', import.meta.url), 'utf8');

test('0012 operator acceptance is pinned, exact, and rollback-only', () => {
  assert.match(script, /current_database\(\) IS DISTINCT FROM 'groundbnb'/);
  assert.match(script, /session_user IS DISTINCT FROM 'neondb_owner'/);
  assert.match(script, /br-rough-flower-b8lerkcf/);
  assert.match(script, /br-bitter-hall-b8ibnrfy/);
  assert.match(script, /IS DISTINCT FROM 12/);
  assert.match(script, /0012_factor_service/);
  assert.match(script, /email=e\.kind \|\| '-01@example\.test'/);
  assert.match(script, /"emailVerified"=true/);
  assert.match(script, /default_transaction_read_only=on/);
  assert.match(script, /statement_timeout=5s/);
  assert.match(script, /M1_FACTOR_SERVICE_CLOSED_PATHS_ROLLBACK_PENDING/);
  assert.match(script.trimEnd(), /ROLLBACK;$/);
  assert.doesNotMatch(script, /^\s*COMMIT\s*;/im);
  assert.doesNotMatch(script, /^\s*(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/im);
});

test('operator probes use only fixed unmapped synthetic identity and never access provider session values', () => {
  assert.match(script, /fake_subject constant text:='10000000-0000-4000-8000-000000000001'/);
  assert.match(script, /fake_session constant text:='10000000-0000-4000-8000-000000000002'/);
  assert.match(script, /subject=fake_subject/);
  assert.match(script, /read_factor_challenge_state\(identity_issuer,fake_subject,fake_session/);
  assert.match(script, /record_factor_challenge_attempt\(identity_issuer,fake_subject,fake_session/);
  assert.match(script, /consume_factor_totp_candidate\(identity_issuer,fake_subject,fake_session/);
  assert.match(script, /consume_factor_recovery_candidate\(identity_issuer,fake_subject,fake_session/);
  assert.match(script, /read_factor_operation_receipt\(identity_issuer,fake_subject,fake_session/);
  assert.match(script, /FROM neon_auth\.session WHERE id=fake_session::uuid/);
  assert.doesNotMatch(script, /s\.token|session_token|"token"|INSERT\s+INTO\s+neon_auth/im);
  assert.doesNotMatch(script, /^\s*(?:INSERT|UPDATE|DELETE)\s+INTO\s+groundbnb\.(?:factor_challenge_operations|factor_attempt_windows|privileged_factor_audit)/im);
});

test('restricted ACL and definer configuration checks cover all five entrypoints', () => {
  assert.match(script, /array_agg\(p\.oid::regprocedure::text ORDER BY p\.oid::regprocedure::text\)/);
  assert.match(script, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(script, /has_sequence_privilege/);
  assert.match(script, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN/);
  assert.match(script, /CASE WHEN c\.relkind='S' THEN[\s\S]*has_sequence_privilege\(app_oid,c\.oid,'UPDATE'\) ELSE false END\)\) OR\s+has_table_privilege\(app_oid,'groundbnb\.factor_challenge_operations'/);
  assert.match(script, /acl\.grantee<>function_owner/);
  assert.match(script, /function_owner IS DISTINCT FROM owner_oid/);
  assert.match(script, /search_path=pg_catalog, pg_temp/);
  for (const fn of [
    'read_factor_challenge_state', 'record_factor_challenge_attempt', 'consume_factor_totp_candidate',
    'consume_factor_recovery_candidate', 'read_factor_operation_receipt',
  ]) assert.ok(script.includes(`groundbnb.${fn}(`), fn);
});

test('closed-path probes require denials and assert no durable factor history changed', () => {
  assert.match(script, /Factor challenge owner or session unavailable/);
  assert.match(script, /Factor operation identity unavailable/);
  assert.match(script, /result->>'status' IS DISTINCT FROM 'unknown'/);
  assert.match(script, /result->>'status' IS DISTINCT FROM 'rejected'/);
  assert.match(script, /count\(\*\) FROM groundbnb\.factor_challenge_operations\) IS DISTINCT FROM op_count/);
  assert.match(script, /COALESCE\(sum\(attempt_count\),0\) FROM groundbnb\.factor_attempt_windows\) IS DISTINCT FROM observed_attempts/);
  assert.match(script, /count\(\*\) FROM groundbnb\.privileged_factor_audit\) IS DISTINCT FROM audit_count/);
  assert.match(script, /Closed-path operator probes changed durable factor history/);
  assert.doesNotMatch(script, /^\s*(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/im);
});
