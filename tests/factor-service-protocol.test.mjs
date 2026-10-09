import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptFactorSecret, createRecoveryCodeDigest } from '../lib/factor-storage.mjs';
import { createFactorServiceProtocol, PROPOSED_FACTOR_RATE_POLICY } from '../lib/factor-service-protocol.mjs';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const FACTOR = '00000000-0000-4000-8000-000000000002';
const ISSUER = 'https://local-auth.example.test';
const SUBJECT = 'synthetic-user-1';
const SESSION = 'synthetic-session-1';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const TOKEN = '287082';
const RECOVERY_CODE = Buffer.alloc(32, 0x33).toString('base64url');
const KEY = Buffer.alloc(32, 0x5a);
const CONTEXT = { environment: 'local', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4 };
const ENVELOPE = encryptFactorSecret({ secret: SECRET, key: KEY, keyId: 'local-test-v1', context: CONTEXT });
const RECOVERY_RECORD = createRecoveryCodeDigest({ code: RECOVERY_CODE, context: CONTEXT });
const IDENTITY = Object.freeze({ issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
  expiresAt: '2030-01-01T00:00:00.000Z' });
const RATE_POLICY = PROPOSED_FACTOR_RATE_POLICY;

function challengeState(overrides = {}) {
  return {
    principal: { accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
      accountStatus: 'active', role: 'admin', securityEpoch: 4 },
    currentSecurityEpoch: 4, accountSuspended: false, sessionRevoked: false, rateLimited: false,
    factor: { accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4, state: 'verified',
      keyId: 'local-test-v1', envelope: ENVELOPE, lastAcceptedStep: null },
    recoveryRecords: [], ...overrides,
  };
}

function receipt(status, method, identity = IDENTITY, operationId) {
  return { status, operationId, method, accountId: ACCOUNT, issuer: identity.issuer,
    subject: identity.subject, sessionId: identity.sessionId };
}

function harness({ state = challengeState(), clock = () => new Date(59_000),
  consumeTotp, consumeRecovery, recordAttempt, readReceipt, resolveSession, keyProvider,
  ratePolicy = RATE_POLICY } = {}) {
  const calls = [];
  const repository = {
    async readChallengeState(identity) { calls.push(['read', identity]); return structuredClone(state); },
    async recordChallengeAttempt(identity, binding, event) {
      calls.push(['attempt', identity, binding, event]);
      return recordAttempt ? recordAttempt(identity, binding, event) : { status: 'recorded' };
    },
    async consumeTotpCandidate(identity, binding, event) {
      calls.push(['totp', identity, binding, event]);
      return consumeTotp ? consumeTotp(identity, binding, event) : { status: 'accepted' };
    },
    async consumeRecoveryCandidate(identity, binding, event) {
      calls.push(['recovery', identity, binding, event]);
      return consumeRecovery ? consumeRecovery(identity, binding, event) : { status: 'accepted' };
    },
    async readOperationReceipt(identity, query) {
      calls.push(['receipt', identity, query]);
      return readReceipt ? readReceipt(identity, query) : receipt('not_found', query.method, identity, query.operationId);
    },
  };
  const dependencies = { environment: 'local',
    resolveSession: resolveSession ?? (async () => ({ ok: true, identity: IDENTITY })),
    clock, keyProvider: keyProvider ?? { async getKey() { return { keyId: 'local-test-v1', key: KEY }; } },
    repository, ratePolicy,
  };
  const service = createFactorServiceProtocol(dependencies);
  return { service, calls, repository, dependencies };
}

test('two-phase TOTP reads state, verifies outside a transaction, then makes one atomic consume call', async () => {
  const h = harness();
  const result = await h.service.challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(result, { ok: true, outcome: 'accepted' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp', 'read']);
  const [, identity, binding, event] = h.calls[1];
  assert.deepEqual(identity, IDENTITY);
  assert.deepEqual(binding, { accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT,
    sessionId: SESSION, factorId: FACTOR, securityEpoch: 4 });
  assert.equal(event.matchedStep, 1);
  assert.match(event.operationId, /^[0-9a-f-]{36}$/i);
  assert.equal(event.identityExpiresAt, IDENTITY.expiresAt);
  assert.deepEqual(event.ratePolicy, RATE_POLICY);
  assert.equal(JSON.stringify(h.calls).includes(TOKEN), false);
  assert.equal(Object.hasOwn(h.repository, 'withChallengeTransaction'), false);
});

test('recovery verifies bounded stored rows and passes exactly one matched row to an atomic writer', async () => {
  const h = harness({ state: challengeState({ recoveryRecords: [
    { recoveryId: 'owned-recovery-1', accountId: ACCOUNT, factorId: FACTOR,
      securityEpoch: 4, record: RECOVERY_RECORD },
  ] }) });
  assert.deepEqual(await h.service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE }),
    { ok: true, outcome: 'accepted' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'recovery', 'read']);
  assert.equal(h.calls[1][3].recoveryId, 'owned-recovery-1');
  assert.equal(JSON.stringify(h.calls).includes(RECOVERY_CODE), false);
});

test('trusted environment is captured at service construction and cannot mutate between recovery attempts', async () => {
  const h = harness({ state: challengeState({ recoveryRecords: [
    { recoveryId: 'owned-recovery-1', accountId: ACCOUNT, factorId: FACTOR,
      securityEpoch: 4, record: RECOVERY_RECORD },
  ] }) });
  h.dependencies.environment = 'preview';
  assert.deepEqual(await h.service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE }),
    { ok: true, outcome: 'accepted' });
});

test('invalid challenge durably records a bounded outcome without storing the submitted value', async () => {
  const h = harness();
  const result = await h.service.challengeTOTP({ requestContext: {}, token: 'bad-token' });
  assert.deepEqual(result, { ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'attempt']);
  const event = h.calls[1][3];
  assert.equal(event.outcome, 'rejected');
  assert.equal(event.ratePolicy.maxFailures, 5);
  assert.equal(Object.hasOwn(event, 'token'), false);
  assert.equal(JSON.stringify(h.calls).includes('bad-token'), false);
});

test('stale epoch/session/factor state fails before verification or writer calls', async () => {
  for (const overrides of [
    { currentSecurityEpoch: 5 },
    { principal: { ...challengeState().principal, sessionId: 'another-session' } },
    { factor: { ...challengeState().factor, state: 'pending' } },
  ]) {
    const h = harness({ state: challengeState(overrides) });
    assert.equal((await h.service.challengeTOTP({ requestContext: {}, token: TOKEN })).outcome, 'unavailable');
    assert.deepEqual(h.calls.map(([name]) => name), ['read']);
  }
});

test('writer receives the complete observed binding for database revalidation and stale writer refusal is final', async () => {
  let eventSeen;
  const h = harness({ consumeTotp: async (_identity, binding, event) => {
    eventSeen = { binding, event };
    return { status: 'rejected' };
  } });
  assert.equal((await h.service.challengeTOTP({ requestContext: {}, token: TOKEN })).outcome, 'rejected');
  assert.equal(eventSeen.binding.securityEpoch, 4);
  assert.equal(eventSeen.binding.sessionId, SESSION);
  assert.equal(eventSeen.binding.factorId, FACTOR);
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp']);
});

test('unknown commit is resolved by one owner/session/method-bound receipt read and never retried', async () => {
  const h = harness({ consumeTotp: async () => ({ status: 'unknown' }),
    readReceipt: async (_identity, query) => receipt('accepted', query.method, IDENTITY, query.operationId) });
  assert.deepEqual(await h.service.challengeTOTP({ requestContext: {}, token: TOKEN }),
    { ok: true, outcome: 'accepted' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp', 'receipt', 'read']);
  assert.equal(h.calls.filter(([name]) => name === 'totp').length, 1);
});

test('unknown commit with missing, malformed, or foreign receipt remains unknown without retry', async () => {
  const invalidReceipts = [null, { status: 'accepted' },
    receipt('accepted', 'recovery'), receipt('accepted', 'totp', { ...IDENTITY, sessionId: 'other' }),
    { ...receipt('accepted', 'totp'), accountId: '00000000-0000-4000-8000-000000000099' }];
  for (const invalid of invalidReceipts) {
    const h = harness({ consumeTotp: async () => { throw new Error(TOKEN); },
      readReceipt: async () => invalid });
    assert.deepEqual(await h.service.challengeTOTP({ requestContext: {}, token: TOKEN }),
      { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
    assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp', 'receipt']);
  }
});

test('receipt not_found never triggers automatic consume retry', async () => {
  const h = harness({ state: challengeState({ recoveryRecords: [
    { recoveryId: 'owned-recovery-1', accountId: ACCOUNT, factorId: FACTOR,
      securityEpoch: 4, record: RECOVERY_RECORD },
  ] }), consumeRecovery: async () => ({ status: 'unknown' }) });
  const result = await h.service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE });
  assert.equal(result.outcome, 'unknown');
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'recovery', 'receipt']);
});

test('a delayed accepted response is withheld if the managed session expires before reply', async () => {
  let current = new Date(59_000);
  const h = harness({ clock: () => current, consumeTotp: async () => {
    current = new Date('2030-01-01T00:00:00.001Z');
    return { status: 'accepted' };
  } });
  assert.deepEqual(await h.service.challengeTOTP({ requestContext: {}, token: TOKEN }),
    { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp']);
});

test('accepted receipts do not bypass current epoch, revocation, or rate checks', async () => {
  for (const changes of [
    { currentSecurityEpoch: 5 },
    { sessionRevoked: true },
    { rateLimited: true },
  ]) {
    const h = harness({ consumeTotp: async () => ({ status: 'unknown' }),
      readReceipt: async (_identity, query) => receipt('accepted', query.method, IDENTITY, query.operationId) });
    const read = h.repository.readChallengeState.bind(h.repository);
    let reads = 0;
    h.repository.readChallengeState = async identity => {
      reads++;
      return reads === 1 ? read(identity) : challengeState(changes);
    };
    assert.deepEqual(await h.service.challengeTOTP({ requestContext: {}, token: TOKEN }),
      { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  }
});

test('accepted writer result is withheld if the factor binding changes before confirmation', async () => {
  const h = harness({ consumeTotp: async () => ({ status: 'accepted' }) });
  const read = h.repository.readChallengeState.bind(h.repository);
  let reads = 0;
  h.repository.readChallengeState = async identity => {
    reads++;
    return reads === 1 ? read(identity) : challengeState({
      factor: { ...challengeState().factor, factorId: 'replacement-factor' },
    });
  };

  assert.deepEqual(await h.service.challengeTOTP({ requestContext: {}, token: TOKEN }),
    { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  assert.deepEqual(h.calls.map(([name]) => name), ['read', 'totp']);
});

test('rate policy is captured immutably and must be explicitly supplied', async () => {
  const configured = { maxFailures: 5, windowSeconds: 900 };
  const h = harness({ ratePolicy: configured });
  assert.equal(Object.isFrozen(PROPOSED_FACTOR_RATE_POLICY), true);
  configured.maxFailures = 10;
  await h.service.challengeTOTP({ requestContext: {}, token: 'bad-token' });
  assert.equal(h.calls[1][3].ratePolicy.maxFailures, 5);
  assert.equal(Object.isFrozen(h.calls[1][3].ratePolicy), true);
  const invalid = { ...PROPOSED_FACTOR_RATE_POLICY, maxFailures: 2 };
  assert.throws(() => createFactorServiceProtocol({ environment: 'local', resolveSession: async () => ({}),
    clock: () => new Date(), keyProvider: { getKey: async () => ({}) }, repository: h.repository,
    ratePolicy: invalid }), /Invalid factor protocol/);
});

test('expiry after read blocks cryptographic consume and rate policy is explicit bounded configuration', async () => {
  let now = new Date(59_000);
  const h = harness({ clock: () => now, consumeTotp: async () => ({ status: 'accepted' }),
    keyProvider: { async getKey() { now = new Date('2030-01-01T00:00:00.000Z'); return { keyId: 'local-test-v1', key: KEY }; } } });
  assert.equal((await h.service.challengeTOTP({ requestContext: {}, token: TOKEN })).outcome, 'unavailable');
  assert.deepEqual(h.calls.map(([name]) => name), ['read']);

  assert.throws(() => createFactorServiceProtocol({ environment: 'local', resolveSession: async () => ({}),
    clock: () => new Date(), keyProvider: { getKey: async () => ({}) }, repository: h.repository }), /Invalid factor protocol/);
});

test('closed inputs and malformed session environment fail without provider or repository calls', async () => {
  let resolves = 0;
  const h = harness({ resolveSession: async () => { resolves++; return { ok: true, identity: {
    ...IDENTITY, expiresAt: '2026-02-30T00:00:00Z' } }; } });
  assert.equal((await h.service.challengeTOTP({ requestContext: {}, token: TOKEN, role: 'owner' })).outcome, 'rejected');
  assert.equal((await h.service.challengeTOTP({ requestContext: {}, token: TOKEN })).outcome, 'unavailable');
  assert.equal(resolves, 1);
  assert.deepEqual(h.calls, []);
});
