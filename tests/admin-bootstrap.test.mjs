import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdminBootstrapCandidate } from '../lib/admin-bootstrap.mjs';
import { createAdminBootstrapProtocol } from '../lib/admin-bootstrap-protocol.mjs';

const issuer = 'https://auth.synthetic.example/groundbnb';
const identities = [
  { email: 'weldayenterprises@gmail.com', subject: 'synthetic-owner-subject', role: 'owner' },
  { email: 'welday007@gmail.com', subject: 'synthetic-admin-one', role: 'admin' },
  { email: 'finallyaiagency@gmail.com', subject: 'synthetic-admin-two', role: 'admin' },
];

function fixture(seed = identities[0], overrides = {}) {
  return {
    deploymentContext: { environment: 'production', trustedIssuer: issuer },
    identity: { issuer, subject: seed.subject, email: seed.email, emailVerified: true },
    account: {
      accountId: '00000000-0000-4000-8000-000000000001',
      status: 'active',
      role: 'member',
      issuer,
      subject: seed.subject,
    },
    control: { firstActivationComplete: false, priorBindings: [], revokedSubjects: [] },
    ...overrides,
  };
}

test('three exact verified synthetic seed identities map to frozen roles as candidates only', () => {
  for (const seed of identities) {
    const result = evaluateAdminBootstrapCandidate(fixture(seed));
    assert.equal(result.ok, true);
    assert.equal(result.kind, 'bootstrap_role_candidate');
    assert.equal(result.candidate.role, seed.role);
    assert.equal(result.candidate.accountId, '00000000-0000-4000-8000-000000000001');
    assert.equal(result.durableRoleGrant, false);
    assert.equal(result.privilegedAccess, false);
    assert.equal(result.requiresVerifiedSecondFactor, true);
  }
});

test('only the trusted production issuer and exact verified email may map', () => {
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], {
    deploymentContext: { environment: 'preview', trustedIssuer: issuer },
  })).reason, 'invalid_deployment_context');
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], {
    identity: { ...fixture().identity, issuer: 'https://other.example/auth' },
  })).reason, 'untrusted_identity');
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], {
    identity: { ...fixture().identity, emailVerified: false },
  })).reason, 'untrusted_identity');
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], {
    identity: { ...fixture().identity, email: 'WeldayEnterprises@gmail.com' },
  })).reason, 'untrusted_identity');
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], {
    identity: { ...fixture().identity, email: 'owner@example.com' },
  })).reason, 'not_seed_identity');
});

test('identity must bind to the existing active member account; no account is provisioned', () => {
  const changedSubject = fixture();
  changedSubject.account.subject = 'different-immutable-subject';
  assert.equal(evaluateAdminBootstrapCandidate(changedSubject).reason, 'account_identity_mismatch');
  const inactive = fixture();
  inactive.account.status = 'deleted';
  assert.equal(evaluateAdminBootstrapCandidate(inactive).reason, 'account_identity_mismatch');
  const alreadyPrivileged = fixture();
  alreadyPrivileged.account.role = 'admin';
  assert.equal(evaluateAdminBootstrapCandidate(alreadyPrivileged).reason, 'account_identity_mismatch');
  const noAccount = fixture();
  noAccount.account.accountId = null;
  assert.equal(evaluateAdminBootstrapCandidate(noAccount).ok, false);
});

test('prior binding replay and same-email subject replacement refuse for controlled resolution', async () => {
  const replay = fixture();
  replay.control.priorBindings.push({
    email: identities[0].email,
    issuer,
    subject: identities[0].subject,
    accountId: replay.account.accountId,
    role: 'owner',
  });
  assert.equal(evaluateAdminBootstrapCandidate(replay).reason, 'bootstrap_subject_already_bound');

  const replaced = fixture(identities[0]);
  replaced.identity.subject = 'new-subject-after-recreation';
  replaced.account.subject = 'new-subject-after-recreation';
  replaced.control.priorBindings.push({
    email: identities[0].email,
    issuer,
    subject: identities[0].subject,
    accountId: '00000000-0000-4000-8000-000000000002',
    role: 'owner',
  });
  assert.equal(evaluateAdminBootstrapCandidate(replaced).reason, 'controlled_resolution_required');

  const replayProtocol = protocolHarness({
    contexts: [protocolContext('eligible'), protocolContext('activated'), protocolContext('activated'), protocolContext('activated')],
    receipt: protocolReceipt('activated'),
  });
  const first = await replayProtocol.protocol.activate({}, { operationId: protocolOperation });
  const replayed = await replayProtocol.protocol.activate({}, { operationId: protocolOperation });
  assert.deepEqual(replayed, first);
  assert.equal(replayed.outcome, 'activated');
  assert.equal(replayProtocol.calls.write, 1);
  assert.equal(replayProtocol.calls.receipt, 1);

  const anotherOperation = '66666666-6666-4666-8666-666666666666';
  const notFoundReplay = protocolHarness({
    contexts: [protocolContext('activated')],
    receipt: protocolReceipt('not_found', { operationId: anotherOperation }),
  });
  assert.equal((await notFoundReplay.protocol.activate({}, { operationId: anotherOperation })).outcome, 'not_found');
  assert.equal(notFoundReplay.calls.write, 0);
});

test('one-time bootstrap control still permits each other seed once after policy activation', async () => {
  const owner = identities[0];
  const secondAdmin = identities[1];
  const input = fixture(secondAdmin);
  input.control.firstActivationComplete = true;
  input.control.priorBindings.push({
    email: owner.email,
    issuer,
    subject: owner.subject,
    accountId: '00000000-0000-4000-8000-000000000009',
    role: 'owner',
  });
  assert.equal(evaluateAdminBootstrapCandidate(input).candidate.role, 'admin');

  const driftedCommit = protocolHarness({
    contexts: [protocolContext('eligible'), protocolContext('activated', { accountRole: 'admin' })],
  });
  assert.deepEqual(await driftedCommit.protocol.activate({}, { operationId: protocolOperation }),
    { ok: false, outcome: 'unknown', operationId: protocolOperation });
  assert.equal(driftedCommit.calls.write, 1);
  assert.equal(driftedCommit.calls.context, 2);

  const preflight = protocolContext('eligible');
  const postcommit = protocolContext('activated');
  const mutableAck = protocolAck('activated');
  const snapshotSuccess = protocolHarness({
    contexts: [preflight, postcommit],
    ack: mutableAck,
    onResolve: (count) => {
      if (count === 2) preflight.status = 'unknown';
      if (count === 4) mutableAck.status = 'rejected';
      if (count === 5) postcommit.status = 'unknown';
    },
  });
  assert.deepEqual(await snapshotSuccess.protocol.activate({}, { operationId: protocolOperation }),
    { ok: true, outcome: 'activated', operationId: protocolOperation });
  assert.equal(snapshotSuccess.calls.write, 1);

  const canonicalOperation = 'abcdefab-cdef-4abc-8abc-abcdefabcdef';
  const uppercaseOperation = canonicalOperation.toUpperCase();
  const canonicalizedOperation = protocolHarness({
    contexts: [protocolContext('eligible'), protocolContext('activated')],
    ack: protocolAck('activated', { operationId: canonicalOperation }),
  });
  assert.deepEqual(await canonicalizedOperation.protocol.activate({}, { operationId: uppercaseOperation }),
    { ok: true, outcome: 'activated', operationId: canonicalOperation });
  assert.equal(canonicalizedOperation.calls.operations[0], canonicalOperation);

  const lostAckReceipt = protocolReceipt('activated');
  const lostAck = protocolHarness({
    contexts: [protocolContext('eligible'), protocolContext('activated')],
    receipt: lostAckReceipt,
    writeError: true,
    onResolve: (count) => { if (count === 5) lostAckReceipt.status = 'rejected'; },
  });
  assert.deepEqual(await lostAck.protocol.activate({}, { operationId: protocolOperation }),
    { ok: true, outcome: 'activated', operationId: protocolOperation });
  assert.equal(lostAck.calls.write, 1);
  assert.equal(lostAck.calls.receipt, 1);
  assert.equal(lostAck.calls.context, 2);
});

test('malformed bootstrap control with duplicate owners, subjects, accounts, or conflicting seed roles refuses', () => {
  const duplicateEmail = fixture(identities[1]);
  duplicateEmail.control.priorBindings.push(
    { email: identities[0].email, issuer, subject: identities[0].subject, accountId: '00000000-0000-4000-8000-000000000009', role: 'owner' },
    { email: identities[0].email, issuer, subject: 'different-owner', accountId: '00000000-0000-4000-8000-000000000008', role: 'owner' },
  );
  assert.equal(evaluateAdminBootstrapCandidate(duplicateEmail).reason, 'inconsistent_bootstrap_control');

  const sharedSubject = fixture(identities[2]);
  sharedSubject.control.priorBindings.push(
    { email: identities[0].email, issuer, subject: identities[0].subject, accountId: '00000000-0000-4000-8000-000000000009', role: 'owner' },
    { email: identities[1].email, issuer, subject: identities[0].subject, accountId: '00000000-0000-4000-8000-000000000008', role: 'admin' },
  );
  assert.equal(evaluateAdminBootstrapCandidate(sharedSubject).reason, 'inconsistent_bootstrap_control');

  const sharedAccount = fixture(identities[2]);
  sharedAccount.control.priorBindings.push(
    { email: identities[0].email, issuer, subject: identities[0].subject, accountId: '00000000-0000-4000-8000-000000000009', role: 'owner' },
    { email: identities[1].email, issuer, subject: identities[1].subject, accountId: '00000000-0000-4000-8000-000000000009', role: 'admin' },
  );
  assert.equal(evaluateAdminBootstrapCandidate(sharedAccount).reason, 'inconsistent_bootstrap_control');

  const wrongRole = fixture(identities[1]);
  wrongRole.control.priorBindings.push(
    { email: identities[0].email, issuer, subject: identities[0].subject, accountId: '00000000-0000-4000-8000-000000000009', role: 'admin' },
  );
  assert.equal(evaluateAdminBootstrapCandidate(wrongRole).reason, 'invalid_bootstrap_history');
});

test('revoked subjects and malformed or missing control history fail closed', async () => {
  const revoked = fixture();
  revoked.control.revokedSubjects.push({ email: identities[0].email, issuer, subject: identities[0].subject });
  assert.equal(evaluateAdminBootstrapCandidate(revoked).reason, 'previously_revoked');
  const replaced = fixture();
  replaced.control.revokedSubjects.push({ email: identities[0].email, issuer, subject: 'old-subject' });
  assert.equal(evaluateAdminBootstrapCandidate(replaced).reason, 'controlled_resolution_required');
  assert.equal(evaluateAdminBootstrapCandidate(fixture(identities[0], { control: null })).reason, 'missing_bootstrap_control');
  const malformed = fixture();
  malformed.control.revokedSubjects.push({ email: identities[0].email, issuer, subject: identities[0].subject, revoked: false });
  assert.equal(evaluateAdminBootstrapCandidate(malformed).reason, 'invalid_revocation_history');

  const mismatchedRejected = protocolHarness({
    contexts: [protocolContext('refused', { accountId: protocolOtherAccount })],
    receipt: protocolReceipt('rejected'),
  });
  assert.equal((await mismatchedRejected.protocol.status({}, { operationId: protocolOperation })).outcome, 'unknown');
  assert.equal(mismatchedRejected.calls.context, 1);

  const matchingRejected = protocolHarness({
    contexts: [protocolContext('refused')],
    receipt: protocolReceipt('rejected'),
  });
  assert.equal((await matchingRejected.protocol.status({}, { operationId: protocolOperation })).outcome, 'refused');
  assert.equal(matchingRejected.calls.context, 1);

  const mutableRejectedReceipt = protocolReceipt('rejected');
  const rejectedCurrentContext = protocolContext('refused');
  const rejectionSnapshot = protocolHarness({
    contexts: [rejectedCurrentContext],
    receipt: mutableRejectedReceipt,
    onResolve: (count) => {
      if (count === 2) mutableRejectedReceipt.status = 'unknown';
      if (count === 3) rejectedCurrentContext.accountId = protocolOtherAccount;
    },
  });
  assert.equal((await rejectionSnapshot.protocol.status({}, { operationId: protocolOperation })).outcome, 'refused');
  assert.equal(rejectionSnapshot.calls.context, 1);

  const staleActivation = protocolHarness({
    contexts: [protocolContext('eligible', { accountRole: 'member', bindingState: 'unbound' })],
    receipt: protocolReceipt('activated'),
  });
  assert.equal((await staleActivation.protocol.status({}, { operationId: protocolOperation })).outcome, 'unknown');
  assert.equal(staleActivation.calls.context, 1);
});

test('profile email or caller-supplied extra authority fields cannot substitute for trusted identity', async () => {
  const profile = fixture();
  profile.profile = { email: identities[0].email };
  assert.equal(evaluateAdminBootstrapCandidate(profile).reason, 'invalid_input');
  const extraClaim = fixture();
  extraClaim.identity.profileEmail = identities[0].email;
  assert.equal(evaluateAdminBootstrapCandidate(extraClaim).reason, 'untrusted_identity');

  let environmentCoercionCalled = false;
  const objectEnvironment = { toString() { environmentCoercionCalled = true; return 'local'; } };
  assert.throws(() => createAdminBootstrapProtocol({ environment: ['local'], resolveSession: async () => ({}), repository: {} }),
    /pinned synthetic environment/);
  assert.throws(() => createAdminBootstrapProtocol({ environment: objectEnvironment, resolveSession: async () => ({}), repository: {} }),
    /pinned synthetic environment/);
  assert.equal(environmentCoercionCalled, false);

  const accessorHarness = protocolHarness();
  const accessorRequest = Object.defineProperty({}, 'operationId', { enumerable: true, get() { throw new Error('must not run'); } });
  assert.equal((await accessorHarness.protocol.status({}, accessorRequest)).outcome, 'refused');
  assert.equal((await accessorHarness.protocol.status({}, { operationId: protocolOperation, role: 'owner' })).outcome, 'refused');
  assert.equal(accessorHarness.calls.resolve, 0);

  let sessionAccessorRead = false;
  const accessorSession = protocolSession();
  Object.defineProperty(accessorSession, 'subject', { enumerable: true, get() { sessionAccessorRead = true; return protocolSubject; } });
  const invalidSession = protocolHarness({ session: accessorSession });
  assert.equal((await invalidSession.protocol.activate({}, { operationId: protocolOperation })).outcome, 'refused');
  assert.equal(sessionAccessorRead, false);
  assert.equal(invalidSession.calls.context, 0);

  const mutableSession = protocolSession();
  const changedSession = protocolHarness({
    session: mutableSession,
    contexts: [protocolContext('eligible')],
    onContext: () => { mutableSession.subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; },
  });
  assert.equal((await changedSession.protocol.activate({}, { operationId: protocolOperation })).outcome, 'unknown');
  assert.equal(changedSession.calls.write, 0);
  assert.ok(changedSession.calls.receivedSessions.every(value => Object.isFrozen(value)));
});

const protocolIssuer = 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
const protocolOperation = '44444444-4444-4444-8444-444444444444';
const protocolAccount = '11111111-1111-4111-8111-111111111111';
const protocolOtherAccount = '22222222-2222-4222-8222-222222222222';
const protocolSubject = '33333333-3333-4333-8333-333333333333';
const protocolSessionId = '55555555-5555-4555-8555-555555555555';
const protocolNow = new Date('2026-10-10T12:00:00.000Z');

function protocolSession(overrides = {}) {
  return {
    issuer: protocolIssuer,
    subject: protocolSubject,
    sessionId: protocolSessionId,
    expiresAt: '2026-10-11T00:00:00.000Z',
    email: 'local-seed-owner@example.test',
    emailVerified: true,
    ...overrides,
  };
}

function protocolContext(status = 'eligible', overrides = {}) {
  const activated = status === 'activated';
  return {
    status,
    issuer: protocolIssuer,
    subject: protocolSubject,
    sessionId: protocolSessionId,
    accountId: protocolAccount,
    accountStatus: 'active',
    accountRole: activated ? 'owner' : 'member',
    seedSlot: 'owner',
    seedRole: 'owner',
    bindingState: activated ? 'bound' : 'unbound',
    ownerState: activated ? 'one' : 'none',
    completionState: activated ? 'in_progress' : 'initialized',
    ...overrides,
  };
}

function protocolReceipt(status, overrides = {}) {
  return {
    status,
    kind: 'activate',
    operationId: protocolOperation,
    issuer: protocolIssuer,
    subject: protocolSubject,
    sessionId: protocolSessionId,
    accountId: status === 'not_found' ? null : protocolAccount,
    seedSlot: status === 'not_found' ? null : 'owner',
    role: status === 'not_found' ? null : 'owner',
    ...overrides,
  };
}

function protocolAck(status, overrides = {}) {
  return {
    status,
    kind: 'activate',
    operationId: protocolOperation,
    issuer: protocolIssuer,
    subject: protocolSubject,
    sessionId: protocolSessionId,
    accountId: protocolAccount,
    seedSlot: 'owner',
    role: 'owner',
    ...overrides,
  };
}

function protocolHarness({ contexts = [], receipt = protocolReceipt('not_found'), ack = protocolAck('activated'), writeError = false, session = protocolSession(), onContext = null, onResolve = null } = {}) {
  const calls = { resolve: 0, context: 0, write: 0, receipt: 0, operations: [], receivedSessions: [] };
  const protocol = createAdminBootstrapProtocol({
    environment: 'local',
    resolveSession: async () => {
      calls.resolve += 1;
      if (onResolve) onResolve(calls.resolve);
      return session;
    },
    repository: {
      readBootstrapContext: async (value) => {
        calls.context += 1;
        calls.receivedSessions.push(value);
        if (onContext) onContext(value);
        return contexts.shift() ?? protocolContext('unknown');
      },
      activateBootstrapSeed: async (value, operation) => {
        calls.write += 1;
        calls.operations.push(operation.operationId);
        calls.receivedSessions.push(value);
        if (writeError) throw new Error('synthetic transport loss');
        return ack;
      },
      readBootstrapReceipt: async (value) => {
        calls.receipt += 1;
        calls.receivedSessions.push(value);
        return receipt;
      },
    },
    clock: () => protocolNow,
  });
  return { protocol, calls };
}
