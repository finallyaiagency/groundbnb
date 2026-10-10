const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT = /^[A-Za-z0-9._~:-]{1,255}$/;
const ISSUER = /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/;

const SEED_ROLES = new Map([
  ['weldayenterprises@gmail.com', 'owner'],
  ['welday007@gmail.com', 'admin'],
  ['finallyaiagency@gmail.com', 'admin'],
]);

function hasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function safeIssuer(value) {
  return typeof value === 'string' && value.length <= 512 && ISSUER.test(value);
}

function safeSubject(value) {
  return typeof value === 'string' && SUBJECT.test(value);
}

function refusal(reason) {
  return { ok: false, kind: 'refused', reason };
}

/**
 * Prepare a bootstrap role candidate from trusted production-auth context.
 * This pure contract neither creates an account nor persists a role, and it
 * never enables privileged access before application-verified MFA.
 */
export function evaluateAdminBootstrapCandidate(input) {
  if (!hasExactKeys(input, ['deploymentContext', 'identity', 'account', 'control'])) return refusal('invalid_input');
  if (!hasExactKeys(input.deploymentContext, ['environment', 'trustedIssuer'])
    || input.deploymentContext.environment !== 'production'
    || !safeIssuer(input.deploymentContext.trustedIssuer)) return refusal('invalid_deployment_context');

  if (!hasExactKeys(input.identity, ['issuer', 'subject', 'email', 'emailVerified'])
    || input.identity.issuer !== input.deploymentContext.trustedIssuer
    || !safeIssuer(input.identity.issuer)
    || !safeSubject(input.identity.subject)
    || typeof input.identity.email !== 'string'
    || input.identity.email !== input.identity.email.toLowerCase()
    || input.identity.emailVerified !== true) return refusal('untrusted_identity');

  const role = SEED_ROLES.get(input.identity.email);
  if (!role) return refusal('not_seed_identity');

  if (!hasExactKeys(input.account, ['accountId', 'status', 'role', 'issuer', 'subject'])
    || typeof input.account.accountId !== 'string'
    || !UUID.test(input.account.accountId)
    || input.account.status !== 'active'
    || input.account.role !== 'member'
    || input.account.issuer !== input.identity.issuer
    || input.account.subject !== input.identity.subject) return refusal('account_identity_mismatch');

  if (!hasExactKeys(input.control, ['firstActivationComplete', 'priorBindings', 'revokedSubjects'])
    || typeof input.control.firstActivationComplete !== 'boolean'
    || !Array.isArray(input.control.priorBindings)
    || !Array.isArray(input.control.revokedSubjects)) return refusal('missing_bootstrap_control');

  // The one-time control initializes bootstrap policy. Each of the three seed
  // subjects may still activate once; exact prior bindings and revocations
  // prevent a later deployment from replaying an already-used seed.
  const seenEmails = new Set();
  const seenSubjects = new Set();
  const seenAccounts = new Set();
  let priorOwnerCount = 0;
  for (const binding of input.control.priorBindings) {
    if (!hasExactKeys(binding, ['email', 'issuer', 'subject', 'accountId', 'role'])
      || typeof binding.email !== 'string'
      || !SEED_ROLES.has(binding.email)
      || !safeIssuer(binding.issuer)
      || !safeSubject(binding.subject)
      || typeof binding.accountId !== 'string'
      || !UUID.test(binding.accountId)
      || binding.role !== SEED_ROLES.get(binding.email)) return refusal('invalid_bootstrap_history');

    const subjectKey = `${binding.issuer}\u0000${binding.subject}`;
    if (seenEmails.has(binding.email) || seenSubjects.has(subjectKey) || seenAccounts.has(binding.accountId)) {
      return refusal('inconsistent_bootstrap_control');
    }
    seenEmails.add(binding.email);
    seenSubjects.add(subjectKey);
    seenAccounts.add(binding.accountId);
    if (binding.role === 'owner') priorOwnerCount += 1;
    if (priorOwnerCount > 1) return refusal('inconsistent_bootstrap_control');

    if (binding.email === input.identity.email) {
      if (binding.issuer !== input.identity.issuer || binding.subject !== input.identity.subject) {
        return refusal('controlled_resolution_required');
      }
      return refusal('bootstrap_subject_already_bound');
    }
    if (binding.issuer === input.identity.issuer && binding.subject === input.identity.subject) {
      return refusal('controlled_resolution_required');
    }
  }

  const revokedSubjects = new Set();
  for (const revoked of input.control.revokedSubjects) {
    if (!hasExactKeys(revoked, ['email', 'issuer', 'subject'])
      || !SEED_ROLES.has(revoked.email)
      || !safeIssuer(revoked.issuer)
      || !safeSubject(revoked.subject)) return refusal('invalid_revocation_history');
    const subjectKey = `${revoked.issuer}\u0000${revoked.subject}`;
    if (revokedSubjects.has(subjectKey)) return refusal('inconsistent_bootstrap_control');
    revokedSubjects.add(subjectKey);
    if (revoked.email === input.identity.email
      && (revoked.issuer !== input.identity.issuer || revoked.subject !== input.identity.subject)) {
      return refusal('controlled_resolution_required');
    }
    if (revoked.issuer === input.identity.issuer && revoked.subject === input.identity.subject) {
      return refusal('previously_revoked');
    }
  }

  return {
    ok: true,
    kind: 'bootstrap_role_candidate',
    candidate: {
      accountId: input.account.accountId,
      issuer: input.identity.issuer,
      subject: input.identity.subject,
      role,
    },
    durableRoleGrant: false,
    privilegedAccess: false,
    requiresVerifiedSecondFactor: true,
  };
}
