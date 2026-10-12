import {
  MEMBERSHIP_FEATURE_TIERS,
  MEMBERSHIP_PLAN_CATALOG,
  validateMembershipCatalog,
} from './membership-catalog.mjs';

const ownKeysExactly = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY = /^(?:0|[1-9]\d{0,8})\.\d{2}$/;
const TIER_RANK = Object.freeze({ v1: 1, 'v1.1': 2 });
const OPERATIONAL_CONTROLS = Object.freeze(['ownership', 'security', 'financial', 'abuse']);
// Frozen public-launch report-only scope explicitly names feature/trip gates;
// saved-trip capacity is the seeded trip gate.
const REPORT_ONLY_QUOTA_KEYS = new Set(['saved_trips']);
const NON_ADMISSION_LIMIT_KEYS = new Set([
  'ai_emergency_reserve_usd', 'ai_base_allowance_warning_percent', 'provider_ceiling_warning_percent',
]);

/**
 * Evaluate one action against server-resolved membership inputs. Callers must
 * source accountId, assignment, operational checks, and implementedFeatures
 * from trusted server state; this module does not authenticate or grant roles.
 * It returns a report event for report-only commercial denials and has no side
 * effects, so a caller must persist/log that event.
 */
export function evaluateMembership(input) {
  const denied = (reason, extra = {}) => ({ allowed: false, reason, wouldDeny: false, ...extra });
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype ||
        Object.keys(input).some(key => !['catalog', 'accountId', 'assignment', 'actionFeature', 'implementedFeatures',
          'runtimeTier', 'commercialMode', 'audience', 'operational', 'quota'].includes(key))) {
      return denied('invalid_context');
    }
    const catalog = input.catalog ?? MEMBERSHIP_PLAN_CATALOG;
    validateMembershipCatalog(catalog);
    const { accountId, assignment, actionFeature } = input;
    if (typeof accountId !== 'string' || !UUID.test(accountId) ||
        !ownKeysExactly(assignment, ['accountId', 'planVersionId']) || assignment.accountId !== accountId ||
        typeof assignment.planVersionId !== 'string' || !UUID.test(assignment.planVersionId)) return denied('assignment_unavailable');
    if (typeof actionFeature !== 'string' || !Object.hasOwn(MEMBERSHIP_FEATURE_TIERS, actionFeature)) {
      return denied('unknown_feature');
    }
    if (!Array.isArray(input.implementedFeatures) ||
        input.implementedFeatures.some(key => typeof key !== 'string' || !Object.hasOwn(MEMBERSHIP_FEATURE_TIERS, key)) ||
        new Set(input.implementedFeatures).size !== input.implementedFeatures.length) return denied('implementation_registry_invalid');
    const runtimeTier = input.runtimeTier ?? 'v1';
    if (!Object.hasOwn(TIER_RANK, runtimeTier)) return denied('runtime_tier_unavailable');
    const commercialMode = input.commercialMode ?? 'report_only';
    const audience = input.audience ?? 'public';
    if (!['report_only', 'enforced'].includes(commercialMode) || !['public', 'enforced_test'].includes(audience) ||
        (audience === 'public' && commercialMode !== 'report_only') ||
        (audience === 'enforced_test' && commercialMode !== 'enforced')) return denied('commercial_policy_invalid');

    if (!ownKeysExactly(input.operational, [...OPERATIONAL_CONTROLS])) return denied('operational_authority_unknown');
    for (const control of OPERATIONAL_CONTROLS) {
      if (input.operational[control] !== 'allowed') {
        return denied(input.operational[control] === 'denied' ? `operational_${control}_denied` : 'operational_authority_unknown');
      }
    }

    const entry = catalog.find(item => item.version.id === assignment.planVersionId);
    if (!entry) return denied('assignment_unavailable');
    if (actionFeature === 'supplier.transactions') return denied('supplier_transactions_deferred', { planVersionId: entry.version.id });
    const feature = entry.version.features[actionFeature];
    const featureTier = feature.releaseTier;
    if (!input.implementedFeatures.includes(actionFeature)) {
      return denied('feature_unimplemented', { planVersionId: entry.version.id, featureTier });
    }
    if (!Object.hasOwn(TIER_RANK, featureTier) || TIER_RANK[featureTier] > TIER_RANK[runtimeTier]) {
      return denied('future_tier_unavailable', { planVersionId: entry.version.id, featureTier });
    }

    const commercialReason = feature.included ? null : 'feature_not_included';
    let quotaReason = null;
    if (input.quota !== undefined) {
      if (!ownKeysExactly(input.quota, ['limitKey', 'used']) || typeof input.quota.limitKey !== 'string') {
        return denied('quota_context_invalid', { planVersionId: entry.version.id });
      }
      const limit = entry.version.limits[input.quota.limitKey];
      if (!limit) return denied('quota_unknown', { planVersionId: entry.version.id });
      if (NON_ADMISSION_LIMIT_KEYS.has(input.quota.limitKey)) {
        return denied('quota_not_admission_metric', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
      }
      if (limit.state === 'not_configured') return denied('quota_unconfigured', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
      let quotaExhausted = false;
      if (limit.kind === 'finite') {
        if (limit.unit === 'USD') {
          if (typeof input.quota.used !== 'string' || !MONEY.test(input.quota.used)) {
            return denied('quota_usage_unknown', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
          }
          const usedCents = Number(input.quota.used.replace('.', ''));
          const limitCents = Number(limit.value.replace('.', ''));
          quotaExhausted = usedCents >= limitCents;
        } else {
          if (!Number.isSafeInteger(input.quota.used) || input.quota.used < 0) {
            return denied('quota_usage_unknown', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
          }
          quotaExhausted = input.quota.used >= limit.value;
        }
      } else if (limit.kind !== 'unlimited') {
        return denied('quota_unknown', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
      }
      if (quotaExhausted) {
        if (!REPORT_ONLY_QUOTA_KEYS.has(input.quota.limitKey)) {
          return denied('operational_quota_exhausted', { planVersionId: entry.version.id, limitKey: input.quota.limitKey });
        }
        quotaReason = 'quota_exhausted';
      }
    }

    const reason = commercialReason ?? quotaReason;
    if (reason && commercialMode === 'enforced') {
      return denied(reason, { planVersionId: entry.version.id, actionFeature });
    }
    if (reason) return {
      allowed: true,
      reason: 'commercial_report_only',
      wouldDeny: true,
      planVersionId: entry.version.id,
      actionFeature,
      auditEvent: {
        type: 'commercial_would_deny', accountId, planVersionId: entry.version.id,
        actionFeature, restriction: reason,
        ...(quotaReason ? { limitKey: input.quota.limitKey } : {}),
      },
    };
    return { allowed: true, reason: 'allowed', wouldDeny: false, planVersionId: entry.version.id, actionFeature };
  } catch {
    return denied('invalid_context');
  }
}
