import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0005_profile_records.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0005_profile_records_down.sql', import.meta.url), 'utf8');

test('forward migration is pinned to synthetic local/preview schema 0001-0004 and existing app-role baseline', () => {
  for (const value of ['br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
    "current_database()<>'groundbnb'", "version='0001_environment'", "version='0002_profile_foundation'",
    "version='0003_profile_domain'", "version='0004_profile_operation_status'", "version='0005_profile_records'",
    "email=e.kind || '-01@example.test'", '"emailVerified"=true', 'role_record.rolconnlimit<>4',
    'default_transaction_read_only=on', 'statement_timeout=5s', 'pg_auth_members', 'has_database_privilege',
    'has_schema_privilege', 'read_profile_operation(text,text,uuid)']) assert.ok(up.includes(value), value);
  assert.doesNotMatch(up, /\b(?:GRANT\s+ALL|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
  assert.match(up, /CREATE TABLE groundbnb\.profile_vehicles/);
  assert.match(up, /CREATE TABLE groundbnb\.profile_notes/);
});

test('normalized record tables are account-owned, RLS-enabled, and unavailable for direct app access', () => {
  for (const table of ['profile_vehicles', 'profile_notes']) {
    const tableSql = up.slice(up.indexOf(`CREATE TABLE groundbnb.${table}`), up.indexOf(');', up.indexOf(`CREATE TABLE groundbnb.${table}`)) + 2);
    assert.match(tableSql, /account_id uuid NOT NULL REFERENCES groundbnb\.profiles\(account_id\)/);
    assert.match(tableSql, /PRIMARY KEY\(account_id,[a-z_]+\)/);
    assert.match(up, new RegExp(`ALTER TABLE groundbnb\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(up, new RegExp(`has_table_privilege\\(app_oid,c\\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\\)`));
  }
  assert.match(up, /REVOKE ALL ON groundbnb\.profile_vehicles,groundbnb\.profile_notes FROM PUBLIC/);
  assert.doesNotMatch(up, /GRANT\s+[^;]*\b(?:profile_vehicles|profile_notes)\b/i);
  assert.doesNotMatch(up, /CREATE\s+POLICY\s+.*(?:profile_vehicles|profile_notes)/i);
});

test('private record validator mirrors the normalized server shape and closes record keys', () => {
  const validator = up.slice(up.indexOf('CREATE FUNCTION groundbnb._valid_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb._valid_profile_records')));
  for (const value of [
    'jsonb_array_length(vehicle_rows)>100', 'jsonb_array_length(note_rows)>100',
    'octet_length(vehicle_rows::text)+octet_length(note_rows::text)>16384',
    "'id','name','type','ownership','propulsion','fuelEconomy','dimensions','location','locationVerifiedAt'",
    "'lengthMeters','widthMeters','heightMeters'", "'latitude','longitude','origin'", "val->>'origin'<>'user'",
    "'selectedQuoteIds','userRemoved'", "item->>'origin'<>'user'", 'userRemoved',
    "locationVerifiedAt", "item->>'ownership' NOT IN ('owned','rented')",
  ]) assert.ok(validator.includes(value), value);
  assert.match(up, /has_function_privilege\(app_oid,'groundbnb\._valid_profile_records\(jsonb,jsonb\)','EXECUTE'\)/);
  assert.match(validator, /to_char\(timestamp_text::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\)<>timestamp_text/);
  assert.match(validator, /EXCEPTION WHEN others THEN\s+RETURN false/);
});

test('canonical snapshot adds normalized arrays while preserving profile answers and revision fields', () => {
  const snapshot = up.slice(up.indexOf('CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot'), up.indexOf('\n$$;', up.indexOf('CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot')));
  for (const key of ["'accountId'", "'revision'", "'createdAt'", "'updatedAt'", "'answers'", "'vehicles'", "'notes'",
    "'fuelEconomy'", "'dimensions'", "'locationVerifiedAt'", "'selectedQuoteIds'", "'userRemoved'"]) assert.ok(snapshot.includes(key), key);
  assert.match(snapshot, /COALESCE\([\s\S]*?'\[\]'::jsonb/);
  assert.match(snapshot, /profile_answers a WHERE a\.account_id=p\.account_id/);
  assert.match(snapshot, /profile_vehicles v WHERE v\.account_id=p\.account_id/);
  assert.match(snapshot, /profile_notes n WHERE n\.account_id=p\.account_id/);
});

test('record write is identity-bound, revision-checked, replay-safe, atomic, and namespaced', () => {
  const writer = up.slice(up.indexOf('CREATE FUNCTION groundbnb.save_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb.save_profile_records')));
  for (const value of [
    'groundbnb._profile_account(identity_issuer,identity_subject)', "'operationKind','profile_records'",
    'prior.request<>request_json', 'prior.acknowledgment', 'FOR UPDATE', 'current_revision<>expected_revision',
    "'category','conflict'", 'profile_vehicles(account_id,vehicle_id', 'profile_notes(account_id,note_id',
    'revision=revision+1', 'groundbnb._profile_snapshot(account_uuid)', 'INSERT INTO groundbnb.profile_operations',
    "'affectedIds'", "'operationKind','profile_records'", "'operationId'", "'savedAt'",
  ]) assert.ok(writer.includes(value), value);
  assert.match(writer, /incoming->>'origin'<>'user' OR incoming->'selectedQuoteIds'<>'\[\]'::jsonb/);
  assert.match(writer, /incoming->>'origin'<>'user'/);
  assert.match(writer, /origin=groundbnb\.profile_notes\.origin/);
  assert.match(writer, /existing_note\.user_removed AND incoming->'userRemoved'<>'true'::jsonb/);
  assert.match(writer, /existing_note\.selected_quote_ids @> jsonb_build_array\(value\)/);
  assert.match(writer, /user_removed=groundbnb\.profile_notes\.user_removed OR EXCLUDED\.user_removed/);
  assert.match(writer, /groundbnb\.profile_vehicles\.fuel_economy->'origin'/);
  assert.match(writer, /groundbnb\.profile_vehicles\.location->'origin'/);
  assert.match(writer, /UNION SELECT \(n->>'id'\)::uuid/);
});

test('stale record revisions return owner-scoped current and proposed record comparisons', () => {
  const writer = up.slice(up.indexOf('CREATE FUNCTION groundbnb.save_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb.save_profile_records')));
  const conflict = writer.slice(writer.indexOf('IF current_revision<>expected_revision THEN'), writer.indexOf('END IF;', writer.indexOf('IF current_revision<>expected_revision THEN')));
  for (const value of [
    "'category','conflict'", "'currentRevision',current_revision", "'fieldComparison'",
    "'vehicles',vehicle_comparison", "'notes',note_comparison", "'current',current_row.vehicle_json",
    "'proposed',proposed", "'current',current_row.note_json", 'v.account_id=account_uuid', 'n.account_id=account_uuid',
    'v.vehicle_id=(proposed->>\'id\')::uuid', 'n.note_id=(proposed->>\'id\')::uuid',
  ]) assert.ok(conflict.includes(value), value);
  assert.match(conflict, /COALESCE\(jsonb_object_agg\(proposed->>'id'/);
  assert.match(conflict, /jsonb_build_object\('vehicles',vehicle_comparison,'notes',note_comparison\)/);
});

test('record acknowledgments carry a distinct operation kind and stored request discriminator', () => {
  const writer = up.slice(up.indexOf('CREATE FUNCTION groundbnb.save_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb.save_profile_records')));
  assert.match(writer, /jsonb_build_object\('operationKind','profile_records','expectedRevision',expected_revision/);
  assert.match(writer, /jsonb_build_object\('ok',true,'operationKind','profile_records','operationId',operation_uuid/);
  assert.match(writer, /IF prior\.request<>request_json THEN RETURN jsonb_build_object\('ok',false,'category','validation'\)/);
});

test('manual edits preserve existing AI provenance without trusting client origin', () => {
  const validator = up.slice(up.indexOf('CREATE FUNCTION groundbnb._valid_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb._valid_profile_records')));
  const writer = up.slice(up.indexOf('CREATE FUNCTION groundbnb.save_profile_records'), up.indexOf('\n$$;', up.indexOf('CREATE FUNCTION groundbnb.save_profile_records')));
  assert.match(validator, /item->>'origin'<>'user'/);
  assert.match(writer, /IF incoming->>'origin'<>'user' OR incoming->'selectedQuoteIds'<>'\[\]'::jsonb/);
  assert.match(writer, /origin=groundbnb\.profile_notes\.origin/);
  assert.doesNotMatch(writer, /origin=EXCLUDED\.origin/);
});

test('only the scoped app writer function is newly granted, with fixed private helpers', () => {
  assert.match(up, /LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\._valid_profile_records\(jsonb,jsonb\),\s*groundbnb\.save_profile_records\(text,text,uuid,bigint,jsonb,jsonb\) FROM PUBLIC/);
  assert.match(up, /GRANT EXECUTE ON FUNCTION groundbnb\.save_profile_records\(text,text,uuid,bigint,jsonb,jsonb\) TO %I/);
  assert.match(up, /has_function_privilege\(app_oid,'groundbnb\.save_profile_records\(text,text,uuid,bigint,jsonb,jsonb\)','EXECUTE'\)/);
  assert.match(up, /acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
  assert.doesNotMatch(up, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+groundbnb\._valid_profile_records/i);
});

test('reverse migration refuses record data or record-operation acknowledgments and restores the 0004 snapshot', () => {
  for (const value of ["version='0001_environment'", "version='0002_profile_foundation'", "version='0003_profile_domain'",
    "version='0004_profile_operation_status'", "version='0005_profile_records'", 'default_transaction_read_only=on',
    'statement_timeout=5s', 'profile_vehicles', 'profile_notes', "request->>'operationKind'='profile_records'",
    'Rollback refused', 'DROP FUNCTION groundbnb.save_profile_records', 'DROP FUNCTION groundbnb._valid_profile_records',
    "DELETE FROM groundbnb.schema_migrations WHERE version='0005_profile_records'"]) assert.ok(down.includes(value), value);
  const restored = down.slice(down.indexOf('CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot'), down.indexOf('\n$$;', down.indexOf('CREATE OR REPLACE FUNCTION groundbnb._profile_snapshot')));
  for (const key of ["'accountId'", "'revision'", "'createdAt'", "'updatedAt'", "'answers'"]) assert.ok(restored.includes(key), key);
  assert.doesNotMatch(restored, /'vehicles'|'notes'/);
  assert.doesNotMatch(down, /\b(?:GRANT\s+ALL|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
});
