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

function dataSnapshot(value, keys) {
  if (!plainRecord(value)) return null;
  try {
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const snapshot = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch { return null; }
}

function exactKeys(value, keys) {
  return dataSnapshot(value, keys) !== null;
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

function snapshotIdentityResult(result, environment) {
  const outer = dataSnapshot(result, ['ok', 'identity']);
  if (!outer || outer.ok !== true) return null;
  const identity = dataSnapshot(outer.identity, ['issuer', 'subject', 'sessionId', 'expiresAt']);
  if (!identity) return null;
  const expires = timestampNs(identity.expiresAt);
  if (identity.issuer !== ISSUERS[environment] || !validUuid(identity.subject) || !validUuid(identity.sessionId) ||
      expires === null || !identity.issuer.includes('neonauth') ||
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
  const context = dataSnapshot(value, CONTEXT_KEYS);
  if (!context || typeof context.accountId !== 'string' || !validUuid(context.accountId) ||
      !['owner', 'admin'].includes(context.role) || context.accountStatus !== 'active' ||
      !validEpoch(context.securityEpoch) || typeof context.anyLiveFactor !== 'boolean' ||
      typeof context.rateLimited !== 'boolean') return null;
  let factor = null;
  if (context.factor !== null) {
    factor = dataSnapshot(context.factor, FACTOR_KEYS);
    if (!factor || !context.anyLiveFactor || !validUuid(factor.factorId) ||
        !validEpoch(factor.securityEpoch) || factor.securityEpoch !== context.securityEpoch ||
        !['pending', 'verified'].includes(factor.state) ||
        (factor.lastAcceptedStep !== null && !validEpoch(factor.lastAcceptedStep)) ||
        !validUuid(factor.beginOperationId) || !validFingerprint(factor.requestFingerprint) ||
        typeof factor.sessionAttested !== 'boolean') return null;
    factor = Object.freeze(factor);
  }
  return Object.freeze({ accountId: context.accountId, role: context.role, accountStatus: context.accountStatus,
    securityEpoch: context.securityEpoch, anyLiveFactor: context.anyLiveFactor, rateLimited: context.rateLimited, factor });
}

function snapshotEnvelope(value, keyId) {
  const envelope = dataSnapshot(value, ['version', 'keyId', 'nonce', 'ciphertext', 'tag']);
  if (!envelope || envelope.version !== 1 || typeof envelope.keyId !== 'string' ||
      envelope.keyId !== keyId || !validKeyId(envelope.keyId) ||
      typeof envelope.nonce !== 'string' || envelope.nonce.length !== 16 || !matchesEntire(/^[A-Za-z0-9_-]{16}$/, envelope.nonce) ||
      typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 43 || envelope.ciphertext.length > 138 ||
      !matchesEntire(/^[A-Za-z0-9_-]{43,138}$/, envelope.ciphertext) ||
      typeof envelope.tag !== 'string' || envelope.tag.length !== 22 || !matchesEntire(/^[A-Za-z0-9_-]{22}$/, envelope.tag)) return null;
  const nonce = Buffer.from(envelope.nonce, 'base64url');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
  const tag = Buffer.from(envelope.tag, 'base64url');
  if (nonce.length !== 12 || nonce.toString('base64url') !== envelope.nonce ||
      ciphertext.length < 32 || ciphertext.length > 103 || ciphertext.toString('base64url') !== envelope.ciphertext ||
      tag.length !== 16 || tag.toString('base64url') !== envelope.tag) return null;
  return Object.freeze(envelope);
}

function snapshotReceipt(value, identity, operationId, kind, context) {
  const receipt = dataSnapshot(value, RECEIPT_KEYS);
  if (!receipt || receipt.operationId !== operationId || receipt.kind !== kind ||
      receipt.accountId !== context.accountId || receipt.issuer !== identity.issuer || receipt.subject !== identity.subject ||
      receipt.sessionId !== identity.sessionId || !['not_found', 'pending', 'rejected', 'verified', 'unknown'].includes(receipt.status)) return null;
  if (receipt.status === 'not_found') {
    return receipt.factorId === null && receipt.securityEpoch === null && receipt.requestFingerprint === null
      ? Object.freeze(receipt) : null;
  }
  return validUuid(receipt.factorId) && validEpoch(receipt.securityEpoch) && validFingerprint(receipt.requestFingerprint)
    ? Object.freeze(receipt) : null;
}

function snapshotBoundAck(value, statuses, operationId, kind, accountId, factorId, securityEpoch, requestFingerprintValue) {
  const ack = dataSnapshot(value, ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch', 'requestFingerprint']);
  if (!ack || !statuses.includes(ack.status) || ack.operationId !== operationId || ack.kind !== kind ||
      ack.accountId !== accountId || ack.factorId !== factorId || ack.securityEpoch !== securityEpoch ||
      ack.requestFingerprint !== requestFingerprintValue) return null;
  return Object.freeze(ack);
}

function snapshotKeyRecord(value, expectedKeyId = null) {
  const record = dataSnapshot(value, ['keyId', 'key']);
  if (!record || typeof record.keyId !== 'string' || !validKeyId(record.keyId) ||
      (expectedKeyId !== null && record.keyId !== expectedKeyId) ||
      !(Buffer.isBuffer(record.key) || record.key instanceof Uint8Array) || record.key.byteLength !== 32) return null;
  return Object.freeze({ keyId: record.keyId, key: Buffer.from(record.key) });
}

function snapshotPendingFactor(value, expected) {
  const pending = dataSnapshot(value, ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope',
    'lastAcceptedStep', 'beginOperationId', 'requestFingerprint']);
  if (!pending || pending.accountId !== expected.accountId || pending.factorId !== expected.factorId ||
      pending.securityEpoch !== expected.securityEpoch || pending.state !== 'pending' ||
      pending.beginOperationId !== expected.beginOperationId || pending.requestFingerprint !== expected.requestFingerprint ||
      (pending.lastAcceptedStep !== null && !validEpoch(pending.lastAcceptedStep)) || !validKeyId(pending.keyId)) return null;
  const envelope = snapshotEnvelope(pending.envelope, pending.keyId);
  return envelope ? Object.freeze({ ...pending, envelope }) : null;
}

function snapshotTotpCandidate(value) {
  const candidate = dataSnapshot(value, ['valid', 'matchedStep']);
  return candidate ? Object.freeze(candidate) : null;
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
    const identity = snapshotIdentityResult(resultValue, environment);
    if (!identity) return null;
    const after = currentNs(clock);
    if (after === null) return null;
    return timestampNs(identity.expiresAt) > after && (!expectedIdentity || sameIdentity(identity, expectedIdentity))
      ? identity : null;
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
    if (!validFingerprint(value)) return null;
    const current = await readStableContext(requestContext, identity, binding);
    return current ? { value, current } : null;
  }

  async function readReceipt(requestContext, identity, context, operationId, kind, requestFingerprintValue = null) {
    let value;
    try {
      value = await repository.readEnrollmentReceipt(identity, { operationId, kind,
        expectedAccountId: context.accountId, expectedFactorId: context.factor?.factorId ?? null,
        expectedSecurityEpoch: context.factor?.securityEpoch ?? null });
    } catch { return { status: 'unknown' }; }
    const receipt = snapshotReceipt(value, identity, operationId, kind, context);
    if (!receipt) return { status: 'unknown' };
    const fresh = await readStableContext(requestContext, identity, { accountId: context.accountId });
    if (!fresh) return { status: 'unknown' };
    if (receipt.status === 'not_found') return { status: 'not_found', current: fresh };
    if (receipt.requestFingerprint !== requestFingerprintValue && requestFingerprintValue !== null) return { status: 'rejected' };
    return { status: receipt.status, receipt, current: fresh };
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

    let rawKeyRecord;
    try { rawKeyRecord = await keyProvider.getKey({ environment, purpose: 'factor-enrollment' }); } catch { return UNAVAILABLE; }
    const keyRecord = snapshotKeyRecord(rawKeyRecord);
    if (!keyRecord) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!stable || !sameBeginContext(stable.context, context)) return UNAVAILABLE;

    const encryptionContext = Object.freeze({ environment, accountId: context.accountId, factorId,
      securityEpoch: targetEpoch });
    let envelope;
    try { envelope = await encryptor.encrypt(privateFields({ keyId: keyRecord.keyId, context: encryptionContext },
      { secret, key: keyRecord.key })); }
    catch { return UNAVAILABLE; }
    envelope = snapshotEnvelope(envelope, keyRecord.keyId);
    if (!envelope) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch });
    if (!stable || !sameBeginContext(stable.context, context)) return UNAVAILABLE;

    let beginAck;
    attemptState.mutationIssued = true;
    try {
      const rawBeginAck = await repository.beginEnrollment(stable.identity, Object.freeze({
        operationId: request.operationId, expectedAccountId: context.accountId,
        expectedCurrentEpoch: context.securityEpoch, targetEpoch, candidateFactorId: factorId,
        requestFingerprint: fingerprintResult.value, envelopeKeyId: keyRecord.keyId, encryptedSecret: envelope,
      }));
      beginAck = snapshotBoundAck(rawBeginAck, ['committed', 'rejected'], request.operationId, 'begin',
        context.accountId, factorId, targetEpoch, fingerprintResult.value);
    } catch { beginAck = null; }
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: beginAck?.status === 'committed' ? targetEpoch : context.securityEpoch });
    if (beginAck?.status === 'rejected') {
      return stable ? result('rejected', request.operationId) : result('unknown', request.operationId);
    }
    if (!beginAck || beginAck.status !== 'committed' || !stable ||
        stable.context.factor?.factorId !== factorId || stable.context.factor.state !== 'pending' ||
        stable.context.factor.securityEpoch !== targetEpoch ||
        stable.context.factor.beginOperationId !== request.operationId ||
        stable.context.factor.requestFingerprint !== fingerprintResult.value) {
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
    let rawPending;
    try { rawPending = await repository.readPendingFactor(stable.identity, Object.freeze({ expectedAccountId: context.accountId,
      expectedFactorId: pendingFactor.factorId, expectedSecurityEpoch: context.securityEpoch,
      expectedBeginOperationId: pendingFactor.beginOperationId })); }
    catch { return UNAVAILABLE; }
    const pending = snapshotPendingFactor(rawPending, { accountId: context.accountId,
      factorId: pendingFactor.factorId, securityEpoch: context.securityEpoch,
      beginOperationId: pendingFactor.beginOperationId, requestFingerprint: pendingFactor.requestFingerprint });
    if (!pending) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch, factorId: pendingFactor.factorId,
        factorState: 'pending' });
    if (!stable) return UNAVAILABLE;

    let rawKeyRecord;
    try { rawKeyRecord = await keyProvider.getKey(Object.freeze({ environment, keyId: pending.keyId,
      purpose: 'factor-enrollment' })); }
    catch { return UNAVAILABLE; }
    const keyRecord = snapshotKeyRecord(rawKeyRecord, pending.keyId);
    if (!keyRecord) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    if (!stable) return UNAVAILABLE;

    let secret;
    try { secret = await decryptor.decrypt(privateFields({ envelope: pending.envelope, keyId: pending.keyId,
      context: Object.freeze({ environment, accountId: context.accountId, factorId: pendingFactor.factorId,
        securityEpoch: pendingFactor.securityEpoch }) }, { key: keyRecord.key })); }
    catch { return UNAVAILABLE; }
    if (!validSecret(secret)) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    if (!stable) return UNAVAILABLE;

    const verifyTime = currentNs(clock);
    if (verifyTime === null || timestampNs(stable.identity.expiresAt) <= verifyTime) return UNAVAILABLE;
    let candidate;
    try { candidate = await totpVerifier.verifyCandidate(privateFields({
      epochSeconds: Number(verifyTime / 1_000_000_000n), lastAcceptedStep: pending.lastAcceptedStep,
    }, { secret, token: request.code })); }
    catch { return UNAVAILABLE; }
    candidate = snapshotTotpCandidate(candidate);
    if (!candidate) return UNAVAILABLE;
    stable = await readStableContext(requestContext, stable.identity, { ...binding, factorState: 'pending' });
    const afterVerify = currentNs(clock);
    if (!stable || afterVerify === null || timestampNs(stable.identity.expiresAt) <= afterVerify) return UNAVAILABLE;
    if (!validTotpCandidate(candidate, afterVerify, pending.lastAcceptedStep)) {
      return recordFailure(request, requestContext, stable.identity, context, pendingFactor,
        fingerprintResult.value, 'invalid', attemptState);
    }

    let verifyAck;
    attemptState.mutationIssued = true;
    try {
      const rawVerifyAck = await repository.verifyEnrollment(stable.identity, Object.freeze({
      operationId: request.operationId, beginOperationId: pending.beginOperationId,
      expectedAccountId: context.accountId, expectedFactorId: pendingFactor.factorId,
      expectedSecurityEpoch: context.securityEpoch, requestFingerprint: fingerprintResult.value,
      matchedStep: candidate.matchedStep,
      }));
      verifyAck = snapshotBoundAck(rawVerifyAck, ['committed', 'rejected'], request.operationId, 'verify',
        context.accountId, pendingFactor.factorId, context.securityEpoch, fingerprintResult.value);
    } catch { verifyAck = null; }
    if (verifyAck?.status === 'committed') {
      const current = await readStableContext(requestContext, stable.identity,
        { ...binding, factorState: 'verified' });
      return current?.context.factor?.sessionAttested ? result('verified', request.operationId) : result('unknown', request.operationId);
    }
    if (verifyAck?.status === 'rejected') {
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
    try {
      const rawAck = await repository.recordEnrollmentAttempt(identity, Object.freeze({ operationId: request.operationId,
      beginOperationId: factor.beginOperationId, expectedAccountId: context.accountId,
      expectedFactorId: factor.factorId, expectedSecurityEpoch: context.securityEpoch,
      requestFingerprint: requestFingerprintValue, reason }));
      ack = snapshotBoundAck(rawAck, ['recorded', 'rejected'], request.operationId, 'verify',
        context.accountId, factor.factorId, context.securityEpoch, requestFingerprintValue);
    } catch { ack = null; }
    const current = await readStableContext(requestContext, identity,
      { accountId: context.accountId, securityEpoch: context.securityEpoch, factorId: factor.factorId, factorState: 'pending' });
    if (!current) return result('unknown', request.operationId);
    if (ack) return result('rejected', request.operationId);
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
