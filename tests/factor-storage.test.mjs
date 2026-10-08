import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecoveryCodeDigest, decryptFactorSecret, encryptFactorSecret, verifyRecoveryCodeCandidate,
} from '../lib/factor-storage.mjs';

// Synthetic fixture only; it is not an enrolled account factor or recovery credential.
const SYNTHETIC_BASE32_SECRET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SYNTHETIC_RECOVERY_CODE = Buffer.alloc(32, 0x33).toString('base64url');
const context = Object.freeze({ environment: 'local', accountId: 'synthetic-account-a', factorId: 'synthetic-factor-a', securityEpoch: 7 });
const key = () => Buffer.alloc(32, 0x5a);

test('factor secret round-trips in a closed v1 envelope and binds key/context', () => {
  const envelope = encryptFactorSecret({ secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context });
  assert.deepEqual(Object.keys(envelope).sort(), ['ciphertext', 'keyId', 'nonce', 'tag', 'version']);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.nonce.length, 16);
  assert.equal(envelope.tag.length, 22);
  assert.equal(envelope.ciphertext.includes(SYNTHETIC_BASE32_SECRET), false);
  const second = encryptFactorSecret({ secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context });
  assert.notEqual(second.nonce, envelope.nonce);
  assert.equal(decryptFactorSecret({ envelope, key: key(), keyId: 'local-v1', context }), SYNTHETIC_BASE32_SECRET);

  const alternateContexts = [
    { ...context, environment: 'preview' }, { ...context, accountId: 'synthetic-account-b' },
    { ...context, factorId: 'synthetic-factor-b' }, { ...context, securityEpoch: 8 },
  ];
  for (const changedContext of alternateContexts) {
    assert.throws(() => decryptFactorSecret({ envelope, key: key(), keyId: 'local-v1', context: changedContext }), error => {
      assert.equal(error.message, 'Factor storage operation failed.');
      assert.equal(error.cause, undefined);
      assert.equal(error.message.includes(SYNTHETIC_BASE32_SECRET), false);
      return true;
    });
  }
  assert.throws(() => decryptFactorSecret({ envelope, key: Buffer.alloc(32, 0x5b), keyId: 'local-v1', context }), /Factor storage operation failed/);
  assert.throws(() => decryptFactorSecret({ envelope, key: key(), keyId: 'preview-v1', context }), /Factor storage operation failed/);
});

test('tampered, malformed, unknown-version, and extra-key envelopes fail privately', () => {
  const envelope = encryptFactorSecret({ secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context });
  const changedCiphertext = `${envelope.ciphertext.slice(0, -1)}${envelope.ciphertext.endsWith('A') ? 'B' : 'A'}`;
  const malformed = [
    null, [], { ...envelope, version: 2 }, { ...envelope, extra: 'secret' },
    { ...envelope, tag: Buffer.alloc(16).toString('base64url').slice(0, -1) },
    { ...envelope, ciphertext: changedCiphertext }, { ...envelope, keyId: 'bad key id' },
  ];
  for (const candidate of malformed) {
    assert.throws(() => decryptFactorSecret({ envelope: candidate, key: key(), keyId: 'local-v1', context }), error => {
      assert.equal(error.message, 'Factor storage operation failed.');
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('factor encryption rejects malformed secret, context, key, key ID, and unknown input fields', () => {
  for (const input of [
    { secret: 'short', key: key(), keyId: 'local-v1', context },
    { secret: 'A'.repeat(104), key: key(), keyId: 'local-v1', context },
    { secret: 'A'.repeat(31) + '0', key: key(), keyId: 'local-v1', context },
    { secret: SYNTHETIC_BASE32_SECRET, key: Buffer.alloc(31), keyId: 'local-v1', context },
    { secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'invalid id', context },
    { secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context: { ...context, securityEpoch: -1 } },
    { secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context: { ...context, accountId: 'bad\u0000id' } },
    { secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context: { ...context, privilege: 'owner' } },
    { secret: SYNTHETIC_BASE32_SECRET, key: key(), keyId: 'local-v1', context, ownerId: 'another-account' },
  ]) assert.throws(() => encryptFactorSecret(input), error => error.message === 'Factor storage operation failed.');
});

test('recovery-code helper returns only a random-salted digest and checks exact owner/factor/epoch context', () => {
  const record = createRecoveryCodeDigest({ code: SYNTHETIC_RECOVERY_CODE, context });
  assert.deepEqual(Object.keys(record).sort(), ['digest', 'salt', 'version']);
  assert.equal(record.version, 1);
  assert.equal(record.salt.length, 22);
  assert.equal(record.digest.length, 43);
  assert.equal(JSON.stringify(record).includes(SYNTHETIC_RECOVERY_CODE), false);
  assert.deepEqual(verifyRecoveryCodeCandidate({ code: SYNTHETIC_RECOVERY_CODE, record, context }), { valid: true });
  assert.deepEqual(verifyRecoveryCodeCandidate({ code: 'WRONG-SYNTHETIC-CODE', record, context }), { valid: false });
  assert.deepEqual(verifyRecoveryCodeCandidate({ code: SYNTHETIC_RECOVERY_CODE, record,
    context: { ...context, accountId: 'synthetic-account-b' } }), { valid: false });
  assert.deepEqual(verifyRecoveryCodeCandidate({ code: SYNTHETIC_RECOVERY_CODE, record,
    context: { ...context, securityEpoch: 8 } }), { valid: false });
});

test('recovery digest inputs are bounded and malformed persisted records fail without disclosure', () => {
  assert.throws(() => createRecoveryCodeDigest({ code: '', context }));
  assert.throws(() => createRecoveryCodeDigest({ code: 'a', context }));
  assert.throws(() => createRecoveryCodeDigest({ code: 'A'.repeat(42) + 'B', context }));
  assert.throws(() => createRecoveryCodeDigest({ code: 'x'.repeat(257), context }));
  assert.throws(() => createRecoveryCodeDigest({ code: SYNTHETIC_RECOVERY_CODE, context, role: 'owner' }));
  for (const record of [null, { version: 2, salt: 'AA', digest: 'AA' }, { version: 1, salt: 'AA', digest: 'AA', code: 'leak' }]) {
    assert.deepEqual(verifyRecoveryCodeCandidate({ code: SYNTHETIC_RECOVERY_CODE, record, context }), { valid: false });
  }
});
