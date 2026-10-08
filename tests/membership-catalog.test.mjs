import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMBERSHIP_FEATURE_TIERS,
  MEMBERSHIP_PLAN_CATALOG,
  MEMBERSHIP_POLICY_DEFAULTS,
  MembershipCatalogValidationError,
  renameMembershipPlan,
  validateMembershipCatalog,
} from '../lib/membership-catalog.mjs';

const plan = key => MEMBERSHIP_PLAN_CATALOG.find(entry => entry.plan.key === key);
const feature = (key, planKey) => plan(planKey).version.features[key];
const limit = (key, planKey) => plan(planKey).version.limits[key];

test('seeds stable Free, Plus, and Pro identities with v1 plan-version records', () => {
  assert.equal(validateMembershipCatalog(MEMBERSHIP_PLAN_CATALOG), true);
  assert.deepEqual(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.plan.key), ['free', 'plus', 'pro']);
  assert.deepEqual(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.plan.displayName), ['Free', 'Plus', 'Pro']);
  assert.deepEqual(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.version.number), [1, 1, 1]);
  assert.deepEqual(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.version.releaseTier), ['v1', 'v1', 'v1']);
  assert.equal(new Set(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.plan.id)).size, 3);
  assert.equal(new Set(MEMBERSHIP_PLAN_CATALOG.map(entry => entry.version.id)).size, 3);
  assert.ok(MEMBERSHIP_PLAN_CATALOG.every(entry => entry.version.planId === entry.plan.id));
  assert.ok(Object.isFrozen(MEMBERSHIP_PLAN_CATALOG[0].version.features));
});

test('catalog uses explicit feature keys and encodes the frozen v1/v1.1/v2 matrix', () => {
  assert.deepEqual(Object.keys(MEMBERSHIP_FEATURE_TIERS).sort(), Object.keys(plan('free').version.features).sort());
  for (const key of ['ai.planning', 'maps.basic', 'maps.tour', 'export.native_json', 'handoff.google_maps',
    'profile.pdf', 'saved_content.view', 'manual_work', 'profile_text.copy']) {
    assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature(key, planKey).included), [true, true, true], key);
  }
  for (const key of ['export.geojson', 'export.gpx', 'export.kml', 'export.csv', 'export.ical', 'handoff.google_calendar']) {
    assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature(key, planKey).included), [false, true, true], key);
  }
  assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature('export.marine_waypoints', planKey).included), [false, false, true]);
  assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature('mcp.agent', planKey).included), [false, true, true]);
  assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature('export.route_video', planKey).included), [false, true, true]);
  assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature('maps.advanced_overlays', planKey).included), [false, false, false]);
  assert.deepEqual(['free', 'plus', 'pro'].map(planKey => feature('supplier.transactions', planKey).included), [false, false, false]);
  assert.equal(feature('mcp.agent', 'plus').releaseTier, 'v1.1');
  assert.equal(feature('export.route_video', 'pro').releaseTier, 'v1.1');
  assert.equal(feature('maps.advanced_overlays', 'pro').releaseTier, 'v2');
  assert.equal(feature('supplier.transactions', 'pro').releaseTier, 'v2');
});

test('plan limits preserve frozen capacity, quotas, AI budgets, grace, reserves and ceilings', () => {
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('saved_trips', key)), [
    { state: 'configured', kind: 'finite', value: 1, unit: 'trip', period: null },
    { state: 'configured', kind: 'finite', value: 10, unit: 'trip', period: null },
    { state: 'configured', kind: 'unlimited', unit: 'trip', period: null },
  ]);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('monitoring_completed_checks', key).period),
    ['calendar_month', 'iso_week', 'day']);
  assert.equal(limit('ai_ordinary_requests', 'free').value, 10);
  assert.equal(limit('ai_ordinary_requests', 'free').period, 'day');
  assert.equal(limit('ai_ordinary_requests', 'plus').kind, 'unlimited');
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('ai_base_cost_usd', key).value), ['0.20', '10.00', '30.00']);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('ai_grace_cost_usd', key).value), ['0.03', '1.90', '5.75']);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('ai_emergency_reserve_usd', key).value), ['0.02', '0.10', '0.25']);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('ai_hard_total_usd', key).value), ['0.25', '12.00', '36.00']);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('provider_cost_daily_ceiling_usd', key).value), ['0.25', '5.00', '15.00']);
  assert.deepEqual(['free', 'plus', 'pro'].map(key => limit('ai_concurrent_jobs', key).value), [1, 2, 3]);
  assert.equal(limit('ai_grace_requests', 'free').value, 2);
  assert.equal(limit('ai_economy_dispatch', 'free').state, 'not_configured');
  assert.equal(limit('ai_base_allowance_warning_percent', 'pro').value, 80);
  assert.equal(limit('provider_ceiling_warning_percent', 'pro').value, 95);
});

test('commercial default remains report-only while operational controls and supplier restrictions remain enforced', () => {
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.commercialMode, 'report_only');
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.enforcedTestCohorts, 'explicit');
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.operationalControls, 'enforced');
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.checkoutEnabled, false);
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.supplierTransactionsEnabled, false);
  assert.equal(MEMBERSHIP_POLICY_DEFAULTS.defaultLifetimeGrantPlanKey, 'pro');
  assert.deepEqual(MEMBERSHIP_POLICY_DEFAULTS.globalLimits, {
    provider_cost_daily_ceiling_usd: { state: 'configured', kind: 'finite', value: '5.00', unit: 'USD', period: 'day' },
    provider_cost_monthly_ceiling_usd: { state: 'configured', kind: 'finite', value: '100.00', unit: 'USD', period: 'calendar_month' },
    free_pool_daily_ceiling_usd: { state: 'configured', kind: 'finite', value: '2.50', unit: 'USD', period: 'day' },
    emergency_reserve_daily_usd: { state: 'configured', kind: 'finite', value: '0.50', unit: 'USD', period: 'day' },
    emergency_reserve_monthly_usd: { state: 'configured', kind: 'finite', value: '5.00', unit: 'USD', period: 'calendar_month' },
  });
});

test('renaming Plus changes only its display label, leaving plan/version assignment identity intact', () => {
  const assignment = Object.freeze({ accountId: 'synthetic-account', planVersionId: plan('plus').version.id });
  const renamed = renameMembershipPlan(MEMBERSHIP_PLAN_CATALOG, 'plus', 'Plus (renamed)');
  const before = plan('plus');
  const after = renamed.find(entry => entry.plan.key === 'plus');
  assert.equal(after.plan.displayName, 'Plus (renamed)');
  assert.equal(after.plan.id, before.plan.id);
  assert.equal(after.plan.key, before.plan.key);
  assert.equal(after.version.id, before.version.id);
  assert.equal(after.version.number, before.version.number);
  assert.deepEqual(after.version.features, before.version.features);
  assert.deepEqual(after.version.limits, before.version.limits);
  assert.equal(assignment.planVersionId, after.version.id);
  assert.equal(plan('plus').plan.displayName, 'Plus');
});

test('catalog validator rejects unknown authority, unstable identities, incomplete feature maps and invalid limits', () => {
  const malformed = mutator => {
    const candidate = structuredClone(MEMBERSHIP_PLAN_CATALOG);
    mutator(candidate);
    return candidate;
  };
  for (const candidate of [
    malformed(rows => { rows[0].plan.role = 'owner'; }),
    malformed(rows => { rows[0].accountId = 'foreign'; }),
    malformed(rows => { rows[0].plan.isPro = true; }),
    malformed(rows => { rows[0].assignments = []; }),
    malformed(rows => { rows[1].plan.id = rows[0].plan.id; }),
    malformed(rows => { rows[1].plan.id = rows[0].plan.id; rows[0].plan.id = rows[1].plan.id; }),
    malformed(rows => { rows[1].version.planId = rows[0].plan.id; }),
    malformed(rows => { rows[0].version.features.unknown = { included: true, releaseTier: 'v1' }; }),
    malformed(rows => { delete rows[0].version.features['ai.planning']; }),
    malformed(rows => { rows[0].version.features['mcp.agent'].releaseTier = 'v2'; }),
    malformed(rows => { rows[0].version.limits.saved_trips = { state: 'configured', kind: 'unlimited', unit: 'trip' }; }),
    malformed(rows => { rows[1].version.limits.ai_base_cost_usd.value = 10; }),
    malformed(rows => { rows[0].version.limits.ai_economy_dispatch = { state: 'configured', kind: 'unlimited', unit: 'dispatch', period: 'day' }; }),
    malformed(rows => { rows[2].version.features['supplier.transactions'].included = true; }),
    malformed(rows => { rows[2].version.features['maps.advanced_overlays'].included = true; }),
  ]) assert.throws(() => validateMembershipCatalog(candidate), MembershipCatalogValidationError);
  assert.throws(() => renameMembershipPlan(MEMBERSHIP_PLAN_CATALOG, 'plus', ''), MembershipCatalogValidationError);
  assert.throws(() => renameMembershipPlan(MEMBERSHIP_PLAN_CATALOG, 'unknown', 'Plus'), MembershipCatalogValidationError);
});
