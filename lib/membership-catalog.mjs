/**
 * Frozen v1 membership catalog seed for MEM-01. These are definitions for a
 * later server evaluator, not live assignments or authorization decisions.
 * Commercial gates default to report-only; operational/security controls stay
 * enforced in every mode.
 */

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const finite = (value, unit, period = null) => ({ state: 'configured', kind: 'finite', value, unit, period });
const unlimited = (unit, period = null) => ({ state: 'configured', kind: 'unlimited', unit, period });
const unconfigured = (unit, period = null) => ({ state: 'not_configured', unit, period });
const feature = (included, releaseTier = 'v1') => ({ included, releaseTier });

const FEATURE_TIERS = deepFreeze({
  'ai.planning': 'v1',
  'trips.saved': 'v1',
  // v1 defines a synthetic quota evaluator; automated watch execution is a separate v1.1 capability.
  'monitoring.checks': 'v1',
  'supplier.transactions': 'v2',
  'mcp.agent': 'v1.1',
  'maps.basic': 'v1',
  'maps.tour': 'v1',
  'export.native_json': 'v1',
  'handoff.google_maps': 'v1',
  'profile.pdf': 'v1',
  'export.geojson': 'v1',
  'export.gpx': 'v1',
  'export.kml': 'v1',
  'export.csv': 'v1',
  'export.ical': 'v1',
  'handoff.google_calendar': 'v1',
  'export.route_video': 'v1.1',
  'export.marine_waypoints': 'v1',
  'maps.advanced_overlays': 'v2',
  'saved_content.view': 'v1',
  'manual_work': 'v1',
  'profile_text.copy': 'v1',
});

const CORE_INCLUDED = [
  'ai.planning', 'trips.saved', 'monitoring.checks', 'maps.basic', 'maps.tour',
  'export.native_json', 'handoff.google_maps', 'profile.pdf', 'saved_content.view',
  'manual_work', 'profile_text.copy',
];
const STANDARD_EXPORTS = [
  'export.geojson', 'export.gpx', 'export.kml', 'export.csv', 'export.ical', 'handoff.google_calendar',
];
const PLUS_PRO_EXPORTS = [...STANDARD_EXPORTS, 'mcp.agent', 'export.route_video'];

function featuresFor(includedKeys) {
  const included = new Set(includedKeys);
  return Object.fromEntries(Object.entries(FEATURE_TIERS).map(([key, releaseTier]) => [
    key, feature(included.has(key), releaseTier),
  ]));
}

const warningLimits = {
  ai_base_allowance_warning_percent: finite(80, 'percent'),
  provider_ceiling_warning_percent: finite(95, 'percent'),
};

const globalLimits = {
  provider_cost_daily_ceiling_usd: finite('5.00', 'USD', 'day'),
  provider_cost_monthly_ceiling_usd: finite('100.00', 'USD', 'calendar_month'),
  free_pool_daily_ceiling_usd: finite('2.50', 'USD', 'day'),
  emergency_reserve_daily_usd: finite('0.50', 'USD', 'day'),
  emergency_reserve_monthly_usd: finite('5.00', 'USD', 'calendar_month'),
};

function limitsFor({ trips, monitoringPeriod, requests, requestPeriod, base, basePeriod,
  grace, gracePeriod, graceRequests, emergency, emergencyPeriod, hardTotal, hardPeriod,
  dailyProviderCeiling, concurrentJobs }) {
  return {
    saved_trips: trips === 'unlimited' ? unlimited('trip') : finite(trips, 'trip'),
    monitoring_completed_checks: finite(1, 'check', monitoringPeriod),
    ai_ordinary_requests: requests === 'unlimited' ? unlimited('request', requestPeriod) : finite(requests, 'request', requestPeriod),
    ai_base_cost_usd: finite(base, 'USD', basePeriod),
    ai_grace_cost_usd: finite(grace, 'USD', gracePeriod),
    ai_grace_requests: graceRequests === 'unlimited' ? unlimited('request', gracePeriod) : finite(graceRequests, 'request', gracePeriod),
    ai_emergency_reserve_usd: finite(emergency, 'USD', emergencyPeriod),
    ai_hard_total_usd: finite(hardTotal, 'USD', hardPeriod),
    provider_cost_daily_ceiling_usd: finite(dailyProviderCeiling, 'USD', 'day'),
    ai_concurrent_jobs: finite(concurrentJobs, 'job'),
    ai_economy_dispatch: unconfigured('dispatch', 'day'),
    ...structuredClone(warningLimits),
  };
}

const planRows = [
  {
    id: '00000000-0000-4000-8000-000000000101', key: 'free', displayName: 'Free',
    included: CORE_INCLUDED,
    limits: limitsFor({ trips: 1, monitoringPeriod: 'calendar_month', requests: 10, requestPeriod: 'day',
      base: '0.20', basePeriod: 'day', grace: '0.03', gracePeriod: 'day', graceRequests: 2,
      emergency: '0.02', emergencyPeriod: 'day', hardTotal: '0.25', hardPeriod: 'day',
      dailyProviderCeiling: '0.25', concurrentJobs: 1 }),
  },
  {
    id: '00000000-0000-4000-8000-000000000102', key: 'plus', displayName: 'Plus',
    included: [...CORE_INCLUDED, ...PLUS_PRO_EXPORTS],
    limits: limitsFor({ trips: 10, monitoringPeriod: 'iso_week', requests: 'unlimited', requestPeriod: 'day',
      base: '10.00', basePeriod: 'calendar_month', grace: '1.90', gracePeriod: 'calendar_month', graceRequests: 'unlimited',
      emergency: '0.10', emergencyPeriod: 'calendar_month', hardTotal: '12.00', hardPeriod: 'calendar_month',
      dailyProviderCeiling: '5.00', concurrentJobs: 2 }),
  },
  {
    id: '00000000-0000-4000-8000-000000000103', key: 'pro', displayName: 'Pro',
    included: [...CORE_INCLUDED, ...PLUS_PRO_EXPORTS, 'export.marine_waypoints'],
    limits: limitsFor({ trips: 'unlimited', monitoringPeriod: 'day', requests: 'unlimited', requestPeriod: 'day',
      base: '30.00', basePeriod: 'calendar_month', grace: '5.75', gracePeriod: 'calendar_month', graceRequests: 'unlimited',
      emergency: '0.25', emergencyPeriod: 'calendar_month', hardTotal: '36.00', hardPeriod: 'calendar_month',
      dailyProviderCeiling: '15.00', concurrentJobs: 3 }),
  },
].map(({ id, key, displayName, included, limits }) => ({
  plan: { id, key, displayName, status: 'active' },
  version: {
    id: `10000000-0000-4000-8000-00000000010${key === 'free' ? '1' : key === 'plus' ? '2' : '3'}`,
    planId: id,
    number: 1,
    releaseTier: 'v1',
    features: featuresFor(included),
    limits,
  },
}));

export const MEMBERSHIP_POLICY_DEFAULTS = deepFreeze({
  commercialMode: 'report_only',
  enforcedTestCohorts: 'explicit',
  operationalControls: 'enforced',
  checkoutEnabled: false,
  supplierTransactionsEnabled: false,
  defaultLifetimeGrantPlanKey: 'pro',
  globalLimits,
});

export const MEMBERSHIP_PLAN_CATALOG = deepFreeze(planRows);
export const MEMBERSHIP_FEATURE_TIERS = FEATURE_TIERS;
export const MEMBERSHIP_LIMIT_KEYS = deepFreeze([
  'saved_trips', 'monitoring_completed_checks', 'ai_ordinary_requests', 'ai_base_cost_usd',
  'ai_grace_cost_usd', 'ai_grace_requests', 'ai_emergency_reserve_usd', 'ai_hard_total_usd',
  'provider_cost_daily_ceiling_usd', 'ai_concurrent_jobs', 'ai_economy_dispatch',
  'ai_base_allowance_warning_percent', 'provider_ceiling_warning_percent',
]);

export class MembershipCatalogValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MembershipCatalogValidationError';
  }
}

const ownKeysExactly = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIODS = new Set(['day', 'calendar_month', 'iso_week', null]);
const UNITS = new Set(['trip', 'check', 'request', 'USD', 'job', 'dispatch', 'percent']);
const MONEY = /^(?:0|[1-9]\d{0,8})\.\d{2}$/;
const PLAN_KEYS = new Set(['free', 'plus', 'pro']);
const STABLE_PLAN_IDS = deepFreeze({
  free: '00000000-0000-4000-8000-000000000101',
  plus: '00000000-0000-4000-8000-000000000102',
  pro: '00000000-0000-4000-8000-000000000103',
});
const STABLE_VERSION_IDS = deepFreeze({
  free: '10000000-0000-4000-8000-000000000101',
  plus: '10000000-0000-4000-8000-000000000102',
  pro: '10000000-0000-4000-8000-000000000103',
});

function invalid(message) {
  throw new MembershipCatalogValidationError(message);
}

function validateLimit(limit, key) {
  if (!limit || typeof limit !== 'object' || Array.isArray(limit) || !['configured', 'not_configured'].includes(limit.state)) {
    invalid(`Limit ${key} must state whether it is configured.`);
  }
  if (limit.state === 'not_configured') {
    if (!ownKeysExactly(limit, ['state', 'unit', 'period']) || !UNITS.has(limit.unit) || !PERIODS.has(limit.period)) {
      invalid(`Limit ${key} has an invalid unconfigured representation.`);
    }
    return;
  }
  if (!['finite', 'unlimited'].includes(limit.kind) || !UNITS.has(limit.unit) || !PERIODS.has(limit.period)) {
    invalid(`Limit ${key} has invalid configured metadata.`);
  }
  if (limit.kind === 'unlimited') {
    if (!ownKeysExactly(limit, ['state', 'kind', 'unit', 'period'])) invalid(`Limit ${key} has an invalid unlimited representation.`);
    return;
  }
  if (!ownKeysExactly(limit, ['state', 'kind', 'value', 'unit', 'period'])) invalid(`Limit ${key} has an invalid finite representation.`);
  if (limit.unit === 'USD') {
    if (typeof limit.value !== 'string' || !MONEY.test(limit.value)) invalid(`Limit ${key} must use a fixed two-decimal USD string.`);
  } else if (typeof limit.value !== 'number' || !Number.isSafeInteger(limit.value) || limit.value < 0) {
    invalid(`Limit ${key} must use a nonnegative safe integer.`);
  }
}

/** Validates the closed seed/catalog contract; it does not make entitlement decisions. */
export function validateMembershipCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== 3) invalid('The v1 catalog must define Free, Plus, and Pro.');
  const seenKeys = new Set();
  const seenPlanIds = new Set();
  const seenVersionIds = new Set();
  const expectedFeatureKeys = Object.keys(FEATURE_TIERS).sort();
  const expectedLimitKeys = [...MEMBERSHIP_LIMIT_KEYS].sort();
  for (const entry of catalog) {
    if (!ownKeysExactly(entry, ['plan', 'version']) ||
        !ownKeysExactly(entry.plan, ['id', 'key', 'displayName', 'status']) ||
        !ownKeysExactly(entry.version, ['id', 'planId', 'number', 'releaseTier', 'features', 'limits'])) {
      invalid('Plan catalog contains an unsupported field or shape.');
    }
    const { plan, version } = entry;
    if (!UUID.test(plan.id) || !UUID.test(version.id) || plan.id !== STABLE_PLAN_IDS[plan.key] ||
        version.id !== STABLE_VERSION_IDS[plan.key] || version.planId !== plan.id ||
        seenPlanIds.has(plan.id) || seenVersionIds.has(version.id) || seenKeys.has(plan.key) ||
        !PLAN_KEYS.has(plan.key) || typeof plan.displayName !== 'string' || !plan.displayName.trim() ||
        plan.displayName.length > 80 || plan.status !== 'active' || version.number !== 1 || version.releaseTier !== 'v1') {
      invalid('Plan identities, names, or version metadata are invalid.');
    }
    seenKeys.add(plan.key); seenPlanIds.add(plan.id); seenVersionIds.add(version.id);
    if (!ownKeysExactly(version.features, expectedFeatureKeys)) invalid('Plan feature definitions are incomplete or contain unknown keys.');
    for (const [featureKey, expectedTier] of Object.entries(FEATURE_TIERS)) {
      const definition = version.features[featureKey];
      if (!ownKeysExactly(definition, ['included', 'releaseTier']) || typeof definition.included !== 'boolean' ||
          definition.releaseTier !== expectedTier) invalid(`Feature ${featureKey} has an invalid or future-tier definition.`);
    }
    if (!ownKeysExactly(version.limits, expectedLimitKeys)) invalid('Plan limit definitions are incomplete or contain unknown keys.');
    for (const [key, value] of Object.entries(version.limits)) validateLimit(value, key);
    if (version.features['supplier.transactions'].included || version.features['maps.advanced_overlays'].included ||
        version.limits.ai_economy_dispatch.state !== 'not_configured') {
      invalid('Deferred transactions, advanced overlays, and v1 Economy dispatch cannot be enabled by this catalog.');
    }
  }
  if (!['free', 'plus', 'pro'].every(key => seenKeys.has(key))) invalid('The v1 plan keys must remain stable.');
  return true;
}

/** Changes only a display label; plan/version IDs and assignment references stay stable. */
export function renameMembershipPlan(catalog, planKey, displayName) {
  validateMembershipCatalog(catalog);
  if (!PLAN_KEYS.has(planKey) || typeof displayName !== 'string' || !displayName.trim() || displayName.length > 80) {
    invalid('A known plan key and non-empty display label are required.');
  }
  const next = structuredClone(catalog);
  const selected = next.find(entry => entry.plan.key === planKey);
  selected.plan.displayName = displayName.trim();
  validateMembershipCatalog(next);
  return deepFreeze(next);
}

validateMembershipCatalog(MEMBERSHIP_PLAN_CATALOG);
