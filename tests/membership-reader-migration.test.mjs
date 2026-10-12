import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0011_membership_reader.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0011_membership_reader_down.sql', import.meta.url), 'utf8');
const readerStart = up.indexOf('CREATE FUNCTION groundbnb.read_membership(identity_issuer text,identity_subject text)');
const readerEnd = up.indexOf('REVOKE ALL ON FUNCTION groundbnb.read_membership(text,text)', readerStart);
const reader = readerStart < 0 || readerEnd < 0 ? '' : up.slice(readerStart, readerEnd);

test('0011 up/down require exact pinned synthetic 0001–0011 receipt and restricted app baseline', () => {
  for (const sql of [up, down]) {
    assert.match(sql, /current_database\(\)<>'groundbnb'/);
    assert.match(sql, /session_user<>'neondb_owner'/);
    assert.match(sql, /br-rough-flower-b8lerkcf/);
    assert.match(sql, /br-bitter-hall-b8ibnrfy/);
    assert.match(sql, /groundbnb_local_app/);
    assert.match(sql, /groundbnb_preview_app/);
    for (const version of [
      '0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors', '0010_factor_recovery_activity',
    ]) assert.ok(sql.includes(`version='${version}'`), version);
    assert.match(sql, /email=e\.kind \|\| '-01@example\.test'/);
    assert.match(sql, /"emailVerified"=true/);
    assert.match(sql, /default_transaction_read_only=on/);
    assert.match(sql, /statement_timeout=5s/);
    assert.match(sql, /has_function_privilege/);
    assert.match(sql, /has_table_privilege/);
    assert.match(sql, /SELECT count\(\*\) INTO receipt_count FROM groundbnb\.schema_migrations/);
    assert.doesNotMatch(sql, /^\s*(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD)\b/im);
  }
  assert.match(up, /receipt_count IS DISTINCT FROM 10/);
  assert.match(down, /receipt_count IS DISTINCT FROM 11/);
  assert.match(up, /exact 0001-0010 baseline and no prior 0011/);
  assert.match(down, /exact 0001-0011 baseline/);
});

test('reader derives identity through the private account helper and returns only the pinned snapshot', () => {
  assert.match(up, /CREATE FUNCTION groundbnb\.read_membership\(identity_issuer text,identity_subject text\) RETURNS jsonb/);
  assert.match(up, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp/);
  assert.match(up, /account_uuid:=groundbnb\._profile_account\(identity_issuer,identity_subject\)/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\.read_membership\(text,text\) FROM PUBLIC/);
  assert.match(up, /Membership reader must remain private with no app-role or PUBLIC EXECUTE/);
  assert.match(up, /'evaluatedAt',evaluated_at/);
  assert.match(up, /'policy',policy_value/);
  assert.match(up, /'baseAssignment',base_value/);
  assert.match(up, /'effectiveLifetimeGrants',grant_values/);
  assert.match(up, /'effectiveLifetimeGrant',effective_grant/);
  assert.doesNotMatch(up, /CREATE FUNCTION groundbnb\.read_membership\([^)]*account_id/i);
  assert.doesNotMatch(up, /\b(?:INSERT|UPDATE|DELETE)\s+INTO\s+groundbnb\.(?:membership_|access_grants|policy_audit)/i);
  assert.doesNotMatch(up, /'free'|DEFAULT\s+'free'/i);
  assert.doesNotMatch(up, /^\s*GRANT\b/im);
});

test('base and lifetime selection is fail-closed, half-open, and deterministic', () => {
  assert.match(up, /base_count IS DISTINCT FROM 1/);
  assert.match(up, /membership_unavailable/);
  assert.match(up, /a\.effective_from<=e\.evaluated_at/);
  assert.match(up, /a\.effective_until IS NULL OR a\.effective_until>e\.evaluated_at/);
  assert.match(up, /pv\.published_at IS NOT NULL/);
  assert.match(up, /pv\.published_at<=[ag]\.evaluated_at/);
  assert.match(up, /g\.revoked_at IS NULL/);
  assert.match(up, /g\.starts_at<=e\.evaluated_at/);
  assert.match(up, /g\.expires_at IS NULL OR g\.expires_at>e\.evaluated_at/);
  assert.match(up, /grant_count IS DISTINCT FROM joined_grant_count/);
  assert.match(up, /starts_at DESC,grant_id::text ASC/);
  assert.match(up, /jsonb_agg\(value ORDER BY starts_at DESC,grant_id::text ASC\)/);
  assert.doesNotMatch(up, /plan_status\s*=\s*'active'|p\.status\s*=\s*'active'/i);
});

test('policy, assignments, and grants use one materialized MVCC snapshot after owner locking', () => {
  assert.ok(reader, 'reader function body exists');
  assert.ok(reader.indexOf('account_uuid:=groundbnb._profile_account') < reader.indexOf('WITH evaluation AS MATERIALIZED'));
  assert.match(reader, /evaluation AS MATERIALIZED \(\s*SELECT clock_timestamp\(\) AS evaluated_at/);
  assert.doesNotMatch(reader, /statement_timestamp\(\)/i);
  assert.match(reader, /active_base AS MATERIALIZED/);
  assert.match(reader, /valid_base AS MATERIALIZED/);
  assert.match(reader, /active_grants AS MATERIALIZED/);
  assert.match(reader, /valid_grants AS MATERIALIZED/);
  assert.match(reader, /FROM base_summary CROSS JOIN grant_summary/);
  assert.match(reader, /INTO evaluated_at,policy_value,base_count,joined_base_count,base_value,[\s\S]*grant_count,joined_grant_count,grant_values,effective_grant/);
  for (const [table, expected] of [
    ['membership_policy', 1], ['membership_assignments', 1], ['access_grants', 1],
    ['membership_plan_versions', 2], ['membership_plans', 2],
  ]) assert.equal((reader.match(new RegExp(`groundbnb\\.${table}\\b`, 'g')) ?? []).length, expected, table);
  assert.doesNotMatch(reader, /SELECT\s+(?:count\(\*\)|jsonb_build_object)[\s\S]{0,100}?INTO\s+\w+[\s\S]{0,100}?FROM\s+groundbnb\./i);
});

test('rollback preserves all membership data and refuses unexpected reader execution grants', () => {
  assert.match(down, /Rollback refused: membership reader has unexpected EXECUTE grants/);
  assert.match(down, /has_function_privilege\(role_record\.oid,function_oid,'EXECUTE'\)/);
  assert.match(down, /acl\.grantee<>function_owner/);
  assert.match(down, /DROP FUNCTION groundbnb\.read_membership\(text,text\)/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0011_membership_reader'/);
  assert.doesNotMatch(down, /^\s*(?:DROP TABLE|TRUNCATE|DELETE FROM groundbnb\.(?:membership_|access_grants|policy_audit))/im);
  assert.doesNotMatch(down, /^\s*GRANT\b/im);
});
