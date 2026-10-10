const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVALID = Object.freeze({ ok: false, error: 'invalid_request' });
const INVALID_ACK = Object.freeze({ ok: false, error: 'invalid_acknowledgment' });
const FAILURE_OUTCOMES = new Set(['rejected', 'unavailable', 'unknown']);

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValues(value, expected) {
  if (!plainRecord(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || !expected.every(key => keys.includes(key))) return false;
    const values = Object.create(null);
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return false;
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return false;
  }
}

function validOperationId(value) {
  return typeof value === 'string' && value.length === 36 && UUID.test(value);
}

function parseResult(operationId, code) {
  const value = { ok: true, operationId };
  if (code !== undefined) {
    // Keep verification material out of ordinary enumeration/JSON logging.
    Object.defineProperty(value, 'code', { value: code, enumerable: false });
  }
  return Object.freeze(value);
}

/**
 * Validate only the closed client body for one server-selected operation.
 * This result is not authorization, a database acknowledgment, or proof that
 * enrollment has begun or completed. Do not log/serialize the verify result.
 */
export function validateFactorEnrollmentRequest(operation, input) {
  if (operation === 'begin') {
    const fields = ownDataValues(input, ['operationId']);
    if (!fields || !validOperationId(fields.operationId)) return INVALID;
    return parseResult(fields.operationId);
  }
  if (operation === 'verify') {
    const fields = ownDataValues(input, ['operationId', 'code']);
    if (!fields || !validOperationId(fields.operationId) || typeof fields.code !== 'string' || fields.code.length !== 6 ||
        !/^\d{6}$/.test(fields.code)) return INVALID;
    return parseResult(fields.operationId, fields.code);
  }
  return INVALID;
}

/**
 * Validate a minimal candidate acknowledgment. The caller must still perform
 * durable receipt, identity, session, and factor checks before granting access.
 */
export function validateFactorEnrollmentAcknowledgment(operation, expectedOperationId, value) {
  const fields = ownDataValues(value, ['operationId', 'outcome']);
  if (!validOperationId(expectedOperationId) || !fields || !validOperationId(fields.operationId) ||
      fields.operationId !== expectedOperationId || typeof fields.outcome !== 'string') return INVALID_ACK;
  const validOutcome = operation === 'begin'
    ? fields.outcome === 'pending' || FAILURE_OUTCOMES.has(fields.outcome)
    : operation === 'verify'
      ? fields.outcome === 'verified' || FAILURE_OUTCOMES.has(fields.outcome)
      : false;
  if (!validOutcome) return INVALID_ACK;
  if (fields.outcome === 'unknown') {
    return Object.freeze({ ok: true, operationId: fields.operationId, outcome: fields.outcome,
      mutationRetryAllowed: false, resolution: 'status_lookup_required' });
  }
  return Object.freeze({ ok: true, operationId: fields.operationId, outcome: fields.outcome });
}
