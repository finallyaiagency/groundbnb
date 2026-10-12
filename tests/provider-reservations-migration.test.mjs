import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const up = readFileSync(new URL('../db/migrations/0008_provider_reservations.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../db/migrations/0008_provider_reservations_down.sql', import.meta.url), 'utf8');
const statements = sql => sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n');

test('migration is pinned to the dormant synthetic database and exact 0001–0007 role baseline', () => {
  for (const sql of [up, down]) {
    for (const pin of [
      "current_database()<>'groundbnb'", 'br-rough-flower-b8lerkcf', 'br-bitter-hall-b8ibnrfy',
      'groundbnb_local_app', 'groundbnb_preview_app',
      ...['0001_environment', '0002_profile_foundation', '0003_profile_domain', '0004_profile_operation_status',
        '0005_profile_records', '0006_profile_transfer', '0007_membership_foundation'].map(version => `version='${version}'`),
      'sole verified synthetic Auth fixture', 'email=e.kind ||', '"emailVerified"=true',
      'default_transaction_read_only=on', 'statement_timeout=5s', 'pg_auth_members',
      'has_database_privilege', 'has_schema_privilege', 'has_table_privilege',
    ]) assert.ok(sql.includes(pin), pin);
    assert.doesNotMatch(sql, /\b(?:ALTER\s+ROLE|CREATE\s+ROLE|PASSWORD|LOGIN|NOLOGIN)\b/i);
  }
  assert.match(up, /version='0008_provider_reservations'/);
  assert.match(down, /version='0008_provider_reservations'/);
});

test('seeded policy matches frozen v1 ceilings and leaves provider rates/caps unconfigured', () => {
  const compact = up.replace(/\s+/g, ' ');
  for (const value of [
    "VALUES('20000000-0000-4000-8000-000000000001','m1-v1-default','active','report_only',5.00,0.50,100.00,5.00, 2.50",
    "'10000000-0000-4000-8000-000000000101','day',0.20,0.03,2,0.02,0.25,0.25,10,1",
    "'10000000-0000-4000-8000-000000000102','calendar_month',10.00,1.90,2147483647,0.10,12.00,5.00,NULL,2",
    "'10000000-0000-4000-8000-000000000103','calendar_month',30.00,5.75,2147483647,0.25,36.00,15.00,NULL,3",
  ]) assert.ok(compact.includes(value), value);
  const executable = statements(up);
  assert.doesNotMatch(executable, /INSERT\s+INTO\s+groundbnb\.(provider_rate_versions|provider_rate_components|provider_financial_limit_versions)/i);
  assert.doesNotMatch(executable, /INSERT\s+INTO\s+groundbnb\.(accounts|account_identities|membership_assignments|access_grants)/i);
  assert.match(up, /VALUES\(true,'paused','20000000-0000-4000-8000-000000000001'\)/);
  assert.match(up, /rate_unconfigured/);
  assert.match(up, /provider_limit_unconfigured/);
  assert.match(up, /commercial_mode text NOT NULL CHECK\(commercial_mode IN \('report_only','enforced'\)\)/);
});

test('financial storage keeps exact spend, period, rate, operation, and attempt provenance private', () => {
  for (const table of [
    'financial_policy_versions', 'financial_dispatch_control', 'financial_control_audit', 'financial_plan_budgets',
    'provider_rate_versions', 'provider_rate_components', 'provider_financial_limit_versions',
    'provider_usage_windows', 'provider_operations', 'provider_attempt_reservations',
  ]) {
    assert.match(up, new RegExp(`CREATE TABLE groundbnb\\.${table}\\s*\\(`));
    assert.match(up, new RegExp(`ALTER TABLE groundbnb\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.doesNotMatch(up, new RegExp(`ALTER TABLE groundbnb\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(up, /numeric\(20,9\)/);
  assert.match(up, /rate_version_id uuid NOT NULL REFERENCES groundbnb\.provider_rate_versions/);
  assert.match(up, /policy_version_id uuid NOT NULL REFERENCES groundbnb\.financial_policy_versions/);
  assert.match(up, /operation_id uuid NOT NULL/);
  assert.match(up, /attempt_id uuid PRIMARY KEY/);
  assert.match(up, /spent_usd numeric\(20,9\) NOT NULL DEFAULT 0/);
  assert.match(up, /pending_usd numeric\(20,9\) NOT NULL DEFAULT 0/);
  assert.match(up, /needs_reconciliation/);
  assert.match(up, /REVOKE ALL ON groundbnb\.financial_policy_versions,[\s\S]*FROM PUBLIC/);
  assert.doesNotMatch(statements(up), /^\s*GRANT\b/gim);
});

test('reserve uses database identity, effective membership, UTC windows, locks, and stored rate calculation', () => {
  const body = up.split('CREATE FUNCTION groundbnb.reserve_provider_attempt')[1].split('CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched')[0];
  for (const phrase of [
    'groundbnb._profile_account(identity_issuer,identity_subject)',
    "account_row.status<>'active'", "control_row.mode<>'normal'", 'rate_unconfigured',
    'membership_assignments', 'access_grants', 'financial_plan_budgets',
    'provider_financial_limit_versions', 'provider_rate_versions', 'groundbnb._provider_cost(rate_uuid,requested_units)',
    "AT TIME ZONE 'UTC'", 'FOR UPDATE', 'pending_usd+cost_max>window_row.cap_usd-window_row.held_usd',
    "'scope','account'", "'scope','provider'", "'scope','application'", "'scope','free_pool'",
    "'kind','day'", "'kind','calendar_month'", 'idempotency_conflict',
  ]) assert.ok(body.includes(phrase), phrase);
  assert.doesNotMatch(body.split('RETURNS jsonb')[0], /(?:cap|spent|pending|verified)\s+(?:numeric|boolean)\s+DEFAULT/i);
  assert.match(up, /ORDER BY u\.scope_kind,u\.scope_key,u\.period_kind,u\.period_key FOR UPDATE OF u/);
  assert.match(body, /FOR w IN SELECT value FROM jsonb_array_elements\(windows\)[\s\S]*?ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP\s+INSERT INTO groundbnb\.provider_usage_windows/);
  assert.match(body, /FOR w IN SELECT value FROM jsonb_array_elements\(windows\)[\s\S]*?ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP\s+UPDATE groundbnb\.provider_usage_windows/);
  const orderedLocks = [
    'FROM groundbnb.financial_dispatch_control WHERE singleton FOR SHARE',
    'WHERE policy_version_id=control_row.policy_version_id AND status=\'active\' FOR SHARE',
    'WHERE rate_version_id=rate_uuid AND provider_key=provider AND model_key=model AND status=\'active\'',
    'WHERE provider_key=provider AND status=\'active\' AND daily_cap_usd IS NOT NULL AND monthly_cap_usd IS NOT NULL',
    'FROM groundbnb.accounts WHERE id=account_uuid FOR UPDATE',
    'FROM groundbnb.provider_attempt_reservations WHERE attempt_id=attempt_uuid FOR UPDATE',
    'WHERE account_id=account_uuid AND operation_id=operation_uuid FOR UPDATE',
  ].map(value => body.indexOf(value));
  assert.ok(orderedLocks.every(index => index>=0));
  assert.ok(orderedLocks.every((index, offset) => offset===0 || index>orderedLocks[offset-1]), orderedLocks.join(','));
  assert.ok(body.indexOf('RETURN attempt_row.reserve_acknowledgment') < body.indexOf('FROM groundbnb.financial_dispatch_control'));
});

test('dispatch marking counts a logical prompt once; settlement replay is stable and uncertain cost stays pending', () => {
  const dispatch = up.split('CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched')[1].split('CREATE FUNCTION groundbnb.settle_provider_attempt')[0];
  assert.match(dispatch, /operation_row\.dispatched_at IS NULL/);
  assert.match(dispatch, /prompt_state='dispatched',dispatched_at=clock_timestamp\(\)/);
  assert.match(dispatch, /promptCounted/);
  assert.match(dispatch, /status IN \('dispatched','settled','needs_reconciliation'\)/);
  assert.match(dispatch, /dispatchAuthorized',true/);
  assert.match(dispatch, /\{dispatchAuthorized\}','false'::jsonb/);
  assert.match(dispatch, /jsonb_to_recordset\(attempt_row\.window_keys\)[\s\S]*?w\.kind='day'[\s\S]*?w\.kind='calendar_month'/);
  assert.match(dispatch, /account_period_key<>\(CASE WHEN operation_row\.account_period='day'[\s\S]*?THEN dispatch_day ELSE dispatch_month END\) OR/);
  assert.doesNotMatch(dispatch, /account_period_key<>CASE WHEN operation_row\.account_period=/);
  const orderedLocks = [
    'FROM groundbnb.financial_dispatch_control WHERE singleton FOR SHARE',
    'WHERE policy_version_id=control_row.policy_version_id AND status=\'active\' FOR SHARE',
    'WHERE rate_version_id=attempt_hint.rate_version_id',
    'WHERE limit_version_id=attempt_hint.limit_version_id',
    'FROM groundbnb.accounts WHERE id=account_uuid FOR UPDATE',
    'WHERE attempt_id=attempt_uuid AND account_id=account_uuid FOR UPDATE',
    'WHERE account_id=account_uuid AND operation_id=attempt_row.operation_id FOR UPDATE',
  ].map(value => dispatch.indexOf(value));
  assert.ok(orderedLocks.every(index => index>=0));
  assert.ok(orderedLocks.every((index, offset) => offset===0 || index>orderedLocks[offset-1]), orderedLocks.join(','));
  assert.ok(dispatch.indexOf("'{dispatchAuthorized}','false'::jsonb") < dispatch.indexOf('FROM groundbnb.financial_dispatch_control'));

  const settle = up.split('CREATE FUNCTION groundbnb.settle_provider_attempt')[1].split('CREATE FUNCTION groundbnb.close_provider_operation')[0];
  for (const phrase of [
    "attempt_row.status='settled'", 'attempt_row.actual_units IS DISTINCT FROM actual_units',
    "status='needs_reconciliation'", 'reservedCostPending', 'confirmed_never_dispatched',
    "pending_usd=pending_usd-attempt_row.maximum_cost_usd", 'spent_usd=spent_usd+actual_cost',
    'actualCostUsd', 'overReservation',
  ]) assert.ok(settle.includes(phrase), phrase);
  assert.match(settle, /IF actual_units IS NULL THEN[\s\S]*status='needs_reconciliation'/);
  assert.match(settle, /IF actual_cost[\s\S]*attempt_row\.maximum_cost_usd/);
  assert.match(settle, /IF confirmed_never_dispatched THEN RETURN jsonb_build_object\('ok',false,'category','idempotency_conflict'\)/);
  assert.match(settle, /IF confirmed_never_dispatched AND actual_units IS NULL THEN RETURN attempt_row\.settlement_acknowledgment/);
  assert.match(up, /r\.status IN \('active','retired'\)/);
  assert.match(settle, /not implemented here; no operator\/service writer is claimed/);
  assert.match(settle, /ORDER BY value->>'scope',value->>'key',value->>'kind',value->>'period' LOOP\s+UPDATE groundbnb\.provider_usage_windows/g);
});

test('rollback refuses any provider history or configured rates and never deletes account or membership data', () => {
  for (const phrase of [
    'provider_attempt_reservations', 'provider_operations', 'provider_usage_windows', 'provider_rate_versions',
    'provider_financial_limit_versions', 'financial_control_audit', 'Rollback refused: provider attempts, operations, or usage windows would lose financial history',
    'financial policy/rates were configured or seed defaults changed',
    'DROP TABLE groundbnb.provider_attempt_reservations', 'DROP TABLE groundbnb.provider_usage_windows',
    'DROP TABLE groundbnb.financial_policy_versions', "DELETE FROM groundbnb.schema_migrations WHERE version='0008_provider_reservations'",
  ]) assert.ok(down.includes(phrase), phrase);
  assert.doesNotMatch(statements(down), /\bCASCADE\b/i);
  assert.doesNotMatch(statements(down), /\bTRUNCATE\s+TABLE\b/i);
  assert.doesNotMatch(statements(down), /DELETE FROM groundbnb\.(accounts|account_identities|membership_assignments|access_grants)/i);
});

test('all financial numbers reject non-finite numeric sentinels and active rate/limit rows require provenance', () => {
  for (const column of [
    'application_daily_cap_usd', 'application_daily_held_usd', 'application_monthly_cap_usd',
    'application_monthly_held_usd', 'free_pool_daily_cap_usd', 'base_ai_usd', 'grace_ai_usd',
    'held_emergency_usd', 'hard_ai_usd', 'daily_provider_cap_usd', 'price_per_million_usd',
    'daily_cap_usd', 'monthly_cap_usd', 'cap_usd', 'held_usd', 'spent_usd', 'pending_usd',
    'maximum_cost_usd', 'actual_cost_usd',
  ]) assert.ok(up.includes(`${column} NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`), column);
  assert.match(up, /status IN \('active','retired'\) AND source_url IS NOT NULL AND source_url ~ '\^https:\/\/' AND[\s\S]*?checked_at IS NOT NULL AND isfinite\(checked_at\)[\s\S]*?checked_by IS NOT NULL[\s\S]*?release_date IS NOT NULL AND isfinite\(release_date\)/);
  assert.match(up, /status IN \('active','retired'\) AND daily_cap_usd IS NOT NULL AND monthly_cap_usd IS NOT NULL[\s\S]*?source_url IS NOT NULL[\s\S]*?checked_at IS NOT NULL AND isfinite\(checked_at\)[\s\S]*?release_date IS NOT NULL AND isfinite\(release_date\)/);
});

test('dispatch scaffolding starts paused and all financial functions/helpers have effective and ACL privacy checks', () => {
  assert.match(up, /INSERT INTO groundbnb\.financial_dispatch_control\(singleton,mode,policy_version_id\)\s+VALUES\(true,'paused'/);
  assert.match(down, /mode='paused'/);
  const names = ['_financial_version_immutable', '_provider_rate_version_guard', '_provider_limit_version_guard',
    '_financial_control_audit', '_financial_audit_immutable', '_provider_cost', 'reserve_provider_attempt',
    'mark_provider_attempt_dispatched', 'settle_provider_attempt', 'close_provider_operation'];
  for (const name of names) {
    assert.ok(up.includes(`'${name}'`), name);
    assert.ok(down.includes(`'${name}'`), name);
  }
  for (const sql of [up, down]) {
    assert.match(sql, /aclexplode\(COALESCE\(p\.proacl,acldefault\('f',p\.proowner\)\)\)/);
    assert.match(sql, /acl\.grantee=0 OR acl\.grantee=(?:app_oid|role_record\.oid)/);
    assert.match(sql, /has_function_privilege\((?:app_oid|role_record\.oid),p\.oid,'EXECUTE'\)/);
  }
});

test('closing a never-dispatched released operation makes it terminal', () => {
  const reserve = up.split('CREATE FUNCTION groundbnb.reserve_provider_attempt')[1].split('CREATE FUNCTION groundbnb.mark_provider_attempt_dispatched')[0];
  const close = up.split('CREATE FUNCTION groundbnb.close_provider_operation')[1].split('ALTER TABLE groundbnb.financial_policy_versions')[0];
  assert.match(reserve, /account_period_key<>\s*\(CASE WHEN plan_row\.account_period='day' THEN day_key ELSE month_key END\) THEN/);
  assert.doesNotMatch(reserve, /account_period_key<>\s*CASE WHEN plan_row\.account_period=/);
  assert.match(reserve, /operation_row\.status NOT IN \('active','needs_reconciliation'\)[\s\S]*?operation_row\.status='released' AND operation_row\.dispatched_at IS NULL/);
  assert.match(close, /UPDATE groundbnb\.provider_operations SET status='complete',closed_at=clock_timestamp\(\)[\s\S]*?status<>'complete'/);
  assert.doesNotMatch(close, /status NOT IN \('complete','released'\)/);
});
