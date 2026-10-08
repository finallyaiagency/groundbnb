import assert from 'node:assert/strict';
import test from 'node:test';
import { handleBrowserAuth } from '../lib/browser-auth.mjs';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';

const now = Date.now();
const issuer = 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
const fixtureEmail = 'local-01@example.test';
let run = 0;
const freshEnv = () => ({
  GROUND_ENV: 'local', GROUND_LOGIN_MODE: 'session-check', GROUND_AUTH_ISSUER: issuer,
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session',
  GROUND_AUTH_COOKIE_SECRET: 'synthetic-signing-secret-for-unit-test-only',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_PROFILE_MODE: 'enabled',
  GROUND_PROFILE_DATABASE_URL: 'postgresql://groundbnb_local_app:' + 'testpass' + '@ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech/groundbnb?sslmode=require',
  GROUND_DATABASE_HOST: 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech',
  GROUND_DATABASE_BRANCH_ID: 'br-rough-flower-b8lerkcf',
  GROUND_BROWSER_AUTH_MODE: 'synthetic', GROUND_BROWSER_AUTH_RUN_ID: `transport-run-${++run}`,
  GROUND_BROWSER_AUTH_START: new Date(now - 60_000).toISOString(),
  GROUND_BROWSER_AUTH_UNTIL: new Date(now + 60_000).toISOString(),
});
const request = (body, cookie = '') => new Request('http://localhost:3000/api/account/auth', {
  method: 'POST', body: JSON.stringify(body),
  headers: { origin: 'http://localhost:3000', 'content-type': 'application/json',
    'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
});
const nativeCookie = (value = 'synthetic.provider.token') =>
  `${NEON_AUTH_SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=900; Secure; HttpOnly`;
const providerUser = { id: 'synthetic-subject', email: fixtureEmail, emailVerified: true, name: 'Synthetic' };
const originalFetch = globalThis.fetch;

test('real verify transport matches SDK contract and issues only the isolated app cookie', async () => {
  const env = freshEnv();
  let resolveCookie;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), `${issuer}/sign-in/email-otp`);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Origin, env.GROUND_PUBLIC_ORIGIN);
    assert.equal(options.headers['x-neon-auth-proxy'], 'nextjs');
    assert.deepEqual(JSON.parse(options.body), { email: fixtureEmail, otp: '123456' });
    return new Response(JSON.stringify({ token: 'private-body-token', user: providerUser }), {
      headers: { 'content-type': 'application/json', 'set-cookie': nativeCookie() },
    });
  };
  try {
    const response = await handleBrowserAuth(
      request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), env, undefined,
      async (_settings, cookie) => {
        resolveCookie = cookie;
        return { ok: true, identity: { issuer, subject: providerUser.id } };
      }, async () => ({ ok: true }), () => now,
    );
    assert.equal(response.status, 200);
    assert.equal(resolveCookie, 'groundbnb_local_session=synthetic.provider.token');
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /^groundbnb_local_session=synthetic\.provider\.token;/);
    assert.match(setCookie, /HttpOnly/i);
    assert.doesNotMatch(setCookie, /__Secure-neon-auth/);
    const body = await response.text();
    assert.doesNotMatch(body, /private-body-token|synthetic\.provider\.token/);
  } finally { globalThis.fetch = originalFetch; }
});

test('non-2xx verify cancels body and revokes a native session cookie exactly once', async () => {
  const env = freshEnv();
  let canceled = false;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, search: parsed.search, method: options.method, cookie: options.headers.Cookie });
    if (parsed.pathname.endsWith('/sign-in/email-otp')) {
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('private upstream diagnostic')); },
        cancel() { canceled = true; },
      }), { status: 503, headers: { 'set-cookie': nativeCookie() } });
    }
    assert.equal(parsed.pathname, `${new URL(issuer).pathname}/sign-out`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Cookie, `${NEON_AUTH_SESSION_COOKIE_NAME}=synthetic.provider.token`);
    return Response.json({ success: true });
  };
  try {
    const response = await handleBrowserAuth(
      request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), env,
    );
    assert.equal(response.status, 503);
    assert.equal(canceled, true);
    assert.deepEqual(calls.map(call => call.path.split('/').at(-1)), ['email-otp', 'sign-out']);
    assert.equal(calls.length, 2);
    const body = await response.text();
    assert.doesNotMatch(body, /private upstream diagnostic|synthetic\.provider\.token/);
    assert.equal(response.headers.get('set-cookie'), null);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid successful verify body retains and revokes its native session cookie', async () => {
  const env = freshEnv();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, cookie: options.headers.Cookie });
    if (parsed.pathname.endsWith('/sign-in/email-otp')) {
      return new Response('{ invalid private body', { headers: { 'set-cookie': nativeCookie() } });
    }
    assert.ok(parsed.pathname.endsWith('/sign-out'));
    assert.equal(options.headers.Cookie, `${NEON_AUTH_SESSION_COOKIE_NAME}=synthetic.provider.token`);
    return Response.json({ success: true });
  };
  try {
    const response = await handleBrowserAuth(
      request({ action: 'verify', email: fixtureEmail, otp: '123456', next: '/profile' }), env,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(calls.map(call => call.path.split('/').at(-1)), ['email-otp', 'sign-out']);
    assert.equal(calls.length, 2);
    assert.doesNotMatch(await response.text(), /private body|synthetic\.provider\.token/);
  } finally { globalThis.fetch = originalFetch; }
});

test('logout claims success only after fresh session lookup confirms absence', async () => {
  const env = freshEnv();
  const calls = [];
  let stillActive = false;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, search: parsed.search, method: options.method, cookie: options.headers.Cookie });
    if (parsed.pathname.endsWith('/sign-out')) return Response.json({ success: true });
    assert.ok(parsed.pathname.endsWith('/get-session'));
    assert.equal(parsed.search, '?disableCookieCache=true');
    assert.equal(options.method, 'GET');
    return Response.json(stillActive
      ? { user: providerUser, session: { id: 'still-active' } }
      : { user: null, session: null });
  };
  try {
    const cookie = 'groundbnb_local_session=synthetic.provider.token';
    const success = await handleBrowserAuth(request({ action: 'logout' }, cookie), env);
    assert.equal(success.status, 200);
    assert.equal((await success.json()).signedOut, true);
    assert.match(success.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].cookie, `${NEON_AUTH_SESSION_COOKIE_NAME}=synthetic.provider.token`);
    assert.equal(calls[1].cookie, `${NEON_AUTH_SESSION_COOKIE_NAME}=synthetic.provider.token`);

    calls.length = 0;
    stillActive = true;
    const pending = await handleBrowserAuth(request({ action: 'logout' }, cookie), env);
    assert.equal(pending.status, 503);
    assert.notEqual((await pending.json()).signedOut, true);
    assert.equal(pending.headers.get('set-cookie'), null);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});
