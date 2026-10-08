import { decryptFactorSecret, verifyRecoveryCodeCandidate } from './factor-storage.mjs';
import { verifyFactorCandidate } from './factor-verifier.mjs';
import { decidePrivilegedAccess } from './privileged-access.mjs';

const ENVIRONMENTS = new Set(['local', 'preview', 'production']);
const FAIL = Object.freeze({ ok: false, outcome: 'unavailable', reason: 'factor_service_unavailable' });
const DENIED = Object.freeze({ ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
const UNKNOWN = Object.freeze({ ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_KEYS = ['issuer', 'subject', 'sessionId', 'expiresAt'];
const PRINCIPAL_KEYS = ['accountId', 'issuer', 'subject', 'sessionId', 'accountStatus', 'role', 'securityEpoch'];
const FACTOR_KEYS = ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope', 'lastAcceptedStep'];
const CHALLENGE_STATE_KEYS = ['principal', 'currentSecurityEpoch', 'accountSuspended', 'sessionRevoked', 'rateLimited', 'factor', 'recoveryRecords'];
const RECOVERY_KEYS = ['recoveryId', 'accountId', 'factorId', 'securityEpoch', 'record'];
const ACCESS_STATE_KEYS = ['principal', 'factorAttestation', 'context'];
const ACCESS_PRINCIPAL_KEYS = ['accountId', 'issuer', 'subject', 'sessionId', 'accountStatus', 'role', 'securityEpoch'];
const ACCESS_FACTOR_KEYS = ['accountId', 'issuer', 'subject', 'sessionId', 'enrolled', 'verified', 'challengedAt', 'lastActivityAt', 'securityEpoch'];
const ACCESS_CONTEXT_KEYS = ['currentSecurityEpoch', 'accountSuspended', 'sessionRevoked', 'rateLimited'];
const MAX_RECOVERY_ROWS = 100;

const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, expected) => plainRecord(value) && Object.keys(value).length === expected.length &&
  expected.every(key => Object.hasOwn(value, key));
const validEpoch = value => Number.isSafeInteger(value) && value >= 0;
const validRequestContext = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function instantNanoseconds(value) {
  // Match the managed-session resolver's full fractional precision without rounding.
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(offsetHourText), offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const whole = value.replace(/\.\d{1,9}(?=Z|[+-])/, '');
  const milliseconds = Date.parse(whole);
  return Number.isFinite(milliseconds)
    ? BigInt(milliseconds) * 1_000_000n + BigInt(fraction.padEnd(9, '0')) : null;
}

function clockValue(clock) {
  let date;
  try { date = clock(); } catch { return null; }
  if (!(date instanceof Date)) return null;
  const ms = Date.prototype.getTime.call(date);
  if (!Number.isFinite(ms)) return null;
  return { date, nanos: BigInt(ms) * 1_000_000n, iso: date.toISOString() };
}

function validIdentity(result, nowMicros) {
  if (!exactKeys(result, ['ok', 'identity']) || result.ok !== true || !exactKeys(result.identity, IDENTITY_KEYS)) return null;
  const { issuer, subject, sessionId, expiresAt } = result.identity;
  const expiry = instantNanoseconds(expiresAt);
  if ([issuer, subject, sessionId].some(value => typeof value !== 'string' || !value.trim() || value.length > 512) ||
      expiry === null || expiry <= nowMicros) return null;
  return Object.freeze({ issuer, subject, sessionId, expiresAt });
}

function identityMatches(principal, identity) {
  return exactKeys(principal, PRINCIPAL_KEYS) && principal.issuer === identity.issuer &&
    principal.subject === identity.subject && principal.sessionId === identity.sessionId &&
    typeof principal.accountId === 'string' && ACCOUNT_ID.test(principal.accountId) &&
    validEpoch(principal.securityEpoch) && ['admin', 'owner'].includes(principal.role) &&
    principal.accountStatus === 'active';
}

function usableState(state, identity) {
  if (!exactKeys(state, CHALLENGE_STATE_KEYS) || !identityMatches(state.principal, identity) ||
      !validEpoch(state.currentSecurityEpoch) || state.currentSecurityEpoch !== state.principal.securityEpoch ||
      state.accountSuspended !== false || state.sessionRevoked !== false || typeof state.rateLimited !== 'boolean' ||
      !exactKeys(state.factor, FACTOR_KEYS) || state.factor.state !== 'verified' ||
      state.factor.accountId !== state.principal.accountId || state.factor.securityEpoch !== state.currentSecurityEpoch ||
      typeof state.factor.factorId !== 'string' || !state.factor.factorId.trim() ||
      typeof state.factor.keyId !== 'string' || !plainRecord(state.factor.envelope) ||
      state.factor.envelope.keyId !== state.factor.keyId ||
      (state.factor.lastAcceptedStep !== null && !validEpoch(state.factor.lastAcceptedStep)) ||
      !Array.isArray(state.recoveryRecords) || state.recoveryRecords.length > MAX_RECOVERY_ROWS) return false;
  if (state.factor.state !== 'verified') return false;
  return state.recoveryRecords.every(record => exactKeys(record, RECOVERY_KEYS) &&
    typeof record.recoveryId === 'string' && record.recoveryId.length > 0 &&
    record.accountId === state.principal.accountId && record.factorId === state.factor.factorId &&
    record.securityEpoch === state.currentSecurityEpoch && exactKeys(record.record, ['version', 'salt', 'digest']));
}

function recoveryContext(environment, state) {
  return { environment, accountId: state.principal.accountId,
    factorId: state.factor.factorId, securityEpoch: state.currentSecurityEpoch };
}

function resultAfterCommit(transactionResult) {
  if (!exactKeys(transactionResult, ['status', 'value'])) return UNKNOWN;
  if (transactionResult.status !== 'committed') return UNKNOWN;
  const outcome = transactionResult.value;
  if (!exactKeys(outcome, ['status'])) return UNKNOWN;
  if (outcome.status === 'accepted') return Object.freeze({ ok: true, outcome: 'accepted' });
  if (outcome.status === 'rejected') return DENIED;
  if (outcome.status === 'unknown') return UNKNOWN;
  return FAIL;
}

/**
 * Offline-only factor orchestration boundary. `resolveSession(requestContext)` must
 * perform a fresh managed-auth read and return the exact resolveManagedSessionIdentity
 * shape. `repository.withChallengeTransaction(identity, work)` must serialize the
 * account/rate/factor rows, reload trusted bindings before `work`, and commit normal
 * callback returns. Throwing rolls back. The transaction exposes only:
 *
 * - `loadChallengeState()` — current server-owned principal, epoch, factor envelope,
 *   replay state, rate/revocation state, and unconsumed recovery digest rows.
 * - `recordAttempt({ outcome, at })` — durably audit/rate-limit a rejected or unavailable
 *   attempt without storing its submitted code.
 * - `consumeTotp({ matchedStep, at, identityExpiresAt })` — atomically recheck current
 *   bindings, recheck the matched step is still within the verifier time window, consume
 *   the unique step, append audit, and persist its attestation.
 * - `consumeRecovery({ recoveryId, at, identityExpiresAt })` — consume that exact row and
 *   atomically append audit and recovery-source attestation.
 *
 * Access uses `repository.withAccessTransaction(identity, work)` with
 * `tx.loadAccessSnapshot()` and `tx.readOnly(callback)`. The latter must pass the callback
 * a frozen narrow reader exposing only route-approved reads; raw transaction/writer
 * access is never passed to application code. The reader exposes no mutation or generic
 * SQL API. The transaction remains open while policy runs and the callback executes.
 * Access is reloaded and reevaluated after that callback before its data can be returned;
 * the repository checks serialized account/session/factor bindings and current session
 * expiry again at commit with its own clock.
 * Consume methods return `{ status: 'committed' | 'rejected' |
 * 'unknown' }`. A transaction wrapper returns `{ status: 'committed', value }` only after
 * commit. Unknown/throwing
 * outcomes are never retried or reported as success. These injected interfaces are test
 * contracts; they do not prove database locking or live MFA.
 */
export function createFactorService(dependencies) {
  if (!exactKeys(dependencies, ['environment', 'resolveSession', 'clock', 'keyProvider', 'repository']) ||
      !ENVIRONMENTS.has(dependencies.environment) || typeof dependencies.resolveSession !== 'function' ||
      typeof dependencies.clock !== 'function' || !plainRecord(dependencies.keyProvider) ||
      typeof dependencies.keyProvider.getKey !== 'function' || !plainRecord(dependencies.repository) ||
      typeof dependencies.repository.withChallengeTransaction !== 'function' ||
      typeof dependencies.repository.withAccessTransaction !== 'function') throw new TypeError('Invalid factor service configuration.');

  async function resolveIdentity(requestContext) {
    const before = clockValue(dependencies.clock);
    if (!before) return null;
    let resolved;
    try { resolved = await dependencies.resolveSession(requestContext); } catch { return null; }
    const after = clockValue(dependencies.clock);
    if (!after) return null;
    const identity = validIdentity(resolved, after.nanos);
    return identity;
  }

  async function challenge(input, method) {
    if (!exactKeys(input, method === 'totp' ? ['requestContext', 'token'] : ['requestContext', 'code']) ||
        !validRequestContext(input.requestContext) ||
        (method === 'totp' && (typeof input.token !== 'string' || input.token.length > 128)) ||
        (method === 'recovery' && (typeof input.code !== 'string' || input.code.length > 128))) return DENIED;
    const identity = await resolveIdentity(input.requestContext);
    if (!identity) return FAIL;
    try {
      const transactionResult = await dependencies.repository.withChallengeTransaction(identity, async tx => {
        if (!plainRecord(tx) || typeof tx.loadChallengeState !== 'function' || typeof tx.recordAttempt !== 'function' ||
            typeof tx.consumeTotp !== 'function' || typeof tx.consumeRecovery !== 'function') return { status: 'unknown' };
        const state = await tx.loadChallengeState();
        if (!usableState(state, identity)) {
          const at = clockValue(dependencies.clock);
          if (!at || !await recordAttempt(tx, 'unavailable', at.iso)) return { status: 'unknown' };
          return { status: 'unknown' };
        }
        if (state.rateLimited) {
          const at = clockValue(dependencies.clock);
          if (!at || !await recordAttempt(tx, 'rejected', at.iso)) return { status: 'unknown' };
          return { status: 'rejected' };
        }
        if (method === 'totp') {
          if (!/^\d{6}$/.test(input.token)) {
            const at = clockValue(dependencies.clock);
            if (!at || !await recordAttempt(tx, 'rejected', at.iso)) return { status: 'unknown' };
            return { status: 'rejected' };
          }
          let keyRecord;
          try { keyRecord = await dependencies.keyProvider.getKey({ environment: dependencies.environment, keyId: state.factor.keyId }); }
          catch { return await unavailableAttempt(tx, dependencies.clock); }
          if (!exactKeys(keyRecord, ['keyId', 'key']) || keyRecord.keyId !== state.factor.keyId) {
            return await unavailableAttempt(tx, dependencies.clock);
          }
          let secret;
          try {
            secret = decryptFactorSecret({ envelope: state.factor.envelope, key: keyRecord.key,
              keyId: state.factor.keyId, context: recoveryContext(dependencies.environment, state) });
          } catch { return await unavailableAttempt(tx, dependencies.clock); }
          const now = clockValue(dependencies.clock);
          if (!now || instantNanoseconds(identity.expiresAt) <= now.nanos) return { status: 'unknown' };
          const candidate = await verifyFactorCandidate({ secret, token: input.token,
            epochSeconds: Math.floor(now.date.getTime() / 1000), lastAcceptedStep: state.factor.lastAcceptedStep });
          const commitTime = clockValue(dependencies.clock);
          if (!commitTime || instantNanoseconds(identity.expiresAt) <= commitTime.nanos) return { status: 'unknown' };
          const currentStep = Math.floor(commitTime.date.getTime() / 30_000);
          if (!candidate.valid || Math.abs(candidate.matchedStep - currentStep) > 1) {
            if (!await recordAttempt(tx, 'rejected', commitTime.iso)) return { status: 'unknown' };
            return { status: 'rejected' };
          }
          const persisted = await tx.consumeTotp({ matchedStep: candidate.matchedStep,
            at: commitTime.iso, identityExpiresAt: identity.expiresAt });
          return exactKeys(persisted, ['status']) && persisted.status === 'committed'
            ? { status: 'accepted' } : { status: persisted?.status === 'rejected' ? 'rejected' : 'unknown' };
        }
        let matchingRecoveryId = null;
        let recoveryMatches = 0;
        for (const record of state.recoveryRecords) {
          const candidate = verifyRecoveryCodeCandidate({ code: input.code, record: record.record,
            context: recoveryContext(dependencies.environment, state) });
          if (candidate.valid) {
            recoveryMatches++;
            matchingRecoveryId = record.recoveryId;
          }
        }
        if (recoveryMatches === 1 && matchingRecoveryId !== null) {
          const at = clockValue(dependencies.clock);
          if (!at || instantNanoseconds(identity.expiresAt) <= at.nanos) return { status: 'unknown' };
          const persisted = await tx.consumeRecovery({ recoveryId: matchingRecoveryId,
            at: at.iso, identityExpiresAt: identity.expiresAt });
          return exactKeys(persisted, ['status']) && persisted.status === 'committed'
            ? { status: 'accepted' } : { status: persisted?.status === 'rejected' ? 'rejected' : 'unknown' };
        }
        const at = clockValue(dependencies.clock);
        if (!at || !await recordAttempt(tx, 'rejected', at.iso)) return { status: 'unknown' };
        return { status: 'rejected' };
      });
      return resultAfterCommit(transactionResult);
    } catch { return UNKNOWN; }
  }

  async function evaluateAccess(requestContext, sensitivity, readProtected) {
    if (!validRequestContext(requestContext) || !['ordinary', 'sensitive'].includes(sensitivity) ||
        typeof readProtected !== 'function') return FAIL;
    const identity = await resolveIdentity(requestContext);
    if (!identity) return FAIL;
    let finalSnapshotForReply = null;
    try {
      const transactionResult = await dependencies.repository.withAccessTransaction(identity, async tx => {
        if (!plainRecord(tx) || typeof tx.loadAccessSnapshot !== 'function' || typeof tx.readOnly !== 'function') {
          return { status: 'unknown' };
        }
        const snapshot = await tx.loadAccessSnapshot();
        const now = clockValue(dependencies.clock);
        if (!now || instantNanoseconds(identity.expiresAt) <= now.nanos || !validAccessSnapshot(snapshot, identity)) {
          return { status: 'denied', decision: Object.freeze({ allowed: false, reason: 'invalid_context' }) };
        }
        const decision = decidePrivilegedAccess({
          principal: snapshot.principal,
          factorAttestation: snapshot.factorAttestation,
          context: { ...snapshot.context, now: now.iso, sensitive: sensitivity === 'sensitive' },
        });
        if (!decision.allowed) return { status: 'denied', decision };
        const value = await tx.readOnly(readProtected);
        const finalSnapshot = await tx.loadAccessSnapshot();
        const finalNow = clockValue(dependencies.clock);
        if (!finalNow || instantNanoseconds(identity.expiresAt) <= finalNow.nanos ||
            !validAccessSnapshot(finalSnapshot, identity)) {
          return { status: 'denied', decision: Object.freeze({ allowed: false, reason: 'invalid_context' }) };
        }
        const finalDecision = decidePrivilegedAccess({ principal: finalSnapshot.principal,
          factorAttestation: finalSnapshot.factorAttestation,
          context: { ...finalSnapshot.context, now: finalNow.iso, sensitive: sensitivity === 'sensitive' } });
        if (!finalDecision.allowed) return { status: 'denied', decision: finalDecision };
        finalSnapshotForReply = finalSnapshot;
        return { status: 'allowed', decision: finalDecision, value };
      });
      if (!exactKeys(transactionResult, ['status', 'value']) || transactionResult.status !== 'committed' ||
          !plainRecord(transactionResult.value)) return UNKNOWN;
      if (transactionResult.value.status === 'denied' && transactionResult.value.decision?.allowed === false) {
        return Object.freeze({ ok: false, decision: transactionResult.value.decision });
      }
      if (transactionResult.value.status === 'allowed' && transactionResult.value.decision?.allowed === true &&
          Object.hasOwn(transactionResult.value, 'value') && finalSnapshotForReply !== null) {
        const replyTime = clockValue(dependencies.clock);
        if (!replyTime || instantNanoseconds(identity.expiresAt) <= replyTime.nanos) {
          return Object.freeze({ ok: false, decision: Object.freeze({ allowed: false, reason: 'invalid_context' }) });
        }
        const replyDecision = decidePrivilegedAccess({ principal: finalSnapshotForReply.principal,
          factorAttestation: finalSnapshotForReply.factorAttestation,
          context: { ...finalSnapshotForReply.context, now: replyTime.iso, sensitive: sensitivity === 'sensitive' } });
        if (!replyDecision.allowed) return Object.freeze({ ok: false, decision: replyDecision });
        return Object.freeze({ ok: true, decision: replyDecision, value: transactionResult.value.value });
      }
      return UNKNOWN;
    } catch { return FAIL; }
  }

  return Object.freeze({
    challengeTOTP: input => challenge(input, 'totp'),
    challengeRecovery: input => challenge(input, 'recovery'),
    withOrdinaryAccess: (requestContext, readProtected) => evaluateAccess(requestContext, 'ordinary', readProtected),
    withSensitiveAccess: (requestContext, readProtected) => evaluateAccess(requestContext, 'sensitive', readProtected),
  });
}

async function recordAttempt(tx, outcome, at) {
  try {
    const recorded = await tx.recordAttempt({ outcome, at });
    return exactKeys(recorded, ['status']) && recorded.status === 'recorded';
  } catch { return false; }
}

async function unavailableAttempt(tx, clock) {
  const now = clockValue(clock);
  if (!now || !await recordAttempt(tx, 'unavailable', now.iso)) return { status: 'unknown' };
  return { status: 'unknown' };
}

function validAccessSnapshot(snapshot, identity) {
  if (!exactKeys(snapshot, ACCESS_STATE_KEYS) || !exactKeys(snapshot.principal, ACCESS_PRINCIPAL_KEYS) ||
      !exactKeys(snapshot.factorAttestation, ACCESS_FACTOR_KEYS) || !exactKeys(snapshot.context, ACCESS_CONTEXT_KEYS)) return false;
  return snapshot.principal.issuer === identity.issuer && snapshot.principal.subject === identity.subject &&
    snapshot.principal.sessionId === identity.sessionId && snapshot.factorAttestation.issuer === identity.issuer &&
    snapshot.factorAttestation.subject === identity.subject && snapshot.factorAttestation.sessionId === identity.sessionId &&
    validEpoch(snapshot.principal.securityEpoch) && validEpoch(snapshot.context.currentSecurityEpoch) &&
    typeof snapshot.context.accountSuspended === 'boolean' && typeof snapshot.context.sessionRevoked === 'boolean' &&
    typeof snapshot.context.rateLimited === 'boolean';
}
