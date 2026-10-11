import { randomUUID } from 'node:crypto';
import { validateFactorEnrollmentRequest } from './factor-enrollment-contract.mjs';

const ENVIRONMENTS = new Set(['local', 'preview']);
const ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SECRET = /^[A-Z2-7]{32,103}$/;
const FINGERPRINT = /^[A-Za-z0-9_-]{43}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const REJECTED = Object.freeze({ ok: false, outcome: 'rejected', reason: 'factor_enrollment_rejected' });
const UNAVAILABLE = Object.freeze({ ok: false, outcome: 'unavailable', reason: 'factor_enrollment_unavailable' });
const UNKNOWN = Object.freeze({ ok: false, outcome: 'unknown', reason: 'factor_enrollment_outcome_unknown' });
const INVALID = Object.freeze({ ok: false, outcome: 'rejected', reason: 'invalid_request' });
const CONTEXT_KEYS = ['accountId', 'role', 'accountStatus', 'securityEpoch', 'anyLiveFactor', 'rateLimited', 'factor'];
const FACTOR_KEYS = ['factorId', 'securityEpoch', 'state', 'lastAcceptedStep',
  'beginOperationId', 'requestFingerprint', 'sessionAttested'];
const RECEIPT_KEYS = ['status', 'operationId', 'kind', 'accountId', 'issuer', 'subject', 'sessionId', 'factorId', 'securityEpoch', 'requestFingerprint'];

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
}

function exactKeys(value, keys) {
  if (!plainRecord(value)) return false;
  try {
    const own = Reflect.ownKeys(value);
    return own.length === keys.length && keys.every(key => own.includes(key)) &&
      keys.every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'));
  } catch { return false; }
}

function matchesEntire(regex, value) {
  if (typeof value !== 'string') return false;
  const match = regex.exec(value);
  return match !== null && match[0] === value;
}

function validKeyId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 64 && matchesEntire(KEY_ID, value); }
function validSecret(value) { return typeof value === 'string' && matchesEntire(SECRET, value); }
function validFingerprint(value) {
  if (typeof value !== 'string' || value.length !== 43 || !matchesEntire(FINGERPRINT, value)) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value;
}

function timestampNs(value) {
  if (typeof value !== 'string') return null;
  const m = ISO.exec(value);
  if (!m || m[0] !== value) return null;
  const [, y, mo, d, h, mi, s, fraction = '', zone, , oh, om] = m;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!year || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(oh), offsetMinute = Number(om);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const base = Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''));
  return Number.isFinite(base) ? BigInt(base) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9)) : null;
}

function currentNs(clock) {
  try {
    const value = clock();
    if (!(value instanceof Date)) return null;
    const ms = Date.prototype.getTime.call(value);
    return Number.isFinite(ms) ? BigInt(ms) * 1_000_000n : null;
  } catch { return null; }
}

function validIdentityResult(result, environment, now) {
  if (!exactKeys(result, ['ok', 'identity']) || result.ok !== true ||
      !exactKeys(result.identity, ['issuer', 'subject', 'sessionId', 'expiresAt'])) return null;
  const identity = result.identity;
  const expires = timestampNs(identity.expiresAt);
  if (identity.issuer !== ISSUERS[environment] || !validUuid(identity.subject) || !validUuid(identity.sessionId) ||
      expires === null || expires <= now || !identity.issuer.includes('neonauth') ||
      !identity.issuer.endsWith('/groundbnb/auth')) return null;
  return Object.freeze({ issuer: identity.issuer, subject: identity.subject,
    sessionId: identity.sessionId, expiresAt: identity.expiresAt });
}

function sameIdentity(a, b) {
  return a.issuer === b.issuer && a.subject === b.subject && a.sessionId === b.sessionId;
}

function validEpoch(value) { return Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER; }
function validUuid(value) { return typeof value === 'string' && value.length === 36 && UUID.test(value); }

function validContext(value) {
  if (!exactKeys(value, CONTEXT_KEYS) || typeof value.accountId !== 'string' || !validUuid(value.accountId) ||
      !['owner', 'admin'].includes(value.role) || value.accountStatus !== 'active' ||
      !validEpoch(value.securityEpoch) || typeof value.anyLiveFactor !== 'boolean' ||
      typeof value.rateLimited !== 'boolean' ||
      (value.factor !== null && (!value.anyLiveFactor || !exactKeys(value.factor, FACTOR_KEYS)))) return null;
  if (value.factor !== null && (!validUuid(value.factor.factorId) ||
      !validEpoch(value.factor.securityEpoch) || value.factor.securityEpoch !== value.securityEpoch ||
      !['pending', 'verified'].includes(value.factor.state) ||
      (value.factor.lastAcceptedStep !== null && !validEpoch(value.factor.lastAcceptedStep)) ||
      !validUuid(value.factor.beginOperationId) || !validFingerprint(value.factor.requestFingerprint) ||
      typeof value.factor.sessionAttested !== 'boolean')) return null;
  return Object.freeze({ accountId: value.accountId, role: value.role, accountStatus: value.accountStatus,
    securityEpoch: value.securityEpoch, anyLiveFactor: value.anyLiveFactor, rateLimited: value.rateLimited,
    factor: value.factor === null ? null : Object.freeze({ ...value.factor }) });
}

function validEnvelope(value, keyId) {
  if (!exactKeys(value, ['version', 'keyId', 'nonce', 'ciphertext', 'tag']) || value.version !== 1 ||
      typeof value.keyId !== 'string' || value.keyId !== keyId || !validKeyId(value.keyId) ||
      typeof value.nonce !== 'string' || value.nonce.length !== 16 || !matchesEntire(/^[A-Za-z0-9_-]{16}$/, value.nonce) ||
      typeof value.ciphertext !== 'string' || value.ciphertext.length < 43 || value.ciphertext.length > 138 ||
      !matchesEntire(/^[A-Za-z0-9_-]{43,138}$/, value.ciphertext) ||
      typeof value.tag !== 'string' || value.tag.length !== 22 || !matchesEntire(/^[A-Za-z0-9_-]{22}$/, value.tag)) return false;
  const nonce = Buffer.from(value.nonce, 'base64url');
  const ciphertext = Buffer.from(value.ciphertext, 'base64url');
  const tag = Buffer.from(value.tag, 'base64url');
  return nonce.length === 12 && nonce.toString('base64url') === value.nonce &&
    ciphertext.length >= 32 && ciphertext.length <= 103 && ciphertext.toString('base64url') === value.ciphertext &&
    tag.length === 16 && tag.toString('base64url') === value.tag;
}

function validReceipt(value, identity, operationId, kind, context) {
  if (!exactKeys(value, RECEIPT_KEYS) || value.operationId !== operationId || value.kind !== kind ||
      value.accountId !== context.accountId || value.issuer !== identity.issuer || value.subject !== identity.subject ||
      value.sessionId !== identity.sessionId || !['not_found', 'pending', 'rejected', 'verified', 'unknown'].includes(value.status)) return false;
  if (value.status === 'not_found') return value.factorId === null && value.securityEpoch === null && value.requestFingerprint === null;
  return validUuid(value.factorId) && validEpoch(value.securityEpoch) && validFingerprint(value.requestFingerprint);
}

function validBoundAck(value, statuses, operationId, kind, accountId, factorId, securityEpoch, requestFingerprintValue) {
  return exactKeys(value, ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch', 'requestFingerprint']) &&
    statuses.includes(value.status) && value.operationId === operationId && value.kind === kind &&
    value.accountId === accountId && value.factorId === factorId && value.securityEpoch === securityEpoch &&
    value.requestFingerprint === requestFingerprintValue;
}

function result(status, operationId) {
  if (status === 'pending') return Object.freeze({ ok: true, operationId, outcome: 'pending' });
  if (status === 'verified') return Object.freeze({ ok: true, operationId, outcome: 'verified' });
  if (status === 'rejected') return Object.freeze({ ...REJECTED, operationId });
  if (status === 'unknown') return Object.freeze({ ...UNKNOWN, operationId });
  return Object.freeze({ ...UNAVAILABLE, operationId });
}

function provisioningResult(operationId, secret) {
  const value = { ok: true, operationId, outcome: 'pending' };
  Object.defineProperty(value, 'provisioningSecret', { value: secret, enumerable: false });
  return Object.freeze(value);
}

function privateFields(fields, secretFields) {
  const value = { ...fields };
  for (const [name, secretValue] of Object.entries(secretFields)) {
    Object.defineProperty(value, name, { value: secretValue, enumerable: false });
  }
  return Object.freeze(value);
}

/**
 * Offline server-side enrollment orchestration. Every persistence call is a
 * fixed repository method; no arbitrary transaction callback or SQL is exposed.
 * An adapter must implement the atomic/revalidation contract from M1-01AE.
 */
export function createFactorEnrollmentProtocol(dependencies) {
  const expected = ['environment', 'resolveSession', 'repository', 'secretGenerator', 'keyProvider',
    'encryptor', 'decryptor', 'totpVerifier', 'fingerprint', 'clock'];
  const repositoryKeys = ['readEnrollmentContext', 'readPendingFactor', 'beginEnrollment',
    'recordEnrollmentAttempt', 'verifyEnrollment', 'readEnrollmentReceipt'];
  if (!exactKeys(dependencies, expected) || !ENVIRONMENTS.has(dependencies.environment) ||
      typeof dependencies.resolveSession !== 'function' || typeof dependencies.clock !== 'function' ||
      !exactKeys(dependencies.repository, repositoryKeys) || repositoryKeys.some(key => typeof dependencies.repository[key] !== 'function') ||
      !exactKeys(dependencies.secretGenerator, ['generate']) || typeof dependencies.secretGenerator.generate !== 'function' ||
      !exactKeys(dependencies.keyProvider, ['getKey']) || typeof dependencies.keyProvider.getKey !== 'function' ||
      !exactKeys(dependencies.encryptor, ['encrypt']) || typeof dependencies.encryptor.encrypt !== 'function' ||
      !exactKeys(dependencies.decryptor, ['decrypt']) || typeof dependencies.decryptor.decrypt !== 'function' ||
      !exactKeys(dependencies.totpVerifier, ['verifyCandidate']) || typeof dependencies.totpVerifier.verifyCandidate !== 'function' ||
      !exactKeys(dependencies.fingerprint, ['create']) || typeof dependencies.fingerprint.create !== 'function') {
    throw new TypeError('Invalid factor enrollment protocol configuration.');
  }
  const environment = dependencies.environment;
  const resolveSession = dependencies.resolveSession;
  const repository = Object.freeze(Object.fromEntries(repositoryKeys.map(key => [key, dependencies.repository[key]])));
  const secretGenerator = Object.freeze({ generate: dependencies.secretGenerator.generate });
  const keyProvider = Object.freeze({ getKey: dependencies.keyProvider.getKey });
  const encryptor = Object.freeze({ encrypt: dependencies.encryptor.encrypt });
  const decryptor = Object.freeze({ decrypt: dependencies.decryptor.decrypt });
  const totpVerifier = Object.freeze({ verifyCandidate: dependencies.totpVerifier.verifyCandidate });
  const fingerprint = Object.freeze({ create: dependencies.fingerprint.create });
  const clock = dependencies.clock;

  async function readIdentity(requestContext, expectedIdentity = null) {
    const before = currentNs(clock);
    if (before === null) return null;
    let resultValue;
    try { resultValue = await resolveSession(requestContext); } catch { return null; }
    const after = currentNs(clock);
    if (after === null) return null;
    const identity = validIdentityResult(resultValue, environment, after);
    return identity && (!expectedIdentity || sameIdentity(identity, expectedIdentity)) ? identity : null;
  }

  async function readStableContext(requestContext, priorIdentity = null, expectedBinding = null) {
    const identity = await readIdentity(requestContext, priorIdentity);
    const readTime = currentNs(clock);
    if (!identity || readTime === null || timestampNs(identity.expiresAt) <= readTime) return null;
    let raw;
    try { raw = await repository.readEnrollmentContext(identity); } catch { return null; }
    const context = validContext(raw);
    if (!context) return null;
    const after = await readIdentity(requestContext, identity);
    const time = currentNs(clock);
    if (!after || time === null || timestampNs(after.expiresAt) <= time) return null;
    if (expectedBinding && (context.accountId !== expectedBinding.accountId ||
        (Object.hasOwn(expectedBinding, 'securityEpoch') && context.securityEpoch !== expectedBinding.securityEpoch) ||
        (expectedBinding.factorId && context.factor?.factorId !== expectedBinding.factorId) ||
        (expectedBinding.factorState && context.factor?.state !== expectedBinding.factorState))) return null;
    return Object.freeze({ identity: after, context });
  }

  async function makeFingerprint(payload, requestContext, identity, binding) {
    let value;
    try { value = await fingerprint.create(Object.freeze(payload)); } catch { return null; }
    const current = await readStableContext(requestContext, identity, binding);
    return validFingerprint(value) && current ? { value, current } : null;
  }

  async function readReceipt(requestContext, identity, context, operationId, kind, requestFingerprintValue = null) {
    let value;
    try {
      value = await repository.readEnrollmentReceipt(identity, { operationId, kind,
        expectedAccountId: context.accountId, expectedFactorId: context.factor?.factorId ?? null,
        expectedSecurityEpoch: context.factor?.securityEpoch ?? null });
    } catch { return { status: 'unknown' }; }
    const fresh = await readStableContext(requestContext, identity, { accountId: context.accountId });
    if (!fresh || !validReceipt(value, identity, operationId, kind, context)) return { status: 'unknown' };
    if (value.status === 'not_found') return { status: 'not_found', current: fresh };
    if (value.requestFingerprint !== requestFingerprintValue && requestFingerprintValue !== null) return { status: 'rejected' };
    return { status: value.status, receipt: value, current: fresh };
  }

  function sameBeginContext(actual, expectedContext) {
    return actual.accountId === expectedContext.accountId && actual.securityEpoch === expectedContext.securityEpoch &&
      actual.role === expectedContext.role && actual.accountStatus === 'active' && !actual.anyLiveFactor && !actual.rateLimited;
  }

  async function begin(requestContext, body, attemptState) {
    const request = validateFactorEnrollmentRequest('begin', body);
    if (!request.ok) return INVALID;
    attemptState.operationId = request.operationId;
    let stable = await readStableContext(requestContext);
    if (!stable) return UNAVAILABLE;
    const { identity, context } = stable;
    const existing = await readReceipt(requestContext, identity, context, request.operationId, 'begin');
    if (existing.status !== 'not_found') {
      if (existing.status !== 'pending' || !existing.receipt) return result(existing.status === 'unknown' ? 'unknown' : 'unavailable', request.operationId);
      const prior = existing.receipt;
      const priorFingerprint = await makeFingerprint({ kind: 'begin', operationId: request.operationId,
        accountId: context.accountId, securityEpoch: prior.securityEpoch, issuer: identity.issuer,
        subject: identity.subject, sessionId: identity.sessionId }, requestContext, existing.current.identity,
      { accountId: context.accountId });
      if (!priorFingerprint || priorFingerprint.value !== prior.requestFingerprint ||
          prior.securityEpoch !== existing.current.context.securityEpoch ||
          existing.current.context.factor?.factorId !== prior.factorId || existing.current.context.factor?.state !== 'pending') {
        return result('unknown', request.operationId);
      }
      return result('pending', request.operationId);
    }
    stable = existing.current;
    if (!sameBeginContext(stable.context, context)) return UNAVAILABLE;
    const targetEpoch = context.securityEpoch + 1;
    const fingerprintResult = await makeFingerprint({ kind: 'begin', operationId: request.operationId,
      accountId: context.accountId, securityEpoch: targetEpoch, issuer: identity.issuer,
      subject: identity.subject, sessionId: identity.sessionId }, requestContext, stable.identity,
    { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!fingerprintResult) return UNAVAILABLE;
    stable = fingerprintResult.current;
    if (!sameBeginContext(stable.context, context)) return UNAVAILABLE;
    if (stable.context.anyLiveFactor || stable.context.factor !== null || stable.context.rateLimited) return UNAVAILABLE;

    let factorId;
    try { factorId = randomUUID(); } catch { return UNAVAILABLE; }
    let secret;
    try { secret = await secretGenerator.generate(); } catch { return UNAVAILABLE; }
    if (!validSecret(secret)) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!stable || !sameBeginContext(stable.context, context)) return UNAVAILABLE;

    let keyRecord;
    try { keyRecord = await keyProvider.getKey({ environment, purpose: 'factor-enrollment' }); } catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!stable || !sameBeginContext(stable.context, context) || !exactKeys(keyRecord, ['keyId', 'key']) ||
        typeof keyRecord.keyId !== 'string' || !validKeyId(keyRecord.keyId) ||
        !(Buffer.isBuffer(keyRecord.key) || keyRecord.key instanceof Uint8Array) || keyRecord.key.byteLength !== 32) return UNAVAILABLE;

    const encryptionContext = Object.freeze({ environment, accountId: context.accountId, factorId,
      securityEpoch: targetEpoch });
    let envelope;
    try { envelope = await encryptor.encrypt(privateFields({ keyId: keyRecord.keyId, context: encryptionContext },
      { secret, key: keyRecord.key })); }
    catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!stable || !sameBeginContext(stable.context, context) || !validEnvelope(envelope, keyRecord.keyId)) return UNAVAILABLE;

    let beginAck;
    attemptState.mutationIssued = true;
    try {
      beginAck = await repository.beginEnrollment(stable.identity, {
        operationId: request.operationId, expectedAccountId: context.accountId,
        expectedCurrentEpoch: context.securityEpoch, targetEpoch, candidateFactorId: factorId,
        requestFingerprint: fingerprintResult.value, envelopeKeyId: keyRecord.keyId, encryptedSecret: envelope,
      });
    } catch { beginAck = { status: 'unknown' }; }
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: beginAck?.status === 'committed' ? targetEpoch : context.securityEpoch });
    const boundBeginAck = validBoundAck(beginAck, ['committed', 'rejected'], request.operationId, 'begin',
      context.accountId, factorId, targetEpoch, fingerprintResult.value);
    if (boundBeginAck && beginAck.status === 'rejected') {
      return stable ? result('rejected', request.operationId) : result('unknown', request.operationId);
    }
    if (!boundBeginAck || beginAck.status !== 'committed' || !stable ||
        stable.context.factor?.factorId !== factorId || stable.context.factor.state !== 'pending' ||
        stable.context.factor.securityEpoch !== targetEpoch) {
      const receipt = await readReceipt(requestContext, stable?.identity ?? identity,
        stable?.context ?? context, request.operationId, 'begin', fingerprintResult.value);
      // A status receipt may confirm the pending record, but never returns
      // provisioning material and never triggers another writer call.
      return receipt.status === 'pending' ? result('pending', request.operationId) : result('unknown', request.operationId);
    }
    return provisioningResult(request.operationId, secret);
  }

  async function verify(requestContext, body, attemptState) {
    const request = validateFactorEnrollmentRequest('verify', body);
    if (!request.ok) return INVALID;
    attemptState.operationId = request.operationId;
    let stable = await readStableContext(requestContext);
    if (!stable || !stable.context.factor || stable.context.factor.securityEpoch !== stable.context.securityEpoch) return UNAVAILABLE;
    const { identity, context } = stable;
    const factor = context.factor;
    const binding = { accountId: context.accountId, securityEpoch: context.securityEpoch, factorId: factor.factorId };
    const existing = await readReceipt(requestContext, identity, context, request.operationId, 'verify');
    if (existing.status !== 'not_found') {
      if (!existing.receipt || !['verified', 'rejected'].includes(existing.status)) return result('unknown', request.operationId);
      const prior = existing.receipt;
      const priorFingerprint = await makeFingerprint(privateFields({ kind: 'verify', operationId: request.operationId,
        accountId: context.accountId, issuer: identity.issuer, subject: identity.subject,
        sessionId: identity.sessionId, factorId: prior.factorId, securityEpoch: prior.securityEpoch }, { code: request.code }),
      requestContext, existing.current.identity, { accountId: context.accountId,
        securityEpoch: prior.securityEpoch, factorId: prior.factorId });
      if (!priorFingerprint || priorFingerprint.value !== prior.requestFingerprint || prior.factorId !== factor.factorId ||
          prior.securityEpoch !== context.securityEpoch) return result('unknown', request.operationId);
      if (existing.status === 'rejected') return result('rejected', request.operationId);
      const current = await readStableContext(requestContext, existing.current.identity,
        { ...binding, factorState: 'verified' });
      return current?.context.factor?.sessionAttested ? result('verified', request.operationId) : result('unknown', request.operationId);
    }
    stable = existing.current;
    if (!stable.context.factor || stable.context.factor.state !== 'pending' ||
        stable.context.factor.securityEpoch !== stable.context.securityEpoch) return UNAVAILABLE;
    const pendingFactor = stable.context.factor;
    const fingerprintResult = await makeFingerprint(privateFields({ kind: 'verify', operationId: request.operationId,
      accountId: context.accountId, issuer: identity.issuer, subject: identity.subject,
      sessionId: identity.sessionId, factorId: pendingFactor.factorId,
      securityEpoch: context.securityEpoch }, { code: request.code }),
    requestContext, stable.identity, { accountId: context.accountId, securityEpoch: context.securityEpoch,
      factorId: pendingFactor.factorId, factorState: 'pending' });
    if (!fingerprintResult) return UNAVAILABLE;
    stable = fingerprintResult.current;
    if (stable.context.rateLimited) {
      return recordFailure(request, requestContext, stable.identity, context, pendingFactor,
        fingerprintResult.value, 'throttled', attemptState);
    }
    let pending;
    try { pending = await repository.readPendingFactor(stable.identity, { expectedAccountId: context.accountId,
      expectedFactorId: pendingFactor.factorId, expectedSecurityEpoch: context.securityEpoch,
      expectedBeginOperationId: pendingFactor.beginOperationId }); }
    catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch, factorId: pendingFactor.factorId,
        factorState: 'pending' });
    if (!stable || !exactKeys(pending, ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope',
      'lastAcceptedStep', 'beginOperationId', 'requestFingerprint']) || pending.accountId !== context.accountId ||
      pending.factorId !== pendingFactor.factorId || pending.securityEpoch !== context.securityEpoch || pending.state !== 'pending' ||
      pending.beginOperationId !== pendingFactor.beginOperationId ||
      pending.requestFingerprint !== pendingFactor.requestFingerprint || !validEnvelope(pending.envelope, pending.keyId)) return UNAVAILABLE;

    let keyRecord;
    try { keyRecord = await keyProvider.getKey({ environment, keyId: pending.keyId, purpose: 'factor-enrollment' }); }
    catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    if (!stable || !exactKeys(keyRecord, ['keyId', 'key']) || keyRecord.keyId !== pending.keyId ||
        !(Buffer.isBuffer(keyRecord.key) || keyRecord.key instanceof Uint8Array) || keyRecord.key.byteLength !== 32) return UNAVAILABLE;

    let secret;
    try { secret = await decryptor.decrypt(privateFields({ envelope: pending.envelope, keyId: pending.keyId,
      context: { environment, accountId: context.accountId, factorId: pendingFactor.factorId,
        securityEpoch: pendingFactor.securityEpoch } }, { key: keyRecord.key })); }
    catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    if (!stable || !validSecret(secret)) return UNAVAILABLE;

    const verifyTime = currentNs(clock);
    if (verifyTime === null || timestampNs(stable.identity.expiresAt) <= verifyTime) return UNAVAILABLE;
    let candidate;
    try { candidate = await totpVerifier.verifyCandidate(privateFields({
      epochSeconds: Number(verifyTime / 1_000_000_000n), lastAcceptedStep: pending.lastAcceptedStep,
    }, { secret, token: request.code })); }
    catch { return UNAVAILABLE; }
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    const afterVerify = currentNs(clock);
    if (!stable || afterVerify === null || timestampNs(stable.identity.expiresAt) <= afterVerify) return UNAVAILABLE;
    if (!validTotpCandidate(candidate, afterVerify, pending.lastAcceptedStep)) {
      return recordFailure(request, requestContext, stable.identity, context, pendingFactor,
        fingerprintResult.value, 'invalid', attemptState);
    }

    let verifyAck;
    attemptState.mutationIssued = true;
    try { verifyAck = await repository.verifyEnrollment(stable.identity, {
      operationId: request.operationId, beginOperationId: pending.beginOperationId,
      expectedAccountId: context.accountId, expectedFactorId: pendingFactor.factorId,
      expectedSecurityEpoch: context.securityEpoch, requestFingerprint: fingerprintResult.value,
      matchedStep: candidate.matchedStep,
    }); } catch { verifyAck = { status: 'unknown' }; }
    const boundVerifyAck = validBoundAck(verifyAck, ['committed', 'rejected'], request.operationId, 'verify',
      context.accountId, pendingFactor.factorId, context.securityEpoch, fingerprintResult.value);
    if (boundVerifyAck && verifyAck.status === 'committed') {
      const current = await readStableContext(requestContext, stable.identity,
        { ...binding, factorState: 'verified' });
      return current?.context.factor?.sessionAttested ? result('verified', request.operationId) : result('unknown', request.operationId);
    }
    if (boundVerifyAck && verifyAck.status === 'rejected') {
      const current = await readStableContext(requestContext, stable.identity,
        { ...binding, factorState: 'pending' });
      return current ? result('rejected', request.operationId) : result('unknown', request.operationId);
    }
    const receipt = await readReceipt(requestContext, stable.identity, stable.context,
      request.operationId, 'verify', fingerprintResult.value);
    if (receipt.status === 'verified') {
      const current = await readStableContext(requestContext, receipt.current.identity,
        { ...binding, factorState: 'verified' });
      return current?.context.factor?.sessionAttested ? result('verified', request.operationId) : result('unknown', request.operationId);
    }
    return result('unknown', request.operationId);
  }

  async function recordFailure(request, requestContext, identity, context, factor, requestFingerprintValue, reason, attemptState) {
    let ack;
    attemptState.mutationIssued = true;
    try { ack = await repository.recordEnrollmentAttempt(identity, { operationId: request.operationId,
      beginOperationId: factor.beginOperationId, expectedAccountId: context.accountId,
      expectedFactorId: factor.factorId, expectedSecurityEpoch: context.securityEpoch,
      requestFingerprint: requestFingerprintValue, reason }); }
    catch { ack = { status: 'unknown' }; }
    const validAck = exactKeys(ack, ['status', 'operationId', 'kind', 'accountId', 'factorId',
      'securityEpoch', 'requestFingerprint']) && ['recorded', 'rejected'].includes(ack.status) &&
      ack.operationId === request.operationId && ack.kind === 'verify' && ack.accountId === context.accountId &&
      ack.factorId === factor.factorId && ack.securityEpoch === context.securityEpoch &&
      ack.requestFingerprint === requestFingerprintValue;
    const current = await readStableContext(requestContext, identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch, factorId: factor.factorId, factorState: 'pending' });
    if (!current) return result('unknown', request.operationId);
    if (validAck) return result('rejected', request.operationId);
    const receipt = await readReceipt(requestContext, current.identity, current.context,
      request.operationId, 'verify', requestFingerprintValue);
    return receipt.status === 'rejected' ? result('rejected', request.operationId) : result('unknown', request.operationId);
  }

  return Object.freeze({
    async begin(requestContext, body) {
      const attemptState = { mutationIssued: false, operationId: null };
      try { return await begin(requestContext, body, attemptState); }
      catch { return attemptState.mutationIssued && attemptState.operationId
        ? result('unknown', attemptState.operationId) : UNAVAILABLE; }
    },
    async verify(requestContext, body) {
      const attemptState = { mutationIssued: false, operationId: null };
      try { return await verify(requestContext, body, attemptState); }
      catch { return attemptState.mutationIssued && attemptState.operationId
        ? result('unknown', attemptState.operationId) : UNAVAILABLE; }
    },
  });
}

function validTotpCandidate(value, nowNs, lastAcceptedStep) {
  if (!exactKeys(value, ['valid', 'matchedStep']) || value.valid !== true ||
      !Number.isSafeInteger(value.matchedStep) || value.matchedStep < 0) return false;
  const currentStep = Number(nowNs / 30_000_000_000n);
  return Math.abs(value.matchedStep - currentStep) <= 1 &&
    (lastAcceptedStep === null || value.matchedStep > lastAcceptedStep);
}
