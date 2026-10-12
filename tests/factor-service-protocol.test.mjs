import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { encryptFactorSecret, decryptFactorSecret, createRecoveryCodeDigest } from '../lib/factor-storage.mjs';
import { createFactorKeyProvider } from '../lib/factor-key-provider.mjs';
import { verifyFactorCandidate } from '../lib/factor-verifier.mjs';
import { createFactorServiceProtocol, PROPOSED_FACTOR_RATE_POLICY } from '../lib/factor-service-protocol.mjs';
import { createFactorEnrollmentProtocol } from '../lib/factor-enrollment-protocol.mjs';
import { createFactorEnrollmentResumeProtocol } from '../lib/factor-enrollment-resume-protocol.mjs';
import { validateFactorEnrollmentAcknowledgment, validateFactorEnrollmentRequest } from '../lib/factor-enrollment-contract.mjs';

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
  const h = harness({ keyProvider: createFactorKeyProvider({ environment: 'local', env: {
    GROUND_FACTOR_ENVELOPE_KEY: KEY.toString('base64url'), GROUND_FACTOR_KEY_ID: 'local-test-v1',
  } }) });
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

  const enrollmentOperationId = '00000000-0000-4000-8000-000000000003';
  const begin = validateFactorEnrollmentRequest('begin', { operationId: enrollmentOperationId });
  assert.deepEqual(begin, { ok: true, operationId: enrollmentOperationId });
  assert.equal(Object.isFrozen(begin), true);
  const letterOperationId = 'abcdefab-cdef-4abc-8abc-abcdefabcdef';
  const upperLetterOperationId = letterOperationId.toUpperCase();
  assert.deepEqual(validateFactorEnrollmentRequest('begin', { operationId: upperLetterOperationId }),
    { ok: true, operationId: letterOperationId });
  assert.equal(validateFactorEnrollmentRequest('begin', { operationId: enrollmentOperationId, role: 'owner' }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('begin', { operationId: 'not-a-uuid' }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('begin', { operationId: `${enrollmentOperationId}\n` }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('begin', { operationId: `${enrollmentOperationId}\r\n` }).ok, false);

  const verify = validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: TOKEN });
  assert.equal(verify.ok, true);
  assert.equal(verify.operationId, enrollmentOperationId);
  assert.equal(verify.code, TOKEN);
  assert.equal(Object.isFrozen(verify), true);
  assert.deepEqual(Object.keys(verify), ['ok', 'operationId']);
  assert.equal(JSON.stringify(verify).includes(TOKEN), false);
  const uppercaseVerify = validateFactorEnrollmentRequest('verify', { operationId: upperLetterOperationId, code: TOKEN });
  assert.equal(uppercaseVerify.ok, true);
  assert.equal(uppercaseVerify.operationId, letterOperationId);
  assert.equal(validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: '12x' }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: `${TOKEN}\n` }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: `${TOKEN}\r\n` }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: TOKEN, factorId: FACTOR }).ok, false);
  assert.equal(validateFactorEnrollmentRequest('verify', { operationId: enrollmentOperationId, code: TOKEN, expiresAt: Infinity }).ok, false);

  assert.deepEqual(validateFactorEnrollmentAcknowledgment('begin', enrollmentOperationId,
    { operationId: enrollmentOperationId, outcome: 'pending' }),
    { ok: true, operationId: enrollmentOperationId, outcome: 'pending' });
  assert.deepEqual(validateFactorEnrollmentAcknowledgment('begin', upperLetterOperationId,
    { operationId: letterOperationId, outcome: 'pending' }),
    { ok: true, operationId: letterOperationId, outcome: 'pending' });
  assert.deepEqual(validateFactorEnrollmentAcknowledgment('verify', letterOperationId,
    { operationId: upperLetterOperationId, outcome: 'verified' }),
    { ok: true, operationId: letterOperationId, outcome: 'verified' });
  assert.equal(validateFactorEnrollmentAcknowledgment('begin', enrollmentOperationId,
    { operationId: enrollmentOperationId, outcome: 'verified' }).ok, false);
  assert.equal(validateFactorEnrollmentAcknowledgment('verify', enrollmentOperationId,
    { operationId: enrollmentOperationId, outcome: 'pending' }).ok, false);
  assert.equal(validateFactorEnrollmentAcknowledgment('verify', enrollmentOperationId,
    { operationId: '00000000-0000-4000-8000-000000000004', outcome: 'verified' }).ok, false);
  assert.equal(validateFactorEnrollmentAcknowledgment('verify', `${enrollmentOperationId}\n`,
    { operationId: enrollmentOperationId, outcome: 'verified' }).ok, false);
  assert.equal(validateFactorEnrollmentAcknowledgment('verify', enrollmentOperationId,
    { operationId: `${enrollmentOperationId}\r\n`, outcome: 'verified' }).ok, false);
  const unknownAck = validateFactorEnrollmentAcknowledgment('verify', enrollmentOperationId,
    { operationId: enrollmentOperationId, outcome: 'unknown' });
  assert.deepEqual(unknownAck, { ok: true, operationId: enrollmentOperationId, outcome: 'unknown',
    mutationRetryAllowed: false, resolution: 'status_lookup_required' });
  assert.equal(Object.isFrozen(unknownAck), true);
  assert.equal(validateFactorEnrollmentAcknowledgment('verify', enrollmentOperationId,
    { operationId: enrollmentOperationId, outcome: 'verified', code: TOKEN, accountId: ACCOUNT, securityEpoch: 4 }).ok, false);
  assert.equal(JSON.stringify(unknownAck).includes(TOKEN), false);

  let getterCalled = false;
  const getterInput = Object.defineProperty({}, 'operationId', { get() {
    getterCalled = true;
    return enrollmentOperationId;
  } });
  assert.equal(validateFactorEnrollmentRequest('begin', getterInput).ok, false);
  assert.equal(getterCalled, false);
  const symbolInput = { operationId: enrollmentOperationId, [Symbol('extra')]: true };
  assert.equal(validateFactorEnrollmentRequest('begin', symbolInput).ok, false);

  const realContext = { environment: 'local', accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 5 };
  const privateEncryptInput = { keyId: 'local-test-v1', context: realContext };
  Object.defineProperties(privateEncryptInput, {
    secret: { value: SECRET, enumerable: false }, key: { value: KEY, enumerable: false },
  });
  const realEnvelope = encryptFactorSecret(privateEncryptInput);
  const privateDecryptInput = { envelope: realEnvelope, keyId: 'local-test-v1', context: realContext };
  Object.defineProperty(privateDecryptInput, 'key', { value: KEY, enumerable: false });
  assert.equal(decryptFactorSecret(privateDecryptInput), SECRET);
  assert.deepEqual(await verifyFactorCandidate({ secret: SECRET, token: TOKEN,
    epochSeconds: 59, lastAcceptedStep: null }), { valid: true, matchedStep: 1 });

  const enrollmentIdentity = Object.freeze({ issuer:
    'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
    subject: '00000000-0000-4000-8000-000000000010', sessionId: '00000000-0000-4000-8000-000000000011',
    expiresAt: '2030-01-01T00:00:00Z' });
  let resolvedIdentity = enrollmentIdentity;
  const beginId = '00000000-0000-4000-8000-000000000012';
  const verifyId = '00000000-0000-4000-8000-000000000013';
  const enrollmentKey = Buffer.from(KEY);
  const mutableKeyRecord = { keyId: 'local-test-v1', key: Buffer.from(enrollmentKey) };
  const persisted = { epoch: 4, factor: null, envelope: null, rateLimited: false };
  let throwAfterBeginCommit = false;
  let beginAckOverride = null;
  let verifyAckOverride = null;
  let beginBindingDrift = null;
  let mutateSessionAtClock = false;
  let clockMutation = null;
  let mutateKeyRecord = true;
  let keyMutation = null;
  let envelopeMutation = null;
  let beginAckMutation = null;
  let pendingMutation = null;
  let verifyAckMutation = null;
  let receiptMutation = null;
  const repositoryCalls = [];
  const observedSubjects = [];
  const enrollmentRepository = {
    async readEnrollmentContext(identity) {
      observedSubjects.push(identity.subject);
      const value = { accountId: ACCOUNT, role: 'owner', accountStatus: 'active', securityEpoch: persisted.epoch,
        anyLiveFactor: persisted.factor !== null, rateLimited: persisted.rateLimited, factor: persisted.factor };
      return value;
    },
    async readPendingFactor(_identity, query) {
      repositoryCalls.push(['pending', query]);
      const value = { accountId: ACCOUNT, factorId: persisted.factor.factorId, securityEpoch: persisted.epoch,
        state: 'pending', keyId: 'local-test-v1', envelope: { ...persisted.envelope }, lastAcceptedStep: null,
        beginOperationId: persisted.factor.beginOperationId, requestFingerprint: persisted.factor.requestFingerprint };
      pendingMutation = () => { value.accountId = '99999999-9999-4999-8999-999999999999'; value.envelope.ciphertext = 'invalid'; };
      return value;
    },
    async beginEnrollment(_identity, input) {
      repositoryCalls.push(['begin', input]);
      if (beginAckOverride) return beginAckOverride;
      persisted.epoch = input.targetEpoch;
      persisted.envelope = input.encryptedSecret;
      persisted.factor = { factorId: input.candidateFactorId, securityEpoch: input.targetEpoch,
        state: 'pending', lastAcceptedStep: null, beginOperationId: input.operationId,
        requestFingerprint: input.requestFingerprint, sessionAttested: false };
      if (beginBindingDrift === 'operationId') {
        persisted.factor.beginOperationId = '00000000-0000-4000-8000-000000000099';
        beginBindingDrift = null;
      } else if (beginBindingDrift === 'fingerprint') {
        const fingerprint = persisted.factor.requestFingerprint;
        persisted.factor.requestFingerprint = `${fingerprint[0] === 'A' ? 'B' : 'A'}${fingerprint.slice(1)}`;
        beginBindingDrift = null;
      }
      if (throwAfterBeginCommit) throw new Error('opaque writer failure');
      const value = { status: 'committed', operationId: input.operationId, kind: 'begin', accountId: ACCOUNT,
        factorId: input.candidateFactorId, securityEpoch: input.targetEpoch,
        requestFingerprint: input.requestFingerprint };
      beginAckMutation = () => { value.status = 'rejected'; };
      return value;
    },
    async recordEnrollmentAttempt(_identity, input) {
      repositoryCalls.push(['attempt', input]);
      return { status: 'recorded', operationId: input.operationId, kind: 'verify', accountId: ACCOUNT,
        factorId: input.expectedFactorId, securityEpoch: input.expectedSecurityEpoch,
        requestFingerprint: input.requestFingerprint };
    },
    async verifyEnrollment(_identity, input) {
      repositoryCalls.push(['verify', input]);
      if (verifyAckOverride) return verifyAckOverride;
      persisted.factor = { ...persisted.factor, state: 'verified', lastAcceptedStep: input.matchedStep,
        sessionAttested: true };
      const value = { status: 'committed', operationId: input.operationId, kind: 'verify', accountId: ACCOUNT,
        factorId: input.expectedFactorId, securityEpoch: input.expectedSecurityEpoch,
        requestFingerprint: input.requestFingerprint };
      verifyAckMutation = () => { value.status = 'rejected'; };
      return value;
    },
    async readEnrollmentReceipt(identity, query) {
      repositoryCalls.push(['receipt', query]);
      if (query.kind === 'begin' && persisted.factor?.beginOperationId === query.operationId) {
        const value = { status: 'pending', operationId: query.operationId, kind: 'begin', accountId: ACCOUNT,
          issuer: identity.issuer, subject: identity.subject, sessionId: identity.sessionId,
          factorId: persisted.factor.factorId, securityEpoch: persisted.factor.securityEpoch,
          requestFingerprint: persisted.factor.requestFingerprint };
        receiptMutation = () => { value.status = 'unknown'; value.factorId = '99999999-9999-4999-8999-999999999999'; };
        return value;
      }
      return { status: 'not_found', operationId: query.operationId, kind: query.kind, accountId: ACCOUNT,
        issuer: identity.issuer, subject: identity.subject, sessionId: identity.sessionId,
        factorId: null, securityEpoch: null, requestFingerprint: null };
    },
  };
  const enrollmentProtocol = createFactorEnrollmentProtocol({ environment: 'local',
    resolveSession: async () => {
      for (const key of ['keyMutation', 'envelopeMutation', 'beginAckMutation',
        'pendingMutation', 'verifyAckMutation', 'receiptMutation']) {
        if (key === 'keyMutation' && keyMutation) { const mutate = keyMutation; keyMutation = null; mutate(); }
        else if (key === 'envelopeMutation' && envelopeMutation) { const mutate = envelopeMutation; envelopeMutation = null; mutate(); }
        else if (key === 'beginAckMutation' && beginAckMutation) { const mutate = beginAckMutation; beginAckMutation = null; mutate(); }
        else if (key === 'pendingMutation' && pendingMutation) { const mutate = pendingMutation; pendingMutation = null; mutate(); }
        else if (key === 'verifyAckMutation' && verifyAckMutation) { const mutate = verifyAckMutation; verifyAckMutation = null; mutate(); }
        else if (key === 'receiptMutation' && receiptMutation) { const mutate = receiptMutation; receiptMutation = null; mutate(); }
      }
      const value = { ok: true, identity: { ...resolvedIdentity } };
      if (mutateSessionAtClock) {
        mutateSessionAtClock = false;
        clockMutation = () => { value.identity.subject = '99999999-9999-4999-8999-999999999999'; };
      }
      return value;
    }, repository: enrollmentRepository,
    secretGenerator: { async generate() { return SECRET; } },
    keyProvider: { async getKey() {
      if (mutateKeyRecord) {
        mutateKeyRecord = false;
        keyMutation = () => { mutableKeyRecord.keyId = 'invalid\n'; mutableKeyRecord.key.fill(0); };
      }
      return mutableKeyRecord;
    } },
    encryptor: { async encrypt(input) {
      const value = { ...encryptFactorSecret(input) };
      envelopeMutation = () => { value.ciphertext = 'invalid'; };
      return value;
    } }, decryptor: { decrypt: decryptFactorSecret },
    totpVerifier: { verifyCandidate: verifyFactorCandidate },
    fingerprint: { async create(payload) {
      return createHmac('sha256', Buffer.alloc(32, 0x6b)).update(JSON.stringify({ ...payload,
        code: payload.code })).digest('base64url');
    } }, clock: () => {
      if (clockMutation) { const mutate = clockMutation; clockMutation = null; mutate(); }
      return new Date(59_000);
    },
  });
  resolvedIdentity = { ...enrollmentIdentity, issuer: `${enrollmentIdentity.issuer}/other` };
  assert.equal((await enrollmentProtocol.begin({}, { operationId: beginId })).outcome, 'unavailable');
  assert.equal(repositoryCalls.length, 0);
  resolvedIdentity = enrollmentIdentity;
  mutateSessionAtClock = true;
  const provisioned = await enrollmentProtocol.begin({}, { operationId: beginId });
  assert.deepEqual({ ok: provisioned.ok, operationId: provisioned.operationId, outcome: provisioned.outcome },
    { ok: true, operationId: beginId, outcome: 'pending' });
  assert.equal(Object.keys(provisioned).includes('provisioningSecret'), false);
  assert.equal(provisioned.provisioningSecret, SECRET);
  assert.equal(JSON.stringify(provisioned).includes(SECRET), false);
  assert.equal(observedSubjects.every(subject => subject === enrollmentIdentity.subject), true);
  mutableKeyRecord.keyId = 'local-test-v1';
  mutableKeyRecord.key = Buffer.from(enrollmentKey);
  const receiptSnapshot = await enrollmentProtocol.begin({}, { operationId: beginId });
  assert.deepEqual(receiptSnapshot, { ok: true, operationId: beginId, outcome: 'pending' });
  persisted.factor.requestFingerprint = `${persisted.factor.requestFingerprint}\n`;
  const callsBeforeBadFingerprint = repositoryCalls.length;
  assert.equal((await enrollmentProtocol.verify({}, { operationId: '00000000-0000-4000-8000-000000000016', code: TOKEN })).outcome,
    'unavailable');
  assert.equal(repositoryCalls.length, callsBeforeBadFingerprint);
  persisted.factor.requestFingerprint = persisted.factor.requestFingerprint.slice(0, -1);
  persisted.rateLimited = true;
  const throttled = await enrollmentProtocol.verify({}, { operationId: '00000000-0000-4000-8000-000000000014', code: TOKEN });
  assert.equal(throttled.outcome, 'rejected');
  assert.equal(repositoryCalls.filter(([name]) => name === 'pending').length, 0);
  assert.equal(repositoryCalls.find(([name]) => name === 'attempt')[1].reason, 'throttled');
  persisted.rateLimited = false;
  const verified = await enrollmentProtocol.verify({}, { operationId: verifyId, code: TOKEN });
  assert.deepEqual(verified, { ok: true, operationId: verifyId, outcome: 'verified' });
  mutableKeyRecord.keyId = 'local-test-v1';
  mutableKeyRecord.key = Buffer.from(enrollmentKey);
  assert.deepEqual(repositoryCalls.filter(([name]) => ['begin', 'verify'].includes(name)).map(([name]) => name),
    ['begin', 'verify']);
  assert.equal(repositoryCalls.some(([name, input]) => name === 'pending' && input.expectedBeginOperationId === beginId), true);

  persisted.epoch = 4;
  persisted.factor = null;
  persisted.envelope = null;
  const callsBeforeUncertainBegin = repositoryCalls.length;
  throwAfterBeginCommit = true;
  const uncertainBegin = await enrollmentProtocol.begin({}, { operationId: '00000000-0000-4000-8000-000000000015' });
  throwAfterBeginCommit = false;
  assert.deepEqual(uncertainBegin, { ok: true, operationId: '00000000-0000-4000-8000-000000000015', outcome: 'pending' });
  assert.equal(Object.hasOwn(uncertainBegin, 'provisioningSecret'), false);
  assert.equal(repositoryCalls.slice(callsBeforeUncertainBegin).filter(([name]) => name === 'begin').length, 1);
  assert.equal(repositoryCalls.slice(callsBeforeUncertainBegin).filter(([name]) => name === 'receipt').length, 2);

  for (const [drift, operationId] of [
    ['operationId', '00000000-0000-4000-8000-000000000019'],
    ['fingerprint', '00000000-0000-4000-8000-00000000001a'],
  ]) {
    persisted.epoch = 4;
    persisted.factor = null;
    persisted.envelope = null;
    beginBindingDrift = drift;
    const callsBeforeBindingDrift = repositoryCalls.length;
    const driftedBegin = await enrollmentProtocol.begin({}, { operationId });
    assert.equal(driftedBegin.outcome, 'unknown');
    assert.equal(Object.hasOwn(driftedBegin, 'provisioningSecret'), false);
    assert.equal(repositoryCalls.slice(callsBeforeBindingDrift).filter(([name]) => name === 'begin').length, 1);
  }

  const callsBeforeMalformedVerifyAck = repositoryCalls.length;
  verifyAckOverride = { status: 'rejected', operationId: verifyId };
  const malformedVerifyAck = await enrollmentProtocol.verify({}, { operationId: '00000000-0000-4000-8000-000000000017', code: TOKEN });
  verifyAckOverride = null;
  assert.equal(malformedVerifyAck.outcome, 'unknown');
  assert.equal(repositoryCalls.slice(callsBeforeMalformedVerifyAck).filter(([name]) => name === 'verify').length, 1);
  assert.equal(repositoryCalls.slice(callsBeforeMalformedVerifyAck).filter(([name]) => name === 'receipt').length, 2);

  persisted.epoch = 4;
  persisted.factor = null;
  persisted.envelope = null;
  const callsBeforeMalformedBeginAck = repositoryCalls.length;
  beginAckOverride = { status: 'rejected' };
  const malformedBeginAck = await enrollmentProtocol.begin({}, { operationId: '00000000-0000-4000-8000-000000000018' });
  beginAckOverride = null;
  assert.equal(malformedBeginAck.outcome, 'unknown');
  assert.equal(repositoryCalls.slice(callsBeforeMalformedBeginAck).filter(([name]) => name === 'begin').length, 1);
  assert.equal(repositoryCalls.slice(callsBeforeMalformedBeginAck).filter(([name]) => name === 'receipt').length, 2);

  const resumeId = '00000000-0000-4000-8000-000000000020';
  const resumeBeginId = beginId;
  const beginFingerprint = createHmac('sha256', Buffer.alloc(32, 0x6b))
    .update('resume-test-begin').digest('base64url');
  const makeResumeHarness = ({ materialStatuses = ['not_found'], writerThrows = false,
    afterWriter = null, afterDecrypt = null, materialFingerprintMismatch = false,
    mutateReceiptAfterRead = false, ackStatus = 'released', newlyCommitted = true,
    decryptor = { async decrypt(input) { return decryptFactorSecret(input); } },
    resolveSession = async () => ({ ok: true, identity: { ...enrollmentIdentity } }) } = {}) => {
    const calls = [];
    const state = { epoch: 5, role: 'owner', sessionValid: true, factorState: 'pending',
      materialStatuses: [...materialStatuses], requestFingerprint: null };
    let materialReads = 0;
    let lastMaterialReceipt = null;
    let mutateReceiptOnResolve = false;
    const materialReceipt = (status, identity, input) => ({ status, operationId: input.operationId, kind: 'resume',
      accountId: ACCOUNT, issuer: identity.issuer, subject: identity.subject, sessionId: identity.sessionId,
      factorId: status === 'not_found' ? null : FACTOR,
      securityEpoch: status === 'not_found' ? null : 5, beginOperationId: resumeBeginId,
      requestFingerprint: status === 'not_found' ? null : state.requestFingerprint });
    const repository = {
      async readEnrollmentContext(identity) {
        calls.push(['context', identity.sessionId]);
        return { accountId: ACCOUNT, role: state.role, accountStatus: 'active', securityEpoch: state.epoch,
          anyLiveFactor: true, rateLimited: false, factor: { factorId: FACTOR, securityEpoch: 5,
            state: state.factorState, lastAcceptedStep: null, beginOperationId: resumeBeginId,
            requestFingerprint: beginFingerprint, sessionAttested: false } };
      },
      async readEnrollmentReceipt(identity, input) {
        calls.push(['begin-receipt', input]);
        assert.equal(input.operationId, resumeBeginId);
        assert.equal(input.expectedAccountId, ACCOUNT);
        assert.equal(input.expectedFactorId, null);
        assert.equal(input.expectedSecurityEpoch, null);
        return { status: 'pending', operationId: resumeBeginId, kind: 'begin', accountId: ACCOUNT,
          issuer: identity.issuer, subject: identity.subject, sessionId: identity.sessionId,
          factorId: FACTOR, securityEpoch: 5, requestFingerprint: beginFingerprint };
      },
      async readMaterialReceipt(identity, input) {
        calls.push(['material-receipt', input]);
        materialReads++;
        const status = state.materialStatuses.shift() ?? 'not_found';
        lastMaterialReceipt = materialReceipt(status, identity, input);
        if (materialFingerprintMismatch && materialReads > 1 && status !== 'not_found') {
          lastMaterialReceipt.requestFingerprint = createHmac('sha256', Buffer.alloc(32, 0x6b))
            .update('wrong-resume-fingerprint').digest('base64url');
        }
        if (mutateReceiptAfterRead && status !== 'not_found') mutateReceiptOnResolve = true;
        return lastMaterialReceipt;
      },
      async readPendingFactor(identity, input) {
        calls.push(['pending', input]);
        return { accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 5, state: 'pending',
          keyId: 'local-test-v1', envelope: { ...realEnvelope }, lastAcceptedStep: null,
          beginOperationId: resumeBeginId, requestFingerprint: beginFingerprint };
      },
      async releaseMaterial(identity, input) {
        calls.push(['release', input]);
        state.requestFingerprint = input.requestFingerprint;
        if (afterWriter) afterWriter(state);
        if (writerThrows) throw new Error('opaque writer result');
        return { status: ackStatus, operationId: input.operationId, kind: 'resume', accountId: ACCOUNT,
          factorId: FACTOR, securityEpoch: 5, requestFingerprint: input.requestFingerprint,
          beginOperationId: resumeBeginId, newlyCommitted };
      },
    };
    const protocol = createFactorEnrollmentResumeProtocol({ environment: 'local', resolveSession: async (...args) => {
      if (mutateReceiptOnResolve && lastMaterialReceipt) {
        lastMaterialReceipt.status = 'not_found';
        lastMaterialReceipt.factorId = null;
        lastMaterialReceipt.securityEpoch = null;
        lastMaterialReceipt.requestFingerprint = null;
        mutateReceiptOnResolve = false;
      }
      return state.sessionValid ? resolveSession(...args) : { ok: false, identity: null };
    },
      repository, keyProvider: { async getKey(input) {
        calls.push(['key', input]);
        return { keyId: 'local-test-v1', key: Buffer.from(KEY) };
      } }, decryptor: { async decrypt(input) {
        calls.push(['decrypt']);
        const value = await decryptor.decrypt(input);
        if (afterDecrypt) afterDecrypt(state);
        return value;
      } },
      fingerprint: { async create(payload) {
        calls.push(['fingerprint', payload]);
        return createHmac('sha256', Buffer.alloc(32, 0x6b)).update(JSON.stringify(payload)).digest('base64url');
      } }, clock: () => new Date('2026-10-11T12:00:00.000Z') });
    return { protocol, calls, state, repository };
  };

  const successfulResume = makeResumeHarness();
  successfulResume.repository.readEnrollmentContext = async () => null;
  const successfulRelease = await successfulResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(successfulRelease.ok, true, `${JSON.stringify(successfulRelease)} calls=${successfulResume.calls.map(([name]) => name).join(',')}`);
  assert.equal(successfulRelease.outcome, 'released');
  assert.equal(successfulRelease.pendingSetupSecret, SECRET);
  assert.equal(Object.isFrozen(successfulRelease), true);
  assert.equal(Object.keys(successfulRelease).includes('pendingSetupSecret'), false);
  assert.equal(JSON.stringify(successfulRelease).includes(SECRET), false);
  assert.equal(successfulResume.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(successfulResume.calls.filter(([name]) => name === 'key').length, 1);
  assert.equal(successfulResume.calls.filter(([name]) => name === 'decrypt').length, 1);
  assert.equal(successfulResume.calls.findIndex(([name]) => name === 'release') <
    successfulResume.calls.findIndex(([name]) => name === 'key'), true);

  const closedResume = makeResumeHarness();
  assert.equal((await closedResume.protocol.resume({}, { operationId: `${resumeId}\n`, beginOperationId: resumeBeginId })).outcome,
    'rejected');
  assert.equal((await closedResume.protocol.resume({}, { operationId: resumeId,
    beginOperationId: resumeBeginId, accountId: ACCOUNT })).outcome, 'rejected');
  assert.equal((await closedResume.protocol.resume({}, { operationId: resumeBeginId,
    beginOperationId: resumeBeginId })).outcome, 'rejected');
  assert.equal(closedResume.calls.length, 0);

  const statusOnlyResume = makeResumeHarness({ materialStatuses: ['released'], mutateReceiptAfterRead: true });
  statusOnlyResume.state.factorState = 'verified';
  statusOnlyResume.state.epoch = 6;
  statusOnlyResume.state.requestFingerprint = createHmac('sha256', Buffer.alloc(32, 0x6b))
    .update('historical-resume').digest('base64url');
  const statusOnly = await statusOnlyResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(statusOnly.outcome, 'released');
  assert.equal(Object.hasOwn(statusOnly, 'pendingSetupSecret'), false);
  assert.equal(statusOnlyResume.calls.some(([name]) => ['pending', 'release', 'key', 'decrypt'].includes(name)), false);

  const lostAckFingerprint = makeResumeHarness({ materialStatuses: ['not_found', 'released'],
    writerThrows: true, materialFingerprintMismatch: true });
  const mismatchedReceipt = await lostAckFingerprint.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(mismatchedReceipt.outcome, 'unknown');
  assert.equal(Object.hasOwn(mismatchedReceipt, 'pendingSetupSecret'), false);
  assert.equal(lostAckFingerprint.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(lostAckFingerprint.calls.filter(([name]) => name === 'material-receipt').length, 2);
  assert.equal(lostAckFingerprint.calls.some(([name]) => ['key', 'decrypt'].includes(name)), false);

  const uncertainResume = makeResumeHarness({ materialStatuses: ['not_found', 'released'], writerThrows: true });
  const uncertainRelease = await uncertainResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(uncertainRelease.outcome, 'released');
  assert.equal(Object.hasOwn(uncertainRelease, 'pendingSetupSecret'), false);
  assert.equal(uncertainResume.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(uncertainResume.calls.filter(([name]) => name === 'material-receipt').length, 2);
  assert.equal(uncertainResume.calls.some(([name]) => ['key', 'decrypt'].includes(name)), false);

  const driftedResume = makeResumeHarness({ afterWriter(state) {
    state.factorState = 'verified';
    state.epoch = 6;
  } });
  const driftedRelease = await driftedResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(driftedRelease.outcome, 'unknown');
  assert.equal(Object.hasOwn(driftedRelease, 'pendingSetupSecret'), false);
  assert.equal(driftedResume.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(driftedResume.calls.some(([name]) => name === 'decrypt'), false);

  const delayedDriftResume = makeResumeHarness({ afterDecrypt(state) {
    state.factorState = 'verified';
    state.epoch = 6;
  } });
  const delayedDrift = await delayedDriftResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(delayedDrift.outcome, 'unknown');
  assert.equal(Object.hasOwn(delayedDrift, 'pendingSetupSecret'), false);
  assert.equal(delayedDriftResume.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(delayedDriftResume.calls.filter(([name]) => name === 'key').length, 1);
  assert.equal(delayedDriftResume.calls.filter(([name]) => name === 'decrypt').length, 1);

  const roleDriftResume = makeResumeHarness({ afterWriter(state) { state.role = 'admin'; } });
  const roleDrift = await roleDriftResume.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(roleDrift.outcome, 'unknown');
  assert.equal(Object.hasOwn(roleDrift, 'pendingSetupSecret'), false);
  assert.equal(roleDriftResume.calls.some(([name]) => ['key', 'decrypt'].includes(name)), false);

  const sessionLostReplay = makeResumeHarness({ ackStatus: 'released', newlyCommitted: false,
    afterWriter(state) { state.sessionValid = false; } });
  const withheldReplay = await sessionLostReplay.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(withheldReplay.outcome, 'unknown');
  assert.equal(Object.hasOwn(withheldReplay, 'pendingSetupSecret'), false);

  const sessionLostRejection = makeResumeHarness({ ackStatus: 'rejected', newlyCommitted: false,
    afterWriter(state) { state.sessionValid = false; } });
  const withheldRejection = await sessionLostRejection.protocol.resume({}, {
    operationId: resumeId, beginOperationId: resumeBeginId,
  });
  assert.equal(withheldRejection.outcome, 'unknown');
  assert.equal(Object.hasOwn(withheldRejection, 'pendingSetupSecret'), false);

  let configGetterCalled = false;
  const invalidConfig = {};
  for (const [name, value] of Object.entries({ resolveSession: async () => ({}),
    repository: {}, keyProvider: {}, decryptor: {}, fingerprint: {}, clock: () => new Date() })) {
    Object.defineProperty(invalidConfig, name, { value, enumerable: true });
  }
  Object.defineProperty(invalidConfig, 'environment', { enumerable: true, get() {
    configGetterCalled = true;
    return 'local';
  } });
  assert.throws(() => createFactorEnrollmentResumeProtocol(invalidConfig), /Invalid factor enrollment resume configuration/);
  assert.equal(configGetterCalled, false);
});
