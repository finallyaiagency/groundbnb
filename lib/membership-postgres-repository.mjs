import { isDeepStrictEqual } from 'node:util';
import {
  MEMBERSHIP_PLAN_CATALOG,
  validateMembershipCatalog,
} from './membership-catalog.mjs';
import { evaluateMembership } from './membership-evaluator.mjs';
import { validStoredTimestamp } from './profile-domain.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, keys) => plainRecord(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value;
const timestamp = validStoredTimestamp;
function timestampMicros(value) {
  if (!timestamp(value)) return null;
  const fraction = value.match(/\.(\d{1,6})(?=Z|[+-])/)?.[1] ?? '';
  const wholeSecond = value.replace(/\.\d{1,6}(?=Z|[+-])/, '');
  return BigInt(Date.parse(wholeSecond)) * 1000n + BigInt(fraction.padEnd(6, '0'));
}
const failed = category => Object.freeze({ ok: false, category });
const QUERY = 'SELECT groundbnb.read_membership($1,$2) AS result';
const freezeTree = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
};

const POLICY_KEYS = ['commercialMode', 'enforcedTestCohorts', 'checkoutEnabled', 'supplierTransactionsEnabled', 'updatedAt'];
const VERSION_KEYS = ['assignmentId', 'planVersionId', 'planId', 'planKey', 'displayName', 'planStatus',
  'versionNumber', 'releaseTier', 'featureDefinitions', 'limitDefinitions', 'effectiveFrom', 'effectiveUntil',
  'status', 'grantType'];
const GRANT_KEYS = ['grantId', 'grantType', 'planVersionId', 'planId', 'planKey', 'displayName', 'planStatus',
  'versionNumber', 'releaseTier', 'featureDefinitions', 'limitDefinitions', 'grantedAt', 'startsAt', 'expiresAt'];

function validPolicy(policy) {
  return exactKeys(policy, POLICY_KEYS) && ['report_only', 'enforced'].includes(policy.commercialMode) &&
    policy.enforcedTestCohorts === 'explicit' && policy.checkoutEnabled === false &&
    policy.supplierTransactionsEnabled === false && timestamp(policy.updatedAt);
}

function frozenPlan(version) {
  if (!exactKeys(version, VERSION_KEYS) || !UUID.test(version.assignmentId) || !UUID.test(version.planVersionId) ||
      !UUID.test(version.planId) || !['free', 'plus', 'pro'].includes(version.planKey) ||
      typeof version.displayName !== 'string' || !version.displayName.trim() || version.displayName.length > 80 ||
      !['active', 'archived'].includes(version.planStatus) || !Number.isSafeInteger(version.versionNumber) ||
      version.versionNumber < 1 || !['v1', 'v1.1'].includes(version.releaseTier) ||
      !timestamp(version.effectiveFrom) || (version.effectiveUntil !== null && !timestamp(version.effectiveUntil)) ||
      version.status !== 'active' || version.grantType !== 'base') return null;
  const entry = MEMBERSHIP_PLAN_CATALOG.find(item => item.plan.key === version.planKey &&
    item.version.id === version.planVersionId && item.plan.id === version.planId);
  if (!entry || version.versionNumber !== entry.version.number || version.releaseTier !== entry.version.releaseTier ||
      !isDeepStrictEqual(version.featureDefinitions, entry.version.features) ||
      !isDeepStrictEqual(version.limitDefinitions, entry.version.limits)) return null;
  return entry;
}

function frozenGrant(grant) {
  if (!exactKeys(grant, GRANT_KEYS) || !UUID.test(grant.grantId) || grant.grantType !== 'lifetime' ||
      !UUID.test(grant.planVersionId) || !UUID.test(grant.planId) ||
      !['free', 'plus', 'pro'].includes(grant.planKey) || typeof grant.displayName !== 'string' ||
      !grant.displayName.trim() || grant.displayName.length > 80 || !['active', 'archived'].includes(grant.planStatus) ||
      !Number.isSafeInteger(grant.versionNumber) || grant.versionNumber < 1 || !['v1', 'v1.1'].includes(grant.releaseTier) ||
      !timestamp(grant.grantedAt) || !timestamp(grant.startsAt) || grant.expiresAt !== null) return null;
  const entry = MEMBERSHIP_PLAN_CATALOG.find(item => item.plan.key === grant.planKey &&
    item.version.id === grant.planVersionId && item.plan.id === grant.planId);
  if (!entry || grant.versionNumber !== entry.version.number || grant.releaseTier !== entry.version.releaseTier ||
      !isDeepStrictEqual(grant.featureDefinitions, entry.version.features) ||
      !isDeepStrictEqual(grant.limitDefinitions, entry.version.limits)) return null;
  return entry;
}

function validateSnapshot(value) {
  if (!exactKeys(value, ['ok', 'accountId', 'evaluatedAt', 'policy', 'baseAssignment',
    'effectiveLifetimeGrants', 'effectiveLifetimeGrant']) || value.ok !== true || !UUID.test(value.accountId) ||
      !timestamp(value.evaluatedAt) || !validPolicy(value.policy) || !Array.isArray(value.effectiveLifetimeGrants) ||
      value.effectiveLifetimeGrants.length > 100) return false;
  const baseEntry = frozenPlan(value.baseAssignment);
  if (!baseEntry) return false;
  const evaluatedAt = timestampMicros(value.evaluatedAt);
  const baseStart = timestampMicros(value.baseAssignment.effectiveFrom);
  const baseEnd = value.baseAssignment.effectiveUntil === null ? null : timestampMicros(value.baseAssignment.effectiveUntil);
  if (baseStart === null || baseStart > evaluatedAt ||
      (value.baseAssignment.effectiveUntil !== null && (baseEnd === null || baseEnd <= evaluatedAt)) ||
      value.effectiveLifetimeGrants.some(grant => !frozenGrant(grant))) return false;
  const seenGrantIds = new Set();
  let previousStart = null;
  let previousId = null;
  for (const grant of value.effectiveLifetimeGrants) {
    const start = timestampMicros(grant.startsAt);
    const id = grant.grantId.toLowerCase();
    if (start === null || start > evaluatedAt || seenGrantIds.has(id) ||
        (previousStart !== null && (start > previousStart || (start === previousStart && id <= previousId)))) return false;
    seenGrantIds.add(id);
    previousStart = start;
    previousId = id;
  }
  if (value.effectiveLifetimeGrant === null) return value.effectiveLifetimeGrants.length === 0;
  if (!frozenGrant(value.effectiveLifetimeGrant) || value.effectiveLifetimeGrants.length === 0 ||
      !isDeepStrictEqual(value.effectiveLifetimeGrant, value.effectiveLifetimeGrants[0])) return false;
  return true;
}

function safeSnapshot(value) {
  if (exactKeys(value, ['ok', 'category']) && value.ok === false && ['auth', 'membership_unavailable'].includes(value.category)) {
    return failed(value.category);
  }
  if (!validateSnapshot(value)) return failed('membership_unavailable');
  return freezeTree(structuredClone(value));
}

/**
 * Server-only. Read the owner-scoped membership snapshot through the existing
 * private SECURITY DEFINER reader. Identity must come from the trusted session
 * resolver. This adapter never accepts an account selector, constructs a
 * connection, logs parameters, or falls back to a plan.
 */
export function createMembershipPostgresRepository(runQuery) {
  if (typeof runQuery !== 'function') throw new TypeError('A private query port is required.');

  async function readMembership(identity) {
    if (!exactKeys(identity, ['issuer', 'subject']) || !opaque(identity.issuer) || !opaque(identity.subject)) {
      return failed('auth');
    }
    try {
      const result = await runQuery(QUERY, [identity.issuer, identity.subject]);
      return safeSnapshot(result);
    } catch {
      return failed('membership_unavailable');
    }
  }

  return Object.freeze({ readMembership });
}

/**
 * Server-only. Apply the pure evaluator to a validated database snapshot.
 * `context` must be assembled from trusted server feature and operational
 * checks; never pass browser assertions as evaluator authority.
 */
export function evaluateMembershipSnapshot(snapshot, context) {
  const denied = reason => Object.freeze({ allowed: false, reason, wouldDeny: false });
  try {
    if (!validateSnapshot(snapshot) || !plainRecord(context) ||
        Object.keys(context).some(key => !['actionFeature', 'implementedFeatures', 'runtimeTier', 'audience',
          'operational', 'quota'].includes(key))) return denied('membership_unavailable');
    const selected = snapshot.effectiveLifetimeGrant ?? snapshot.baseAssignment;
    const entry = MEMBERSHIP_PLAN_CATALOG.find(item => item.version.id === selected.planVersionId);
    if (!entry) return denied('membership_unavailable');
    const audience = context.audience ?? 'public';
    if (!['public', 'enforced_test'].includes(audience)) return denied('membership_unavailable');
    if (audience === 'enforced_test' && snapshot.policy.enforcedTestCohorts !== 'explicit') {
      return denied('membership_unavailable');
    }
    const commercialMode = audience === 'enforced_test' ? 'enforced' : snapshot.policy.commercialMode;
    return evaluateMembership({
      catalog: MEMBERSHIP_PLAN_CATALOG,
      accountId: snapshot.accountId,
      assignment: { accountId: snapshot.accountId, planVersionId: entry.version.id },
      actionFeature: context.actionFeature,
      implementedFeatures: context.implementedFeatures,
      runtimeTier: context.runtimeTier,
      commercialMode,
      audience,
      operational: context.operational,
      ...(Object.hasOwn(context, 'quota') ? { quota: context.quota } : {}),
    });
  } catch {
    return denied('membership_unavailable');
  }
}

validateMembershipCatalog(MEMBERSHIP_PLAN_CATALOG);
