import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repair = await readFile(new URL('../db/operations/repair-m1-membership-reader-evaluated-at.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/migrations/0011_membership_reader.sql', import.meta.url), 'utf8');

test('membership evaluated_at repair is guarded, unique-fragment-only, and metadata-preserving', () => {
  assert.match(repair, /current_database\(\) IS DISTINCT FROM 'groundbnb'[\s\S]*session_user IS DISTINCT FROM 'neondb_owner'/);
  assert.match(repair, /count\(\*\) FROM groundbnb\.schema_migrations\) IS DISTINCT FROM 11/);
  assert.match(repair, /0010_factor_recovery_activity'[\s\S]*0011_membership_reader/);
  assert.match(repair, /email=e\.kind \|\| '-01@example\.test'[\s\S]*"emailVerified"=true/);
  assert.match(repair, /rolconfig @> ARRAY[\s\S]*IS DISTINCT FROM true/);
  assert.match(repair, /EXISTS\(SELECT 1 FROM pg_auth_members WHERE member=app_oid\)/);
  assert.match(repair, /original_owner IS DISTINCT FROM owner_oid/);
  assert.match(repair, /has_sequence_privilege\(app_oid,c\.oid,'USAGE'\)/);
  assert.match(repair, /CASE WHEN c\.relkind IN \('r','p','v','m','f'\) THEN[\s\S]*has_table_privilege\(app_oid,c\.oid/);
  assert.match(repair, /CASE WHEN c\.relkind='S' THEN[\s\S]*has_sequence_privilege\(app_oid,c\.oid/);
  assert.match(repair, /c\.relkind IN \('r','p','v','m','f'\)/);
  assert.match(repair, /read_profile\(text,text\)[\s\S]*read_profile_operation\(text,text,uuid\)[\s\S]*save_profile_transfer\(text,text,uuid,bigint,jsonb,jsonb\)/);
  assert.match(repair, /prorettype NOT IN \('trigger'::regtype,'event_trigger'::regtype\)/);
  assert.match(repair, /has_function_privilege\(app_oid,function_oid,'EXECUTE'\)/);
  assert.match(repair, /has_table_privilege\(app_oid,c\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\)/);
  assert.match(repair, /SELECT p\.oid,p\.proowner,p\.proacl,p\.proconfig,p\.prosecdef/);
  assert.match(repair, /regexp_matches\(definition,old_fragment_pattern,'g'\)/);
  assert.match(repair, /matches_found IS DISTINCT FROM 1/);
  assert.match(repair, /regexp_replace\(definition,old_fragment_pattern,replacement_fragment,'g'\)/);
  assert.match(repair, /EXECUTE repaired_definition/);
  assert.match(repair, /proowner=original_owner AND p\.proacl IS NOT DISTINCT FROM original_acl AND/);
  assert.match(repair, /p\.proconfig IS NOT DISTINCT FROM original_config/);
  assert.match(repair, /prosecdef=original_security_definer/);
  assert.match(repair, /M1_MEMBERSHIP_READER_EVALUATED_AT_REPAIR_PREPARED/);
  assert.match(repair, /COMMIT\s*;\s*$/);
  assert.doesNotMatch(repair, /\bGRANT\s+/i);
  assert.doesNotMatch(repair, /\b(?:INSERT|UPDATE|DELETE)\s+INTO\s+groundbnb\.(?!schema_migrations)/i);
  assert.doesNotMatch(repair, /\b(?:fetch|https?\s*\(|curl|wget)\b/i);
  assert.match(migration, /\(SELECT evaluated_at FROM evaluation\)/);
});
