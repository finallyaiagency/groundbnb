import assert from 'node:assert/strict';
import test from 'node:test';
import { decidePrivilegedAccess } from '../lib/privileged-access.mjs';

const NOW = '2026-10-08T16:00:00.000Z';

function fixture(overrides = {}) {
  const principal = {
    accountId: '00000000-0000-4000-8000-000000000001', issuer: 'https://local-auth.example.test', subject: 'subject-1',
    sessionId: 'session-1', accountStatus: 'active', role: 'admin', securityEpoch: 4,
  };
  const factorAttestation = {
    accountId: principal.accountId, issuer: principal.issuer, subject: principal.subject,
    sessionId: principal.sessionId, enrolled: true, verified: true,
    challengedAt: '2026-10-08T15:59:00.000Z', lastActivityAt: NOW, securityEpoch: 4,
  };
  const context = {
    now: NOW, currentSecurityEpoch: 4, accountSuspended: false, sessionRevoked: false,
    rateLimited: false, sensitive: false,
  };
  return {
    principal: { ...principal, ...overrides.principal },
    factorAttestation: overrides.factorAttestation === null ? null : { ...factorAttestation, ...overrides.factorAttestation },
    context: { ...context, ...overrides.context },
  };
}

const decision = overrides => decidePrivilegedAccess(fixture(overrides));

test('allows active admin and owner only with matching fresh server factor state', () => {
  assert.deepEqual(decision(), { allowed: true, reason: 'factor_fresh' });
  assert.deepEqual(decision({ principal: { role: 'owner' }, context: { sensitive: true } }),
    { allowed: true, reason: 'step_up_fresh' });
});

test('denies regular users, inactive accounts, missing factor, and Google/email-only sessions', () => {
  assert.equal(decision({ principal: { role: 'user' } }).reason, 'not_privileged');
  assert.equal(decision({ principal: { accountStatus: 'suspended' } }).reason, 'inactive_account');
  assert.equal(decision({ factorAttestation: null }).reason, 'factor_required');
  assert.equal(decidePrivilegedAccess({
    principal: { ...fixture().principal, emailVerified: true, authProvider: 'google' },
    factorAttestation: null,
    context: fixture().context,
  }).reason, 'factor_required');
  assert.equal(decision({ factorAttestation: { enrolled: false } }).reason, 'factor_required');
  assert.equal(decision({ factorAttestation: { verified: false } }).reason, 'factor_required');
});

test('denies unknown and invalid identity, session, revocation, rate-limit, or epoch context', () => {
  for (const factorAttestation of [
    { accountId: 'other-account' }, { issuer: 'https://other-auth.example.test' },
    { subject: 'other-subject' }, { sessionId: 'other-session' },
  ]) assert.equal(decision({ factorAttestation }).reason, 'identity_mismatch');
  assert.equal(decision({ context: { sessionRevoked: true } }).reason, 'session_revoked');
  assert.equal(decision({ context: { sessionRevoked: undefined } }).reason, 'session_revoked');
  assert.equal(decision({ context: { rateLimited: true } }).reason, 'factor_rate_limited');
  assert.equal(decision({ context: { rateLimited: undefined } }).reason, 'factor_rate_limited');
  assert.equal(decision({ context: { accountSuspended: true } }).reason, 'inactive_account');
  assert.equal(decision({ principal: { accountId: 'not-a-uuid' } }).reason, 'invalid_principal');
  assert.equal(decision({ principal: { subject: '   ' } }).reason, 'invalid_principal');
  assert.equal(decision({ principal: { issuer: '   ' } }).reason, 'invalid_principal');
  assert.equal(decision({ principal: { sessionId: '   ' } }).reason, 'invalid_principal');
  assert.equal(decision({ principal: { securityEpoch: 3 } }).reason, 'invalid_principal');
  assert.equal(decision({ factorAttestation: { securityEpoch: 3 } }).reason, 'stale_epoch');
  assert.equal(decision({ context: { currentSecurityEpoch: 5 } }).reason, 'invalid_principal');
});

test('enforces exact 12-hour challenge and 30-minute inactivity boundaries', () => {
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T04:00:00.000Z', lastActivityAt: NOW,
  } }).allowed, true);
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T03:59:59.999Z',
  } }).reason, 'factor_stale');
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T15:00:00.000Z', lastActivityAt: '2026-10-08T15:29:59.999Z',
  } }).reason, 'session_idle');
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T15:00:00.000Z', lastActivityAt: '2026-10-08T15:30:00.000Z',
  } }).reason, 'session_idle');
});

test('sensitive decisions require step-up no older than five minutes', () => {
  assert.equal(decision({ context: { sensitive: true }, factorAttestation: {
    challengedAt: '2026-10-08T15:55:00.000Z', lastActivityAt: NOW,
  } }).allowed, true);
  assert.equal(decision({ context: { sensitive: true }, factorAttestation: {
    challengedAt: '2026-10-08T15:54:59.999Z', lastActivityAt: NOW,
  } }).reason, 'step_up_required');
});

test('rejects malformed, unknown, or future timestamps and impossible factor chronology', () => {
  for (const challengedAt of [null, 'unknown', '2026-02-30T15:59:00.000Z', '2026-10-08T15:59:00-04:00',
    '2026-10-08T16:00:00.001Z']) {
    assert.equal(decision({ factorAttestation: { challengedAt } }).reason, 'invalid_factor_times');
  }
  assert.equal(decision({ factorAttestation: { lastActivityAt: '2026-10-08T16:00:00.001Z' } }).reason, 'invalid_factor_times');
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T15:59:30.000Z', lastActivityAt: '2026-10-08T15:59:00.000Z',
  } }).reason, 'invalid_factor_times');
  assert.deepEqual(decidePrivilegedAccess({}), { allowed: false, reason: 'invalid_context' });
  for (const input of [null, undefined, 0, 'not a decision object', []]) {
    assert.deepEqual(decidePrivilegedAccess(input), { allowed: false, reason: 'invalid_context' });
  }
});

test('returns only a frozen decision with no protected payload or mutation', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = decidePrivilegedAccess(input);
  assert.deepEqual(result, { allowed: true, reason: 'factor_fresh' });
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), ['allowed', 'reason']);
  assert.deepEqual(decision({ factorAttestation: null }), { allowed: false, reason: 'factor_required' });
});

test('trusted PostgreSQL offset/microsecond times preserve exact freshness and future boundaries', () => {
  assert.equal(decision({ factorAttestation: {
    challengedAt: '2026-10-08T11:59:00.176146-04:00', lastActivityAt: '2026-10-08T12:00:00.000000-04:00',
  } }).allowed, true);
  assert.equal(decision({ factorAttestation: { challengedAt: '2026-10-08T16:00:00.000001Z' } }).reason, 'invalid_factor_times');
  assert.equal(decision({ context: { sensitive: true }, factorAttestation: {
    challengedAt: '2026-10-08T15:54:59.999999Z', lastActivityAt: NOW,
  } }).reason, 'step_up_required');
  assert.equal(decision({ context: { sensitive: true }, factorAttestation: {
    challengedAt: '2026-10-08T15:55:00.000000Z', lastActivityAt: NOW,
  } }).allowed, true);
  assert.equal(decision({ factorAttestation: { challengedAt: '2026-10-08T15:20:00.000000Z',
    lastActivityAt: '2026-10-08T15:30:00.000001Z' } }).allowed, true);
  assert.equal(decision({ factorAttestation: { challengedAt: '2026-10-08T15:20:00.000000Z',
    lastActivityAt: '2026-10-08T15:30:00.000000Z' } }).reason, 'session_idle');
});

test('unknown timestamp and non-string owner values deny without coercing an identity', () => {
  for (const challengedAt of [0, new Date(NOW), {}, []]) {
    assert.equal(decision({ factorAttestation: { challengedAt } }).reason, 'invalid_factor_times');
  }
  const untrustedOwner = { toString() { throw new Error('must not coerce'); } };
  assert.equal(decision({ principal: { accountId: untrustedOwner } }).reason, 'invalid_principal');
  assert.equal(decision({ factorAttestation: { accountId: untrustedOwner } }).reason, 'identity_mismatch');
});
