import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = await readFile(new URL('../db/operations/grant-m1-membership-reader.sql', import.meta.url), 'utf8');
const membership = await readFile(new URL('../db/migrations/0011_membership_reader.sql', import.meta.url), 'utf8');
const factor = await readFile(new URL('../db/migrations/0012_factor_service.sql', import.meta.url), 'utf8');
const packet = await readFile(new URL('../docs/tasks/M1-01U-membership-reader.md', import.meta.url), 'utf8');

test('membership reader grant is pinned to the exact synthetic local/preview 0012 baseline', () => {
  assert.match(script, /current_database\(\) IS DISTINCT FROM 'groundbnb'[\s\S]*session_user IS DISTINCT FROM 'neondb_owner'/);
  assert.match(script, /e\.kind='local' AND e\.branch_id='br-rough-flower-b8lerkcf'[\s\S]*groundbnb_local_app/);
  assert.match(script, /e\.kind='preview' AND e\.branch_id='br-bitter-hall-b8ibnrfy'[\s\S]*groundbnb_preview_app/);
  assert.match(script, /count\(\*\) FROM groundbnb\.schema_migrations\) IS DISTINCT FROM 12/);
  for (const receipt of [
    '0001_environment','0002_profile_foundation','0003_profile_domain','0004_profile_operation_status',
    '0005_profile_records','0006_profile_transfer','0007_membership_foundation','0008_provider_reservations',
    '0009_privileged_factors','0010_factor_recovery_activity','0011_membership_reader','0012_factor_service',
  ]) assert.ok(script.includes(`'${receipt}'`), `missing receipt ${receipt}`);
  assert.match(script, /count\(\*\) FROM neon_auth\."user"\) IS DISTINCT FROM 1/);
  assert.match(script, /email=e\.kind \|\| '-01@example\.test'[\s\S]*"emailVerified"=true/);
});

test('grant preserves the existing five-function app boundary and adds only the reader', () => {
  assert.match(script, /EXISTS\(SELECT 1 FROM pg_auth_members WHERE member=app_oid\)/);
  assert.match(script, /default_transaction_read_only=on/);
  assert.match(script, /statement_timeout=5s/);
  assert.match(script, /NOT has_schema_privilege\(app_oid,'groundbnb','USAGE'\)/);
  assert.match(script, /has_table_privilege\(app_oid,'groundbnb\.environment_identity','SELECT'\) IS DISTINCT FROM true/);
  assert.match(script, /has_table_privilege\(app_oid,'groundbnb\.schema_migrations','SELECT'\) IS DISTINCT FROM true/);
  assert.match(script, /relkind IN \('r','p','v','m','f'\)/);
  assert.match(script, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN\s+has_table_privilege\(app_oid,c\.oid/);
  assert.match(script, /CASE WHEN c\.relkind='S' THEN\s+has_sequence_privilege\(app_oid,c\.oid,'USAGE'\)/);
  assert.match(script, /p\.prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(script, /ARRAY\['groundbnb\.read_profile\(text,text\)'[\s\S]*'groundbnb\.save_profile_transfer\(text,text,uuid,bigint,jsonb,jsonb\)'\]::text\[\]/);
  assert.match(script, /EXECUTE format\('GRANT EXECUTE ON FUNCTION groundbnb\.read_membership\(text,text\) TO %I',app_role\)/);
  assert.match(script, /ARRAY\['groundbnb\.read_membership\(text,text\)'[\s\S]*'groundbnb\.save_profile_transfer\(text,text,uuid,bigint,jsonb,jsonb\)'\]::text\[\]/);
  assert.match(script, /function_owner IS DISTINCT FROM owner_oid/);
  assert.match(script, /prosecdef FROM pg_proc WHERE oid=function_oid\) IS DISTINCT FROM true/);
  assert.match(script, /search_path=pg_catalog, pg_temp/);
  assert.match(script, /acl\.grantee=0/);
  assert.match(script, /has_function_privilege\(app_oid,function_oid,'EXECUTE'\)/);
  assert.match(script, /M1_MEMBERSHIP_READER_GRANT_APPLIED/);
  assert.match(script, /COMMIT\s*;\s*$/);

  const grantCalls = [...script.matchAll(/GRANT EXECUTE ON FUNCTION[^']+'/g)].map(([statement]) => statement);
  assert.deepEqual(grantCalls, ["GRANT EXECUTE ON FUNCTION groundbnb.read_membership(text,text) TO %I'"]);
  assert.doesNotMatch(script, /\b(?:CREATE|ALTER|DROP)\s+ROLE\b|PASSWORD\s*=/i);
  assert.doesNotMatch(script, /\bGRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)\b/i);
  assert.doesNotMatch(script, /\bGRANT\s+EXECUTE\s+ON\s+FUNCTION\s+groundbnb\.(?:read_factor|consume_factor|record_factor|_)/i);
  assert.doesNotMatch(script, /\b(?:INSERT|UPDATE|DELETE)\s+INTO\s+groundbnb\.(?!schema_migrations)/i);
  assert.doesNotMatch(script, /\b(?:fetch|https?\s*\(|curl|wget)\b/i);
  assert.match(membership, /base_count IS DISTINCT FROM 1 OR joined_base_count IS DISTINCT FROM 1/);
  assert.match(factor, /REVOKE ALL ON FUNCTION groundbnb\.read_factor_challenge_state/);
  assert.match(packet, /Never invent a Free default or silently select an arbitrary base assignment/);
});
