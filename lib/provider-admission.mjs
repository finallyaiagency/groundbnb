const NANO_USD = 1_000_000_000n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const REQUIRED_WINDOW_KEYS = [
  'account:day',
  'account:month',
  'provider:day',
  'provider:month',
  'application:day',
  'application:month',
];

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

/** Parse a non-negative USD decimal string exactly as integer nanodollars. */
export function parseUsdNanodollars(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * NANO_USD + BigInt(fraction.padEnd(9, '0') || '0');
}

function formatUsdNanodollars(value) {
  const whole = value / NANO_USD;
  const fraction = (value % NANO_USD).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function periodIsValid(key, value) {
  if (typeof value !== 'string') return false;
  if (key.endsWith(':day')) {
    if (!DAY.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  return MONTH.test(value);
}

function refusal(reason) {
  return { ok: false, kind: 'refused', reason };
}

/**
 * Build an offline admission candidate from server-trusted identity, policy,
 * rate, period and usage context. This does not reserve funds or authorize a
 * provider call; a durable atomic reservation is still required.
 */
export function evaluateProviderAdmission(input) {
  if (!exactKeys(input, [
    'identity', 'policy', 'rate', 'operationId', 'attemptId', 'currentPeriod',
    'freePoolRequired', 'windows',
  ])) return refusal('invalid_input');

  if (!exactKeys(input.identity, ['accountId', 'verified'])
    || typeof input.identity.accountId !== 'string'
    || !UUID.test(input.identity.accountId)
    || input.identity.verified !== true) return refusal('unverified_identity');

  if (!exactKeys(input.policy, ['versionId', 'status', 'commercialMode'])
    || typeof input.policy.versionId !== 'string'
    || !VERSION.test(input.policy.versionId)
    || !['Active', 'Paused'].includes(input.policy.status)
    || !['report_only', 'enforced'].includes(input.policy.commercialMode)) return refusal('invalid_policy');
  if (input.policy.status === 'Paused') return refusal('paused');

  if (!exactKeys(input.rate, ['versionId', 'providerId', 'maximumCostUsd'])
    || typeof input.rate.versionId !== 'string'
    || !VERSION.test(input.rate.versionId)
    || typeof input.rate.providerId !== 'string'
    || !VERSION.test(input.rate.providerId)) return refusal('unknown_rate');
  const maximum = parseUsdNanodollars(input.rate.maximumCostUsd);
  if (maximum === null) return refusal('unknown_or_invalid_maximum_cost');

  if (typeof input.operationId !== 'string' || !UUID.test(input.operationId)
    || typeof input.attemptId !== 'string' || !UUID.test(input.attemptId)) return refusal('invalid_operation_identity');

  if (!exactKeys(input.currentPeriod, ['dayKey', 'monthKey'])
    || !periodIsValid('account:day', input.currentPeriod.dayKey)
    || !MONTH.test(input.currentPeriod.monthKey)
    || input.currentPeriod.dayKey.slice(0, 7) !== input.currentPeriod.monthKey) return refusal('invalid_period_context');

  if (typeof input.freePoolRequired !== 'boolean') return refusal('invalid_free_pool_context');
  if (!Array.isArray(input.windows)) return refusal('missing_windows');

  const required = new Set(REQUIRED_WINDOW_KEYS);
  if (input.freePoolRequired) required.add('free_pool:day');
  if (input.windows.length !== required.size) return refusal('incomplete_or_extra_windows');

  const seen = new Set();
  const calculations = [];
  for (const window of input.windows) {
    if (!exactKeys(window, ['key', 'ownerId', 'periodKey', 'spentUsd', 'pendingUsd', 'capUsd', 'heldEmergencyUsd'])) {
      return refusal('invalid_window');
    }
    if (typeof window.key !== 'string' || !required.has(window.key) || seen.has(window.key)) return refusal('invalid_window_set');
    seen.add(window.key);

    const [scope, period] = window.key.split(':');
    const expectedOwner = scope === 'account'
      ? input.identity.accountId
      : scope === 'provider' ? input.rate.providerId
        : scope === 'application' ? 'application'
          : 'free-pool';
    if (typeof expectedOwner !== 'string' || !expectedOwner || window.ownerId !== expectedOwner) {
      return refusal('window_owner_mismatch');
    }
    const expectedPeriod = period === 'day' ? input.currentPeriod.dayKey : input.currentPeriod.monthKey;
    if (!periodIsValid(window.key, window.periodKey) || window.periodKey !== expectedPeriod) return refusal('window_period_mismatch');

    const spent = parseUsdNanodollars(window.spentUsd);
    const pending = parseUsdNanodollars(window.pendingUsd);
    const cap = parseUsdNanodollars(window.capUsd);
    const held = parseUsdNanodollars(window.heldEmergencyUsd);
    if ([spent, pending, cap, held].some((amount) => amount === null)) return refusal('unknown_or_invalid_window_amount');
    if (held > cap) return refusal('reserve_exceeds_cap');
    if (spent + pending + maximum > cap - held) return refusal('window_limit_exceeded');
    calculations.push({ key: window.key, remainingUsd: formatUsdNanodollars(cap - held - spent - pending - maximum) });
  }
  if (seen.size !== required.size) return refusal('incomplete_window_set');

  return {
    ok: true,
    kind: 'admission_candidate',
    candidate: {
      accountId: input.identity.accountId,
      policyVersionId: input.policy.versionId,
      rateVersionId: input.rate.versionId,
      operationId: input.operationId,
      attemptId: input.attemptId,
      currentPeriod: { ...input.currentPeriod },
      maximumCostUsd: formatUsdNanodollars(maximum),
      windows: calculations,
      commercialMode: input.policy.commercialMode,
    },
    durableReservation: false,
    dispatchAuthorized: false,
  };
}
