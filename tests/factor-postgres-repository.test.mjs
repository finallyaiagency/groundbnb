import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptFactorSecret, createRecoveryCodeDigest } from '../lib/factor-storage.mjs';
import { createFactorPostgresRepository } from '../lib/factor-postgres-repository.mjs';
import { createFactorEnrollmentPostgresRepository, createFactorEnrollmentResumePostgresRepository } from '../lib/factor-enrollment-postgres-repository.mjs';
import { createFactorEnrollmentResumeProtocol } from '../lib/factor-enrollment-resume-protocol.mjs';
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

  const ENROLLMENT_SUBJECT = '00000000-0000-4000-8000-000000000011';
  const ENROLLMENT_SESSION = '00000000-0000-4000-8000-000000000012';
  const BEGIN_OPERATION = '00000000-0000-4000-8000-000000000013';
  const ATTEMPT_OPERATION = '00000000-0000-4000-8000-000000000014';
  const VERIFY_OPERATION = '00000000-0000-4000-8000-000000000015';
  const REJECTED_ATTEMPT_OPERATION = '00000000-0000-4000-8000-000000000017';
  const BARE_ATTEMPT_OPERATION = '00000000-0000-4000-8000-000000000018';
  const CANDIDATE_FACTOR = '00000000-0000-4000-8000-000000000016';
  const FINGERPRINT = 'A'.repeat(43);
  const ENROLLMENT_IDENTITY = Object.freeze({
    issuer: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
    subject: ENROLLMENT_SUBJECT, sessionId: ENROLLMENT_SESSION, expiresAt: EXPIRY,
  });
  const ENROLLMENT_CONTEXT = { accountId: ACCOUNT, role: 'admin', accountStatus: 'active', securityEpoch: 4,
    anyLiveFactor: false, rateLimited: false, factor: null };
  const PENDING_FACTOR = { accountId: ACCOUNT, factorId: FACTOR, securityEpoch: 4, state: 'pending',
    keyId: 'local-test-v1', envelope: ENVELOPE, lastAcceptedStep: null,
    beginOperationId: BEGIN_OPERATION, requestFingerprint: FINGERPRINT };
  const ACK = (operationId, kind, factorId, securityEpoch) => ({ status: 'committed', operationId,
    kind, accountId: ACCOUNT, factorId, securityEpoch, requestFingerprint: FINGERPRINT });
  const RECORD_ACK = { ...ACK(ATTEMPT_OPERATION, 'verify', FACTOR, 4), status: 'recorded' };
  const REJECTED_RECORD_ACK = { ...ACK(REJECTED_ATTEMPT_OPERATION, 'verify', FACTOR, 4), status: 'rejected' };
  const NOT_FOUND_RECEIPT = { status: 'not_found', operationId: BEGIN_OPERATION, kind: 'begin', accountId: ACCOUNT,
    issuer: ENROLLMENT_IDENTITY.issuer, subject: ENROLLMENT_SUBJECT, sessionId: ENROLLMENT_SESSION,
    factorId: null, securityEpoch: null, requestFingerprint: null };
  const enrollmentCalls = [];
  const enrollmentResponses = [ENROLLMENT_CONTEXT, PENDING_FACTOR,
    ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5), RECORD_ACK, REJECTED_RECORD_ACK,
    { status: 'recorded' },
    ACK(VERIFY_OPERATION, 'verify', FACTOR, 4), NOT_FOUND_RECEIPT];
  const enrollmentRepository = createFactorEnrollmentPostgresRepository('local', async (statement, values) => {
    enrollmentCalls.push({ statement, values });
    return enrollmentResponses.shift();
  });
  assert.deepEqual(Object.keys(enrollmentRepository).sort(), [
    'beginEnrollment', 'readEnrollmentContext', 'readEnrollmentReceipt', 'readPendingFactor',
    'recordEnrollmentAttempt', 'verifyEnrollment',
  ]);
  assert.deepEqual(await enrollmentRepository.readEnrollmentContext(ENROLLMENT_IDENTITY), ENROLLMENT_CONTEXT);
  assert.deepEqual(await enrollmentRepository.readPendingFactor(ENROLLMENT_IDENTITY, {
    expectedAccountId: ACCOUNT, expectedFactorId: FACTOR, expectedSecurityEpoch: 4,
    expectedBeginOperationId: BEGIN_OPERATION,
  }), PENDING_FACTOR);
  assert.deepEqual(await enrollmentRepository.beginEnrollment(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT, expectedCurrentEpoch: 4, targetEpoch: 5,
    candidateFactorId: CANDIDATE_FACTOR, requestFingerprint: FINGERPRINT, envelopeKeyId: 'local-test-v1',
    encryptedSecret: ENVELOPE,
  }), ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5));
  assert.deepEqual(await enrollmentRepository.recordEnrollmentAttempt(ENROLLMENT_IDENTITY, {
    operationId: ATTEMPT_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, requestFingerprint: FINGERPRINT, reason: 'invalid',
  }), RECORD_ACK);
  assert.deepEqual(await enrollmentRepository.recordEnrollmentAttempt(ENROLLMENT_IDENTITY, {
    operationId: REJECTED_ATTEMPT_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, requestFingerprint: FINGERPRINT, reason: 'invalid',
  }), REJECTED_RECORD_ACK);
  assert.deepEqual(await enrollmentRepository.recordEnrollmentAttempt(ENROLLMENT_IDENTITY, {
    operationId: BARE_ATTEMPT_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, requestFingerprint: FINGERPRINT, reason: 'invalid',
  }), { status: 'unknown' });
  assert.deepEqual(await enrollmentRepository.verifyEnrollment(ENROLLMENT_IDENTITY, {
    operationId: VERIFY_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, requestFingerprint: FINGERPRINT, matchedStep: 123,
  }), ACK(VERIFY_OPERATION, 'verify', FACTOR, 4));
  assert.deepEqual(await enrollmentRepository.readEnrollmentReceipt(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, kind: 'begin', expectedAccountId: ACCOUNT,
    expectedFactorId: null, expectedSecurityEpoch: null,
  }), NOT_FOUND_RECEIPT);
  assert.deepEqual(enrollmentCalls.map(call => call.statement), [
    'SELECT groundbnb.read_factor_enrollment_context($1,$2,$3,$4::timestamptz) AS result',
    'SELECT groundbnb.read_pending_factor_for_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::bigint) AS result',
    'SELECT groundbnb.begin_factor_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::bigint,$7::bigint,$8::uuid,$9::uuid,$10::bytea,$11,$12::jsonb) AS result',
    'SELECT groundbnb.record_factor_enrollment_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11) AS result',
    'SELECT groundbnb.record_factor_enrollment_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11) AS result',
    'SELECT groundbnb.record_factor_enrollment_attempt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11) AS result',
    'SELECT groundbnb.verify_factor_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10::bytea,$11::bigint) AS result',
    'SELECT groundbnb.read_factor_enrollment_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6,$7::uuid,$8::uuid,$9::bigint) AS result',
  ]);
  assert.equal(enrollmentCalls.every(call => !/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(call.statement)), true);
  const enrollmentPrefix = [ENROLLMENT_IDENTITY.issuer, ENROLLMENT_SUBJECT, ENROLLMENT_SESSION, EXPIRY];
  assert.deepEqual(enrollmentCalls[0].values, enrollmentPrefix);
  assert.deepEqual(enrollmentCalls[1].values, [...enrollmentPrefix, BEGIN_OPERATION, ACCOUNT, FACTOR, 4]);
  assert.deepEqual(enrollmentCalls[2].values.slice(0, 9), [ENROLLMENT_IDENTITY.issuer, ENROLLMENT_SUBJECT,
    ENROLLMENT_SESSION, EXPIRY, ACCOUNT, 4, 5, CANDIDATE_FACTOR, BEGIN_OPERATION]);
  assert.equal(Buffer.isBuffer(enrollmentCalls[2].values[9]), true);
  assert.equal(enrollmentCalls[2].values[9].length, 32);
  assert.equal(enrollmentCalls[2].values[10], 'local-test-v1');
  assert.deepEqual(JSON.parse(enrollmentCalls[2].values[11]), ENVELOPE);
  assert.deepEqual(enrollmentCalls[3].values.slice(0, 9), [...enrollmentPrefix, BEGIN_OPERATION,
    ATTEMPT_OPERATION, ACCOUNT, FACTOR, 4]);
  assert.deepEqual(enrollmentCalls[3].values[9], Buffer.from(FINGERPRINT, 'base64url'));
  assert.equal(enrollmentCalls[3].values[10], 'invalid');
  assert.deepEqual(enrollmentCalls[4].values, [...enrollmentPrefix, BEGIN_OPERATION,
    REJECTED_ATTEMPT_OPERATION, ACCOUNT, FACTOR, 4, Buffer.from(FINGERPRINT, 'base64url'), 'invalid']);
  assert.deepEqual(enrollmentCalls[5].values, [...enrollmentPrefix, BEGIN_OPERATION,
    BARE_ATTEMPT_OPERATION, ACCOUNT, FACTOR, 4, Buffer.from(FINGERPRINT, 'base64url'), 'invalid']);
  assert.deepEqual(enrollmentCalls[6].values, [...enrollmentPrefix, BEGIN_OPERATION,
    VERIFY_OPERATION, ACCOUNT, FACTOR, 4, Buffer.from(FINGERPRINT, 'base64url'), 123]);
  assert.deepEqual(enrollmentCalls[7].values, [...enrollmentPrefix, BEGIN_OPERATION,
    'begin', ACCOUNT, null, null]);
  assert.equal(enrollmentCalls.some(call => call.values.some(value => String(value).includes(SECRET))), false);

  const badIdentityCalls = [];
  const strictIdentityRepository = createFactorEnrollmentPostgresRepository('local', async (...args) => {
    badIdentityCalls.push(args);
    return ENROLLMENT_CONTEXT;
  });
  await assert.rejects(strictIdentityRepository.readEnrollmentContext({ ...ENROLLMENT_IDENTITY,
    expiresAt: `${EXPIRY}\n` }), { message: 'Factor enrollment repository operation failed.' });
  await assert.rejects(strictIdentityRepository.readEnrollmentContext({ ...ENROLLMENT_IDENTITY,
    subject: `${ENROLLMENT_SUBJECT}\n` }), { message: 'Factor enrollment repository operation failed.' });
  assert.equal(badIdentityCalls.length, 0);

  const inconsistentContextRepository = createFactorEnrollmentPostgresRepository('local', async () => ({
    ...ENROLLMENT_CONTEXT, anyLiveFactor: false,
    factor: { factorId: FACTOR, securityEpoch: 4, state: 'pending', lastAcceptedStep: null,
      beginOperationId: BEGIN_OPERATION, requestFingerprint: FINGERPRINT, sessionAttested: false },
  }));
  await assert.rejects(inconsistentContextRepository.readEnrollmentContext(ENROLLMENT_IDENTITY),
    { message: 'Factor enrollment repository operation failed.' });

  const invalidKeyIdRepository = createFactorEnrollmentPostgresRepository('local', async (...args) => {
    badIdentityCalls.push(args);
    return ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5);
  });
  assert.deepEqual(await invalidKeyIdRepository.beginEnrollment(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT, expectedCurrentEpoch: 4, targetEpoch: 5,
    candidateFactorId: CANDIDATE_FACTOR, requestFingerprint: FINGERPRINT,
    envelopeKeyId: 'local-test-v1\n', encryptedSecret: ENVELOPE,
  }), { status: 'unknown' });
  assert.equal(badIdentityCalls.length, 0);

  let releaseBegin;
  let capturedBegin;
  const snapshotRepository = createFactorEnrollmentPostgresRepository('local', async (statement, values) => {
    capturedBegin = { statement, values };
    await new Promise(resolve => { releaseBegin = resolve; });
    return ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5);
  });
  const mutableIdentity = { ...ENROLLMENT_IDENTITY };
  const mutableEnvelope = structuredClone(ENVELOPE);
  const pendingBegin = snapshotRepository.beginEnrollment(mutableIdentity, {
    operationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT, expectedCurrentEpoch: 4, targetEpoch: 5,
    candidateFactorId: CANDIDATE_FACTOR, requestFingerprint: FINGERPRINT,
    envelopeKeyId: 'local-test-v1', encryptedSecret: mutableEnvelope,
  });
  mutableIdentity.subject = '00000000-0000-4000-8000-000000000099';
  mutableEnvelope.ciphertext = Buffer.alloc(32, 0x44).toString('base64url');
  releaseBegin();
  assert.deepEqual(await pendingBegin, ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5));
  assert.equal(capturedBegin.values[1], ENROLLMENT_SUBJECT);
  assert.deepEqual(JSON.parse(capturedBegin.values[11]), ENVELOPE);

  const RESUME_OPERATION = '00000000-0000-4000-8000-000000000019';
  const BEGIN_RECEIPT = { status: 'pending', operationId: BEGIN_OPERATION, kind: 'begin', accountId: ACCOUNT,
    issuer: ENROLLMENT_IDENTITY.issuer, subject: ENROLLMENT_SUBJECT, sessionId: ENROLLMENT_SESSION,
    factorId: FACTOR, securityEpoch: 4, requestFingerprint: FINGERPRINT };
  const MATERIAL_NOT_FOUND = { status: 'not_found', operationId: RESUME_OPERATION, kind: 'resume', accountId: ACCOUNT,
    issuer: ENROLLMENT_IDENTITY.issuer, subject: ENROLLMENT_SUBJECT, sessionId: ENROLLMENT_SESSION,
    factorId: null, securityEpoch: null, beginOperationId: BEGIN_OPERATION, requestFingerprint: null };
  const MATERIAL_RELEASED = { status: 'released', operationId: RESUME_OPERATION, kind: 'resume', accountId: ACCOUNT,
    issuer: ENROLLMENT_IDENTITY.issuer, subject: ENROLLMENT_SUBJECT, sessionId: ENROLLMENT_SESSION,
    factorId: FACTOR, securityEpoch: 4, beginOperationId: BEGIN_OPERATION, requestFingerprint: FINGERPRINT };
  const RELEASE_ACK = { status: 'released', operationId: RESUME_OPERATION, kind: 'resume', accountId: ACCOUNT,
    factorId: FACTOR, securityEpoch: 4, requestFingerprint: FINGERPRINT, beginOperationId: BEGIN_OPERATION,
    newlyCommitted: true };
  const resumeCalls = [];
  const resumeResponses = [ENROLLMENT_CONTEXT, BEGIN_RECEIPT, PENDING_FACTOR, MATERIAL_NOT_FOUND, RELEASE_ACK];
  const resumeRepository = createFactorEnrollmentResumePostgresRepository('local', async (statement, values) => {
    resumeCalls.push({ statement, values });
    return resumeResponses.shift();
  });
  assert.deepEqual(Object.keys(resumeRepository).sort(), [
    'readEnrollmentContext', 'readEnrollmentReceipt', 'readMaterialReceipt', 'readPendingFactor', 'releaseMaterial',
  ]);
  assert.deepEqual(await resumeRepository.readEnrollmentContext(ENROLLMENT_IDENTITY), ENROLLMENT_CONTEXT);
  assert.deepEqual(await resumeRepository.readEnrollmentReceipt(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, kind: 'begin', expectedAccountId: ACCOUNT,
    expectedFactorId: null, expectedSecurityEpoch: null,
  }), BEGIN_RECEIPT);
  assert.deepEqual(await resumeRepository.readPendingFactor(ENROLLMENT_IDENTITY, {
    expectedAccountId: ACCOUNT, expectedFactorId: FACTOR, expectedSecurityEpoch: 4,
    expectedBeginOperationId: BEGIN_OPERATION,
  }), PENDING_FACTOR);
  assert.deepEqual(await resumeRepository.readMaterialReceipt(ENROLLMENT_IDENTITY, {
    operationId: RESUME_OPERATION, expectedAccountId: ACCOUNT, expectedFactorId: FACTOR,
    expectedSecurityEpoch: 4, expectedBeginOperationId: BEGIN_OPERATION,
  }), MATERIAL_NOT_FOUND);
  assert.deepEqual(await resumeRepository.releaseMaterial(ENROLLMENT_IDENTITY, {
    operationId: RESUME_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, expectedEnvelopeKeyId: 'local-test-v1',
    requestFingerprint: FINGERPRINT,
  }), RELEASE_ACK);
  assert.deepEqual(resumeCalls.map(call => call.statement), [
    'SELECT groundbnb.read_factor_enrollment_context($1,$2,$3,$4::timestamptz) AS result',
    'SELECT groundbnb.read_factor_enrollment_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6,$7::uuid,$8::uuid,$9::bigint) AS result',
    'SELECT groundbnb.read_pending_factor_for_enrollment($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::bigint) AS result',
    'SELECT groundbnb.read_factor_enrollment_material_receipt($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::bigint,$9::uuid) AS result',
    'SELECT groundbnb.record_factor_enrollment_material_release($1,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7::uuid,$8::uuid,$9::bigint,$10,$11::bytea) AS result',
  ]);
  const resumePrefix = [ENROLLMENT_IDENTITY.issuer, ENROLLMENT_SUBJECT, ENROLLMENT_SESSION, EXPIRY];
  assert.deepEqual(resumeCalls[1].values, [...resumePrefix, BEGIN_OPERATION, 'begin', ACCOUNT, null, null]);
  assert.deepEqual(resumeCalls[2].values, [...resumePrefix, BEGIN_OPERATION, ACCOUNT, FACTOR, 4]);
  assert.deepEqual(resumeCalls[3].values, [...resumePrefix, RESUME_OPERATION, ACCOUNT, FACTOR, 4, BEGIN_OPERATION]);
  assert.deepEqual(resumeCalls[4].values.slice(0, 10), [...resumePrefix, BEGIN_OPERATION, RESUME_OPERATION,
    ACCOUNT, FACTOR, 4, 'local-test-v1']);
  assert.deepEqual(resumeCalls[4].values[10], Buffer.from(FINGERPRINT, 'base64url'));
  assert.equal(resumeCalls.every(call => !/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(call.statement)), true);
  let environmentCoercions = 0;
  const hostileEnvironment = { [Symbol.toPrimitive]() { environmentCoercions += 1; return 'local'; } };
  assert.throws(() => createFactorEnrollmentPostgresRepository(hostileEnvironment, async () => null), TypeError);
  assert.throws(() => createFactorEnrollmentResumePostgresRepository(hostileEnvironment, async () => null), TypeError);
  assert.equal(environmentCoercions, 0);

  const malformedAckRepository = createFactorEnrollmentResumePostgresRepository('local', async () => ({
    ...RELEASE_ACK, unexpected: 'not exposed',
  }));
  assert.deepEqual(await malformedAckRepository.releaseMaterial(ENROLLMENT_IDENTITY, {
    operationId: RESUME_OPERATION, beginOperationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT,
    expectedFactorId: FACTOR, expectedSecurityEpoch: 4, expectedEnvelopeKeyId: 'local-test-v1',
    requestFingerprint: FINGERPRINT,
  }), { status: 'unknown', operationId: RESUME_OPERATION, kind: 'resume', accountId: ACCOUNT,
    factorId: FACTOR, securityEpoch: 4, requestFingerprint: FINGERPRINT, beginOperationId: BEGIN_OPERATION,
    newlyCommitted: false });
  const malformedReceiptRepository = createFactorEnrollmentResumePostgresRepository('local', async () => ({
    ...MATERIAL_NOT_FOUND, requestFingerprint: 'unexpected',
  }));
  await assert.rejects(malformedReceiptRepository.readMaterialReceipt(ENROLLMENT_IDENTITY, {
    operationId: RESUME_OPERATION, expectedAccountId: ACCOUNT, expectedFactorId: FACTOR,
    expectedSecurityEpoch: 4, expectedBeginOperationId: BEGIN_OPERATION,
  }), { message: 'Factor enrollment repository operation failed.' });

  let forbiddenGetterReads = 0;
  let forbiddenToJsonCalls = 0;
  const getterEnvelope = { ...ENVELOPE };
  Object.defineProperty(getterEnvelope, 'ciphertext', { enumerable: true, configurable: true, get() {
    forbiddenGetterReads += 1;
    return ENVELOPE.ciphertext;
  } });
  Object.defineProperty(getterEnvelope, 'toJSON', { enumerable: true, value() {
    forbiddenToJsonCalls += 1;
    return ENVELOPE;
  } });
  let hostileCallCount = 0;
  const hostileRepository = createFactorEnrollmentPostgresRepository('local', async () => {
    hostileCallCount += 1;
    return ACK(BEGIN_OPERATION, 'begin', CANDIDATE_FACTOR, 5);
  });
  const hostileAck = await hostileRepository.beginEnrollment(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT, expectedCurrentEpoch: 4, targetEpoch: 5,
    candidateFactorId: CANDIDATE_FACTOR, requestFingerprint: FINGERPRINT, envelopeKeyId: 'local-test-v1',
    encryptedSecret: getterEnvelope,
  });
  assert.deepEqual(hostileAck, { status: 'unknown' });
  assert.equal(forbiddenGetterReads, 0);
  assert.equal(forbiddenToJsonCalls, 0);
  assert.equal(hostileCallCount, 0);
  assert.deepEqual(await hostileRepository.beginEnrollment(ENROLLMENT_IDENTITY, {
    operationId: BEGIN_OPERATION, expectedAccountId: ACCOUNT, expectedCurrentEpoch: 4, targetEpoch: 5,
    candidateFactorId: CANDIDATE_FACTOR, requestFingerprint: FINGERPRINT, envelopeKeyId: 'local-test-v1',
    encryptedSecret: { ...ENVELOPE, ciphertext: Number.NaN },
  }), { status: 'unknown' });
  assert.equal(hostileCallCount, 0);

  const interopCalls = [];
  let materialReadCount = 0;
  const resumeContext = { ...ENROLLMENT_CONTEXT, anyLiveFactor: true, factor: {
    factorId: FACTOR, securityEpoch: 4, state: 'pending', lastAcceptedStep: null,
    beginOperationId: BEGIN_OPERATION, requestFingerprint: FINGERPRINT, sessionAttested: false,
  } };
  const interopRepository = createFactorEnrollmentResumePostgresRepository('local', async (statement, values) => {
    interopCalls.push({ statement, values });
    if (statement.includes('read_factor_enrollment_context')) return resumeContext;
    if (statement.includes('read_factor_enrollment_receipt')) return BEGIN_RECEIPT;
    if (statement.includes('read_pending_factor_for_enrollment')) return PENDING_FACTOR;
    if (statement.includes('read_factor_enrollment_material_receipt')) {
      materialReadCount += 1;
      return materialReadCount === 1 ? MATERIAL_NOT_FOUND : { ...MATERIAL_RELEASED,
        requestFingerprint: values[0] === ENROLLMENT_IDENTITY.issuer ? FINGERPRINT : 'invalid' };
    }
    if (statement.includes('record_factor_enrollment_material_release')) throw new Error('simulated lost response');
    throw new Error('Unexpected fixed statement.');
  });
  const resumeProtocol = createFactorEnrollmentResumeProtocol({
    environment: 'local', resolveSession: async () => ({ ok: true, identity: ENROLLMENT_IDENTITY }),
    repository: interopRepository, keyProvider: { async getKey() { throw new Error('must not retrieve key after uncertain ACK'); } },
    decryptor: { async decrypt() { throw new Error('must not decrypt after uncertain ACK'); } },
    fingerprint: { async create() { return FINGERPRINT; } }, clock: () => new Date('2026-10-11T12:00:00.000Z'),
  });
  const reconciledResume = await resumeProtocol.resume({}, { operationId: RESUME_OPERATION, beginOperationId: BEGIN_OPERATION });
  assert.equal(reconciledResume.ok, true);
  assert.equal(reconciledResume.outcome, 'released');
  assert.equal(Object.hasOwn(reconciledResume, 'pendingSetupSecret'), false);
  assert.equal(interopCalls.filter(call => call.statement.includes('record_factor_enrollment_material_release')).length, 1);
  assert.equal(interopCalls.filter(call => call.statement.includes('read_factor_enrollment_material_receipt')).length, 2);
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
