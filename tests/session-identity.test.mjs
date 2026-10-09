import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveManagedSessionIdentity, resolveSessionIdentity, sessionConfiguration } from '../lib/session-identity.mjs';

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

test('native Node environment retains the pinned configuration without accepting other exotic objects', () => {
  const moduleUrl = new URL('../lib/session-identity.mjs', import.meta.url).href;
  const script = `import { sessionConfiguration } from ${JSON.stringify(moduleUrl)};
    const accepted = sessionConfiguration(process.env);
    const rejected = sessionConfiguration(Object.create({ ...process.env }));
    console.log(JSON.stringify({ accepted: Boolean(accepted), rejected: rejected === null }));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...env }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0);
  assert.deepEqual(JSON.parse(child.stdout), { accepted: true, rejected: true });
});

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

test('managed identity resolver returns only pinned verified identity and session freshness', async () => {
  let calls = 0;
  const result = await resolveManagedSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
    async (config, token) => {
      calls++;
      assert.equal(config.issuer, env.GROUND_AUTH_ISSUER);
      assert.equal(token, 'synthetic-token');
      return { data: fixture };
    }, now);
  assert.deepEqual(result, { ok: true, identity: {
    issuer: env.GROUND_AUTH_ISSUER, subject: fixture.user.id,
    sessionId: fixture.session.id, expiresAt: fixture.session.expiresAt,
  } });
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes('synthetic-token'), false);
  assert.equal(JSON.stringify(result).includes('owner'), false);
  assert.equal(JSON.stringify(result).includes('email'), false);
});

test('managed identity rejects malformed identity/session identifiers and expiry timestamps', async () => {
  const malformed = [
    { ...fixture, user: { ...fixture.user, id: '   ' } },
    { ...fixture, user: { ...fixture.user, id: 's'.repeat(201) } },
    { ...fixture, user: { ...fixture.user, id: 'bad\u0000subject' } },
    { ...fixture, session: { ...fixture.session, id: '  ' } },
    { ...fixture, session: { ...fixture.session, id: 'x'.repeat(201) } },
    { ...fixture, session: { ...fixture.session, id: 'bad\u007fsession' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-02-30T16:00:00Z' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07 16:00:00Z' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07T16:00:00' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07T16:00:00+14:01' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07T16:00:00+01:60' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07T16:00:00.1234567890Z' } },
    { ...fixture, session: { ...fixture.session, expiresAt: '2026-10-07T15:00:00.000000000Z' } },
  ];
  for (const data of malformed) {
    const result = await resolveManagedSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
      async () => ({ data }), now);
    assert.deepEqual(result, { ok: false, category: 'auth' });
  }
});

test('managed identity accepts strict calendar timestamps with offsets and sub-millisecond precision', async () => {
  for (const expiresAt of [
    '2026-10-07T12:00:00-04:00',
    '2026-10-07T15:00:00.000000001Z',
  ]) {
    const result = await resolveManagedSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
      async () => ({ data: { ...fixture, session: { ...fixture.session, expiresAt } } }), now);
    assert.equal(result.ok, true);
    assert.equal(result.identity.expiresAt, expiresAt);
  }
});

test('invalid server clock refuses both resolvers before contacting managed auth', async () => {
  for (const invalidClock of [new Date(Number.NaN), null, '2026-10-07T15:00:00Z']) {
    for (const resolve of [resolveManagedSessionIdentity, resolveSessionIdentity]) {
      let called = false;
      const result = await resolve(env, 'groundbnb_local_session=synthetic-token', async () => {
        called = true;
        return { data: fixture };
      }, invalidClock);
      assert.deepEqual(result, { ok: false, category: 'unavailable' });
      assert.equal(called, false);
    }
  }
});

test('malformed environment values refuse both resolvers before contacting managed auth', async () => {
  for (const invalidEnv of [null, [], 'local', 42]) {
    for (const resolve of [resolveManagedSessionIdentity, resolveSessionIdentity]) {
      let called = false;
      const result = await resolve(invalidEnv, 'groundbnb_local_session=synthetic-token', async () => {
        called = true;
        return { data: fixture };
      }, now);
      assert.deepEqual(result, { ok: false, category: 'unavailable' });
      assert.equal(called, false);
    }
  }
});

test('legacy resolver keeps its narrow issuer/subject output while sharing strict session validation', async () => {
  const result = await resolveSessionIdentity(env, 'groundbnb_local_session=synthetic-token',
    async () => ({ data: fixture }), now);
  assert.deepEqual(result, { ok: true, identity: { issuer: env.GROUND_AUTH_ISSUER, subject: fixture.user.id } });
});

test('both resolvers recheck the server clock after awaiting the provider', async () => {
  for (const resolve of [resolveManagedSessionIdentity, resolveSessionIdentity]) {
    for (const completedAt of [new Date(fixture.session.expiresAt), new Date(NaN)]) {
      let clock = now;
      const result = await resolve(env, 'groundbnb_local_session=synthetic-token', async () => {
        clock = completedAt;
        return { data: fixture };
      }, () => clock);
      assert.deepEqual(result, { ok: false, category: Number.isFinite(completedAt.getTime()) ? 'auth' : 'unavailable' });
    }
    let called = false;
    assert.deepEqual(await resolve(env, 'groundbnb_local_session=synthetic-token', async () => {
      called = true;
    }, () => { throw new Error('private clock failure'); }), { ok: false, category: 'unavailable' });
    assert.equal(called, false);
  }
});
