import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0006_profile_transfer.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0006_profile_transfer_down.sql', import.meta.url), 'utf8');
const signature = 'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)';
const functionStart = up.indexOf('CREATE FUNCTION groundbnb.save_profile_transfer(');
const functionEnd = up.indexOf('\nEND $$;', functionStart);
const body = up.slice(functionStart, functionEnd);

test('forward migration is pinned to the synthetic 0001-0005 branches, fixture, and current ACL boundary', () => {
  for (const text of ['br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy', 'groundbnb_local_app', 'groundbnb_preview_app',
    "current_database()<>'groundbnb'", ...['0001_environment', '0002_profile_foundation', '0003_profile_domain',
      '0004_profile_operation_status', '0005_profile_records'].map(version => `version='${version}'`),
    "email=e.kind || '-01@example.test'", '"emailVerified"=true', 'default_transaction_read_only=on',
    'statement_timeout=5s', 'role_record.rolconnlimit<>4', 'pg_auth_members', 'has_database_privilege',
    'has_schema_privilege', 'groundbnb.read_profile(text,text)', 'groundbnb.save_profile_records(text,text,uuid,bigint,jsonb,jsonb)',
    'groundbnb._valid_profile_patch(jsonb)', 'groundbnb._valid_profile_records(jsonb,jsonb)']) assert.ok(up.includes(text), text);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\.save_profile_transfer/);
  assert.ok(up.includes(`GRANT EXECUTE ON FUNCTION ${signature} TO %I`));
  assert.match(up, /acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
  assert.doesNotMatch(up, /\b(?:ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
});

test('one transfer function accepts fields-only or notes-only selection but rejects empty and malformed payloads', () => {
  assert.ok(functionStart >= 0 && functionEnd > functionStart, 'transfer function body is delimited');
  assert.match(body, /groundbnb\._profile_account\(identity_issuer,identity_subject\)/);
  assert.match(body, /profile_patch IS NULL OR jsonb_typeof\(profile_patch\) IS DISTINCT FROM 'object'/);
  assert.match(body, /note_rows IS NULL OR jsonb_typeof\(note_rows\) IS DISTINCT FROM 'array'/);
  assert.match(body, /count\(\*\) FROM jsonb_object_keys\(profile_patch\)\)>0 AND NOT groundbnb\._valid_profile_patch\(profile_patch\)/);
  assert.match(body, /note_ids>0 AND NOT groundbnb\._valid_profile_records\('\[\]'::jsonb,note_rows\)/);
  assert.match(body, /count\(\*\) FROM jsonb_object_keys\(profile_patch\)\)=0 AND note_ids=0/);
  assert.match(body, /operationKind','profile_transfer'/);
});

test('transfer blocks unverified resolved home points and clears old resolution atomically with address changes', () => {
  assert.match(body, /profile_patch \? 'homePoint' AND profile_patch->'homePoint'->'value' IS DISTINCT FROM 'null'::jsonb/);
  assert.match(body, /IF profile_patch \? 'homeAddress' THEN/);
  assert.match(body, /jsonb_set\(profile_patch,'\{homePoint\}','\{"value":null,"answered":false\}'::jsonb,true\)/);
  assert.ok(body.indexOf('homePoint') < body.indexOf("IF profile_patch ? 'homeAddress'"));
});

test('operation replay precedes revision conflict, and stale reports compare both selected domains', () => {
  const request = body.indexOf("request_json:=jsonb_build_object('operationKind','profile_transfer'");
  const replayLookup = body.indexOf('SELECT * INTO prior FROM groundbnb.profile_operations', request);
  const replayReturn = body.indexOf('RETURN prior.acknowledgment;', replayLookup);
  const profileLock = body.indexOf('FOR UPDATE;', replayReturn);
  const conflict = body.indexOf("'category','conflict'", profileLock);
  assert.ok(request >= 0 && replayLookup > request && replayReturn > replayLookup && profileLock > replayReturn && conflict > profileLock);
  assert.match(body, /prior\.request<>request_json/);
  assert.ok(body.includes("groundbnb._profile_snapshot(account_uuid)->'answers'->p.key"));
  assert.match(body, /'profileFields',COALESCE\(profile_comparison/);
  assert.match(body, /'notes',COALESCE\(note_comparison/);
});

test('only new manual notes are inserted; old IDs, AI labels, quote links, and tombstones cannot be overwritten', () => {
  assert.match(body, /incoming->>'origin'<>'user'/);
  assert.match(body, /incoming->'selectedQuoteIds'<>'\[\]'::jsonb/);
  assert.match(body, /incoming->'userRemoved'<>'false'::jsonb/);
  assert.match(body, /JOIN groundbnb\.profile_notes n ON n\.account_id=account_uuid AND n\.note_id=\(value->>'id'\)::uuid/);
  assert.match(body, /INSERT INTO groundbnb\.profile_notes\(account_id,note_id,note_text,origin,selected_quote_ids,user_removed,updated_at\)/);
  assert.match(body, /SELECT account_uuid,\(n->>'id'\)::uuid,n->>'text','user','\[\]'::jsonb,false,saved_time/);
  assert.doesNotMatch(body, /ON CONFLICT\(account_id,note_id\)/);
  assert.doesNotMatch(body, /DELETE FROM groundbnb\.profile_notes/);
});

test('profile fields, notes, one revision, and one durable acknowledgment commit together', () => {
  assert.match(body, /INSERT INTO groundbnb\.profile_answers\(account_id,field,value,answered,updated_at\)/);
  assert.match(body, /UPDATE groundbnb\.profiles SET revision=revision\+1,updated_at=saved_time WHERE account_id=account_uuid/);
  assert.equal((body.match(/UPDATE groundbnb\.profiles SET revision=revision\+1/g) ?? []).length, 1);
  assert.match(body, /jsonb_build_object\('ok',true,'operationKind','profile_transfer','operationId',operation_uuid/);
  assert.match(body, /'profile',groundbnb\._profile_snapshot\(account_uuid\)/);
  assert.match(body, /INSERT INTO groundbnb\.profile_operations\(account_id,operation_id,request,acknowledgment,saved_at\)/);
  assert.match(body, /'affectedIds',COALESCE\(affected,'\[\]'::jsonb\)/);
});

test('forward appends only the function grant, while rollback refuses transfer receipts and drops only function/receipt', () => {
  assert.match(up, /INSERT INTO groundbnb\.schema_migrations\(version\) VALUES\('0006_profile_transfer'\)/);
  assert.match(down, /version='0006_profile_transfer'/);
  assert.match(down, /request->>'operationKind'='profile_transfer'/);
  assert.match(down, /Rollback refused: profile-transfer operation acknowledgments/);
  assert.match(down, /DROP FUNCTION groundbnb\.save_profile_transfer/);
  assert.match(down, /DELETE FROM groundbnb\.schema_migrations WHERE version='0006_profile_transfer'/);
  assert.doesNotMatch(down, /DELETE FROM groundbnb\.profile_operations|DELETE FROM groundbnb\.profile_notes|DELETE FROM groundbnb\.profile_answers/);
  assert.doesNotMatch(down, /^\s*(?:DROP TABLE|TRUNCATE|CASCADE)\b/im);
  assert.doesNotMatch(down, /\b(?:GRANT|ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
});
