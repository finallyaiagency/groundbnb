import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdminBootstrapCandidate } from '../lib/admin-bootstrap.mjs';

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

test('prior binding replay and same-email subject replacement refuse for controlled resolution', () => {
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
});

test('one-time bootstrap control still permits each other seed once after policy activation', () => {
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

test('revoked subjects and malformed or missing control history fail closed', () => {
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
});

test('profile email or caller-supplied extra authority fields cannot substitute for trusted identity', () => {
  const profile = fixture();
  profile.profile = { email: identities[0].email };
  assert.equal(evaluateAdminBootstrapCandidate(profile).reason, 'invalid_input');
  const extraClaim = fixture();
  extraClaim.identity.profileEmail = identities[0].email;
  assert.equal(evaluateAdminBootstrapCandidate(extraClaim).reason, 'untrusted_identity');
});
