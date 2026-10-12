import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrowserAuth, browserAuthConfiguration, safeAuthNext } from '../lib/browser-auth.mjs';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';

const now = Date.parse('2026-10-07T20:00:00.000Z');
const clock = () => now;
const target = PROFILE_TARGETS.local;
const databaseUrl = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
databaseUrl.username = target.role;
databaseUrl.password = 'synthetic-test-only';
const env = {
  GROUND_ENV: 'local', GROUND_LOGIN_MODE: 'session-check', GROUND_PROFILE_MODE: 'enabled', GROUND_PROFILE_DOMAIN_MODE: 'full-v1',
  GROUND_PROFILE_DATABASE_URL: databaseUrl.href, GROUND_DATABASE_HOST: target.host,
  GROUND_DATABASE_BRANCH_ID: target.branch,
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session', GROUND_AUTH_COOKIE_SECRET: 'synthetic-signing-secret-unit-fixture-only',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_BROWSER_AUTH_MODE: 'synthetic', GROUND_BROWSER_AUTH_RUN_ID: 'unit-run-20261007',
  GROUND_BROWSER_AUTH_START: new Date(now - 60_000).toISOString(),
  GROUND_BROWSER_AUTH_UNTIL: new Date(now + 60_000).toISOString(),
};
const fixtureEmail = 'local-01@example.test';
let runNumber = 0;
const freshEnv = () => ({ ...env, GROUND_BROWSER_AUTH_RUN_ID: `unit-run-20261007-${++runNumber}` });
const request = (body, changes = {}) => new Request('http://localhost:3000/api/account/auth', {
  method: 'POST', body: JSON.stringify(body),
  headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...changes },
});
const ok = (data = {}) => ({ ok: true, data });

test('run configuration is synthetic-only, pinned, and bounded to an active window', () => {
  assert.ok(browserAuthConfiguration(env, now));
  for (const change of [
    { GROUND_BROWSER_AUTH_MODE: 'off' }, { GROUND_ENV: 'preview' },
    { GROUND_BROWSER_AUTH_RUN_ID: 'short' }, { GROUND_PROFILE_MODE: 'off' },
    { GROUND_BROWSER_AUTH_START: new Date(now + 1).toISOString() },
    { GROUND_BROWSER_AUTH_UNTIL: new Date(now).toISOString() },
    { GROUND_BROWSER_AUTH_UNTIL: new Date(now + 30 * 60_000 + 1).toISOString() },
    { GROUND_LOGIN_MODE: 'off' }, { GROUND_EMAIL_MODE: 'live' },
  ]) assert.equal(browserAuthConfiguration({ ...env, ...change }, now), null);
  assert.equal(browserAuthConfiguration(env, Date.parse(env.GROUND_BROWSER_AUTH_UNTIL)), null);
});

test('safe next paths accept only the closed local destination set', () => {
  for (const path of ['/', '/profile', '/profile/review', '/onboarding', '/trips', '/planner', '/planner/trip_2', '/trails']) {
    assert.equal(safeAuthNext(path), path);
  }
  for (const path of [null, '//attacker.example', '/\\attacker.example', '/profile?x=1', '/%2f%2fattacker',
    '/planner/a/b', '/auth', 'https://attacker.example', '/profile%0d%0a']) assert.equal(safeAuthNext(path), null);
});

test('closed request validation rejects foreign origins, query selectors, wrong methods, oversized and unknown input before provider calls', async () => {
  let calls = 0;
  const upstream = async () => { calls++; throw new Error('should not call'); };
  const bad = [
    [request({ action: 'send', email: fixtureEmail }, { origin: 'https://foreign.example' }), env],
    [new Request('http://localhost:3000/api/account/auth?accountId=other', { method: 'POST', body: '{}',
      headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json' } }), env],
    [request({ action: 'send', email: fixtureEmail }, { 'sec-fetch-site': 'cross-site' }), env],
    [new Request('http://localhost:3000/api/account/auth', { method: 'GET', headers: { origin: env.GROUND_PUBLIC_ORIGIN } }), env],
    [request({ action: 'send', email: fixtureEmail, role: 'owner' }), env],
    [request({ action: 'send', email: 'other@example.test' }), env],
    [request({ action: 'send', email: fixtureEmail }, { 'content-type': 'text/plain' }), env],
    [new Request('http://localhost:3000/api/account/auth', { method: 'POST', body: ' '.repeat(2049),
      headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json' } }), env],
    [request({ action: 'verify', email: fixtureEmail, otp: '12345', next: '/profile' }), env],
    [request({ action: 'verify', email: fixtureEmail, otp: '123456', next: 'https://attacker.example' }), env],
  ];
  for (const [req, settings] of bad) {
    const response = await handleBrowserAuth(req, settings, upstream, async () => {}, async () => {}, clock);
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('send is fixture-only and response never claims email delivery or reflects provider details', async () => {
  let call;
  const response = await handleBrowserAuth(request({ action: 'send', email: fixtureEmail }), freshEnv(),
    async (...args) => { call = args; return { ...ok({ success: true, private: 'provider detail' }) }; },
    async () => { throw Error('unexpected identity read'); }, async () => { throw Error('unexpected profile read'); }, clock);
  assert.equal(response.status, 200);
  assert.deepEqual(call.slice(1, 3), ['send', { email: fixtureEmail, type: 'sign-in' }]);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['category', 'ok', 'requestId', 'requested'].sort());
  assert.equal(body.requested, true);
  assert.equal(JSON.stringify(body).includes('provider detail'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
});

test('one synthetic run admits only one send even when the browser repeats the request', async () => {
  const settings = freshEnv();
  let calls = 0;
  const upstream = async () => { calls++; return ok({ success: true }); };
  const first = await handleBrowserAuth(request({ action: 'send', email: fixtureEmail }), settings, upstream,
    async () => {}, async () => {}, clock);
  const repeated = await handleBrowserAuth(request({ action: 'send', email: fixtureEmail }), settings, upstream,
    async () => {}, async () => {}, clock);
  assert.equal(first.status, 200);
  assert.equal(repeated.status, 429);
  assert.equal((await repeated.json()).category, 'throttled');
  assert.equal(calls, 1);
});

test('pinned provider transport uses only the approved send endpoint and rejects oversized response data privately', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), `${env.GROUND_AUTH_ISSUER}/email-otp/send-verification-otp`);
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.headers.Origin, env.GROUND_PUBLIC_ORIGIN);
      assert.equal(options.headers['x-neon-auth-proxy'], 'nextjs');
      assert.deepEqual(JSON.parse(options.body), { email: fixtureEmail, type: 'sign-in' });
      return new Response(JSON.stringify({ success: true }));
    };
    const success = await handleBrowserAuth(request({ action: 'send', email: fixtureEmail }), freshEnv(), undefined,
      async () => {}, async () => {}, clock);
    assert.equal(success.status, 200);

    globalThis.fetch = async () => new Response(JSON.stringify({ diagnostic: 'private '.repeat(5000) }));
    const oversized = await handleBrowserAuth(request({ action: 'send', email: fixtureEmail }), freshEnv(), undefined,
      async () => {}, async () => {}, clock);
    assert.equal(oversized.status, 503);
    const body = await oversized.text();
    assert.equal(body.includes('private'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('verify maps the provider user to a fresh managed identity and active profile before issuing the isolated cookie', async () => {
  const nativeCookie = { value: 'provider.token', maxAge: 1800 };
  const providerUser = { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'user' };
  let resolvedCookie; let storedIdentity;
  const response = await handleBrowserAuth(request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), freshEnv(),
    async (config, action) => action === 'verify' ? { ok: true, data: { user: providerUser, diagnostic: 'private' }, nativeCookie }
      : { ok: true, data: {} },
    async (_env, cookieHeader) => { resolvedCookie = cookieHeader; return { ok: true, identity: { issuer: env.GROUND_AUTH_ISSUER, subject: providerUser.id } }; },
    async (_env, identity, operation) => { storedIdentity = [identity, operation]; return { ok: true }; }, clock);
  assert.equal(response.status, 200);
  assert.equal(resolvedCookie, 'groundbnb_local_session=provider.token');
  assert.deepEqual(storedIdentity, [{ issuer: env.GROUND_AUTH_ISSUER, subject: providerUser.id }, { kind: 'read' }]);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /^groundbnb_local_session=provider\.token;/);
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Lax/i); assert.match(setCookie, /Max-Age=60/i);
  assert.equal((await response.json()).next, '/profile');
});

test('verify refuses mismatched, unverified, privileged, missing-session and failed-profile outcomes; it revokes every minted token', async () => {
  const cases = [
    { user: { id: 'foreign', email: fixtureEmail, emailVerified: true, role: 'user' }, identity: 'synthetic-subject' },
    { user: { id: 'synthetic-subject', email: 'other@example.test', emailVerified: true, role: 'user' }, identity: 'synthetic-subject' },
    { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: false, role: 'user' }, identity: 'synthetic-subject' },
    { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'owner' }, identity: 'synthetic-subject' },
    { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'user' }, identity: 'synthetic-subject', resolveOk: false },
    { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'user' }, identity: 'synthetic-subject', profileOk: false },
  ];
  for (const scenario of cases) {
    const actions = [];
    const response = await handleBrowserAuth(request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), freshEnv(),
      async (_config, action) => { actions.push(action); return action === 'verify'
        ? { ok: true, data: { user: scenario.user }, nativeCookie: { value: 'new.provider.token', maxAge: 300 } }
        : { ok: true, data: {} }; },
      async () => scenario.resolveOk === false ? { ok: false, category: 'auth' }
        : { ok: true, identity: { issuer: env.GROUND_AUTH_ISSUER, subject: scenario.identity } },
      async () => scenario.profileOk === false ? { ok: false, category: 'auth' } : { ok: true }, clock);
    assert.notEqual(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(actions.filter(action => action === 'logout').length, 1);
    const body = await response.json();
    assert.equal(JSON.stringify(body).includes('new.provider.token'), false);
  }
});

test('verification finishing after the synthetic window expires cleans up the minted session without reading or issuing a cookie', async () => {
  let current = now;
  const until = now + 1000;
  const settings = { ...freshEnv(), GROUND_BROWSER_AUTH_UNTIL: new Date(until).toISOString() };
  const actions = [];
  let identityCalls = 0; let profileCalls = 0;
  const response = await handleBrowserAuth(request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), settings,
    async (_config, action) => {
      actions.push(action);
      if (action === 'verify') {
        current = until + 1;
        return { ok: true, data: { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'user' } },
          nativeCookie: { value: 'expired-window-token', maxAge: 300 } };
      }
      return ok();
    }, async () => { identityCalls++; return { ok: true, identity: { issuer: env.GROUND_AUTH_ISSUER, subject: 'synthetic-subject' } }; },
    async () => { profileCalls++; return { ok: true }; }, () => current);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(actions, ['verify', 'logout']);
  assert.equal(identityCalls, 0);
  assert.equal(profileCalls, 0);
  assert.equal((await response.text()).includes('expired-window-token'), false);
});

test('failed upstream logout and post-logout session reads never claim sign-out or clear a retryable cookie', async () => {
  const requestWithCookie = request({ action: 'logout' }, { cookie: 'groundbnb_local_session=provider.token' });
  const failedRevoke = await handleBrowserAuth(requestWithCookie, freshEnv(),
    async () => ({ ok: false, category: 'unavailable', diagnostic: 'secret' }), async () => {}, async () => {}, clock);
  assert.equal(failedRevoke.status, 503);
  assert.equal(failedRevoke.headers.get('set-cookie'), null);
  assert.equal(JSON.stringify(await failedRevoke.json()).includes('secret'), false);
  let calls = 0;
  const stillActive = await handleBrowserAuth(request({ action: 'logout' }, { cookie: 'groundbnb_local_session=provider.token' }), freshEnv(),
    async (_config, action) => { calls++; return action === 'logout' ? ok() : ok({ user: { id: 'still-active' } }); },
    async () => {}, async () => {}, clock);
  assert.equal(calls, 2);
  assert.equal(stillActive.status, 503);
  assert.equal(stillActive.headers.get('set-cookie'), null);
});

test('successful logout proves session removal before expiring only the local app cookie', async () => {
  const actions = [];
  const response = await handleBrowserAuth(request({ action: 'logout' }, { cookie: 'groundbnb_local_session=provider.token' }), freshEnv(),
    async (_config, action, _body, token) => { actions.push([action, token]); return action === 'session' ? ok({}) : ok(); },
    async () => {}, async () => {}, clock);
  assert.equal(response.status, 200);
  assert.deepEqual(actions, [['logout', 'provider.token'], ['session', 'provider.token']]);
  assert.match(response.headers.get('set-cookie'), /groundbnb_local_session=;/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
  assert.deepEqual(await response.json().then(body => ({ signedOut: body.signedOut })), { signedOut: true });
});

test('provider exceptions are redacted, single-attempt, and any minted token is cleaned up', async () => {
  const actions = [];
  const response = await handleBrowserAuth(request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), freshEnv(),
    async (_config, action) => {
      actions.push(action);
      if (action === 'verify') return { ok: true, data: { user: { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, role: 'user' } }, nativeCookie: { value: 'secret-token' } };
      throw Error('private diagnostic secret-token');
    }, async () => { throw Error('resolver diagnostic'); }, async () => {}, clock);
  assert.equal(response.status, 503);
  assert.deepEqual(actions, ['verify', 'logout']);
  const body = await response.text();
  assert.equal(body.includes('private diagnostic'), false);
  assert.equal(body.includes('secret-token'), false);
  assert.equal(body.includes('resolver diagnostic'), false);
});

