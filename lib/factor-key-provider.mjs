const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const KEY_PURPOSE = 'factor-enrollment';
const KEY_UNAVAILABLE = 'Factor key unavailable.';

function unavailable() {
  return new Error(KEY_UNAVAILABLE);
}

function plainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function snapshotExact(value, keys) {
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
  } catch {
    return null;
  }
}

function snapshotRequest(value) {
  if (!plainRecord(value)) return null;
  try {
    const own = Reflect.ownKeys(value);
    if (own.length !== 2 && own.length !== 3) return null;
    if (!own.includes('environment') || !own.includes('purpose') ||
        (own.length === 3 && !own.includes('keyId'))) return null;
    const result = {};
    for (const key of own) {
      if (key !== 'environment' && key !== 'purpose' && key !== 'keyId') return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function validEnvironment(value) {
  return value === 'local' || value === 'preview';
}

function validKeyId(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return false;
  const match = KEY_ID_PATTERN.exec(value);
  return match !== null && match[0] === value;
}

function validateEncodedKey(value) {
  if (typeof value !== 'string' || value.length !== 43) throw unavailable();
  const match = KEY_PATTERN.exec(value);
  if (!match || match[0] !== value) throw unavailable();
  let decoded;
  try { decoded = Buffer.from(value, 'base64url'); } catch { throw unavailable(); }
  try {
    if (decoded.length !== 32 || decoded.toString('base64url') !== value) throw unavailable();
  } finally {
    decoded.fill(0);
  }
}

function keyRecord(keyId, encodedKey) {
  const result = { keyId };
  Object.defineProperty(result, 'key', {
    value: Buffer.from(encodedKey, 'base64url'),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(result);
}

/**
 * Create an injected current-key-only provider. Callers supply a trusted,
 * environment-specific runtime snapshot; this module never reads process.env,
 * files, tool output, or a remote secret store.
 */
export function createFactorKeyProvider(configuration) {
  if (typeof window !== 'undefined') throw new TypeError('Factor key provider is server-only.');
  const config = snapshotExact(configuration, ['environment', 'env']);
  if (!config || !validEnvironment(config.environment)) {
    throw new TypeError('Invalid factor key provider configuration.');
  }
  const source = snapshotExact(config.env, ['GROUND_FACTOR_ENVELOPE_KEY', 'GROUND_FACTOR_KEY_ID']);
  if (!source || !validKeyId(source.GROUND_FACTOR_KEY_ID)) {
    throw new TypeError('Invalid factor key provider configuration.');
  }
  validateEncodedKey(source.GROUND_FACTOR_ENVELOPE_KEY);

  const environment = config.environment;
  const currentKeyId = source.GROUND_FACTOR_KEY_ID;
  const encodedKey = source.GROUND_FACTOR_ENVELOPE_KEY;

  return Object.freeze({
    getKey(request) {
      const input = snapshotRequest(request);
      if (!input || input.environment !== environment || input.purpose !== KEY_PURPOSE ||
          (Object.hasOwn(input, 'keyId') && input.keyId !== currentKeyId)) throw unavailable();
      return keyRecord(currentKeyId, encodedKey);
    },
  });
}
