import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const up=readFileSync(new URL('../db/migrations/0004_profile_operation_status.sql',import.meta.url),'utf8');
const down=readFileSync(new URL('../db/migrations/0004_profile_operation_status_down.sql',import.meta.url),'utf8');
test('prepared status migration pins both synthetic branches and prior schema/role safeguards',()=>{
  for (const sql of [up,down]) {
    for (const pin of ['br-rough-flower-b8lerkcf','br-bitter-hall-b8ibnrfy','0001_environment','0002_profile_foundation','0003_profile_domain',
      'default_transaction_read_only=on','statement_timeout=5s','pg_auth_members','sole verified synthetic fixture']) assert.ok(sql.includes(pin),pin);
    assert.match(sql,/current_database\(\)<>'groundbnb'/);
    assert.match(sql,/rolbypassrls/);
    assert.match(sql,/has_table_privilege/);
  }
});
test('status SQL reads the authenticated owner original acknowledgment without changing product data',()=>{
  const body=up.slice(up.indexOf('CREATE FUNCTION'),up.indexOf('REVOKE ALL ON FUNCTION'));
  assert.match(body,/SECURITY DEFINER SET search_path=pg_catalog,pg_temp/);
  assert.match(body,/account_uuid:=groundbnb\._profile_account\(identity_issuer,identity_subject\)/);
  assert.match(body,/WHERE account_id=account_uuid AND operation_id=operation_uuid/);
  assert.match(body,/RETURN acknowledgment_json \|\| jsonb_build_object\('status','saved'\)/);
  assert.doesNotMatch(body,/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/);
  assert.match(up,/REVOKE ALL ON FUNCTION groundbnb\.read_profile_operation\(text,text,uuid\) FROM PUBLIC/);
  assert.match(up,/GRANT EXECUTE ON FUNCTION groundbnb\.read_profile_operation/);
  assert.doesNotMatch(up,/GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)/);
});
test('status rollback only removes reader and migration receipt, retaining durable saves',()=>{
  assert.match(down,/NOT EXISTS\(SELECT 1 FROM groundbnb.schema_migrations WHERE version='0004_profile_operation_status'\)/);
  assert.match(down,/DROP FUNCTION groundbnb\.read_profile_operation\(text,text,uuid\)/);
  assert.doesNotMatch(down,/^\s*(DROP TABLE|TRUNCATE\s|DELETE FROM groundbnb\.(profiles|profile_answers|profile_operations|accounts))/m);
});
