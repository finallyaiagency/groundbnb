import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptFactorSecret, createRecoveryCodeDigest } from '../lib/factor-storage.mjs';
import { createFactorPostgresRepository } from '../lib/factor-postgres-repository.mjs';
import { createFactorServiceProtocol, PROPOSED_FACTOR_RATE_POLICY } from '../lib/factor-service-protocol.mjs';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const FACTOR = '00000000-0000-4000-8000-000000000002';
const RECOVERY_ID = '00000000-0000-4000-8000-000000000003';
const OPERATION = '00000000-0000-4000-8000-000000000004';
const ISSUER = 'https://local-auth.example.test';
const SUBJECT = 'synthetic-user-1';
const SESSION = 'synthetic-session-1';
const EXPIRY = '2030-01-01T00:00:00.000Z';
const KEY = Buffer.alloc(32, 0x5a);
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const CONTEXT = { environment: 'local', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4 };
const ENVELOPE = encryptFactorSecret({ secret: SECRET, key: KEY, keyId: 'local-test-v1', context: CONTEXT });
const RECOVERY = createRecoveryCodeDigest({ code: Buffer.alloc(32, 0x33).toString('base64url'), context: CONTEXT });
const IDENTITY = Object.freeze({ issuer: ISSUER, subject: SUBJECT, sessionId: SESSION, expiresAt: EXPIRY });
const BINDING = Object.freeze({ accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT,
  sessionId: SESSION, factorId: FACTOR, securityEpoch: 4 });
const POLICY = Object.freeze({ maxFailures: 5, windowSeconds: 900 });
const STATE = Object.freeze({
  principal: Object.freeze({ accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    accountStatus: 'active', role: 'admin', securityEpoch: 4 }),
  currentSecurityEpoch: 4, accountSuspended: false, sessionRevoked: false, rateLimited: false,
  factor: Object.freeze({ accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4,
    state: 'verified', keyId: 'local-test-v1', envelope: ENVELOPE, lastAcceptedStep: null }),
  recoveryRecords: [Object.freeze({ recoveryId: RECOVERY_ID, accountId: ACCOUNT,
    factorId: FACTOR, securityEpoch: 4, record: RECOVERY })],
});

function harness(responses = []) {
  const calls = [];
  const repository = createFactorPostgresRepository(async (statement, values) => {
    calls.push({ statement, values });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return { repository, calls };
}

test('repository exposes only closed challenge methods and reads through one fixed function call', async () => {
  const h = harness([STATE]);
  const result = await h.repository.readChallengeState(IDENTITY);
  assert.deepEqual(h.calls, [{
    statement: 'SELECT groundbnb.read_factor_challenge_state($1,$2,$3,$4::timestamptz) AS result',
    values: [ISSUER, SUBJECT, SESSION, EXPIRY],
  }]);
  assert.deepEqual(Object.keys(h.repository).sort(), [
    'consumeRecoveryCandidate', 'consumeTotpCandidate', 'readChallengeState',
    'readOperationReceipt', 'recordChallengeAttempt',
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.factor), true);
  assert.equal(result.factor.envelope.ciphertext, ENVELOPE.ciphertext);
  assert.equal(Object.hasOwn(h.repository, 'query'), false);
  assert.equal(Object.hasOwn(h.repository, 'withChallengeTransaction'), false);
  assert.equal(Object.hasOwn(h.repository, 'withAccessTransaction'), false);
});

test('reader rejects malformed, foreign, suspended, excessive, or unknown database state', async () => {
  for (const value of [null, { ...STATE, extra: true },
    { ...STATE, principal: { ...STATE.principal, issuer: 'foreign' } },
    { ...STATE, accountSuspended: true },
    { ...STATE, factor: { ...STATE.factor, state: 'pending' } },
    { ...STATE, recoveryRecords: Array(101).fill(STATE.recoveryRecords[0]) }]) {
    const h = harness([value]);
    await assert.rejects(h.repository.readChallengeState(IDENTITY), { message: 'Factor repository operation failed.' });
    assert.equal(h.calls.length, 1);
  }
  const badIdentity = harness([STATE]);
  await assert.rejects(badIdentity.repository.readChallengeState({ ...IDENTITY,
    expiresAt: '2026-02-30T00:00:00Z' }), { message: 'Factor repository operation failed.' });
  assert.equal(badIdentity.calls.length, 0);
});

test('attempt/TOTP/recovery each use one fixed parameterized function call without passing account ID or app timestamp', async () => {
  const h = harness([{ status: 'recorded' }, { status: 'accepted' }, { status: 'rejected' }]);
  assert.deepEqual(await h.repository.recordChallengeAttempt(IDENTITY, BINDING, {
    operationId: OPERATION, method: 'totp', outcome: 'rejected', at: '2026-10-08T12:00:00.000Z', ratePolicy: POLICY,
  }), { status: 'recorded' });
  assert.deepEqual(await h.repository.consumeTotpCandidate(IDENTITY, BINDING, {
    operationId: OPERATION, matchedStep: 123, identityExpiresAt: EXPIRY, ratePolicy: POLICY,
  }), { status: 'accepted' });
  assert.deepEqual(await h.repository.consumeRecoveryCandidate(IDENTITY, BINDING, {
    operationId: OPERATION, recoveryId: RECOVERY_ID, identityExpiresAt: EXPIRY, ratePolicy: POLICY,
  }), { status: 'rejected' });
  assert.deepEqual(h.calls.map(call => call.statement), [
    'SELECT groundbnb.record_factor_challenge_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::uuid,$8,$9,$10::integer,$11::integer) AS result',
    'SELECT groundbnb.consume_factor_totp_candidate($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::bigint,$8::uuid,$9::integer,$10::integer) AS result',
    'SELECT groundbnb.consume_factor_recovery_candidate($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::uuid,$8::uuid,$9::integer,$10::integer) AS result',
  ]);
  assert.deepEqual(h.calls[0].values, [ISSUER, SUBJECT, SESSION, EXPIRY, FACTOR, 4,
    OPERATION, 'totp', 'rejected', 5, 900]);
  assert.deepEqual(h.calls[1].values, [ISSUER, SUBJECT, SESSION, EXPIRY, FACTOR, 4, 123,
    OPERATION, 5, 900]);
  assert.deepEqual(h.calls[2].values, [ISSUER, SUBJECT, SESSION, EXPIRY, FACTOR, 4,
    RECOVERY_ID, OPERATION, 5, 900]);
  for (const call of h.calls) {
    assert.equal(call.statement.includes('INSERT '), false);
    assert.equal(call.values.includes(ACCOUNT), false);
    assert.equal(call.values.includes('2026-10-08T12:00:00.000Z'), false);
  }
});

test('unknown, malformed, and throwing writer results are closed and never retried', async () => {
  for (const response of [{ status: 'unknown', detail: 'secret' }, { status: 'accepted', extra: true }, new Error('driver secret')]) {
    const h = harness([response]);
    assert.deepEqual(await h.repository.consumeTotpCandidate(IDENTITY, BINDING, {
      operationId: OPERATION, matchedStep: 123, identityExpiresAt: EXPIRY, ratePolicy: POLICY,
    }), { status: 'unknown' });
    assert.equal(h.calls.length, 1);
    assert.equal(JSON.stringify(h.calls).includes('driver secret'), false);
  }
});

test('writer refuses malformed bindings, invalid event keys, and invalid expiration without calling SQL', async () => {
  const h = harness();
  assert.deepEqual(await h.repository.consumeTotpCandidate(IDENTITY, { ...BINDING, accountId: 'invalid' }, {
    operationId: OPERATION, matchedStep: 123, identityExpiresAt: EXPIRY, ratePolicy: POLICY,
  }), { status: 'unknown' });
  assert.deepEqual(await h.repository.consumeTotpCandidate(IDENTITY, BINDING, {
    operationId: OPERATION, matchedStep: 123, identityExpiresAt: 'different', ratePolicy: POLICY,
  }), { status: 'unknown' });
  assert.equal(h.calls.length, 0);
});

test('receipt lookup validates exact account/session/method/operation binding and suppresses raw errors', async () => {
  const result = { status: 'accepted', operationId: OPERATION, method: 'totp', accountId: ACCOUNT,
    issuer: ISSUER, subject: SUBJECT, sessionId: SESSION };
  const h = harness([result]);
  assert.deepEqual(await h.repository.readOperationReceipt(IDENTITY, {
    operationId: OPERATION, method: 'totp', expectedAccountId: ACCOUNT,
  }), result);
  assert.deepEqual(h.calls, [{
    statement: 'SELECT groundbnb.read_factor_operation_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6) AS result',
    values: [ISSUER, SUBJECT, SESSION, EXPIRY, OPERATION, 'totp'],
  }]);
  for (const invalid of [null, { ...result, method: 'recovery' }, { ...result, sessionId: 'foreign' },
    { ...result, accountId: '00000000-0000-4000-8000-000000000099' }, { ...result, extra: true }]) {
    const other = harness([invalid]);
    await assert.rejects(other.repository.readOperationReceipt(IDENTITY, {
      operationId: OPERATION, method: 'totp', expectedAccountId: ACCOUNT,
    }),
      { message: 'Factor repository operation failed.' });
  }
  const errored = harness([new Error('credential-bearing driver error')]);
  await assert.rejects(errored.repository.readOperationReceipt(IDENTITY, {
    operationId: OPERATION, method: 'totp', expectedAccountId: ACCOUNT,
  }),
    { message: 'Factor repository operation failed.' });
});

test('only predeclared private groundbnb functions appear in SQL text', async () => {
  const h = harness([{ status: 'recorded' }]);
  await h.repository.recordChallengeAttempt(IDENTITY, BINDING, {
    operationId: OPERATION, method: 'recovery', outcome: 'unavailable', at: '2026-10-08T12:00:00Z', ratePolicy: POLICY,
  });
  assert.match(h.calls[0].statement, /^SELECT groundbnb\.record_factor_challenge_attempt\(/);
  assert.doesNotMatch(h.calls[0].statement, /\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i);
  assert.equal(h.calls[0].values.some(value => String(value).includes(RECOVERY.salt)), false);
});

test('repository and service protocol interoperate through an injected port with no open transaction', async () => {
  const calls = [];
  const repository = createFactorPostgresRepository(async (statement, values) => {
    calls.push({ statement, values });
    if (statement.includes('read_factor_challenge_state')) return STATE;
    if (statement.includes('consume_factor_totp_candidate')) return { status: 'accepted' };
    throw new Error('unexpected SQL function');
  });
  const service = createFactorServiceProtocol({ environment: 'local',
    resolveSession: async () => ({ ok: true, identity: IDENTITY }),
    clock: () => new Date(59_000),
    keyProvider: { async getKey() { return { keyId: 'local-test-v1', key: KEY }; } },
    repository, ratePolicy: PROPOSED_FACTOR_RATE_POLICY,
  });
  assert.deepEqual(await service.challengeTOTP({ requestContext: {}, token: '287082' }),
    { ok: true, outcome: 'accepted' });
  assert.equal(calls.length, 3);
  assert.match(calls[0].statement, /read_factor_challenge_state/);
  assert.match(calls[1].statement, /consume_factor_totp_candidate/);
  assert.match(calls[2].statement, /read_factor_challenge_state/);
  assert.equal(calls.some(call => /BEGIN|transaction/i.test(call.statement)), false);
});

test('unknown consume resolves one owner-bound operation receipt without retrying the writer', async () => {
  const calls = [];
  const repository = createFactorPostgresRepository(async (statement, values) => {
    calls.push({ statement, values });
    if (statement.includes('read_factor_challenge_state')) return STATE;
    if (statement.includes('consume_factor_totp_candidate')) return { status: 'unknown' };
    if (statement.includes('read_factor_operation_receipt')) return {
      status: 'accepted', operationId: values[4], method: values[5], accountId: ACCOUNT,
      issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    };
    throw new Error('unexpected SQL function');
  });
  const service = createFactorServiceProtocol({ environment: 'local',
    resolveSession: async () => ({ ok: true, identity: IDENTITY }),
    clock: () => new Date(59_000),
    keyProvider: { async getKey() { return { keyId: 'local-test-v1', key: KEY }; } },
    repository, ratePolicy: PROPOSED_FACTOR_RATE_POLICY,
  });
  assert.deepEqual(await service.challengeTOTP({ requestContext: {}, token: '287082' }),
    { ok: true, outcome: 'accepted' });
  assert.deepEqual(calls.map(call => call.statement.includes('read_factor_challenge_state') ? 'read'
    : call.statement.includes('consume_factor_totp_candidate') ? 'consume'
    : call.statement.includes('read_factor_operation_receipt') ? 'receipt' : 'unexpected'),
  ['read', 'consume', 'receipt', 'read']);
  assert.equal(calls[1].values[7], calls[2].values[4]);
  assert.equal(calls[1].values[7].length, 36);
});
