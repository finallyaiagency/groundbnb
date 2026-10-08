import { createAuthServer, NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';

const TARGETS = Object.freeze({
  preview: { issuer: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_preview_session' },
  local: { issuer: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_local_session' },
});
const PRODUCTION_ISSUER = 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';

/** @typedef {{ issuer: string, subject: string, sessionId: string, expiresAt: string }} ManagedIdentity */
/** @typedef {{ ok: true, identity: ManagedIdentity } | { ok: false, category: 'auth' | 'unavailable' }} ManagedSessionIdentityResult */
/** @typedef {{ ok: true, identity: { issuer: string, subject: string } } | { ok: false, category: 'auth' | 'unavailable' }} SessionIdentityResult */

export function sessionConfiguration(env) {
  try {
    if (env === null || typeof env !== 'object' || Array.isArray(env) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(env))) return null;
    const target = TARGETS[env.GROUND_ENV];
    const origin = new URL(env.GROUND_PUBLIC_ORIGIN);
    if (!target || env.GROUND_LOGIN_MODE !== 'session-check' ||
        env.GROUND_AUTH_ISSUER !== target.issuer || env.GROUND_AUTH_COOKIE_NAME !== target.cookie ||
        env.GROUND_PRODUCTION_AUTH_ISSUER !== PRODUCTION_ISSUER ||
        env.GROUND_EMAIL_MODE !== 'capture' || env.GROUND_SCHEDULED_WORK !== 'off' ||
        env.GROUND_METERED_DISPATCH !== 'off' || env.GROUND_SEED_MODE !== 'synthetic' ||
        (env.VERCEL_ENV && env.VERCEL_ENV !== (env.GROUND_ENV === 'preview' ? 'preview' : 'development')) ||
        (env.VERCEL === '1' && !env.VERCEL_ENV) ||
        typeof env.GROUND_AUTH_COOKIE_SECRET !== 'string' || env.GROUND_AUTH_COOKIE_SECRET.length < 32 ||
        origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
        !(origin.protocol === 'https:' || (env.GROUND_ENV === 'local' && origin.protocol === 'http:' && origin.hostname === 'localhost')) ||
        origin.origin === new URL(env.GROUND_PRODUCTION_ORIGIN).origin) return null;
    return { issuer: target.issuer, cookie: target.cookie, origin: origin.origin,
      secret: env.GROUND_AUTH_COOKIE_SECRET };
  } catch { return null; }
}

export function sessionCookie(header, name) {
  if (typeof header !== 'string' || header.length > 8192) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return value && /^[A-Za-z0-9._~%+\/-]+$/.test(value) ? value : null;
}

// No signed-cookie authority cache: the SDK's server method must contact Neon.
function managedSession(config, token) {
  const auth = createAuthServer({
    baseUrl: config.issuer, cookieSecret: config.secret,
    log: { debug() {}, info() {}, warn() {}, error() {} },
    context: () => ({
      getCookies: () => `${NEON_AUTH_SESSION_COOKIE_NAME}=${token}`,
      setCookie() {}, // Read-only check; auth UI will own cookie issuance/rotation later.
      getHeader: () => null, getOrigin: () => config.origin, getFramework: () => 'nextjs',
    }),
  });
  // 0.5.0-beta compares to the string "true", not boolean true.
  return auth.getSession({ query: { disableCookieCache: 'true' } });
}

const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function clockNanoseconds(now) {
  try {
    if (!(now instanceof Date)) return null;
    const milliseconds = Date.prototype.getTime.call(now);
    return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1_000_000n : null;
  } catch { return null; }
}

function expiryNanoseconds(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z') {
    const offsetHour = Number(offsetHourText), offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;
  }
  const base = Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''));
  if (!Number.isFinite(base)) return null;
  return BigInt(base) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9));
}

function validManagedIdentity(result, config, nowNs) {
  const { user, session } = result?.data ?? {};
  const expiresAtNs = expiryNanoseconds(session?.expiresAt);
  if (result?.error || typeof user?.id !== 'string' || !user.id.trim() || user.id.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(user.id) || user.emailVerified !== true || session?.userId !== user.id ||
      typeof session.id !== 'string' || !session.id.trim() || session.id.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(session.id) || expiresAtNs === null || expiresAtNs <= nowNs) return null;
  return Object.freeze({ issuer: config.issuer, subject: user.id, sessionId: session.id, expiresAt: session.expiresAt });
}

/** @returns {Promise<ManagedSessionIdentityResult>} */
async function readManagedSessionIdentity(env, cookieHeader, getSession, now) {
  const nowNs = clockNanoseconds(now);
  if (nowNs === null) return { ok: false, category: 'unavailable' };
  const config = sessionConfiguration(env);
  if (!config) return { ok: false, category: 'unavailable' };
  const token = sessionCookie(cookieHeader, config.cookie);
  if (!token) return { ok: false, category: 'auth' };
  try {
    const result = await getSession(config, token);
    const identity = validManagedIdentity(result, config, nowNs);
    return identity ? { ok: true, identity } : { ok: false, category: 'auth' };
  } catch {
    return { ok: false, category: 'unavailable' };
  }
}

/** Internal verified subject only; this does not create an application account or grant roles.
 * @returns {Promise<SessionIdentityResult>}
 */
export async function resolveSessionIdentity(env, cookieHeader, getSession = managedSession, now = new Date()) {
  const result = await readManagedSessionIdentity(env, cookieHeader, getSession, now);
  return result.ok ? { ok: true, identity: { issuer: result.identity.issuer, subject: result.identity.subject } } : result;
}

/** Fresh managed-auth identity context for trusted server checks; never return cookie or user profile data.
 * @returns {Promise<ManagedSessionIdentityResult>}
 */
export async function resolveManagedSessionIdentity(env, cookieHeader, getSession = managedSession, now = new Date()) {
  return readManagedSessionIdentity(env, cookieHeader, getSession, now);
}
