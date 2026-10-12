import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = await readFile(new URL('../db/operations/verify-m1-membership-reader.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/migrations/0011_membership_reader.sql', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../db/migrations/0007_membership_foundation.sql', import.meta.url), 'utf8');

test('membership reader operator acceptance is exact-baseline, private, synthetic, and rollback-only', () => {
  assert.match(script, /current_database\(\) IS DISTINCT FROM 'groundbnb'[\s\S]*session_user IS DISTINCT FROM 'neondb_owner'/);
  assert.match(script, /count\(\*\) FROM groundbnb\.schema_migrations\) IS DISTINCT FROM 11/);
  assert.match(script, /'0010_factor_recovery_activity'[\s\S]*'0011_membership_reader'/);
  assert.match(script, /count\(\*\) FROM neon_auth\."user"\) IS DISTINCT FROM 1/);
  assert.match(script, /email=e\.kind \|\| '-01@example\.test'[\s\S]*"emailVerified"=true/);
  assert.match(script, /\(role_record\.rolconfig @> ARRAY\[[^\]]+\]\) IS DISTINCT FROM true/);
  assert.match(script, /EXISTS\(SELECT 1 FROM pg_auth_members WHERE member=app_oid\)/);
  assert.match(script, /function_owner IS DISTINCT FROM owner_oid/);
  assert.match(script, /has_sequence_privilege\(app_oid,c\.oid,'USAGE'\)/);
  assert.match(script, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN[\s\S]*has_table_privilege\(app_oid,c\.oid/);
  assert.match(script, /CASE WHEN c\.relkind='S' THEN[\s\S]*has_sequence_privilege\(app_oid,c\.oid/);
  assert.match(script, /c\.relkind IN \('r','p','v','m','f'\)/);
  assert.match(script, /array_agg\(p\.oid::regprocedure::text ORDER BY p\.oid::regprocedure::text\)/);
  assert.match(script, /prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(script, /read_profile\(text,text\)[\s\S]*read_profile_operation\(text,text,uuid\)[\s\S]*save_profile_transfer\(text,text,uuid,bigint,jsonb,jsonb\)/);
  assert.match(script, /mode FROM groundbnb\.financial_dispatch_control[\s\S]*IS DISTINCT FROM 'paused'/);
  assert.match(script, /EXISTS\(SELECT 1 FROM groundbnb\.provider_rate_versions\)/);
  assert.match(script, /EXISTS\(SELECT 1 FROM groundbnb\.provider_financial_limit_versions\)/);
  assert.match(script, /read_membership\(identity_issuer,'m1u-unmapped-subject-acceptance'\)/);
  assert.match(script, /Missing base assignment did not fail closed/);
  assert.match(script, /Overlapping base membership assignments are not allowed/);
  assert.match(script, /grant_tie_a[\s\S]*grant_tie_b[\s\S]*grant_revoked[\s\S]*grant_future/);
  assert.match(script, /effectiveLifetimeGrants[\s\S]*grant_tie_a::text[\s\S]*grant_tie_b::text/);
  assert.match(script, /result#>>'\{baseAssignment,assignmentId\}' IS DISTINCT FROM assignment_current::text/);
  assert.match(script, /Membership reader did not return the coherent expected base, policy, and ordered overlays/i);
  assert.match(script, /M1_MEMBERSHIP_READER_ACCEPTANCE_PREPARED/);
  assert.match(script, /ROLLBACK\s*;\s*$/);
  assert.doesNotMatch(script, /\bCOMMIT\s*;/i);
  assert.doesNotMatch(script, /INSERT\s+INTO\s+neon_auth\./i);
  assert.doesNotMatch(script, /\b(?:fetch|https?\s*\(|curl|wget)\b/i);
});

test('operator coverage respects the database guard and documents unconstructible defensive cases', () => {
  assert.match(foundation, /_guard_base_assignment_overlap/);
  assert.match(foundation, /Overlapping base membership assignments are not allowed/);
  assert.match(migration, /base_count IS DISTINCT FROM 1 OR joined_base_count IS DISTINCT FROM 1/);
  assert.match(script, /do not disable\/bypass it to fabricate the reader's defensive ambiguity branch/i);
  assert.match(foundation, /CHECK \(expires_at IS NULL\)/);
  assert.match(script, /future overlay/);
});
