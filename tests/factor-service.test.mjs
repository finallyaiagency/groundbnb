import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptFactorSecret, createRecoveryCodeDigest } from '../lib/factor-storage.mjs';
import { createFactorService } from '../lib/factor-service.mjs';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const FACTOR = '00000000-0000-4000-8000-000000000002';
const ISSUER = 'https://local-auth.example.test';
const SUBJECT = 'synthetic-user-1';
const SESSION = 'synthetic-session-1';
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Public RFC vector, not an enrolled secret.
const TOKEN = '287082'; // RFC 6238 SHA-1 vector at epoch second 59.
const RECOVERY_CODE = Buffer.alloc(32, 0x33).toString('base64url'); // Synthetic only.
const KEY = Buffer.alloc(32, 0x5a);
const context = { environment: 'local', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4 };
const envelope = encryptFactorSecret({ secret: SECRET, key: KEY, keyId: 'local-test-v1', context });

function makeRepository(changes = {}) {
  const principal = { accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    accountStatus: 'active', role: 'admin', securityEpoch: 4 };
  const state = {
    principal, currentSecurityEpoch: 4, accountSuspended: false, sessionRevoked: false,
    rateLimited: false,
    factor: { accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4, state: 'verified',
      keyId: 'local-test-v1', envelope, lastAcceptedStep: null },
    recoveryRecords: [],
    ...changes,
  };
  const audits = [];
  const committed = [];
  let tail = Promise.resolve();
  const repository = {
    async withChallengeTransaction(identity, work) {
      const result = tail.then(async () => {
        let draft = structuredClone(state);
        const draftAudits = [];
        const draftCommitted = [];
        const tx = {
          async loadChallengeState() { return structuredClone(draft); },
          async recordAttempt(event) { draftAudits.push({ ...event }); return { status: 'recorded' }; },
          async consumeTotp(event) {
            if (event.matchedStep <= draft.factor.lastAcceptedStep) return { status: 'rejected' };
            draft.factor.lastAcceptedStep = event.matchedStep;
            draftCommitted.push({ method: 'totp', step: event.matchedStep, at: event.at,
              identityExpiresAt: event.identityExpiresAt, identity });
            draftAudits.push({ outcome: 'accepted_totp', at: event.at });
            return { status: 'committed' };
          },
          async consumeRecovery(event) {
            const index = draft.recoveryRecords.findIndex(row => row.recoveryId === event.recoveryId);
            if (index < 0) return { status: 'rejected' };
            draft.recoveryRecords.splice(index, 1);
            draftCommitted.push({ method: 'recovery', recoveryId: event.recoveryId, at: event.at,
              identityExpiresAt: event.identityExpiresAt, identity });
            draftAudits.push({ outcome: 'accepted_recovery', at: event.at });
            return { status: 'committed' };
          },
        };
        const value = await work(tx);
        Object.assign(state, draft);
        audits.push(...draftAudits);
        committed.push(...draftCommitted);
        return { status: 'committed', value };
      });
      tail = result.catch(() => undefined);
      return result;
    },
    async withAccessTransaction(identity, work) {
      const tx = { async loadAccessSnapshot() { return structuredClone(changes.accessSnapshot); },
        async readOnly(callback) {
          const reader = Object.freeze({ async loadProtectedValue() { return 'protected'; } });
          return callback(reader);
        } };
      const value = await work(tx);
      return { status: 'committed', value };
    },
  };
  return { repository, state, audits, committed };
}

function baseAccessSnapshot(overrides = {}) {
  const principal = { accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    accountStatus: 'active', role: 'admin', securityEpoch: 4 };
  return {
    principal,
    factorAttestation: { accountId: ACCOUNT, issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
      enrolled: true, verified: true, challengedAt: '2026-10-08T15:59:00.000Z',
      lastActivityAt: '2026-10-08T16:00:00.000Z', securityEpoch: 4 },
    context: { currentSecurityEpoch: 4, accountSuspended: false, sessionRevoked: false, rateLimited: false },
    ...overrides,
  };
}

function createHarness({ repository, clock = () => new Date(59_000), resolveSession, keyProvider } = {}) {
  const trustedIdentity = { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    expiresAt: '2030-01-01T00:00:00.000Z' };
  return createFactorService({ environment: 'local',
    resolveSession: resolveSession ?? (async () => ({ ok: true, identity: trustedIdentity })),
    clock, keyProvider: keyProvider ?? { async getKey() { return { keyId: 'local-test-v1', key: KEY }; } },
    repository: repository ?? makeRepository().repository,
  });
}

test('TOTP succeeds only after transaction commit; response and audit omit submitted code and secret', async () => {
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository });
  const result = await service.challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(result, { ok: true, outcome: 'accepted' });
  assert.deepEqual(mock.committed.map(row => [row.method, row.step]), [['totp', 1]]);
  assert.deepEqual(mock.audits.map(row => row.outcome), ['accepted_totp']);
  assert.equal(JSON.stringify({ result, audits: mock.audits, committed: mock.committed }).includes(TOKEN), false);
  assert.equal(JSON.stringify({ result, audits: mock.audits, committed: mock.committed }).includes(SECRET), false);
});

test('invalid TOTP is durably counted without raw code and does not create an attestation', async () => {
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository });
  const result = await service.challengeTOTP({ requestContext: {}, token: '000000' });
  assert.deepEqual(result, { ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
  assert.deepEqual(mock.audits, [{ outcome: 'rejected', at: '1970-01-01T00:00:59.000Z' }]);
  assert.equal(mock.committed.length, 0);
  assert.equal(JSON.stringify(mock.audits).includes('000000'), false);
});

test('bounded malformed TOTP format is rate-counted without storing its submitted value', async () => {
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository });
  const result = await service.challengeTOTP({ requestContext: {}, token: '12x' });
  assert.equal(result.outcome, 'rejected');
  assert.deepEqual(mock.audits.map(row => row.outcome), ['rejected']);
  assert.equal(JSON.stringify(mock.audits).includes('12x'), false);
});

test('two concurrent uses of one TOTP step have at most one successful transaction', async () => {
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository });
  const results = await Promise.all([
    service.challengeTOTP({ requestContext: {}, token: TOKEN }),
    service.challengeTOTP({ requestContext: {}, token: TOKEN }),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(mock.committed.filter(row => row.method === 'totp').length, 1);
  assert.equal(mock.audits.filter(row => row.outcome === 'rejected').length, 1);
});

test('recovery candidate is consumed once inside the same transaction as its attestation', async () => {
  const record = createRecoveryCodeDigest({ code: RECOVERY_CODE, context });
  const mock = makeRepository({ recoveryRecords: [{ recoveryId: 'recovery-row-1', accountId: ACCOUNT,
    factorId: FACTOR, securityEpoch: 4, record }] });
  const service = createHarness({ repository: mock.repository });
  const results = await Promise.all([
    service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE }),
    service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE }),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(mock.committed.filter(row => row.method === 'recovery').length, 1);
  assert.deepEqual(mock.state.recoveryRecords, []);
  assert.equal(JSON.stringify({ results, audits: mock.audits }).includes(RECOVERY_CODE), false);
});

test('ambiguous duplicate recovery matches are all checked but never consumed', async () => {
  const record = createRecoveryCodeDigest({ code: RECOVERY_CODE, context });
  const mock = makeRepository({ recoveryRecords: [
    { recoveryId: 'recovery-row-a', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4, record },
    { recoveryId: 'recovery-row-b', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4, record },
  ] });
  const service = createHarness({ repository: mock.repository });
  const result = await service.challengeRecovery({ requestContext: {}, code: RECOVERY_CODE });
  assert.deepEqual(result, { ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
  assert.equal(mock.committed.length, 0);
  assert.equal(mock.state.recoveryRecords.length, 2);
  assert.deepEqual(mock.audits.map(row => row.outcome), ['rejected']);
});

test('missing key and unknown commit outcome fail closed without leaking underlying errors or retrying', async () => {
  const mock = makeRepository();
  let calls = 0;
  const unavailable = createHarness({ repository: mock.repository, keyProvider: {
    async getKey() { calls++; throw new Error(`secret ${SECRET}`); },
  } });
  const unavailableResult = await unavailable.challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(unavailableResult, { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  assert.equal(calls, 1);
  assert.equal(JSON.stringify({ unavailableResult, audits: mock.audits }).includes(SECRET), false);

  const unknownRepository = makeRepository();
  unknownRepository.repository.withChallengeTransaction = async () => ({ status: 'unknown' });
  const unknown = await createHarness({ repository: unknownRepository.repository })
    .challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(unknown, { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
});

test('session expiry is rechecked after asynchronous key retrieval before step consumption', async () => {
  let current = new Date(59_000);
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository, clock: () => current,
    resolveSession: async () => ({ ok: true, identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
      expiresAt: '1970-01-01T00:01:00.000Z' } }),
    keyProvider: { async getKey() {
      current = new Date('1970-01-01T00:01:00.000Z');
      return { keyId: 'local-test-v1', key: KEY };
    } },
  });
  const result = await service.challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(result, { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  assert.equal(mock.committed.length, 0);
});

test('a TOTP candidate that leaves the accepted server-time window in flight is not consumed', async () => {
  const moments = [59_000, 59_000, 59_000, 120_000];
  let index = 0;
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository, clock: () => new Date(moments[Math.min(index++, moments.length - 1)]) });
  const result = await service.challengeTOTP({ requestContext: {}, token: TOKEN });
  assert.deepEqual(result, { ok: false, outcome: 'rejected', reason: 'factor_challenge_rejected' });
  assert.equal(mock.committed.length, 0);
  assert.deepEqual(mock.audits.map(row => row.outcome), ['rejected']);
});

test('managed identity expiry accepts resolver precision through nanoseconds without rounding into access', async () => {
  const mock = makeRepository();
  const service = createHarness({ repository: mock.repository, clock: () => new Date(59_000),
    resolveSession: async () => ({ ok: true, identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
      expiresAt: '1970-01-01T00:01:00.123456789Z' } }) });
  assert.deepEqual(await service.challengeTOTP({ requestContext: {}, token: TOKEN }), { ok: true, outcome: 'accepted' });
});

test('access denial happens before protected read and the service supplies sensitivity from its method', async () => {
  let reads = 0;
  const deniedMock = makeRepository({ accessSnapshot: baseAccessSnapshot({
    principal: { ...baseAccessSnapshot().principal, role: 'member' },
  }) });
  const deniedService = createHarness({ repository: deniedMock.repository,
    clock: () => new Date('2026-10-08T16:00:00.000Z') });
  const denied = await deniedService.withSensitiveAccess({}, async () => { reads++; return 'protected'; });
  assert.equal(denied.ok, false);
  assert.equal(denied.decision.reason, 'not_privileged');
  assert.equal(reads, 0);

  const allowedMock = makeRepository({ accessSnapshot: baseAccessSnapshot() });
  const allowedService = createHarness({ repository: allowedMock.repository,
    clock: () => new Date('2026-10-08T16:00:00.000Z') });
  const allowed = await allowedService.withSensitiveAccess({}, async reader => {
    reads++;
    assert.deepEqual(Object.keys(reader), ['loadProtectedValue']);
    assert.equal(Object.isFrozen(reader), true);
    return reader.loadProtectedValue();
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.decision.reason, 'step_up_fresh');
  assert.equal(allowed.value, 'protected');
  assert.equal(reads, 1);
});

test('identity expiry is rechecked after async repository load before protected data access', async () => {
  let current = new Date('2026-10-08T15:59:59.000Z');
  const mock = makeRepository({ accessSnapshot: baseAccessSnapshot() });
  const service = createHarness({ repository: { ...mock.repository, async withAccessTransaction(identity, work) {
    return mock.repository.withAccessTransaction(identity, async tx => {
      const wrapped = { async loadAccessSnapshot() {
        const snapshot = await tx.loadAccessSnapshot();
        current = new Date('2026-10-08T16:00:01.000Z');
        return snapshot;
      } };
      return work(wrapped);
    });
  } }, clock: () => current,
  resolveSession: async () => ({ ok: true, identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
    expiresAt: '2026-10-08T16:00:00.000Z' } }) });
  let reads = 0;
  const result = await service.withOrdinaryAccess({}, async () => { reads++; return 'protected'; });
  assert.equal(result.ok, false);
  assert.equal(reads, 0);
});

test('access rechecks fresh challenge and revocation after a slow read and never returns stale protected data', async () => {
  let now = new Date('2026-10-08T16:00:00.000Z');
  let snapshot = baseAccessSnapshot();
  const repository = makeRepository().repository;
  repository.withAccessTransaction = async (identity, work) => {
    const value = await work({ async loadAccessSnapshot() { return structuredClone(snapshot); },
      async readOnly(callback) { return callback(Object.freeze({ async loadProtectedValue() { return 'private-value'; } })); } });
    return { status: 'committed', value };
  };
  const service = createHarness({ repository, clock: () => now });
  let reads = 0;
  const result = await service.withSensitiveAccess({}, async reader => {
    reads++;
    now = new Date('2026-10-08T16:05:00.001Z');
    snapshot = { ...snapshot, context: { ...snapshot.context, sessionRevoked: true } };
    return reader.loadProtectedValue();
  });
  assert.equal(reads, 1);
  assert.equal(result.ok, false);
  assert.equal(result.decision.reason, 'session_revoked');
  assert.equal(Object.hasOwn(result, 'value'), false);
});

test('unknown access commit cannot return a protected callback value', async () => {
  const repository = makeRepository({ accessSnapshot: baseAccessSnapshot() }).repository;
  repository.withAccessTransaction = async (identity, work) => {
    const value = await work({ async loadAccessSnapshot() { return baseAccessSnapshot(); },
      async readOnly(callback) { return callback(Object.freeze({ async loadProtectedValue() { return 'protected-marker'; } })); } });
    return { status: 'unknown', value };
  };
  const service = createHarness({ repository, clock: () => new Date('2026-10-08T16:00:00.000Z') });
  const result = await service.withOrdinaryAccess({}, reader => reader.loadProtectedValue());
  assert.deepEqual(result, { ok: false, outcome: 'unknown', reason: 'factor_outcome_unknown' });
  assert.equal(JSON.stringify(result).includes('protected-marker'), false);
});

test('session expiry during protected read denies and suppresses its protected value', async () => {
  let now = new Date('2026-10-08T16:00:00.000Z');
  const repository = makeRepository({ accessSnapshot: baseAccessSnapshot() }).repository;
  const service = createHarness({ repository, clock: () => now,
    resolveSession: async () => ({ ok: true, identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
      expiresAt: '2026-10-08T16:00:00.001Z' } }) });
  let reads = 0;
  const result = await service.withOrdinaryAccess({}, async reader => {
    reads++;
    now = new Date('2026-10-08T16:00:00.002Z');
    return reader.loadProtectedValue();
  });
  assert.equal(reads, 1);
  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(result, 'value'), false);
});

test('transaction reply delay rechecks expiry and five-minute step-up before returning protected data', async () => {
  for (const testCase of [
    { expiry: '2030-01-01T00:00:00.000Z', challenge: '2026-10-08T15:55:00.000Z',
      replyTime: '2026-10-08T16:05:00.001Z', expected: 'step_up_required' },
    { expiry: '2026-10-08T16:00:00.001Z', challenge: '2026-10-08T15:59:00.000Z',
      replyTime: '2026-10-08T16:00:00.002Z', expected: 'invalid_context' },
  ]) {
    let now = new Date('2026-10-08T16:00:00.000Z');
    const snapshot = baseAccessSnapshot({ factorAttestation: { ...baseAccessSnapshot().factorAttestation,
      challengedAt: testCase.challenge, lastActivityAt: '2026-10-08T16:00:00.000Z' } });
    const repository = makeRepository({ accessSnapshot: snapshot }).repository;
    repository.withAccessTransaction = async (identity, work) => {
      const value = await work({ async loadAccessSnapshot() { return structuredClone(snapshot); },
        async readOnly(callback) { return callback(Object.freeze({ async loadProtectedValue() { return 'reply-secret'; } })); } });
      now = new Date(testCase.replyTime);
      return { status: 'committed', value };
    };
    const service = createHarness({ repository, clock: () => now,
      resolveSession: async () => ({ ok: true, identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION,
        expiresAt: testCase.expiry } }) });
    const result = await service.withSensitiveAccess({}, reader => reader.loadProtectedValue());
    assert.equal(result.ok, false);
    assert.equal(result.decision.reason, testCase.expected);
    assert.equal(Object.hasOwn(result, 'value'), false);
    assert.equal(JSON.stringify(result).includes('reply-secret'), false);
  }
});

test('closed inputs and mismatched trusted session bindings fail without repository access', async () => {
  let repositoryCalls = 0;
  const mock = makeRepository();
  const repository = { ...mock.repository, async withChallengeTransaction(...args) {
    repositoryCalls++;
    return mock.repository.withChallengeTransaction(...args);
  } };
  const service = createHarness({ repository });
  assert.equal((await service.challengeTOTP({ requestContext: {}, token: TOKEN, role: 'owner' })).outcome, 'rejected');
  const expired = createHarness({ repository, resolveSession: async () => ({ ok: true,
    identity: { issuer: ISSUER, subject: SUBJECT, sessionId: SESSION, expiresAt: '1970-01-01T00:00:00Z' } }) });
  assert.equal((await expired.challengeTOTP({ requestContext: {}, token: TOKEN })).outcome, 'unavailable');
  assert.equal(repositoryCalls, 0);
  assert.equal((await service.challengeTOTP({ requestContext: null, token: TOKEN })).outcome, 'rejected');
  assert.equal(repositoryCalls, 0);
});
