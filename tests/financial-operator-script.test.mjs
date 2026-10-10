import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../db/operations/verify-m1-financial-membership.sql', import.meta.url), 'utf8');
const executable = sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n');

test('operator script is pinned, rollback-only, and keeps output fixed', () => {
  for (const pin of [
    "current_database() IS DISTINCT FROM 'groundbnb'", "session_user IS DISTINCT FROM 'neondb_owner'",
    'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy',
    ...['0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
      '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation',
      '0008_provider_reservations', '0009_privileged_factors'].map(version => `'${version}'`),
    "email=e.kind || '-01@example.test'", '"emailVerified"=true',
    "SELECT 'M1_FINANCIAL_MEMBERSHIP_ACCEPTANCE_PREPARED' AS result",
  ]) assert.ok(executable.includes(pin), pin);
  assert.match(executable, /\bBEGIN\s*;/i);
  assert.match(executable, /\bROLLBACK\s*;/i);
  assert.doesNotMatch(executable, /\bCOMMIT\b/i);
  assert.doesNotMatch(executable, /\b(?:ALTER|CREATE)\s+ROLE\b|\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|EXECUTE|USAGE)\b/i);
  assert.doesNotMatch(executable, /\b(?:https?:\/\/(?!example\.test)|password|secret|authorization)\b/i);
  assert.doesNotMatch(executable, /\bON_ERROR_STOP\b|^\\set/im);
  assert.match(executable, /SELECT count\(\*\) FROM groundbnb\.schema_migrations\) IS DISTINCT FROM 9/);
});

test('script checks membership versioning, overlay, overlap, and revocation history', () => {
  for (const invariant of [
    'membership_assignments', 'Overlapping base membership assignments are not allowed',
    'Published plan versions are immutable', 'access_grants', 'lifetime',
    'Grant revocation history is immutable', 'plan_version_id=plus_plan',
    'plan_version_id=base_plan',
  ]) assert.ok(executable.includes(invariant), invariant);
});

test('script covers paused mode, reserve and dispatch replay, uncertainty, release, and close', () => {
  for (const invariant of [
    "mode FROM groundbnb.financial_dispatch_control WHERE singleton) IS DISTINCT FROM 'paused'",
    "receipt->>'category' IS DISTINCT FROM 'paused'", 'maximumCostUsd', 'Reserve replay did not return its original receipt',
    "dispatchAuthorized' IS DISTINCT FROM 'false'", 'Settlement replay did not return original receipt',
    'needs_reconciliation', 'pending_usd>0', 'reconciliation_required',
    'NULL,true', 'Terminal released operation was reopened',
  ]) assert.ok(executable.includes(invariant), invariant);
  assert.match(sql, /no network dispatch/i);
  assert.match(sql, /not official vendor pricing/i);
});

test('synthetic monetary receipts compare numeric values without requiring a text scale', () => {
  assert.match(executable, /\(receipt->>'maximumCostUsd'\)::numeric IS DISTINCT FROM 0\.002::numeric/);
  assert.match(executable, /\(receipt->>'actualCostUsd'\)::numeric IS DISTINCT FROM 0\.001::numeric/);
  assert.doesNotMatch(executable, /receipt->>'(?:maximumCostUsd|actualCostUsd)' IS DISTINCT FROM '\d+\.\d+'/);
});

test('script asserts nonfinite and provenance failures in nested savepoints', () => {
  assert.match(executable, /'NaN'::numeric/);
  assert.match(executable, /Expected active rate provenance rejection/);
  assert.match(executable, /EXCEPTION WHEN check_violation/);
  assert.match(executable, /M1-01R synthetic arithmetic fixture/);
});
