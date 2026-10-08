import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFactorCandidate } from '../lib/factor-verifier.mjs';

// Public RFC 6238 SHA-1 test secret, not an enrolled factor or credential.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const fixture = changes => ({ secret: RFC_SECRET, token: '287082', epochSeconds: 59,
  lastAcceptedStep: null, ...changes });

test('maintained verifier matches public RFC six-digit vector and returns only a frozen step candidate', async () => {
  const result = await verifyFactorCandidate(fixture());
  assert.deepEqual(result, { valid: true, matchedStep: 1 });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes(RFC_SECRET), false);
});

test('accepts at most one adjacent 30-second step and rejects stale or already-consumed candidates', async () => {
  assert.deepEqual(await verifyFactorCandidate(fixture({ epochSeconds: 89 })), { valid: true, matchedStep: 1 });
  assert.deepEqual(await verifyFactorCandidate(fixture({ epochSeconds: 90 })), { valid: false });
  assert.deepEqual(await verifyFactorCandidate(fixture({ lastAcceptedStep: 1 })), { valid: false });
  assert.deepEqual(await verifyFactorCandidate(fixture({ lastAcceptedStep: 2 })), { valid: false });
  assert.deepEqual(await verifyFactorCandidate(fixture({ lastAcceptedStep: 0 })), { valid: true, matchedStep: 1 });
});

test('malformed inputs, unknown replay state and incorrect codes fail without disclosure', async () => {
  for (const input of [null, undefined, [], 1, {}, fixture({ token: '123456' }),
    fixture({ token: 287082 }), fixture({ token: '0287082' }), fixture({ token: '28708a' }),
    fixture({ epochSeconds: -1 }), fixture({ epochSeconds: 59.5 }), fixture({ epochSeconds: NaN }),
    fixture({ lastAcceptedStep: undefined }), fixture({ lastAcceptedStep: -1 }),
    fixture({ secret: 'too-short' }), fixture({ secret: RFC_SECRET.toLowerCase() }),
    fixture({ secret: 'A'.repeat(104) }), fixture({ role: 'owner' })]) {
    assert.deepEqual(await verifyFactorCandidate(input), { valid: false });
  }
});
