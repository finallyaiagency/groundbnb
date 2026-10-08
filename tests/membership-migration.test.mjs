import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MEMBERSHIP_PLAN_CATALOG, MEMBERSHIP_POLICY_DEFAULTS } from '../lib/membership-catalog.mjs';

const up = readFileSync(new URL('../db/migrations/0007_membership_foundation.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0007_membership_foundation_down.sql', import.meta.url), 'utf8');
const snapshots = text => [...text.matchAll(/WITH catalog AS \(SELECT '(\[[^\n]*\])'::jsonb AS rows\)/g)]
  .map(([, json]) => JSON.parse(json));

test('up and down are pinned to database, branches, migrations, sole fixture, and app-role baseline', () => {
  for (const sql of [up, down]) {
    for (const pin of [
      "current_database()<>'groundbnb'",
      'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy',
      'groundbnb_local_app', 'groundbnb_preview_app',
      ...['0001_environment', '0002_profile_foundation', '0003_profile_domain',
        '0004_profile_operation_status', '0005_profile_records', '0006_profile_transfer'].map(version => `version='${version}'`),
      'version=\'0007_membership_foundation\'', 'email=e.kind || \'-01@example.test\'',
      '"emailVerified"=true', 'default_transaction_read_only=on', 'statement_timeout=5s',
      'pg_auth_members', 'has_database_privilege', 'has_schema_privilege', 'has_table_privilege',
      'groundbnb.read_profile(text,text)', 'groundbnb.save_profile_transfer(text,text,uuid,bigint,jsonb,jsonb)',
      'sole verified synthetic fixture',
    ]) assert.ok(sql.includes(pin), pin);
    assert.doesNotMatch(sql, /\b(?:ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
  }
});

test('SQL seed snapshot exactly matches the validated versioned v1 catalog', () => {
  const upSeeds = snapshots(up);
  assert.equal(upSeeds.length, 2);
  assert.deepEqual(upSeeds[0], MEMBERSHIP_PLAN_CATALOG);
  assert.deepEqual(upSeeds[1], MEMBERSHIP_PLAN_CATALOG);
  assert.match(up, /published_at\s+IS NULL/);
  assert.ok(up.includes(`VALUES(true,'${MEMBERSHIP_POLICY_DEFAULTS.commercialMode}',`));
  assert.ok(up.includes(`'${MEMBERSHIP_POLICY_DEFAULTS.enforcedTestCohorts}',false,false)`));
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.checkoutEnabled, false);
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.supplierTransactionsEnabled, false);
  assert.deepEqual(MEMBERSHIP_PLAN_CATALOG.map(({ plan }) => [plan.key, plan.displayName]), [
    ['free', 'Free'], ['plus', 'Plus'], ['pro', 'Pro'],
  ]);
});

test('membership records pin versions and owners without coupling account role or inserting assignments', () => {
  for (const definition of [
    'membership_plans', 'membership_plan_versions', 'membership_policy', 'membership_assignments', 'access_grants', 'policy_audit',
  ]) assert.match(up, new RegExp(`CREATE TABLE groundbnb\\.${definition}\\s*\\(`));
  assert.match(up, /plan_version_id uuid NOT NULL REFERENCES groundbnb\.membership_plan_versions\(version_id\) ON DELETE RESTRICT/);
  assert.match(up, /created_by text NOT NULL CHECK/);
  assert.match(up, /'migration:m1-01k'/);
  assert.match(up, /account_id uuid NOT NULL REFERENCES groundbnb\.accounts\(id\) ON DELETE RESTRICT/);
  assert.match(up, /granted_by uuid NOT NULL REFERENCES groundbnb\.accounts\(id\) ON DELETE RESTRICT/);
  assert.match(up, /actor_account_id uuid NOT NULL REFERENCES groundbnb\.accounts\(id\) ON DELETE RESTRICT/);
  assert.match(up, /grant_type text NOT NULL CHECK \(grant_type='lifetime'\)/);
  assert.match(up, /CHECK \(expires_at IS NULL\)/);
  assert.match(up, /status text NOT NULL CHECK \(status IN \('scheduled','active','ended','revoked'\)\)/);
  assert.match(up, /INSERT INTO groundbnb\.membership_plans/);
  assert.match(up, /INSERT INTO groundbnb\.membership_plan_versions/);
  assert.doesNotMatch(up, /INSERT INTO groundbnb\.(accounts|account_identities|membership_assignments|access_grants|policy_audit)/);
  assert.doesNotMatch(up, /UPDATE groundbnb\.accounts|role\s*=\s*'owner'|role\s*=\s*'admin'/i);
});

test('published versions and issued history cannot be overwritten or deleted; base periods are serialized', () => {
  assert.match(up, /published plan versions are immutable/i);
  assert.match(up, /Only a membership plan display label may change/i);
  assert.match(up, /FOR UPDATE/);
  assert.match(up, /Overlapping base membership assignments are not allowed/);
  assert.match(up, /NEW\.assignment_id,NEW\.account_id,NEW\.plan_version_id/);
  assert.match(up, /Assignment history cannot be shortened outside termination/);
  assert.match(up, /Active membership assignments cannot return to scheduled/);
  assert.match(up, /Membership assignment history is retained/);
  assert.match(up, /Access grant history is retained/);
  assert.match(up, /Grant revocation history is immutable/);
  assert.match(up, /Membership policy audit is append-only/);
  assert.match(up, /a\.effective_until IS NULL OR NEW\.effective_from<a\.effective_until/);
  assert.match(up, /NEW\.effective_until IS NULL OR a\.effective_from<NEW\.effective_until/);
  assert.doesNotMatch(up, /'infinity'::timestamptz/i);
  assert.match(up, /isfinite\(effective_from\)/);
  assert.match(up, /isfinite\(granted_at\)/);
});

test('tables have RLS and app roles receive no table/helper grants', () => {
  for (const table of ['membership_plans', 'membership_plan_versions', 'membership_policy', 'membership_assignments', 'access_grants', 'policy_audit']) {
    // Match the existing migrations: RLS without direct grants preserves owner access for bounded definer functions.
    assert.match(up, new RegExp(`ALTER TABLE groundbnb\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(up, /FORCE ROW LEVEL SECURITY|CREATE POLICY/i);
  assert.match(up, /REVOKE ALL ON groundbnb\.membership_plans,groundbnb\.membership_plan_versions,[\s\S]*FROM PUBLIC/);
  assert.match(up, /REVOKE ALL ON FUNCTION groundbnb\._guard_base_assignment_overlap\(\) FROM PUBLIC/);
  assert.match(up, /Membership policy defaults require a later audited control migration/);
  assert.match(up, /has_table_privilege\(app_oid,c\.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'\)/);
  assert.match(up, /acl\.grantee=0 OR acl\.grantee=app_oid/);
  assert.doesNotMatch(up, /^\s*GRANT\b/im);
});

test('rollback refuses any assignments, grants, audit history, or catalog changes', () => {
  for (const value of [
    'membership_assignments', 'access_grants', 'policy_audit', 'membership_policy',
    'Rollback refused: membership assignments, grants, or policy audit history would be lost',
    'membership catalog was renamed, extended, or modified',
    'DROP TABLE groundbnb.policy_audit', 'DROP TABLE groundbnb.access_grants',
    'DROP TABLE groundbnb.membership_assignments', 'DROP TABLE groundbnb.membership_plan_versions',
    'DROP TABLE groundbnb.membership_policy', 'DROP TABLE groundbnb.membership_plans',
    "DELETE FROM groundbnb.schema_migrations WHERE version='0007_membership_foundation'",
  ]) assert.ok(down.includes(value), value);
  assert.doesNotMatch(down, /^\s*(?:CASCADE|TRUNCATE)\b/im);
  assert.doesNotMatch(down, /DELETE FROM groundbnb\.(accounts|account_identities|profiles|profile_answers|profile_operations)/i);
  assert.doesNotMatch(down, /^\s*GRANT\b/im);
});
