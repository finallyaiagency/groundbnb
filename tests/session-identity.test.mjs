import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionIdentity, sessionConfiguration } from '../lib/session-identity.mjs';

const env = {
  GROUND_ENV: 'local', GROUND_LOGIN_MODE: 'session-check',
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_AUTH_COOKIE_SECRET: 'synthetic-test-only-signing-secret-123456',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
};
const now = new Date('2026-10-07T15:00:00.000Z');
const fixture = {
  user: { id: 'synthetic-subject', emailVerified: true, role: 'owner', email: 'local-01@example.test' },
  session: { id: 'synthetic-session', userId: 'synthetic-subject', expiresAt: '2026-10-07T16:00:00.000Z', token: 'synthetic-token' },
};

test('disabled, foreign issuer, wrong cookie namespace and unsafe environment refuse provider contact', async () => {
  for (const change of [
    { GROUND_LOGIN_MODE: 'off' }, { GROUND_ENV: 'production' }, { GROUND_ENV: 'recovery' },
    { GROUND_AUTH_ISSUER: env.GROUND_PRODUCTION_AUTH_ISSUER }, { GROUND_AUTH_ISSUER: 'https://attacker.example.test' },
    { GROUND_AUTH_COOKIE_NAME: 'groundbnb_preview_session' }, { GROUND_AUTH_COOKIE_SECRET: '' },
    { GROUND_EMAIL_MODE: 'live' }, { GROUND_METERED_DISPATCH: 'bounded' }, { GROUND_SCHEDULED_WORK: 'on' },
    { GROUND_PUBLIC_ORIGIN: env.GROUND_PRODUCTION_ORIGIN }, { GROUND_PRODUCTION_ORIGIN: '' },
    { VERCEL_ENV: 'production' }, { VERCEL: '1' },
  ]) {
    let called = false;
    const result = await resolveSessionIdentity({ ...env, ...change }, 'groundbnb_local_session=synthetic-token',
      async () => { called = true; throw new Error('Must not run'); }, now);
    assert.equal(result.ok, false);
    assert.equal(called, false);
  }
  assert.ok(sessionConfiguration(env));
});

test('foreign, absent, ambiguous and malformed cookies never reach the provider', async () => {
  for (const cookie of [null, '', 'groundbnb_preview_session=synthetic-token',
    'groundbnb_local_session=a; groundbnb_local_session=b', 'groundbnb_local_session=a\r\nb',
    'groundbnb_local_session=', 'a'.repeat(8193)]) {
    let called = false;
    assert.equal((await resolveSessionIdentity(env, cookie, async () => { called = true; }, now)).ok, false);
    assert.equal(called, false);
  }
});

test('rejects unverified, expired and mismatched managed identities; returns no private data or authority', async () => {
  for (const data of [null, { ...fixture, user: { ...fixture.user, emailVerified: false } },
    { ...fixture, session: { ...fixture.session, userId: 'foreign-subject' } },
    { ...fixture, session: { ...fixture.session, expiresAt: now.toISOString() } },
    { ...fixture, session: { ...fixture.session, expiresAt: 'invalid' } }]) {
    assert.equal((await resolveSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
      async () => ({ data }), now)).ok, false);
  }
  const identity = await resolveSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
    async () => ({ data: fixture }), now);
  assert.deepEqual(identity, { ok: true, identity: { issuer: env.GROUND_AUTH_ISSUER, subject: fixture.user.id } });
  assert.deepEqual(await resolveSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
    async () => { throw new Error('private cookie and credential details'); }, now), { ok: false, category: 'unavailable' });
});

test('pinned real SDK serializes a fresh provider read and forwards only the isolated session token', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(String(url), `${env.GROUND_AUTH_ISSUER}/get-session?disableCookieCache=true`);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Cookie, '__Secure-neon-auth.session_token=synthetic-token');
    assert.equal(options.headers.Origin, env.GROUND_PUBLIC_ORIGIN);
    return Response.json(fixture);
  };
  try {
    assert.equal((await resolveSessionIdentity(env,
      'groundbnb_local_session=synthetic-token; unrelated=discarded; groundbnb_preview_session=foreign', undefined, now)).ok, true);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
