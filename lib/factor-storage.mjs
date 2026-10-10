import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ENVELOPE_KEYS = Object.freeze(['version', 'keyId', 'nonce', 'ciphertext', 'tag']);
const CONTEXT_KEYS = Object.freeze(['environment', 'accountId', 'factorId', 'securityEpoch']);
const ALLOWED_ENVIRONMENTS = new Set(['local', 'preview', 'production', 'recovery']);
const FAIL_MESSAGE = 'Factor storage operation failed.';
const BASE32_SECRET = /^[A-Z2-7]{32,103}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
// Issued recovery codes use 32 random bytes encoded as canonical base64url.
const RECOVERY_CODE = /^[A-Za-z0-9_-]{43}$/;
const RECOVERY_SALT_BYTES = 16;
const RECOVERY_DIGEST_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function fail() { return new Error(FAIL_MESSAGE); }

function plainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value, expected) {
  return plainRecord(value) && Object.keys(value).length === expected.length &&
    expected.every(key => Object.hasOwn(value, key));
}

function validateContext(context) {
  if (!hasExactKeys(context, CONTEXT_KEYS) || !ALLOWED_ENVIRONMENTS.has(context.environment) ||
      typeof context.accountId !== 'string' || !OPAQUE_ID.test(context.accountId) ||
      typeof context.factorId !== 'string' || !OPAQUE_ID.test(context.factorId) ||
      !Number.isSafeInteger(context.securityEpoch) || context.securityEpoch < 0) throw fail();
  return context;
}

function validateKey(key) {
  if (!(Buffer.isBuffer(key) || key instanceof Uint8Array) || key.byteLength !== 32) throw fail();
  return Buffer.from(key);
}

function validateKeyId(keyId) {
  if (typeof keyId !== 'string' || !KEY_ID.test(keyId)) throw fail();
  return keyId;
}

function validateSecret(secret) {
  if (typeof secret !== 'string' || !BASE32_SECRET.test(secret)) throw fail();
  return secret;
}

function aadFor(context, keyId) {
  return Buffer.from(JSON.stringify([
    'groundbnb-factor-secret', 1, context.environment, context.accountId, context.factorId,
    context.securityEpoch, keyId,
  ]), 'utf8');
}

function decodeCanonicalBase64Url(value, minBytes, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(maxBytes * 4 / 3) ||
      !/^[A-Za-z0-9_-]+$/.test(value)) throw fail();
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length < minBytes || decoded.length > maxBytes || decoded.toString('base64url') !== value) throw fail();
  return decoded;
}

function decodeEnvelope(envelope) {
  if (!hasExactKeys(envelope, ENVELOPE_KEYS) || envelope.version !== 1) throw fail();
  const keyId = validateKeyId(envelope.keyId);
  const nonce = decodeCanonicalBase64Url(envelope.nonce, NONCE_BYTES, NONCE_BYTES);
  const ciphertext = decodeCanonicalBase64Url(envelope.ciphertext, 32, 103);
  const tag = decodeCanonicalBase64Url(envelope.tag, TAG_BYTES, TAG_BYTES);
  return { keyId, nonce, ciphertext, tag };
}

/** Encrypt one bounded Base32 secret with caller-supplied environment-specific key material. */
export function encryptFactorSecret(input) {
  try {
    if (!hasExactKeys(input, ['secret', 'key', 'keyId', 'context'])) throw fail();
    const secret = validateSecret(input.secret);
    const key = validateKey(input.key);
    const keyId = validateKeyId(input.keyId);
    const context = validateContext(input.context);
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aadFor(context, keyId));
    const ciphertext = Buffer.concat([cipher.update(secret, 'ascii'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Object.freeze({ version: 1, keyId, nonce: nonce.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'), tag: tag.toString('base64url') });
  } catch {
    throw fail();
  }
}

/** Decrypt only for the exact owner/environment/factor/epoch and externally selected key ID. */
export function decryptFactorSecret(input) {
  try {
    if (!hasExactKeys(input, ['envelope', 'key', 'keyId', 'context'])) throw fail();
    const key = validateKey(input.key);
    const keyId = validateKeyId(input.keyId);
    const context = validateContext(input.context);
    const envelope = decodeEnvelope(input.envelope);
    if (envelope.keyId !== keyId) throw fail();
    const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(aadFor(context, keyId));
    decipher.setAuthTag(envelope.tag);
    const plaintext = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    return validateSecret(plaintext.toString('utf8'));
  } catch {
    throw fail();
  }
}

function recoveryDigest(code, salt, context) {
  return createHash('sha256').update(JSON.stringify([
    'groundbnb-recovery-code-v1', context.environment, context.accountId, context.factorId,
    context.securityEpoch, salt.toString('base64url'), code,
  ]), 'utf8').digest();
}

function validRecoveryCode(code) {
  if (typeof code !== 'string' || !RECOVERY_CODE.test(code)) return false;
  const decoded = Buffer.from(code, 'base64url');
  return decoded.length === 32 && decoded.toString('base64url') === code;
}

/** Create a salted digest record from an already-issued code; this function does not issue codes. */
export function createRecoveryCodeDigest(input) {
  try {
    if (!hasExactKeys(input, ['code', 'context']) || !validRecoveryCode(input.code)) throw fail();
    const context = validateContext(input.context);
    const salt = randomBytes(RECOVERY_SALT_BYTES);
    const digest = recoveryDigest(input.code, salt, context);
    return Object.freeze({ version: 1, salt: salt.toString('base64url'), digest: digest.toString('base64url') });
  } catch {
    throw fail();
  }
}

/** Check a digest candidate in constant time; durable one-use consumption remains a database transaction. */
export function verifyRecoveryCodeCandidate(input) {
  try {
    if (!hasExactKeys(input, ['code', 'record', 'context']) || !validRecoveryCode(input.code) ||
        !hasExactKeys(input.record, ['version', 'salt', 'digest']) || input.record.version !== 1) return Object.freeze({ valid: false });
    const context = validateContext(input.context);
    const salt = decodeCanonicalBase64Url(input.record.salt, RECOVERY_SALT_BYTES, RECOVERY_SALT_BYTES);
    const expected = decodeCanonicalBase64Url(input.record.digest, RECOVERY_DIGEST_BYTES, RECOVERY_DIGEST_BYTES);
    const actual = recoveryDigest(input.code, salt, context);
    return Object.freeze({ valid: timingSafeEqual(actual, expected) });
  } catch {
    return Object.freeze({ valid: false });
  }
}
