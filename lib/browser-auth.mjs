import { randomUUID } from 'node:crypto';
import { NEON_AUTH_SESSION_COOKIE_NAME, parseSetCookies, serializeSetCookie } from '@neondatabase/auth/server';
import { resolveSessionIdentity, sessionConfiguration, sessionCookie } from './session-identity.mjs';
import { persistProfile, profileConfiguration } from './profile-persistence.mjs';

const attempts = new Map();
const privateHeaders = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
export function safeAuthNext(value) {
  return typeof value === 'string' && /^\/(?:profile(?:\/review)?|onboarding|trips|planner(?:\/[A-Za-z0-9_-]+)?|trails)?$/.test(value) ? value : null;
}
export function browserAuthConfiguration(env, now = Date.now()) {
  const auth = sessionConfiguration(env);
  const start = Date.parse(env.GROUND_BROWSER_AUTH_START);
  const until = Date.parse(env.GROUND_BROWSER_AUTH_UNTIL);
  if (!auth || !profileConfiguration(env) || env.GROUND_BROWSER_AUTH_MODE !== 'synthetic' ||
      !/^[A-Za-z0-9_-]{8,80}$/.test(env.GROUND_BROWSER_AUTH_RUN_ID ?? '') ||
      !Number.isFinite(start) || !Number.isFinite(until) || start > now || now >= until ||
      until - start > 30 * 60 * 1000 || until <= start) return null;
  return { ...auth, email: `${env.GROUND_ENV}-01@example.test`, runId: env.GROUND_BROWSER_AUTH_RUN_ID, until };
}
function reply(category, requestId, extra = {}, cookie = null) {
  const headers = new Headers(privateHeaders);
  if (cookie) headers.append('Set-Cookie', cookie);
  return Response.json({ ok: category === 'ok', category, requestId, ...extra }, {
    status: { ok: 200, validation: 400, auth: 401, throttled: 429, unavailable: 503 }[category], headers,
  });
}
async function jsonBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 2048) { await reader.cancel(); throw Error(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
  return body;
}
// Official pinned SDK endpoint vocabulary; closed paths and no automatic retry.
async function managedRequest(config, action, body, token = '') {
  const path = { send: '/email-otp/send-verification-otp', verify: '/sign-in/email-otp',
    logout: '/sign-out', session: '/get-session?disableCookieCache=true' }[action];
  if (!path) throw Error();
  const response = await fetch(`${config.issuer}${path}`, {
    method: action === 'session' ? 'GET' : 'POST', redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: { Origin: config.origin, 'x-neon-auth-proxy': 'nextjs',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Cookie: `${NEON_AUTH_SESSION_COOKIE_NAME}=${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) return { ok: false, category: response.status >= 500 ? 'unavailable' : 'auth' };
  const data = await response.json();
  const nativeCookies = response.headers.getSetCookie().flatMap(parseSetCookies)
    .filter(cookie => cookie.name === NEON_AUTH_SESSION_COOKIE_NAME && cookie.value);
  return { ok: true, data, nativeCookie: nativeCookies.length === 1 ? nativeCookies[0] : null };
}
function appCookie(config, value, maxAge) {
  return serializeSetCookie({ name: config.cookie, value, path: '/', httpOnly: true,
    secure: new URL(config.origin).protocol === 'https:', sameSite: 'lax', maxAge });
}
/** This protected synthetic slice is not public signup or a distributed production limiter. */
export async function handleBrowserAuth(request, env, upstream = managedRequest, resolve = resolveSessionIdentity, store = persistProfile) {
  const requestId = randomUUID();
  const config = browserAuthConfiguration(env);
  if (!config) return reply('unavailable', requestId);
  if (request.method !== 'POST' || new URL(request.url).search || request.headers.get('origin') !== config.origin ||
      !['same-origin', null].includes(request.headers.get('sec-fetch-site')) ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply('validation', requestId);
  let input;
  try { input = await jsonBody(request); } catch { return reply('validation', requestId); }
  const { action } = input;
  if (!['send', 'verify', 'logout'].includes(action)) return reply('validation', requestId);
  const allowed = { send: ['action','email'], verify: ['action','email','otp','next'], logout: ['action'] }[action];
  if (!allowed || Object.keys(input).some(key => !allowed.includes(key)) ||
      (action !== 'logout' && input.email !== config.email) ||
      (action === 'verify' && (!/^\d{6}$/.test(input.otp ?? '') || !safeAuthNext(input.next)))) return reply('validation', requestId);
  for (const [key, value] of attempts) if (value.until <= Date.now()) attempts.delete(key);
  const key = `${config.origin}:${config.runId}`;
  let run = attempts.get(key);
  if (!run) {
    if (attempts.size >= 16) return reply('unavailable', requestId);
    run = { until: config.until, sends: 0, verifies: 0 }; attempts.set(key, run);
  }
  if (action === 'send' && ++run.sends > 2 || action === 'verify' && ++run.verifies > 6) return reply('throttled', requestId);
  const token = sessionCookie(request.headers.get('cookie'), config.cookie);
  let rejectedToken = '';
  try {
    if (action === 'logout') {
      if (token) {
        const logout = await upstream(config, 'logout', {}, token);
        if (!logout.ok) return reply(logout.category, requestId);
        const current = await upstream(config, 'session', null, token);
        if (!current.ok || current.data?.user || current.data?.session) return reply('unavailable', requestId);
      }
      return reply('ok', requestId, { signedOut: true }, appCookie(config, '', 0));
    }
    const result = await upstream(config, action, action === 'send' ? { email: config.email, type: 'sign-in' }
      : { email: config.email, otp: input.otp });
    if (!result.ok) return reply(result.category, requestId);
    if (action === 'send') return reply('ok', requestId, { requested: true });
    const cookie = result.nativeCookie;
    if (cookie) rejectedToken = encodeURIComponent(cookie.value);
    if (!cookie || result.data?.user?.email !== config.email || result.data.user.emailVerified !== true ||
        result.data.user.role && result.data.user.role !== 'user') return reply('auth', requestId);
    const encodedToken = encodeURIComponent(cookie.value);
    const verified = await resolve(env, `${config.cookie}=${encodedToken}`);
    if (!verified.ok) return reply(verified.category, requestId);
    if (verified.identity.subject !== result.data.user.id) return reply('auth', requestId);
    const profile = await store(env, verified.identity, { kind: 'read' });
    if (!profile.ok) {
      return reply(profile.category === 'auth' ? 'auth' : 'unavailable', requestId);
    }
    const lifetime = Math.min(Math.floor((config.until - Date.now()) / 1000), 3600,
      Number.isFinite(cookie.maxAge) && cookie.maxAge > 0 ? cookie.maxAge : 3600);
    if (lifetime <= 0) return reply('unavailable', requestId);
    rejectedToken = '';
    return reply('ok', requestId, { next: safeAuthNext(input.next) }, appCookie(config, cookie.value, lifetime));
  } catch { return reply('unavailable', requestId); }
  finally { if (rejectedToken) await upstream(config, 'logout', {}, rejectedToken).catch(() => {}); }
}
