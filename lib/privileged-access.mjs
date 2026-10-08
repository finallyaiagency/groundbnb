const MAX_CHALLENGE_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_IDLE_MS = 30 * 60 * 1000;
const MAX_STEP_UP_AGE_MS = 5 * 60 * 1000;
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) return null;
  return millis;
}

const deny = reason => Object.freeze({ allowed: false, reason });
const allow = reason => Object.freeze({ allowed: true, reason });

/**
 * Decision-only policy contract. Every input must come from current trusted
 * server session/account/factor state; request fields, provider labels, email,
 * and client timestamps are not evidence. This function neither verifies a
 * factor nor mutates state and its result contains no protected data.
 */
export function decidePrivilegedAccess(input) {
  if (!plainRecord(input)) return deny('invalid_context');
  const { principal, factorAttestation, context } = input;
  if (!plainRecord(principal) || !plainRecord(context) || typeof context.sensitive !== 'boolean') {
    return deny('invalid_context');
  }
  if (principal.accountStatus !== 'active' || context.accountSuspended !== false) return deny('inactive_account');
  if (!['admin', 'owner'].includes(principal.role)) return deny('not_privileged');
  if (context.sessionRevoked !== false) return deny('session_revoked');
  if (context.rateLimited !== false) return deny('factor_rate_limited');

  const principalIdentity = [principal.accountId, principal.issuer, principal.subject, principal.sessionId];
  if (!ACCOUNT_ID.test(principal.accountId) ||
      principalIdentity.slice(1).some(value => typeof value !== 'string' || !value.trim() || value.length > 512) ||
      !Number.isSafeInteger(principal.securityEpoch) || principal.securityEpoch < 0 ||
      !Number.isSafeInteger(context.currentSecurityEpoch) || context.currentSecurityEpoch < 0 ||
      principal.securityEpoch !== context.currentSecurityEpoch) return deny('invalid_principal');
  if (!plainRecord(factorAttestation) || factorAttestation.enrolled !== true || factorAttestation.verified !== true) {
    return deny('factor_required');
  }

  const factorIdentity = [factorAttestation.accountId, factorAttestation.issuer,
    factorAttestation.subject, factorAttestation.sessionId];
  if (!ACCOUNT_ID.test(factorAttestation.accountId) ||
      factorIdentity.slice(1).some(value => typeof value !== 'string' || !value.trim() || value.length > 512) ||
      factorAttestation.accountId !== principal.accountId || factorAttestation.issuer !== principal.issuer ||
      factorAttestation.subject !== principal.subject || factorAttestation.sessionId !== principal.sessionId) {
    return deny('identity_mismatch');
  }
  if (!Number.isSafeInteger(factorAttestation.securityEpoch) || factorAttestation.securityEpoch < 0 ||
      factorAttestation.securityEpoch !== context.currentSecurityEpoch) return deny('stale_epoch');

  const now = timestamp(context.now);
  const challengedAt = timestamp(factorAttestation.challengedAt);
  const lastActivityAt = timestamp(factorAttestation.lastActivityAt);
  if (now === null || challengedAt === null || lastActivityAt === null || challengedAt > now ||
      lastActivityAt > now || lastActivityAt < challengedAt) return deny('invalid_factor_times');
  if (now - challengedAt > MAX_CHALLENGE_AGE_MS) return deny('factor_stale');
  if (now - lastActivityAt >= MAX_IDLE_MS) return deny('session_idle');
  if (context.sensitive && now - challengedAt > MAX_STEP_UP_AGE_MS) return deny('step_up_required');
  return allow(context.sensitive ? 'step_up_fresh' : 'factor_fresh');
}
