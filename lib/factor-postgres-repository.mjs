const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METHODS = new Set(['totp', 'recovery']);
const ATTEMPT_OUTCOMES = new Set(['rejected', 'unavailable']);
const MAX_RECOVERY_ROWS = 100;
const IDENTITY_KEYS = ['issuer', 'subject', 'sessionId', 'expiresAt'];
const BINDING_KEYS = ['accountId', 'issuer', 'subject', 'sessionId', 'factorId', 'securityEpoch'];
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, keys) => plainRecord(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value;
const epoch = value => Number.isSafeInteger(value) && value >= 0;
const safeError = () => new Error('Factor repository operation failed.');

function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== 'Z') {
    const offsetHour = Number(offsetHourText), offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validIdentity(identity) {
  return exactKeys(identity, IDENTITY_KEYS) && opaque(identity.issuer) && opaque(identity.subject) &&
    opaque(identity.sessionId) && validTimestamp(identity.expiresAt);
}

function validRatePolicy(policy) {
  return exactKeys(policy, ['maxFailures', 'windowSeconds']) && Number.isInteger(policy.maxFailures) &&
    policy.maxFailures >= 3 && policy.maxFailures <= 10 && Number.isInteger(policy.windowSeconds) &&
    policy.windowSeconds >= 60 && policy.windowSeconds <= 3600;
}

function validEnvelope(value, keyId) {
  return exactKeys(value, ['version', 'keyId', 'nonce', 'ciphertext', 'tag']) && value.version === 1 &&
    value.keyId === keyId && typeof value.nonce === 'string' && /^[A-Za-z0-9_-]{16}$/.test(value.nonce) &&
    typeof value.ciphertext === 'string' && /^[A-Za-z0-9_-]{43,138}$/.test(value.ciphertext) &&
    typeof value.tag === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value.tag);
}

function validDigest(value) {
  return exactKeys(value, ['version', 'salt', 'digest']) && value.version === 1 &&
    typeof value.salt === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value.salt) &&
    typeof value.digest === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.digest);
}

function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function validateChallengeState(value, identity) {
  const stateKeys = ['principal', 'currentSecurityEpoch', 'accountSuspended', 'sessionRevoked', 'rateLimited', 'factor', 'recoveryRecords'];
  const principalKeys = ['accountId', 'issuer', 'subject', 'sessionId', 'accountStatus', 'role', 'securityEpoch'];
  const factorKeys = ['accountId', 'factorId', 'securityEpoch', 'state', 'keyId', 'envelope', 'lastAcceptedStep'];
  const recoveryKeys = ['recoveryId', 'accountId', 'factorId', 'securityEpoch', 'record'];
  if (!exactKeys(value, stateKeys) || !exactKeys(value.principal, principalKeys) || !exactKeys(value.factor, factorKeys) ||
      !Array.isArray(value.recoveryRecords) || value.recoveryRecords.length > MAX_RECOVERY_ROWS) return false;
  const principal = value.principal, factor = value.factor;
  if (!UUID.test(principal.accountId) || principal.issuer !== identity.issuer || principal.subject !== identity.subject ||
      principal.sessionId !== identity.sessionId || !['owner', 'admin'].includes(principal.role) ||
      principal.accountStatus !== 'active' || !epoch(principal.securityEpoch) ||
      value.currentSecurityEpoch !== principal.securityEpoch || value.accountSuspended !== false ||
      value.sessionRevoked !== false || typeof value.rateLimited !== 'boolean' ||
      factor.accountId !== principal.accountId || !UUID.test(factor.factorId) ||
      factor.securityEpoch !== value.currentSecurityEpoch || factor.state !== 'verified' ||
      !opaque(factor.keyId) || !validEnvelope(factor.envelope, factor.keyId) ||
      (factor.lastAcceptedStep !== null && !epoch(factor.lastAcceptedStep))) return false;
  return value.recoveryRecords.every(record => exactKeys(record, recoveryKeys) && UUID.test(record.recoveryId) &&
    record.accountId === principal.accountId && record.factorId === factor.factorId &&
    record.securityEpoch === value.currentSecurityEpoch && validDigest(record.record));
}

function normalizeBinding(binding, identity) {
  if (!exactKeys(binding, BINDING_KEYS) || !UUID.test(binding.accountId) || !UUID.test(binding.factorId) ||
      binding.issuer !== identity.issuer || binding.subject !== identity.subject || binding.sessionId !== identity.sessionId ||
      !epoch(binding.securityEpoch)) throw safeError();
  return binding;
}

function validOperationId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw safeError();
  return value.toLowerCase();
}

function knownStatus(value, allowed) {
  return exactKeys(value, ['status']) && allowed.has(value.status) ? value.status : null;
}

/**
 * Build the factor-service repository over a trusted, injected single-query port.
 * The port returns the JSON value from one allowlisted SELECT. This module never
 * creates a Neon client, batches requests, starts transactions, logs parameters,
 * or runs generic SQL. Each writer maps to exactly one database function call.
 */
export function createFactorPostgresRepository(runQuery) {
  if (typeof runQuery !== 'function') throw new TypeError('A private query port is required.');

  async function run(statement, values) {
    try { return await runQuery(statement, values); }
    catch { throw safeError(); }
  }

  async function readChallengeState(identity) {
    if (!validIdentity(identity)) throw safeError();
    const statement = 'SELECT groundbnb.read_factor_challenge_state($1,$2,$3,$4::timestamptz) AS result';
    const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt]);
    if (!validateChallengeState(result, identity)) throw safeError();
    return freezeTree(structuredClone(result));
  }

  async function recordChallengeAttempt(identity, bindingInput, event) {
    try {
      if (!validIdentity(identity)) throw safeError();
      const binding = normalizeBinding(bindingInput, identity);
      if (!exactKeys(event, ['operationId', 'method', 'outcome', 'at', 'ratePolicy']) ||
          !METHODS.has(event.method) || !ATTEMPT_OUTCOMES.has(event.outcome) || !validRatePolicy(event.ratePolicy)) {
        throw safeError();
      }
      const operationId = validOperationId(event.operationId);
      const statement = 'SELECT groundbnb.record_factor_challenge_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::uuid,$8,$9,$10::integer,$11::integer) AS result';
      const values = [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        binding.factorId, binding.securityEpoch, operationId, event.method, event.outcome,
        event.ratePolicy.maxFailures, event.ratePolicy.windowSeconds];
      const result = await run(statement, values);
      const status = knownStatus(result, new Set(['recorded', 'unknown']));
      return Object.freeze({ status: status ?? 'unknown' });
    } catch { return { status: 'unknown' }; }
  }

  async function consumeTotpCandidate(identity, bindingInput, event) {
    try {
      if (!validIdentity(identity)) throw safeError();
      const binding = normalizeBinding(bindingInput, identity);
      if (!exactKeys(event, ['operationId', 'matchedStep', 'identityExpiresAt', 'ratePolicy']) ||
          !epoch(event.matchedStep) || event.identityExpiresAt !== identity.expiresAt || !validRatePolicy(event.ratePolicy)) {
        throw safeError();
      }
      const operationId = validOperationId(event.operationId);
      const statement = 'SELECT groundbnb.consume_factor_totp_candidate($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::bigint,$8::uuid,$9::integer,$10::integer) AS result';
      const values = [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        binding.factorId, binding.securityEpoch, event.matchedStep, operationId,
        event.ratePolicy.maxFailures, event.ratePolicy.windowSeconds];
      const result = await run(statement, values);
      const status = knownStatus(result, new Set(['accepted', 'rejected', 'unknown']));
      return Object.freeze({ status: status ?? 'unknown' });
    } catch { return { status: 'unknown' }; }
  }

  async function consumeRecoveryCandidate(identity, bindingInput, event) {
    try {
      if (!validIdentity(identity)) throw safeError();
      const binding = normalizeBinding(bindingInput, identity);
      if (!exactKeys(event, ['operationId', 'recoveryId', 'identityExpiresAt', 'ratePolicy']) ||
          !UUID.test(event.recoveryId) || event.identityExpiresAt !== identity.expiresAt || !validRatePolicy(event.ratePolicy)) {
        throw safeError();
      }
      const operationId = validOperationId(event.operationId);
      const statement = 'SELECT groundbnb.consume_factor_recovery_candidate($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::uuid,$8::uuid,$9::integer,$10::integer) AS result';
      const values = [identity.issuer, identity.subject, identity.sessionId, identity.expiresAt,
        binding.factorId, binding.securityEpoch, event.recoveryId, operationId,
        event.ratePolicy.maxFailures, event.ratePolicy.windowSeconds];
      const result = await run(statement, values);
      const status = knownStatus(result, new Set(['accepted', 'rejected', 'unknown']));
      return Object.freeze({ status: status ?? 'unknown' });
    } catch { return { status: 'unknown' }; }
  }

  async function readOperationReceipt(identity, query) {
    if (!validIdentity(identity) || !exactKeys(query, ['operationId', 'method', 'expectedAccountId']) ||
        !METHODS.has(query.method) || !UUID.test(query.expectedAccountId)) throw safeError();
    const operationId = validOperationId(query.operationId);
    const statement = 'SELECT groundbnb.read_factor_operation_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6) AS result';
    const result = await run(statement, [identity.issuer, identity.subject, identity.sessionId,
      identity.expiresAt, operationId, query.method]);
    const keys = ['status', 'operationId', 'method', 'accountId', 'issuer', 'subject', 'sessionId'];
    if (!exactKeys(result, keys) || !['accepted', 'rejected', 'unavailable', 'not_found'].includes(result.status) ||
        result.operationId !== operationId || result.method !== query.method || result.accountId !== query.expectedAccountId ||
        result.issuer !== identity.issuer || result.subject !== identity.subject || result.sessionId !== identity.sessionId) {
      throw safeError();
    }
    return Object.freeze({ ...result });
  }

  return Object.freeze({ readChallengeState, recordChallengeAttempt, consumeTotpCandidate,
    consumeRecoveryCandidate, readOperationReceipt });
}
