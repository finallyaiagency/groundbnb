import { randomUUID } from 'node:crypto';
import { decryptFactorSecret, verifyRecoveryCodeCandidate } from './factor-storage.mjs';
import { verifyFactorCandidate } from './factor-verifier.mjs';

const ENVIRONMENTS = new Set(['local', 'preview', 'production']);
const OUTCOME = Object.freeze({ ok: true, outcome: 'accepted' });
const REJECTED = Object.freeze({ ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
const UNAVAILABLE = Object.freeze({ ok: false, outcome: 'unavailable', reason: 'factor_service_unavailable' });
const UNKNOWN = Object.freeze({ ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT = UUID;
const MAX_RECOVERY_ROWS = 100;
// A proposed, bounded default. Runtime wiring must pass it explicitly; the
// frozen source requires rate limiting but does not prescribe these numbers.
export const PROPOSED_FACTOR_RATE_POLICY = Object.freeze({ maxFailures: 5, windowSeconds: 900 });
const IDENTITY_KEYS = ['issuer', 'subject', 'sessionId', 'expiresAt'];
const STATE_KEYS = ['principal', 'currentSecurityEpoch', 'accountSuspended', 'sessionRevoked', 'rateLimited', 'factor', 'recoveryRecords'];
const PRINCIPAL_KEYS = ['accountId', 'issuer', 'subject', 'sessionId', 'accountStatus', 'role', 'securityEpoch'];
const FACTOR_KEYS = ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope', 'lastAcceptedStep'];
const RECOVERY_KEYS = ['recoveryId', 'accountId', 'factorId', 'securityEpoch', 'record'];

const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, keys) => plainRecord(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const validEpoch = value => Number.isSafeInteger(value) && value >= 0;
const validOpaque = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;

function instantNanos(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, fraction = '', zone, , oh, om] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(hh), minute = Number(mm), second = Number(ss);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(oh), offsetMinute = Number(om);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const whole = value.replace(/\.\d{1,9}(?=Z|[+-])/, '');
  const parsed = Date.parse(whole);
  return Number.isFinite(parsed) ? BigInt(parsed) * 1_000_000n + BigInt(fraction.padEnd(9, '0')) : null;
}

function now(clock) {
  let value;
  try { value = clock(); } catch { return null; }
  if (!(value instanceof Date)) return null;
  const milliseconds = Date.prototype.getTime.call(value);
  if (!Number.isFinite(milliseconds)) return null;
  return { date: value, nanos: BigInt(milliseconds) * 1_000_000n, iso: value.toISOString() };
}

function trustedIdentity(result, current) {
  if (!exactKeys(result, ['ok', 'identity']) || result.ok !== true || !exactKeys(result.identity, IDENTITY_KEYS)) return null;
  const identity = result.identity;
  const expiry = instantNanos(identity.expiresAt);
  if (![identity.issuer, identity.subject, identity.sessionId].every(validOpaque) || expiry === null || expiry <= current.nanos) return null;
  return Object.freeze({ issuer: identity.issuer, subject: identity.subject,
    sessionId: identity.sessionId, expiresAt: identity.expiresAt });
}

function validateState(state, identity) {
  if (!exactKeys(state, STATE_KEYS) || !exactKeys(state.principal, PRINCIPAL_KEYS) ||
      !exactKeys(state.factor, FACTOR_KEYS) || !Array.isArray(state.recoveryRecords) ||
      state.recoveryRecords.length > MAX_RECOVERY_ROWS) return null;
  const p = state.principal, f = state.factor;
  if (p.issuer !== identity.issuer || p.subject !== identity.subject || p.sessionId !== identity.sessionId ||
      typeof p.accountId !== 'string' || !ACCOUNT.test(p.accountId) || !validEpoch(p.securityEpoch) ||
      !['owner', 'admin'].includes(p.role) || p.accountStatus !== 'active' ||
      !validEpoch(state.currentSecurityEpoch) || state.currentSecurityEpoch !== p.securityEpoch ||
      state.accountSuspended !== false || state.sessionRevoked !== false || typeof state.rateLimited !== 'boolean' ||
      f.accountId !== p.accountId || f.securityEpoch !== state.currentSecurityEpoch || f.state !== 'verified' ||
      !validOpaque(f.factorId) || !validOpaque(f.keyId) || !plainRecord(f.envelope) || f.envelope.keyId !== f.keyId ||
      (f.lastAcceptedStep !== null && !validEpoch(f.lastAcceptedStep))) return null;
  for (const row of state.recoveryRecords) {
    if (!exactKeys(row, RECOVERY_KEYS) || !validOpaque(row.recoveryId) || row.accountId !== p.accountId ||
        row.factorId !== f.factorId || row.securityEpoch !== state.currentSecurityEpoch ||
        !exactKeys(row.record, ['version', 'salt', 'digest'])) return null;
  }
  return Object.freeze({ accountId: p.accountId, issuer: p.issuer, subject: p.subject,
    sessionId: p.sessionId, factorId: f.factorId, securityEpoch: state.currentSecurityEpoch });
}

function validRatePolicy(value) {
  return exactKeys(value, ['maxFailures', 'windowSeconds']) && Number.isInteger(value.maxFailures) &&
    value.maxFailures >= 3 && value.maxFailures <= 10 && Number.isInteger(value.windowSeconds) &&
    value.windowSeconds >= 60 && value.windowSeconds <= 3600;
}

function receiptMatches(value, identity, operationId, method, binding) {
  return exactKeys(value, ['status', 'operationId', 'method', 'accountId', 'issuer', 'subject', 'sessionId']) &&
    ['accepted', 'rejected', 'unavailable', 'not_found'].includes(value.status) &&
    value.operationId === operationId && value.method === method && value.accountId === binding.accountId &&
    value.issuer === identity.issuer &&
    value.subject === identity.subject && value.sessionId === identity.sessionId;
}

function resultFor(status) {
  if (status === 'accepted') return OUTCOME;
  if (status === 'rejected') return REJECTED;
  if (status === 'unavailable') return UNAVAILABLE;
  return UNKNOWN;
}

/**
 * Offline two-phase service protocol. The repository is a narrow port, not a
 * transaction callback: readChallengeState, one atomic writer, and (only after
 * uncertainty) readOperationReceipt. No HTTP request or callback holds a DB lock
 * while JavaScript verifies a factor candidate.
 */
export function createFactorServiceProtocol(dependencies) {
  if (!exactKeys(dependencies, ['environment', 'resolveSession', 'clock', 'keyProvider', 'repository', 'ratePolicy']) ||
      !ENVIRONMENTS.has(dependencies.environment) || typeof dependencies.resolveSession !== 'function' ||
      typeof dependencies.clock !== 'function' || !validRatePolicy(dependencies.ratePolicy) ||
      !plainRecord(dependencies.keyProvider) || typeof dependencies.keyProvider.getKey !== 'function' ||
      !plainRecord(dependencies.repository) || typeof dependencies.repository.readChallengeState !== 'function' ||
      typeof dependencies.repository.recordChallengeAttempt !== 'function' ||
      typeof dependencies.repository.consumeTotpCandidate !== 'function' ||
      typeof dependencies.repository.consumeRecoveryCandidate !== 'function' ||
      typeof dependencies.repository.readOperationReceipt !== 'function') throw new TypeError('Invalid factor protocol configuration.');
  const environment = dependencies.environment;
  const resolveSession = dependencies.resolveSession;
  const clock = dependencies.clock;
  const keyProvider = dependencies.keyProvider;
  const repository = dependencies.repository;
  const ratePolicy = Object.freeze({ maxFailures: dependencies.ratePolicy.maxFailures,
    windowSeconds: dependencies.ratePolicy.windowSeconds });

  async function readIdentity(context) {
    const before = now(clock);
    if (!before) return null;
    let result;
    try { result = await resolveSession(context); } catch { return null; }
    const after = now(clock);
    return after ? trustedIdentity(result, after) : null;
  }

  async function uncertainResult(identity, operationId, method, requestContext, binding) {
    try {
      const receipt = await repository.readOperationReceipt(identity, { operationId, method,
        expectedAccountId: binding.accountId });
      if (!receiptMatches(receipt, identity, operationId, method, binding)) return UNKNOWN;
      if (receipt.status !== 'accepted') return resultFor(receipt.status);
      return confirmAccepted(identity, requestContext, binding);
    } catch { return UNKNOWN; }
  }

  async function confirmAccepted(identity, requestContext, expectedBinding) {
    const freshIdentity = await readIdentity(requestContext);
    if (!freshIdentity || freshIdentity.issuer !== identity.issuer || freshIdentity.subject !== identity.subject ||
        freshIdentity.sessionId !== identity.sessionId) return UNKNOWN;
    const timestamp = now(clock);
    if (!timestamp || instantNanos(freshIdentity.expiresAt) <= timestamp.nanos) return UNKNOWN;
    let freshState;
    try { freshState = await repository.readChallengeState(freshIdentity); } catch { return UNKNOWN; }
    const currentBinding = validateState(freshState, freshIdentity);
    const afterRead = now(clock);
    if (!currentBinding || freshState.rateLimited || !afterRead || instantNanos(freshIdentity.expiresAt) <= afterRead.nanos) return UNKNOWN;
    if (expectedBinding && (currentBinding.accountId !== expectedBinding.accountId ||
        currentBinding.factorId !== expectedBinding.factorId || currentBinding.securityEpoch !== expectedBinding.securityEpoch ||
        currentBinding.issuer !== expectedBinding.issuer || currentBinding.subject !== expectedBinding.subject ||
        currentBinding.sessionId !== expectedBinding.sessionId)) return UNKNOWN;
    // Status receipts are scoped by the database to the same owner/session/method;
    // the current state read prevents a historical receipt from surviving revocation.
    return OUTCOME;
  }

  async function recordFailure(identity, binding, operationId, outcome, method, requestContext) {
    const timestamp = now(clock);
    if (!timestamp || instantNanos(identity.expiresAt) <= timestamp.nanos) return UNKNOWN;
    try {
      const result = await repository.recordChallengeAttempt(identity, binding, {
        operationId, method, outcome, at: timestamp.iso, ratePolicy,
      });
      if (exactKeys(result, ['status']) && result.status === 'recorded') return outcome === 'rejected' ? REJECTED : UNAVAILABLE;
      if (exactKeys(result, ['status']) && result.status === 'unknown') return uncertainResult(identity, operationId, method, requestContext, binding);
      return UNKNOWN;
    } catch { return uncertainResult(identity, operationId, method, requestContext, binding); }
  }

  async function challenge(input, method) {
    const credentialKey = method === 'totp' ? 'token' : 'code';
    if (!exactKeys(input, ['requestContext', credentialKey]) || !plainRecord(input.requestContext) ||
        typeof input[credentialKey] !== 'string' || input[credentialKey].length > 128) return REJECTED;
    const identity = await readIdentity(input.requestContext);
    if (!identity) return UNAVAILABLE;
    let operationId;
    try { operationId = randomUUID(); } catch { return UNAVAILABLE; }
    const beforeRead = now(clock);
    if (!beforeRead || instantNanos(identity.expiresAt) <= beforeRead.nanos) return UNAVAILABLE;
    let state;
    try { state = await repository.readChallengeState(identity); } catch { return UNAVAILABLE; }
    const binding = validateState(state, identity);
    const readTime = now(clock);
    if (!binding || !readTime || instantNanos(identity.expiresAt) <= readTime.nanos) return UNAVAILABLE;
    if (state.rateLimited) return recordFailure(identity, binding, operationId, 'rejected', method, input.requestContext);

    if (method === 'totp') {
      const token = input.token;
      if (!/^\d{6}$/.test(token)) return recordFailure(identity, binding, operationId, 'rejected', method, input.requestContext);
      let keyRecord;
      try { keyRecord = await keyProvider.getKey({ environment, keyId: state.factor.keyId }); }
      catch { return recordFailure(identity, binding, operationId, 'unavailable', method, input.requestContext); }
      if (!exactKeys(keyRecord, ['keyId', 'key']) || keyRecord.keyId !== state.factor.keyId) {
        return recordFailure(identity, binding, operationId, 'unavailable', method, input.requestContext);
      }
      let secret;
      try { secret = decryptFactorSecret({ envelope: state.factor.envelope, key: keyRecord.key,
        keyId: state.factor.keyId, context: { environment,
          accountId: binding.accountId, factorId: binding.factorId, securityEpoch: binding.securityEpoch } }); }
      catch { return recordFailure(identity, binding, operationId, 'unavailable', method, input.requestContext); }
      const verifyTime = now(clock);
      if (!verifyTime || instantNanos(identity.expiresAt) <= verifyTime.nanos) return UNAVAILABLE;
      const candidate = await verifyFactorCandidate({ secret, token,
        epochSeconds: Math.floor(verifyTime.date.getTime() / 1000), lastAcceptedStep: state.factor.lastAcceptedStep });
      const consumeTime = now(clock);
      if (!consumeTime || instantNanos(identity.expiresAt) <= consumeTime.nanos) return UNAVAILABLE;
      const currentStep = Math.floor(consumeTime.date.getTime() / 30_000);
      if (!candidate.valid || Math.abs(candidate.matchedStep - currentStep) > 1) {
        return recordFailure(identity, binding, operationId, 'rejected', method, input.requestContext);
      }
      try {
        const result = await repository.consumeTotpCandidate(identity, binding, {
          operationId, matchedStep: candidate.matchedStep, identityExpiresAt: identity.expiresAt,
          ratePolicy,
        });
        if (exactKeys(result, ['status']) && result.status === 'accepted') {
          return confirmAccepted(identity, input.requestContext, binding);
        }
        if (exactKeys(result, ['status']) && result.status === 'rejected') return REJECTED;
        return uncertainResult(identity, operationId, method, input.requestContext, binding);
      } catch { return uncertainResult(identity, operationId, method, input.requestContext, binding); }
    }

    let matches = 0, matchedRecoveryId = null;
    for (const row of state.recoveryRecords) {
      if (verifyRecoveryCodeCandidate({ code: input.code, record: row.record,
        context: { environment, accountId: binding.accountId,
          factorId: binding.factorId, securityEpoch: binding.securityEpoch } }).valid) {
        matches++;
        matchedRecoveryId = row.recoveryId;
      }
    }
    if (matches !== 1 || matchedRecoveryId === null) return recordFailure(identity, binding, operationId, 'rejected', method, input.requestContext);
    const consumeTime = now(clock);
    if (!consumeTime || instantNanos(identity.expiresAt) <= consumeTime.nanos) return UNAVAILABLE;
    try {
      const result = await repository.consumeRecoveryCandidate(identity, binding, {
        operationId, recoveryId: matchedRecoveryId, identityExpiresAt: identity.expiresAt,
        ratePolicy,
      });
      if (exactKeys(result, ['status']) && result.status === 'accepted') {
        return confirmAccepted(identity, input.requestContext, binding);
      }
      if (exactKeys(result, ['status']) && result.status === 'rejected') return REJECTED;
      return uncertainResult(identity, operationId, method, input.requestContext, binding);
    } catch { return uncertainResult(identity, operationId, method, input.requestContext, binding); }
  }

  return Object.freeze({ challengeTOTP: input => challenge(input, 'totp'),
    challengeRecovery: input => challenge(input, 'recovery') });
}
