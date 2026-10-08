import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PROFILE_CATALOGS, PROFILE_FIELD_DEFINITIONS } from '../lib/profile-domain.mjs';
import { PROFILE_CURRENCY_CODES } from '../lib/profile-currency-codes.mjs';
import { PROFILE_DOMAIN_REGISTRY_HASH, buildForwardMigration } from '../scripts/generate-m1-profile-domain-migration.mjs';

const up = readFileSync(new URL('../db/migrations/0003_profile_domain.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0003_profile_domain_down.sql', import.meta.url), 'utf8');
const originalFields = ['homeAddress', 'dietaryRequirements', 'specialRequirements', 'hasPets',
  'alwaysBeginEndAtHome', 'travelerCount', 'preferredRegions'];

test('forward migration is the exact deterministic generator output', () => {
  assert.equal(up, buildForwardMigration());
  assert.match(up, /Generated validator registry is frozen below with its source hash/);
});

test('frozen SQL registry snapshot matches the current v1 source registry and hash', () => {
  const snapshotStart = up.indexOf('-- Frozen profile-domain registry snapshot:\n') + '-- Frozen profile-domain registry snapshot:\n'.length;
  const snapshotEnd = up.indexOf('\n\nCREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch', snapshotStart);
  const frozen = up.slice(snapshotStart, snapshotEnd).split('\n').map(line => line.replace(/^-- ?/, '')).join('\n');
  const parsed = JSON.parse(frozen);
  const expected = {
    version: 1,
    fields: PROFILE_FIELD_DEFINITIONS,
    catalogs: PROFILE_CATALOGS,
    currencies: PROFILE_CURRENCY_CODES,
  };
  assert.deepEqual(parsed, expected);
  assert.equal(createHash('sha256').update(JSON.stringify(parsed)).digest('hex').toUpperCase(), PROFILE_DOMAIN_REGISTRY_HASH);
  assert.equal(PROFILE_DOMAIN_REGISTRY_HASH, '5BE2FD8ADC201DDDFC7BA8089F1424FA9223226F8B23CBBD3B7174D233DA36DA');
  assert.match(up, new RegExp(`Generated profile registry SHA-256: ${PROFILE_DOMAIN_REGISTRY_HASH}`));
});

test('forward migration is pinned to the approved synthetic branches and preserves the role boundary', () => {
  for (const text of ['br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
    "current_database()<>'groundbnb'", "version='0001_environment'", "version='0002_profile_foundation'",
    'default_transaction_read_only=on', 'statement_timeout=5s', 'role_record.rolconnlimit<>4',
    'pg_auth_members', 'neon_auth."user"', 'has_database_privilege', 'has_schema_privilege']) assert.ok(up.includes(text), text);
  assert.doesNotMatch(up, /\b(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
  assert.match(up, /SET search_path=pg_catalog,pg_temp/);
  assert.match(up, /has_function_privilege\(role_record\.oid,'groundbnb\._valid_profile_patch\(jsonb\)','EXECUTE'\)/);
  assert.match(up, /has_table_privilege\(role_record\.oid,c\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\)/);
});

test('forward database allowlist and validator fields match the full v1 account domain', () => {
  const check = up.match(/ADD CONSTRAINT profile_answers_field_check CHECK\(field IN \(([^)]*)\)\)/)?.[1];
  assert.ok(check);
  const allowed = [...check.matchAll(/'((?:[^']|'')*)'/g)].map(match => match[1].replaceAll("''", "'"));
  assert.deepEqual(allowed, Object.keys(PROFILE_FIELD_DEFINITIONS));
  const functionBody = up.slice(up.indexOf('CREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch'), up.indexOf('\n$$;', up.indexOf('CREATE OR REPLACE FUNCTION groundbnb._valid_profile_patch')));
  for (const field of Object.keys(PROFILE_FIELD_DEFINITIONS)) assert.ok(functionBody.includes(`WHEN item.key='${field}' THEN`), field);
  for (const field of ['startLocation', 'destination', 'tripLengthDays', 'notes', 'units', 'fundTheFunEnabled', 'ownerId', 'revision']) {
    assert.ok(!allowed.includes(field), field);
  }
  assert.match(functionBody, /octet_length\(patch::text\)>16384/);
  assert.match(functionBody, /field_count NOT BETWEEN 1 AND 55/);
  assert.match(functionBody, /numeric<1/);
  assert.match(functionBody, /numeric>999/);
  assert.match(functionBody, /jsonb_object_keys\(item\.value\)\)<>2/);
  assert.match(functionBody, /item\.value \? 'value' AND item\.value \? 'answered'/);
  assert.doesNotMatch(functionBody, /item\.value \? 'scope'|item\.value \? 'updatedAt'/);
  assert.match(functionBody, /NOT CASE WHEN value_type='array' THEN jsonb_array_length\(answer_value\)=0 ELSE false END/);
  assert.match(functionBody, /jsonb_typeof\(v\) IS DISTINCT FROM 'string'/);
  assert.match(functionBody, /Resolved home points remain read-only until a provenance-bound resolver path exists/);
  assert.match(functionBody, /IF value_type='object' THEN RETURN false; END IF/);
  assert.match(functionBody, /jsonb_array_length\(answer_value\)>64/);
});

test('reverse migration is guarded, lossless, and restores the exact seven-field validator', () => {
  for (const text of ['br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', "version='0001_environment'",
    "version='0002_profile_foundation'", "version='0003_profile_domain'", 'applied_at', 'updated_at>applied',
    'saved_at>applied', 'field NOT IN', "NOT BETWEEN 1 AND 200", 'Rollback refused']) assert.ok(down.includes(text), text);
  assert.doesNotMatch(down, /\b(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
  const check = down.match(/ADD CONSTRAINT profile_answers_field_check CHECK\(field IN\s*\(([^)]*)\)\)/)?.[1];
  assert.ok(check);
  const restored = [...check.matchAll(/'((?:[^']|'')*)'/g)].map(match => match[1].replaceAll("''", "'"));
  assert.deepEqual(restored, originalFields);
  assert.match(down, /NOT BETWEEN 1 AND 7/);
  assert.match(down, /NOT BETWEEN 1 AND 200/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0003_profile_domain'/);
});
