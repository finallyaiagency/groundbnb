import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMBERSHIP_PLAN_CATALOG,
  validateMembershipCatalog,
} from '../lib/membership-catalog.mjs';
import { evaluateMembership } from '../lib/membership-evaluator.mjs';

const accountId = '00000000-0000-4000-8000-000000000001';
const plan = key => MEMBERSHIP_PLAN_CATALOG.find(entry => entry.plan.key === key);
const operational = { ownership: 'allowed', security: 'allowed', financial: 'allowed', abuse: 'allowed' };
const evaluate = (overrides = {}) => evaluateMembership({
  accountId,
  assignment: { accountId, planVersionId: plan('free').version.id },
  actionFeature: 'export.native_json',
  implementedFeatures: ['export.native_json'],
  operational,
  ...overrides,
});

test('uses only an explicit account-scoped stable plan-version assignment; no role, label, or default grants access', () => {
  assert.deepEqual(evaluate(), {
    allowed: true, reason: 'allowed', wouldDeny: false,
    planVersionId: plan('free').version.id, actionFeature: 'export.native_json',
  });
  for (const input of [
    { ...evaluateInput(), assignment: undefined },
    { ...evaluateInput(), assignment: { accountId: '00000000-0000-4000-8000-000000000099', planVersionId: plan('pro').version.id } },
    { ...evaluateInput(), assignment: { accountId, planVersionId: '00000000-0000-4000-8000-000000000999' } },
    { ...evaluateInput(), role: 'admin' },
    { ...evaluateInput(), clientPlanKey: 'pro' },
    { ...evaluateInput(), assignment: { accountId, planVersionId: plan('pro').version.id, role: 'owner' } },
  ]) assert.equal(evaluateMembership(input).allowed, false);
});

function evaluateInput(overrides = {}) {
  return {
    accountId,
    assignment: { accountId, planVersionId: plan('free').version.id },
    actionFeature: 'export.native_json',
    implementedFeatures: ['export.native_json'],
    operational,
    ...overrides,
  };
}

test('commercial feature denial is report-only for public launch and enforced for explicit test cohorts', () => {
  const publicResult = evaluate({
    actionFeature: 'export.csv', implementedFeatures: ['export.csv'],
  });
  assert.equal(publicResult.allowed, true);
  assert.equal(publicResult.wouldDeny, true);
  assert.equal(publicResult.reason, 'commercial_report_only');
  assert.deepEqual(publicResult.auditEvent, {
    type: 'commercial_would_deny', accountId, planVersionId: plan('free').version.id,
    actionFeature: 'export.csv', restriction: 'feature_not_included',
  });
  const cohort = evaluate({
    actionFeature: 'export.csv', implementedFeatures: ['export.csv'],
    commercialMode: 'enforced', audience: 'enforced_test',
  });
  assert.deepEqual(cohort, {
    allowed: false, reason: 'feature_not_included', wouldDeny: false,
    planVersionId: plan('free').version.id, actionFeature: 'export.csv',
  });
  assert.equal(evaluate({ commercialMode: 'enforced', audience: 'public' }).reason, 'commercial_policy_invalid');
});

test('unimplemented, future-tier, unknown, and supplier transaction features are unavailable in every commercial mode', () => {
  assert.equal(evaluate({ actionFeature: 'mcp.agent', implementedFeatures: ['mcp.agent'] }).reason, 'future_tier_unavailable');
  assert.equal(evaluate({ actionFeature: 'mcp.agent', implementedFeatures: [] }).reason, 'feature_unimplemented');
  assert.equal(evaluate({ actionFeature: 'export.csv', implementedFeatures: [] }).reason, 'feature_unimplemented');
  assert.equal(evaluate({ actionFeature: 'not.a.feature', implementedFeatures: [] }).reason, 'unknown_feature');
  const enforced = { commercialMode: 'enforced', audience: 'enforced_test' };
  assert.equal(evaluate({ actionFeature: 'supplier.transactions', implementedFeatures: ['supplier.transactions'], ...enforced }).reason,
    'supplier_transactions_deferred');
  assert.equal(evaluate({
    assignment: { accountId, planVersionId: plan('plus').version.id }, actionFeature: 'export.route_video',
    implementedFeatures: ['export.route_video'], runtimeTier: 'v1.1',
  }).allowed, true);
  assert.equal(evaluate({
    assignment: { accountId, planVersionId: plan('plus').version.id }, actionFeature: 'export.route_video',
    implementedFeatures: ['export.route_video'], runtimeTier: 'v1',
  }).reason, 'future_tier_unavailable');
});

test('ownership, security, financial, and abuse checks are hard gates in report-only mode', () => {
  for (const control of ['ownership', 'security', 'financial', 'abuse']) {
    assert.deepEqual(evaluate({
      actionFeature: 'export.csv', implementedFeatures: ['export.csv'],
      operational: { ...operational, [control]: 'denied' },
    }), { allowed: false, reason: `operational_${control}_denied`, wouldDeny: false });
    assert.equal(evaluate({ operational: { ...operational, [control]: 'unknown' } }).reason, 'operational_authority_unknown');
  }
  assert.equal(evaluate({ operational: undefined, actionFeature: 'export.csv', implementedFeatures: ['export.csv'] }).allowed, false);
});

test('finite quotas use configured units and preserve explicit unlimited versus unconfigured states', () => {
  const report = evaluate({ quota: { limitKey: 'saved_trips', used: 1 } });
  assert.equal(report.allowed, true);
  assert.equal(report.wouldDeny, true);
  assert.equal(report.auditEvent.limitKey, 'saved_trips');
  assert.equal(evaluate({ quota: { limitKey: 'saved_trips', used: 1 }, commercialMode: 'enforced', audience: 'enforced_test' }).allowed, false);
  assert.equal(evaluate({ quota: { limitKey: 'saved_trips', used: 0 } }).wouldDeny, false);

  for (const [limitKey, used] of [
    ['provider_cost_daily_ceiling_usd', '0.25'],
    ['ai_ordinary_requests', 10],
    ['ai_grace_requests', 2],
    ['ai_grace_cost_usd', '0.03'],
    ['ai_base_cost_usd', '0.20'],
    ['ai_hard_total_usd', '0.25'],
    ['ai_concurrent_jobs', 1],
    ['monitoring_completed_checks', 1],
  ]) {
    const result = evaluate({ quota: { limitKey, used } });
    assert.equal(result.allowed, false, `${limitKey} must stay a hard gate in public report-only mode`);
    assert.equal(result.wouldDeny, false);
    assert.equal(result.reason, 'operational_quota_exhausted');
  }
  for (const limitKey of ['ai_emergency_reserve_usd', 'ai_base_allowance_warning_percent', 'provider_ceiling_warning_percent']) {
    assert.equal(evaluate({ quota: { limitKey, used: limitKey.endsWith('_usd') ? '0.02' : 80 } }).reason,
      'quota_not_admission_metric');
  }

  const plus = { assignment: { accountId, planVersionId: plan('plus').version.id } };
  assert.equal(evaluate({ ...plus, quota: { limitKey: 'saved_trips', used: 10 } }).wouldDeny, true);
  assert.equal(evaluate({ ...plus, quota: { limitKey: 'saved_trips', used: 9 } }).wouldDeny, false);
  const pro = { assignment: { accountId, planVersionId: plan('pro').version.id } };
  assert.equal(evaluate({ ...pro, quota: { limitKey: 'saved_trips', used: 999999 } }).wouldDeny, false);
  assert.equal(evaluate({ quota: { limitKey: 'ai_economy_dispatch', used: 0 } }).reason, 'quota_unconfigured');
  assert.equal(evaluate({ quota: { limitKey: 'unknown_limit', used: 0 } }).reason, 'quota_unknown');
  assert.equal(evaluate({ quota: { limitKey: 'saved_trips', used: -1 } }).reason, 'quota_usage_unknown');
});

test('invalid catalog, duplicate implementation keys, and untrusted extra inputs fail closed', () => {
  assert.equal(validateMembershipCatalog(MEMBERSHIP_PLAN_CATALOG), true);
  const changed = structuredClone(MEMBERSHIP_PLAN_CATALOG);
  changed[0].version.features.unrecognized = { included: true, releaseTier: 'v1' };
  assert.equal(evaluate({ catalog: changed }).allowed, false);
  assert.equal(evaluate({ implementedFeatures: ['export.native_json', 'export.native_json'] }).reason, 'implementation_registry_invalid');
  assert.equal(evaluate({ arbitrary: 'client assertion' }).reason, 'invalid_context');
});
