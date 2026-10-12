const ENVIRONMENTS = new Set(['local', 'preview']);
const ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SECRET = /^[A-Z2-7]{32,103}$/;
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL_16 = /^[A-Za-z0-9_-]{16}$/;
const BASE64URL_22 = /^[A-Za-z0-9_-]{22}$/;
const BASE64URL_CIPHERTEXT = /^[A-Za-z0-9_-]{43,138}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const CONTEXT_KEYS = ['accountId', 'role', 'accountStatus', 'securityEpoch', 'anyLiveFactor', 'rateLimited', 'factor'];
const FACTOR_KEYS = ['factorId', 'securityEpoch', 'state', 'lastAcceptedStep', 'beginOperationId',
  'requestFingerprint', 'sessionAttested'];
const BEGIN_RECEIPT_KEYS = ['status', 'operationId', 'kind', 'accountId', 'issuer', 'subject', 'sessionId',
  'factorId', 'securityEpoch', 'requestFingerprint'];
const MATERIAL_RECEIPT_KEYS = ['status', 'operationId', 'kind', 'accountId', 'issuer', 'subject', 'sessionId',
  'factorId', 'securityEpoch', 'beginOperationId', 'requestFingerprint'];
const ACK_KEYS = ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch',
  'requestFingerprint', 'beginOperationId', 'newlyCommitted'];
const PENDING_KEYS = ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope',
  'lastAcceptedStep', 'beginOperationId', 'requestFingerprint'];
const ENVELOPE_KEYS = ['version', 'keyId', 'nonce', 'ciphertext', 'tag'];
const UNAVAILABLE = Object.freeze({ ok: false, outcome: 'unavailable', reason: 'factor_resume_unavailable' });
const UNKNOWN = Object.freeze({ ok: false, outcome: 'unknown', reason: 'factor_resume_outcome_unknown' });
const REJECTED = Object.freeze({ ok: false, outcome: 'rejected', reason: 'factor_resume_rejected' });
const INVALID = Object.freeze({ ok: false, outcome: 'rejected', reason: 'invalid_request' });

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
}

function snapshot(value, keys) {
  if (!plainRecord(value)) return null;
  try {
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const result = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch { return null; }
}

function validUuid(value) {
  if (typeof value !== 'string' || value.length !== 36) return false;
  const match = UUID.exec(value);
  return match !== null && match[0] === value;
}
function validKeyId(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return false;
  const match = KEY_ID.exec(value);
  return match !== null && match[0] === value;
}
function validFingerprint(value) {
  if (typeof value !== 'string' || value.length !== 43) return false;
  const match = BASE64URL_43.exec(value);
  if (!match || match[0] !== value) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value;
}
function validEpoch(value) { return Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER; }
function matchesEntire(regex, value) {
  if (typeof value !== 'string') return false;
  const match = regex.exec(value);
  return match !== null && match[0] === value;
}

function timestampNs(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 40) return null;
  const m = ISO.exec(value);
  if (!m || m[0] !== value) return null;
  const [, y, mo, d, h, mi, s, fraction = '', zone, , oh, om] = m;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!year || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(oh), offsetMinute = Number(om);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const base = Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''));
  return Number.isFinite(base)
    ? BigInt(base) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9))
    : null;
}

function currentNs(clock) {
  try {
    const value = clock();
    if (!(value instanceof Date)) return null;
    const millis = Date.prototype.getTime.call(value);
    return Number.isFinite(millis) ? BigInt(millis) * 1_000_000n : null;
  } catch { return null; }
}

function snapshotIdentityResult(value, environment) {
  const outer = snapshot(value, ['ok', 'identity']);
  if (!outer || outer.ok !== true) return null;
  const identity = snapshot(outer.identity, ['issuer', 'subject', 'sessionId', 'expiresAt']);
  if (!identity || identity.issuer !== ISSUERS[environment] || !validUuid(identity.subject) ||
      !validUuid(identity.sessionId) || timestampNs(identity.expiresAt) === null) return null;
  return Object.freeze(identity);
}

function sameIdentity(a, b) {
  return a.issuer === b.issuer && a.subject === b.subject && a.sessionId === b.sessionId;
}

function validContext(value) {
  const context = snapshot(value, CONTEXT_KEYS);
  if (!context || !validUuid(context.accountId) || !['owner', 'admin'].includes(context.role) ||
      context.accountStatus !== 'active' || !validEpoch(context.securityEpoch) ||
      typeof context.anyLiveFactor !== 'boolean' || typeof context.rateLimited !== 'boolean') return null;
  let factor = null;
  if (context.factor !== null) {
    factor = snapshot(context.factor, FACTOR_KEYS);
    if (!factor || !context.anyLiveFactor || !validUuid(factor.factorId) || !validEpoch(factor.securityEpoch) ||
        factor.securityEpoch > context.securityEpoch || !['pending', 'verified'].includes(factor.state) ||
        (factor.lastAcceptedStep !== null && !validEpoch(factor.lastAcceptedStep)) ||
        !validUuid(factor.beginOperationId) || !validFingerprint(factor.requestFingerprint) ||
        typeof factor.sessionAttested !== 'boolean') return null;
    factor = Object.freeze(factor);
  } else if (context.anyLiveFactor) return null;
  return Object.freeze({ ...context, factor });
}

function dataResult(outcome, operationId) {
  const base = outcome === 'rejected' ? REJECTED : outcome === 'unknown' ? UNKNOWN : UNAVAILABLE;
  return Object.freeze({ ...base, ...(operationId ? { operationId } : {}) });
}

function safeStatus(status, operationId) {
  if (status === 'released') return Object.freeze({ ok: true, operationId, outcome: 'released' });
  if (status === 'rejected') return Object.freeze({ ...REJECTED, operationId });
  if (status === 'unknown') return Object.freeze({ ...UNKNOWN, operationId });
  return Object.freeze({ ...UNAVAILABLE, operationId });
}

function validateRequest(value) {
  const request = snapshot(value, ['operationId', 'beginOperationId']);
  if (!request || !validUuid(request.operationId) || !validUuid(request.beginOperationId)) return null;
  const operationId = request.operationId.toLowerCase();
  const beginOperationId = request.beginOperationId.toLowerCase();
  if (operationId === beginOperationId) return null;
  return Object.freeze({ operationId, beginOperationId });
}

function snapshotBeginReceipt(value, identity, accountId, operationId) {
  const receipt = snapshot(value, BEGIN_RECEIPT_KEYS);
  if (!receipt || receipt.operationId !== operationId || receipt.kind !== 'begin' ||
      receipt.accountId !== accountId || receipt.issuer !== identity.issuer || receipt.subject !== identity.subject ||
      receipt.sessionId !== identity.sessionId || !['not_found', 'pending'].includes(receipt.status)) return null;
  if (receipt.status === 'not_found') {
    return receipt.factorId === null && receipt.securityEpoch === null && receipt.requestFingerprint === null
      ? Object.freeze(receipt) : null;
  }
  return validUuid(receipt.factorId) && validEpoch(receipt.securityEpoch) && validFingerprint(receipt.requestFingerprint)
    ? Object.freeze(receipt) : null;
}

function snapshotMaterialReceipt(value, identity, expected) {
  const receipt = snapshot(value, MATERIAL_RECEIPT_KEYS);
  if (!receipt || receipt.operationId !== expected.operationId || receipt.kind !== 'resume' ||
      receipt.accountId !== expected.accountId || receipt.issuer !== identity.issuer ||
      receipt.subject !== identity.subject || receipt.sessionId !== identity.sessionId ||
      receipt.beginOperationId !== expected.beginOperationId || !['not_found', 'released', 'rejected'].includes(receipt.status)) return null;
  if (receipt.status === 'not_found') {
    return receipt.factorId === null && receipt.securityEpoch === null && receipt.requestFingerprint === null
      ? Object.freeze(receipt) : null;
  }
  return receipt.factorId === expected.factorId && receipt.securityEpoch === expected.securityEpoch &&
    (expected.requestFingerprint === undefined || receipt.requestFingerprint === expected.requestFingerprint) &&
    validFingerprint(receipt.requestFingerprint) ? Object.freeze(receipt) : null;
}

function snapshotEnvelope(value, keyId) {
  const envelope = snapshot(value, ENVELOPE_KEYS);
  if (!envelope || envelope.version !== 1 || envelope.keyId !== keyId || !validKeyId(envelope.keyId) ||
      typeof envelope.nonce !== 'string' || envelope.nonce.length !== 16 ||
      !matchesEntire(BASE64URL_16, envelope.nonce) ||
      typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 43 || envelope.ciphertext.length > 138 ||
      !matchesEntire(BASE64URL_CIPHERTEXT, envelope.ciphertext) ||
      typeof envelope.tag !== 'string' || envelope.tag.length !== 22 || !matchesEntire(BASE64URL_22, envelope.tag)) return null;
  const nonce = Buffer.from(envelope.nonce, 'base64url');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
  const tag = Buffer.from(envelope.tag, 'base64url');
  if (nonce.length !== 12 || nonce.toString('base64url') !== envelope.nonce || ciphertext.length < 32 ||
      ciphertext.length > 103 || ciphertext.toString('base64url') !== envelope.ciphertext ||
      tag.length !== 16 || tag.toString('base64url') !== envelope.tag) return null;
  return Object.freeze(envelope);
}

function snapshotPending(value, expected) {
  const pending = snapshot(value, PENDING_KEYS);
  if (!pending || pending.accountId !== expected.accountId || pending.factorId !== expected.factorId ||
      pending.securityEpoch !== expected.securityEpoch || pending.state !== 'pending' ||
      !validKeyId(pending.keyId) || (expected.keyId !== undefined && pending.keyId !== expected.keyId) ||
      pending.beginOperationId !== expected.beginOperationId ||
      pending.requestFingerprint !== expected.beginFingerprint ||
      (pending.lastAcceptedStep !== null && !validEpoch(pending.lastAcceptedStep))) return null;
  const envelope = snapshotEnvelope(pending.envelope, pending.keyId);
  return envelope ? Object.freeze({ ...pending, envelope }) : null;
}

function snapshotAck(value, expected) {
  const ack = snapshot(value, ACK_KEYS);
  if (!ack || !['released', 'rejected', 'unknown'].includes(ack.status) ||
      ack.operationId !== expected.operationId || ack.kind !== 'resume' ||
      ack.accountId !== expected.accountId || ack.factorId !== expected.factorId ||
      ack.securityEpoch !== expected.securityEpoch || ack.requestFingerprint !== expected.requestFingerprint ||
      ack.beginOperationId !== expected.beginOperationId || typeof ack.newlyCommitted !== 'boolean' ||
      (ack.status !== 'released' && ack.newlyCommitted)) return null;
  return Object.freeze(ack);
}

function snapshotKey(value, expectedKeyId) {
  const record = snapshot(value, ['keyId', 'key']);
  if (!record || record.keyId !== expectedKeyId || !validKeyId(record.keyId) ||
      !(Buffer.isBuffer(record.key) || record.key instanceof Uint8Array) || record.key.byteLength !== 32) return null;
  return Object.freeze({ keyId: record.keyId, key: Buffer.from(record.key) });
}

function sameEnvelope(a, b) {
  return ENVELOPE_KEYS.every(key => a.envelope[key] === b.envelope[key]);
}

function privateKeyInput(fields, key) {
  const value = { ...fields };
  Object.defineProperty(value, 'key', { value: key, enumerable: false });
  return Object.freeze(value);
}

/**
 * Offline orchestration only. The injected repository must map each method to
 * the fixed private 0014/0015 functions; this module does not prove SQL behavior
 * or grant access. Only a newly committed release followed by repeated fresh
 * binding checks yields the non-enumerable setup value.
 */
export function createFactorEnrollmentResumeProtocol(dependencies) {
  const dependencyKeys = ['environment', 'resolveSession', 'repository', 'keyProvider', 'decryptor', 'fingerprint', 'clock'];
  const repositoryMethods = ['readEnrollmentContext', 'readEnrollmentReceipt', 'readMaterialReceipt',
    'readPendingFactor', 'releaseMaterial'];
  const config = snapshot(dependencies, dependencyKeys);
  const repositoryConfig = config && snapshot(config.repository, repositoryMethods);
  const keyConfig = config && snapshot(config.keyProvider, ['getKey']);
  const decryptorConfig = config && snapshot(config.decryptor, ['decrypt']);
  const fingerprintConfig = config && snapshot(config.fingerprint, ['create']);
  if (!config || !ENVIRONMENTS.has(config.environment) ||
      typeof config.resolveSession !== 'function' || typeof config.clock !== 'function' ||
      !repositoryConfig || repositoryMethods.some(key => typeof repositoryConfig[key] !== 'function') ||
      !keyConfig || typeof keyConfig.getKey !== 'function' ||
      !decryptorConfig || typeof decryptorConfig.decrypt !== 'function' ||
      !fingerprintConfig || typeof fingerprintConfig.create !== 'function') {
    throw new TypeError('Invalid factor enrollment resume configuration.');
  }
  const environment = config.environment;
  const resolveSession = config.resolveSession;
  const clock = config.clock;
  const repository = Object.freeze(repositoryConfig);
  const getKey = keyConfig.getKey;
  const decrypt = decryptorConfig.decrypt;
  const createFingerprint = fingerprintConfig.create;

  async function freshIdentity(requestContext, expectedIdentity = null) {
    const before = currentNs(clock);
    if (before === null) return null;
    let raw;
    try { raw = await resolveSession(requestContext); } catch { return null; }
    const identity = snapshotIdentityResult(raw, environment);
    const after = currentNs(clock);
    if (!identity || after === null || timestampNs(identity.expiresAt) <= after ||
        (expectedIdentity && !sameIdentity(identity, expectedIdentity))) return null;
    return identity;
  }

  async function stableContext(requestContext, priorIdentity = null, accountId = null) {
    const identity = await freshIdentity(requestContext, priorIdentity);
    const before = currentNs(clock);
    if (!identity || before === null || timestampNs(identity.expiresAt) <= before) return null;
    let raw;
    try { raw = await repository.readEnrollmentContext(identity); } catch { return null; }
    const context = validContext(raw);
    const afterIdentity = await freshIdentity(requestContext, identity);
    const after = currentNs(clock);
    if (!context || !afterIdentity || after === null || timestampNs(afterIdentity.expiresAt) <= after ||
        (accountId && context.accountId !== accountId)) return null;
    return Object.freeze({ identity: afterIdentity, context });
  }

  async function readBeginReceipt(requestContext, identity, accountId, beginOperationId) {
    let raw;
    try {
      raw = await repository.readEnrollmentReceipt(identity, Object.freeze({ operationId: beginOperationId,
        kind: 'begin', expectedAccountId: accountId, expectedFactorId: null, expectedSecurityEpoch: null }));
    } catch { return null; }
    const receipt = snapshotBeginReceipt(raw, identity, accountId, beginOperationId);
    const current = await stableContext(requestContext, identity, accountId);
    if (!current || !sameIdentity(current.identity, identity)) return null;
    return receipt ? Object.freeze({ receipt, current }) : null;
  }

  async function readMaterialReceipt(requestContext, identity, expected) {
    let raw;
    try {
      raw = await repository.readMaterialReceipt(identity, Object.freeze({ operationId: expected.operationId,
        expectedAccountId: expected.accountId, expectedFactorId: expected.factorId,
        expectedSecurityEpoch: expected.securityEpoch, expectedBeginOperationId: expected.beginOperationId }));
    } catch { return null; }
    const receipt = snapshotMaterialReceipt(raw, identity, expected);
    const current = await stableContext(requestContext, identity, expected.accountId);
    if (!current || !sameIdentity(current.identity, identity)) return null;
    return receipt ? Object.freeze({ receipt, current }) : null;
  }

  async function readPendingStable(requestContext, identity, expected) {
    let current = await stableContext(requestContext, identity, expected.accountId);
    if (!current || !isEligiblePending(current.context, expected)) return null;
    let raw;
    try {
      raw = await repository.readPendingFactor(current.identity, Object.freeze({ expectedAccountId: expected.accountId,
        expectedFactorId: expected.factorId, expectedSecurityEpoch: expected.securityEpoch,
        expectedBeginOperationId: expected.beginOperationId }));
    } catch { return null; }
    const pending = snapshotPending(raw, expected);
    current = await stableContext(requestContext, current.identity, expected.accountId);
    if (!pending || !current || !isEligiblePending(current.context, expected)) return null;
    return Object.freeze({ ...current, pending });
  }

  function isEligiblePending(context, expected) {
    const factor = context.factor;
    return context.accountStatus === 'active' && ['owner', 'admin'].includes(context.role) &&
      context.role === expected.role &&
      context.securityEpoch === expected.securityEpoch && factor !== null && factor.state === 'pending' &&
      factor.factorId === expected.factorId && factor.securityEpoch === expected.securityEpoch &&
      factor.beginOperationId === expected.beginOperationId && factor.requestFingerprint === expected.beginFingerprint;
  }

  async function resume(requestContext, body) {
    const request = validateRequest(body);
    if (!request) return INVALID;
    const initial = await stableContext(requestContext);
    if (!initial) return dataResult('unavailable', request.operationId);
    const { identity: initialIdentity, context: initialContext } = initial;
    const beginResult = await readBeginReceipt(requestContext, initialIdentity, initialContext.accountId, request.beginOperationId);
    if (!beginResult || beginResult.receipt.status === 'not_found' || beginResult.receipt.status === 'unknown') {
      return dataResult('unavailable', request.operationId);
    }
    const begin = beginResult.receipt;
    const expected = Object.freeze({ operationId: request.operationId, beginOperationId: request.beginOperationId,
      accountId: initialContext.accountId, factorId: begin.factorId, securityEpoch: begin.securityEpoch,
      beginFingerprint: begin.requestFingerprint, role: initialContext.role });

    const prior = await readMaterialReceipt(requestContext, beginResult.current.identity, expected);
    if (!prior) return dataResult('unknown', request.operationId);
    if (prior.receipt.status !== 'not_found') return safeStatus(prior.receipt.status, request.operationId);
    if (begin.status !== 'pending' || !isEligiblePending(prior.current.context, expected)) {
      return dataResult('unavailable', request.operationId);
    }

    const firstPending = await readPendingStable(requestContext, prior.current.identity, expected);
    if (!firstPending || firstPending.pending.keyId !== firstPending.pending.envelope.keyId) {
      return dataResult('unavailable', request.operationId);
    }
    const pending = firstPending.pending;
    const fingerprintPayload = Object.freeze({ kind: 'resume', operationId: request.operationId,
      beginOperationId: request.beginOperationId, environment, issuer: firstPending.identity.issuer,
      subject: firstPending.identity.subject, sessionId: firstPending.identity.sessionId,
      accountId: expected.accountId, factorId: expected.factorId, securityEpoch: expected.securityEpoch,
      keyId: pending.keyId });
    let requestFingerprint;
    try { requestFingerprint = await createFingerprint(fingerprintPayload); } catch { return dataResult('unavailable', request.operationId); }
    if (!validFingerprint(requestFingerprint)) return dataResult('unavailable', request.operationId);

    const beforeWrite = await readPendingStable(requestContext, firstPending.identity, expected);
    if (!beforeWrite || !sameEnvelope(pending, beforeWrite.pending) || beforeWrite.pending.keyId !== pending.keyId) {
      return dataResult('unavailable', request.operationId);
    }
    const writerExpected = Object.freeze({ ...expected, requestFingerprint, keyId: pending.keyId });
    let rawAck;
    try {
      rawAck = await repository.releaseMaterial(beforeWrite.identity, Object.freeze({
        operationId: request.operationId, beginOperationId: request.beginOperationId,
        expectedAccountId: expected.accountId, expectedFactorId: expected.factorId,
        expectedSecurityEpoch: expected.securityEpoch, expectedEnvelopeKeyId: pending.keyId,
        requestFingerprint,
      }));
    } catch { rawAck = null; }
    const ack = snapshotAck(rawAck, writerExpected);
    if (ack?.status === 'rejected' || (ack?.status === 'released' && !ack.newlyCommitted)) {
      const current = await stableContext(requestContext, beforeWrite.identity, expected.accountId);
      if (!current) return dataResult('unknown', request.operationId);
      return safeStatus(ack.status, request.operationId);
    }
    if (!ack || ack.status !== 'released' || ack.newlyCommitted !== true) {
      const reconciled = await readMaterialReceipt(requestContext, beforeWrite.identity, writerExpected);
      if (!reconciled) return dataResult('unknown', request.operationId);
      if (reconciled.receipt.status === 'not_found') return dataResult('unknown', request.operationId);
      return safeStatus(reconciled.receipt.status, request.operationId);
    }

    let keyRecord = null;
    try {
      const postWrite = await readPendingStable(requestContext, beforeWrite.identity, expected);
      if (!postWrite || !sameEnvelope(pending, postWrite.pending) || postWrite.pending.keyId !== pending.keyId) {
        return dataResult('unknown', request.operationId);
      }

      let rawKey;
      try { rawKey = await getKey(Object.freeze({ environment, keyId: pending.keyId, purpose: 'factor-enrollment' })); }
      catch { return dataResult('unknown', request.operationId); }
      keyRecord = snapshotKey(rawKey, pending.keyId);
      if (!keyRecord) return dataResult('unknown', request.operationId);

      const afterKey = await readPendingStable(requestContext, postWrite.identity, expected);
      if (!afterKey || !sameEnvelope(pending, afterKey.pending) || afterKey.pending.keyId !== pending.keyId) {
        return dataResult('unknown', request.operationId);
      }

      let secret;
      try {
        secret = await decrypt(privateKeyInput({ envelope: pending.envelope, keyId: pending.keyId,
          context: Object.freeze({ environment, accountId: expected.accountId,
            factorId: expected.factorId, securityEpoch: expected.securityEpoch }) }, keyRecord.key));
      } catch { return dataResult('unknown', request.operationId); }
      if (typeof secret !== 'string' || secret.length < 32 || secret.length > 103 ||
          !SECRET.test(secret) || SECRET.exec(secret)?.[0] !== secret) return dataResult('unknown', request.operationId);

      const afterDecrypt = await readPendingStable(requestContext, afterKey.identity, expected);
      if (!afterDecrypt || !sameEnvelope(pending, afterDecrypt.pending) || afterDecrypt.pending.keyId !== pending.keyId) {
        return dataResult('unknown', request.operationId);
      }
      const finalNow = currentNs(clock);
      if (finalNow === null || timestampNs(afterDecrypt.identity.expiresAt) <= finalNow) {
        return dataResult('unknown', request.operationId);
      }
      const delivered = { ok: true, operationId: request.operationId, outcome: 'released' };
      Object.defineProperty(delivered, 'pendingSetupSecret', { value: secret, enumerable: false });
      return Object.freeze(delivered);
    } finally {
      // Best effort for this local copy only; JavaScript/runtime copies cannot be guaranteed erased.
      if (keyRecord?.key) keyRecord.key.fill(0);
    }
  }

  return Object.freeze({ resume });
}
