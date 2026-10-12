const ISSUERS = Object.freeze({
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FINGERPRINT = /^[A-Za-z0-9_-]{43}$/;
const KINDS = new Set(['begin', 'verify']);
const ATTEMPT_REASONS = new Set(['invalid', 'replay', 'expired', 'unavailable', 'throttled']);
const safeError = () => new Error('Factor enrollment repository operation failed.');

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

function validUuid(value) {
  return typeof value === 'string' && value.length === 36 && UUID.test(value);
}

function validKeyId(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  const match = KEY_ID.exec(value);
  return match !== null && match[0] === value;
}

function sameUuid(left, right) {
  return validUuid(left) && validUuid(right) && left.toLowerCase() === right.toLowerCase();
}

function validEpoch(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
}

function canonicalBytes(value, pattern, expectedLength) {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  try {
    const bytes = Buffer.from(value, 'base64url');
    return bytes.length === expectedLength && bytes.toString('base64url') === value ? bytes : null;
  } catch { return null; }
}

function canonicalByteRange(value, pattern, minimum, maximum) {
  if (typeof value !== 'string' || !pattern.test(value)) return null;
  try {
    const bytes = Buffer.from(value, 'base64url');
    return bytes.length >= minimum && bytes.length <= maximum && bytes.toString('base64url') === value ? bytes : null;
  } catch { return null; }
}

function validFingerprint(value) {
  return canonicalBytes(value, FINGERPRINT, 32) !== null;
}

function timestampNs(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, fraction = '', zone, , oh, om] = m;
  if (m[0] !== value) return null;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!year || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(oh), offsetMinute = Number(om);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const base = Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''));
  return Number.isFinite(base) ? BigInt(base) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9)) : null;
}

function validIdentity(identity, environment) {
  const expiresAtNs = timestampNs(identity?.expiresAt);
  if (!exactKeys(identity, ['issuer', 'subject', 'sessionId', 'expiresAt']) ||
      identity.issuer !== ISSUERS[environment] || !validUuid(identity.subject) ||
      !validUuid(identity.sessionId) || expiresAtNs === null) return false;
  return true;
}

function validEnvelope(value, expectedKeyId) {
  if (!exactKeys(value, ['version', 'keyId', 'nonce', 'ciphertext', 'tag']) || value.version !== 1 ||
      !validKeyId(value.keyId) || value.keyId !== expectedKeyId) return false;
  return canonicalBytes(value.nonce, /^[A-Za-z0-9_-]{16}$/, 12) !== null &&
    canonicalByteRange(value.ciphertext, /^[A-Za-z0-9_-]{43,138}$/, 32, 103) !== null &&
    canonicalBytes(value.tag, /^[A-Za-z0-9_-]{22}$/, 16) !== null;
}

function validFactorMetadata(value) {
  const keys = ['factorId', 'securityEpoch', 'state', 'lastAcceptedStep',
    'beginOperationId', 'requestFingerprint', 'sessionAttested'];
  return exactKeys(value, keys) && validUuid(value.factorId) && validEpoch(value.securityEpoch) &&
    ['pending', 'verified'].includes(value.state) &&
    (value.lastAcceptedStep === null || validEpoch(value.lastAcceptedStep)) &&
    validUuid(value.beginOperationId) && validFingerprint(value.requestFingerprint) &&
    typeof value.sessionAttested === 'boolean';
}

function validateContext(value) {
  const keys = ['accountId', 'role', 'accountStatus', 'securityEpoch', 'anyLiveFactor', 'rateLimited', 'factor'];
  if (!exactKeys(value, keys) || !validUuid(value.accountId) || !['owner', 'admin'].includes(value.role) ||
      value.accountStatus !== 'active' || !validEpoch(value.securityEpoch) ||
      typeof value.anyLiveFactor !== 'boolean' || typeof value.rateLimited !== 'boolean' ||
      (value.factor !== null && !validFactorMetadata(value.factor))) return false;
  return value.factor === null || (value.anyLiveFactor && value.factor.securityEpoch === value.securityEpoch);
}

function snapshotRecord(value, keys) {
  try {
    if (!plainRecord(value)) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const copy = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      copy[key] = descriptor.value;
    }
    return copy;
  } catch { return null; }
}

function snapshotJsonValue(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 4096 || depth > 12) throw safeError();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw safeError();
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw safeError();
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes('length') || value.length > 4096) throw safeError();
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw safeError();
      result.push(snapshotJsonValue(descriptor.value, depth + 1, budget));
    }
    return result;
  }
  if (value === null || typeof value !== 'object') throw safeError();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw safeError();
  const keys = Reflect.ownKeys(value);
  if (keys.length > 4096 || keys.some(key => typeof key !== 'string')) throw safeError();
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw safeError();
    Object.defineProperty(result, key, { value: snapshotJsonValue(descriptor.value, depth + 1, budget),
      enumerable: true, configurable: true, writable: true });
  }
  return result;
}

function snapshotJsonRecord(value, keys) {
  try {
    if (!plainRecord(value)) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !keys.every(key => own.includes(key))) return null;
    const record = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
      Object.defineProperty(record, key, { value: snapshotJsonValue(descriptor.value),
        enumerable: true, configurable: true, writable: true });
    }
    return immutableJson(record);
  } catch { return null; }
}

function serializeJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = [];
    for (let index = 0; index < value.length; index += 1) items.push(serializeJsonValue(value[index]));
    return `[${items.join(',')}]`;
  }
  const entries = Object.keys(value).map(key => `${JSON.stringify(key)}:${serializeJsonValue(value[key])}`);
  return `{${entries.join(',')}}`;
}

function operationId(value) {
  if (!validUuid(value)) throw safeError();
  return value;
}

function fingerprintBytes(value) {
  const bytes = canonicalBytes(value, FINGERPRINT, 32);
  if (!bytes) throw safeError();
  return bytes;
}

function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function immutableJson(value) {
  return freezeTree(value);
}

function validateAck(value, { statuses, operationId: expectedOperationId, kind, accountId, factorId, epoch, fingerprint }) {
  const ack = snapshotRecord(value, ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch', 'requestFingerprint']);
  if (!ack || !statuses.has(ack.status) || !validUuid(ack.operationId) ||
      ack.operationId.toLowerCase() !== expectedOperationId.toLowerCase() || ack.kind !== kind ||
      ack.accountId !== accountId || ack.factorId !== factorId || ack.securityEpoch !== epoch ||
      ack.requestFingerprint !== fingerprint) return false;
  return true;
}

function normalizedWriterStatus(value, { statuses, operationId: expectedOperationId, kind, accountId, factorId, epoch, fingerprint }) {
  try {
    const ack = snapshotRecord(value, ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch', 'requestFingerprint']);
    if (ack && validateAck(ack, { statuses, operationId: expectedOperationId, kind,
      accountId, factorId, epoch, fingerprint })) return immutableJson({ ...ack, operationId: expectedOperationId });
  } catch { /* malformed driver values remain unknown */ }
  return Object.freeze({ status: 'unknown' });
}

/**
 * Build the private factor-enrollment repository over a trusted, injected
 * single-query port. `runQuery` receives one fixed SELECT and bound values,
 * and resolves to the parsed JSONB `result` value. This adapter never creates
 * a database client, exposes generic SQL/transactions, retries a writer, or
 * logs query input/output. The six functions remain dormant until separately
 * implemented and explicitly granted.
 */
export function createFactorEnrollmentPostgresRepository(environment, runQuery) {
  if (typeof environment !== 'string' || !Object.hasOwn(ISSUERS, environment) || typeof runQuery !== 'function') {
    throw new TypeError('A pinned local/preview environment and private query port are required.');
  }

  async function run(statement, values) {
    try { return await runQuery(statement, values); }
    catch { throw safeError(); }
  }

  function requireIdentity(identity) {
    try {
      const snapshot = snapshotRecord(identity, ['issuer', 'subject', 'sessionId', 'expiresAt']);
      if (!snapshot || !validIdentity(snapshot, environment)) throw safeError();
      return Object.freeze(snapshot);
    } catch { throw safeError(); }
  }

  async function readEnrollmentContext(identityInput) {
    const identity = requireIdentity(identityInput);
    const statement = 'SELECT groundbnb.read_factor_enrollment_context($1,$2,$3,$4::timestamptz) AS result';
    const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt]);
    try {
      const snapshot = snapshotJsonRecord(result, ['accountId', 'role', 'accountStatus', 'securityEpoch', 'anyLiveFactor', 'rateLimited', 'factor']);
      if (!snapshot || !validateContext(snapshot)) throw safeError();
      return snapshot;
    } catch { throw safeError(); }
  }

  async function readPendingFactor(identityInput, bindingInput) {
    const identity = requireIdentity(identityInput);
    const bindingKeys = ['expectedAccountId', 'expectedFactorId', 'expectedSecurityEpoch', 'expectedBeginOperationId'];
    const binding = snapshotRecord(bindingInput, bindingKeys);
    if (!binding || !validUuid(binding.expectedAccountId) || !validUuid(binding.expectedFactorId) ||
        !validEpoch(binding.expectedSecurityEpoch) || !validUuid(binding.expectedBeginOperationId)) throw safeError();
    const beginId = binding.expectedBeginOperationId.toLowerCase();
    const accountId = binding.expectedAccountId.toLowerCase();
    const factorId = binding.expectedFactorId.toLowerCase();
    const epoch = binding.expectedSecurityEpoch;
    const statement = 'SELECT groundbnb.read_pending_factor_for_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::bigint) AS result';
    const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
      beginId, accountId, factorId, epoch]);
    const keys = ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope', 'lastAcceptedStep',
      'beginOperationId', 'requestFingerprint'];
    try {
      const snapshot = snapshotJsonRecord(result, keys);
      if (!snapshot || snapshot.accountId !== accountId || snapshot.factorId !== factorId ||
          snapshot.securityEpoch !== epoch || snapshot.state !== 'pending' ||
          !validKeyId(snapshot.keyId) || !validEnvelope(snapshot.envelope, snapshot.keyId) ||
          (snapshot.lastAcceptedStep !== null && !validEpoch(snapshot.lastAcceptedStep)) ||
          snapshot.beginOperationId !== beginId || !validFingerprint(snapshot.requestFingerprint)) throw safeError();
      return snapshot;
    } catch { throw safeError(); }
  }

  async function beginEnrollment(identityInput, event) {
    try {
      const identity = requireIdentity(identityInput);
      const keys = ['operationId', 'expectedAccountId', 'expectedCurrentEpoch', 'targetEpoch', 'candidateFactorId',
        'requestFingerprint', 'envelopeKeyId', 'encryptedSecret'];
      const input = snapshotJsonRecord(event, keys);
      if (!input || !validUuid(input.expectedAccountId) ||
          !validEpoch(input.expectedCurrentEpoch) || input.expectedCurrentEpoch >= Number.MAX_SAFE_INTEGER - 1 ||
          input.targetEpoch !== input.expectedCurrentEpoch + 1 || !validUuid(input.candidateFactorId) ||
          !validKeyId(input.envelopeKeyId) ||
          !validEnvelope(input.encryptedSecret, input.envelopeKeyId)) return { status: 'unknown' };
      const op = operationId(input.operationId), accountId = input.expectedAccountId.toLowerCase();
      const factorId = input.candidateFactorId.toLowerCase(), fingerprint = input.requestFingerprint;
      const fingerprintValue = fingerprintBytes(fingerprint);
      const statement = 'SELECT groundbnb.begin_factor_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::bigint,$8::uuid,$9::uuid,$10::bytea,$11,$12::jsonb) AS result';
      const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        accountId, input.expectedCurrentEpoch, input.targetEpoch, factorId, op, fingerprintValue,
        input.envelopeKeyId, serializeJsonValue(input.encryptedSecret)]);
      return normalizedWriterStatus(result, { statuses: new Set(['committed', 'rejected', 'unknown']), operationId: op, kind: 'begin',
        accountId, factorId, epoch: input.targetEpoch, fingerprint });
    } catch { return Object.freeze({ status: 'unknown' }); }
  }

  async function recordEnrollmentAttempt(identityInput, event) {
    try {
      const identity = requireIdentity(identityInput);
      const keys = ['operationId', 'beginOperationId', 'expectedAccountId', 'expectedFactorId',
        'expectedSecurityEpoch', 'requestFingerprint', 'reason'];
      const input = snapshotRecord(event, keys);
      if (!input || !validUuid(input.beginOperationId) || !validUuid(input.expectedAccountId) ||
          !validUuid(input.expectedFactorId) || !validEpoch(input.expectedSecurityEpoch) ||
          !ATTEMPT_REASONS.has(input.reason)) return Object.freeze({ status: 'unknown' });
      const op = operationId(input.operationId), beginId = input.beginOperationId.toLowerCase();
      const accountId = input.expectedAccountId.toLowerCase(), factorId = input.expectedFactorId.toLowerCase();
      const fingerprint = input.requestFingerprint, fingerprintValue = fingerprintBytes(fingerprint);
      const statement = 'SELECT groundbnb.record_factor_enrollment_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11) AS result';
      const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        beginId, op, accountId, factorId, input.expectedSecurityEpoch, fingerprintValue, input.reason]);
      const statuses = new Set(['recorded', 'rejected', 'unknown']);
      return normalizedWriterStatus(result, { statuses, operationId: op, kind: 'verify',
        accountId, factorId, epoch: input.expectedSecurityEpoch, fingerprint });
    } catch { return Object.freeze({ status: 'unknown' }); }
  }

  async function verifyEnrollment(identityInput, event) {
    try {
      const identity = requireIdentity(identityInput);
      const keys = ['operationId', 'beginOperationId', 'expectedAccountId', 'expectedFactorId',
        'expectedSecurityEpoch', 'requestFingerprint', 'matchedStep'];
      const input = snapshotRecord(event, keys);
      if (!input || !validUuid(input.beginOperationId) || !validUuid(input.expectedAccountId) ||
          !validUuid(input.expectedFactorId) || !validEpoch(input.expectedSecurityEpoch) || !validEpoch(input.matchedStep)) {
        return Object.freeze({ status: 'unknown' });
      }
      const op = operationId(input.operationId), beginId = input.beginOperationId.toLowerCase();
      const accountId = input.expectedAccountId.toLowerCase(), factorId = input.expectedFactorId.toLowerCase();
      const fingerprint = input.requestFingerprint, fingerprintValue = fingerprintBytes(fingerprint);
      const statement = 'SELECT groundbnb.verify_factor_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11::bigint) AS result';
      const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        beginId, op, accountId, factorId, input.expectedSecurityEpoch, fingerprintValue, input.matchedStep]);
      return normalizedWriterStatus(result, { statuses: new Set(['committed', 'rejected', 'unknown']), operationId: op, kind: 'verify',
        accountId, factorId, epoch: input.expectedSecurityEpoch, fingerprint });
    } catch { return Object.freeze({ status: 'unknown' }); }
  }

  async function readEnrollmentReceipt(identityInput, query) {
    const identity = requireIdentity(identityInput);
    const keys = ['operationId', 'kind', 'expectedAccountId', 'expectedFactorId', 'expectedSecurityEpoch'];
    const input = snapshotRecord(query, keys);
    if (!input || !KINDS.has(input.kind) || !validUuid(input.expectedAccountId) ||
        (input.expectedFactorId !== null && !validUuid(input.expectedFactorId)) ||
        (input.expectedSecurityEpoch !== null && !validEpoch(input.expectedSecurityEpoch)) ||
        ((input.expectedFactorId === null) !== (input.expectedSecurityEpoch === null))) throw safeError();
    const op = operationId(input.operationId), accountId = input.expectedAccountId.toLowerCase();
    const factorId = input.expectedFactorId === null ? null : input.expectedFactorId.toLowerCase();
    const statement = 'SELECT groundbnb.read_factor_enrollment_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6,$7::uuid,$8::uuid,$9::bigint) AS result';
    const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
      op, input.kind, accountId, factorId, input.expectedSecurityEpoch]);
    const keysOut = ['status', 'operationId', 'kind', 'accountId', 'issuer', 'subject', 'sessionId',
      'factorId', 'securityEpoch', 'requestFingerprint'];
    try {
      const snapshot = snapshotJsonRecord(result, keysOut);
      if (!snapshot || !['not_found', 'pending', 'rejected', 'verified', 'unknown'].includes(snapshot.status) ||
          !validUuid(snapshot.operationId) || snapshot.operationId.toLowerCase() !== op.toLowerCase() ||
          snapshot.kind !== input.kind || snapshot.accountId !== accountId ||
          snapshot.issuer !== identity.issuer || !sameUuid(snapshot.subject, identity.subject) ||
          !sameUuid(snapshot.sessionId, identity.sessionId)) throw safeError();
      if (snapshot.status === 'not_found') {
        if (snapshot.factorId !== null || snapshot.securityEpoch !== null || snapshot.requestFingerprint !== null) throw safeError();
      } else if (!validUuid(snapshot.factorId) || !validEpoch(snapshot.securityEpoch) ||
          !validFingerprint(snapshot.requestFingerprint) ||
          (factorId !== null && (!sameUuid(snapshot.factorId, factorId) || snapshot.securityEpoch !== input.expectedSecurityEpoch))) {
        throw safeError();
      }
      return immutableJson({ ...snapshot, operationId: op, subject: identity.subject, sessionId: identity.sessionId });
    } catch { throw safeError(); }
  }

  return Object.freeze({ readEnrollmentContext, readPendingFactor, beginEnrollment,
    recordEnrollmentAttempt, verifyEnrollment, readEnrollmentReceipt });
}

const MATERIAL_RECEIPT_KEYS = ['status', 'operationId', 'kind', 'accountId', 'issuer', 'subject', 'sessionId',
  'factorId', 'securityEpoch', 'beginOperationId', 'requestFingerprint'];
const MATERIAL_ACK_KEYS = ['status', 'operationId', 'kind', 'accountId', 'factorId', 'securityEpoch',
  'requestFingerprint', 'beginOperationId', 'newlyCommitted'];

/**
 * Fixed-call repository view for the dormant same-session resume protocol.
 * The injected query port must target the checked local/preview database and
 * resolve a writer only after the standalone HTTP statement has committed.
 * Neither condition is proven by this offline adapter.
 */
export function createFactorEnrollmentResumePostgresRepository(environment, runQuery) {
  if (typeof environment !== 'string' || !Object.hasOwn(ISSUERS, environment) || typeof runQuery !== 'function') {
    throw new TypeError('A pinned local/preview environment and private query port are required.');
  }
  const enrollment = createFactorEnrollmentPostgresRepository(environment, runQuery);

  function identitySnapshot(value) {
    const identity = snapshotRecord(value, ['issuer', 'subject', 'sessionId', 'expiresAt']);
    if (!identity || !validIdentity(identity, environment)) throw safeError();
    return Object.freeze(identity);
  }

  async function runFixed(statement, values) {
    try { return await runQuery(statement, Object.freeze(values.slice())); }
    catch { throw safeError(); }
  }

  async function readEnrollmentReceipt(identityInput, queryInput) {
    const query = snapshotRecord(queryInput, ['operationId', 'kind', 'expectedAccountId',
      'expectedFactorId', 'expectedSecurityEpoch']);
    if (!query || query.kind !== 'begin' || !validUuid(query.operationId) || !validUuid(query.expectedAccountId) ||
        query.expectedFactorId !== null || query.expectedSecurityEpoch !== null) throw safeError();
    const receipt = await enrollment.readEnrollmentReceipt(identityInput, query);
    if (!['not_found', 'pending'].includes(receipt.status)) throw safeError();
    return receipt;
  }

  async function readMaterialReceipt(identityInput, queryInput) {
    const identity = identitySnapshot(identityInput);
    const query = snapshotRecord(queryInput, ['operationId', 'expectedAccountId', 'expectedFactorId',
      'expectedSecurityEpoch', 'expectedBeginOperationId']);
    if (!query || !validUuid(query.operationId) || !validUuid(query.expectedAccountId) ||
        !validUuid(query.expectedFactorId) || !validEpoch(query.expectedSecurityEpoch) ||
        !validUuid(query.expectedBeginOperationId)) throw safeError();
    const operation = query.operationId.toLowerCase();
    const account = query.expectedAccountId.toLowerCase();
    const factor = query.expectedFactorId.toLowerCase();
    const begin = query.expectedBeginOperationId.toLowerCase();
    const statement = 'SELECT groundbnb.read_factor_enrollment_material_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::bigint,$9::uuid) AS result';
    const raw = await runFixed(statement, [identity.issuer, identity.subject, identity.sessionId,
      identity.expiresAt, operation, account, factor, query.expectedSecurityEpoch, begin]);
    const receipt = snapshotJsonRecord(raw, MATERIAL_RECEIPT_KEYS);
    if (!receipt || !['not_found', 'released', 'rejected'].includes(receipt.status) ||
        receipt.operationId !== operation || receipt.kind !== 'resume' || receipt.accountId !== account ||
        receipt.issuer !== identity.issuer || receipt.subject !== identity.subject ||
        receipt.sessionId !== identity.sessionId || receipt.beginOperationId !== begin) throw safeError();
    if (receipt.status === 'not_found') {
      if (receipt.factorId !== null || receipt.securityEpoch !== null || receipt.requestFingerprint !== null) throw safeError();
    } else if (receipt.factorId !== factor || receipt.securityEpoch !== query.expectedSecurityEpoch ||
        !validFingerprint(receipt.requestFingerprint)) throw safeError();
    return receipt;
  }

  async function releaseMaterial(identityInput, eventInput) {
    let account = null, factor = null, epoch = null, begin = null, operation = null, fingerprint = null;
    try {
      const identity = identitySnapshot(identityInput);
      const event = snapshotRecord(eventInput, ['operationId', 'beginOperationId', 'expectedAccountId',
        'expectedFactorId', 'expectedSecurityEpoch', 'expectedEnvelopeKeyId', 'requestFingerprint']);
      if (!event || !validUuid(event.operationId) || !validUuid(event.beginOperationId) ||
          !validUuid(event.expectedAccountId) || !validUuid(event.expectedFactorId) ||
          !validEpoch(event.expectedSecurityEpoch) || !validKeyId(event.expectedEnvelopeKeyId)) return Object.freeze({ status: 'unknown' });
      operation = event.operationId.toLowerCase();
      begin = event.beginOperationId.toLowerCase();
      account = event.expectedAccountId.toLowerCase();
      factor = event.expectedFactorId.toLowerCase();
      epoch = event.expectedSecurityEpoch;
      const fingerprintValue = fingerprintBytes(event.requestFingerprint);
      fingerprint = event.requestFingerprint;
      const statement = 'SELECT groundbnb.record_factor_enrollment_material_release($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10,$11::bytea) AS result';
      const raw = await runFixed(statement, [identity.issuer, identity.subject, identity.sessionId,
        identity.expiresAt, begin, operation, account, factor, epoch, event.expectedEnvelopeKeyId, fingerprintValue]);
      const ack = snapshotJsonRecord(raw, MATERIAL_ACK_KEYS);
      if (!ack || !['released', 'rejected', 'unknown'].includes(ack.status) ||
          ack.operationId !== operation || ack.kind !== 'resume' || ack.accountId !== account ||
          ack.factorId !== factor || ack.securityEpoch !== epoch || ack.requestFingerprint !== fingerprint ||
          ack.beginOperationId !== begin || typeof ack.newlyCommitted !== 'boolean' ||
          (ack.status !== 'released' && ack.newlyCommitted)) throw safeError();
      return ack;
    } catch {
      return Object.freeze({ status: 'unknown', operationId: operation, kind: 'resume', accountId: account,
        factorId: factor, securityEpoch: epoch, requestFingerprint: fingerprint, beginOperationId: begin,
        newlyCommitted: false });
    }
  }

  return Object.freeze({ readEnrollmentContext: enrollment.readEnrollmentContext, readEnrollmentReceipt,
    readMaterialReceipt, readPendingFactor: enrollment.readPendingFactor, releaseMaterial });
}
