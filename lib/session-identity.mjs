import { createAuthServer, NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';

const TARGETS = Object.freeze({
  preview: { issuer: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_preview_session' },
  local: { issuer: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_local_session' },
});
const SYNTHETIC_SEED_EMAILS = Object.freeze({
  local: new Set(['local-seed-owner@example.test', 'local-seed-admin-a@example.test', 'local-seed-admin-b@example.test']),
  preview: new Set(['preview-seed-owner@example.test', 'preview-seed-admin-a@example.test', 'preview-seed-admin-b@example.test']),
});
const PRODUCTION_ISSUER = 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @typedef {{ issuer: string, subject: string, sessionId: string, expiresAt: string }} ManagedIdentity */
/** @typedef {{ ok: true, identity: ManagedIdentity } | { ok: false, category: 'auth' | 'unavailable' }} ManagedSessionIdentityResult */
/** @typedef {{ ok: true, identity: { issuer: string, subject: string } } | { ok: false, category: 'auth' | 'unavailable' }} SessionIdentityResult */

export function sessionConfiguration(env) {
  try {
    if (env === null || typeof env !== 'object' || Array.isArray(env) ||
        (env !== process.env && ![Object.prototype, null].includes(Object.getPrototypeOf(env)))) return null;
    const environment = env.GROUND_ENV;
    if (typeof environment !== 'string' || !Object.hasOwn(TARGETS, environment)) return null;
    const target = TARGETS[environment];
    const origin = new URL(env.GROUND_PUBLIC_ORIGIN);
    if (!target || env.GROUND_LOGIN_MODE !== 'session-check' ||
        env.GROUND_AUTH_ISSUER !== target.issuer || env.GROUND_AUTH_COOKIE_NAME !== target.cookie ||
        env.GROUND_PRODUCTION_AUTH_ISSUER !== PRODUCTION_ISSUER ||
        env.GROUND_EMAIL_MODE !== 'capture' || env.GROUND_SCHEDULED_WORK !== 'off' ||
        env.GROUND_METERED_DISPATCH !== 'off' || env.GROUND_SEED_MODE !== 'synthetic' ||
        (env.VERCEL_ENV && env.VERCEL_ENV !== (environment === 'preview' ? 'preview' : 'development')) ||
        (env.VERCEL === '1' && !env.VERCEL_ENV) ||
        typeof env.GROUND_AUTH_COOKIE_SECRET !== 'string' || env.GROUND_AUTH_COOKIE_SECRET.length < 32 ||
        origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
        !(origin.protocol === 'https:' || (environment === 'local' && origin.protocol === 'http:' && origin.hostname === 'localhost')) ||
        origin.origin === new URL(env.GROUND_PRODUCTION_ORIGIN).origin) return null;
    return Object.freeze({ environment, issuer: target.issuer, cookie: target.cookie, origin: origin.origin,
      secret: env.GROUND_AUTH_COOKIE_SECRET });
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
    if (typeof now === 'function') now = now();
    if (!(now instanceof Date)) return null;
    const milliseconds = Date.prototype.getTime.call(now);
    return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1_000_000n : null;
  } catch { return null; }
}

function expiryNanoseconds(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match || match[0] !== value) return null;
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

function validManagedIdentity(provider, config, nowNs) {
  const expiresAtNs = expiryNanoseconds(provider?.expiresAt);
  if (!provider || typeof provider.userId !== 'string' || !provider.userId.trim() || provider.userId.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(provider.userId) || provider.emailVerified !== true || provider.sessionUserId !== provider.userId ||
      typeof provider.sessionId !== 'string' || !provider.sessionId.trim() || provider.sessionId.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(provider.sessionId) || expiresAtNs === null || expiresAtNs <= nowNs) return null;
  return Object.freeze({ issuer: config.issuer, subject: provider.userId, sessionId: provider.sessionId, expiresAt: provider.expiresAt });
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
    const provider = snapshotManagedSession(result);
    const completedAtNs = clockNanoseconds(now);
    if (completedAtNs === null) return { ok: false, category: 'unavailable' };
    const identity = validManagedIdentity(provider, config, completedAtNs);
    return identity ? { ok: true, identity } : { ok: false, category: 'auth' };
  } catch {
    return { ok: false, category: 'unavailable' };
  }
}

function ownDataValue(object, key) {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) return { valid: false };
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return { valid: false, present: false };
  if (!Object.hasOwn(descriptor, 'value')) return { valid: false, present: true };
  return { valid: true, value: descriptor.value };
}

// Copy only the provider fields used by the private seed resolver, without invoking getters.
function snapshotManagedSession(result, includeEmail = false) {
  try {
    const topError = ownDataValue(result, 'error');
    const data = ownDataValue(result, 'data');
    if (!data.valid || (topError.present && (!topError.valid || topError.value))) return null;
    const user = ownDataValue(data.value, 'user');
    const session = ownDataValue(data.value, 'session');
    if (!user.valid || !session.valid) return null;
    const userId = ownDataValue(user.value, 'id');
    const email = includeEmail ? ownDataValue(user.value, 'email') : { valid: true, value: undefined };
    const emailVerified = ownDataValue(user.value, 'emailVerified');
    const sessionId = ownDataValue(session.value, 'id');
    const sessionUserId = ownDataValue(session.value, 'userId');
    const expiresAt = ownDataValue(session.value, 'expiresAt');
    if ([userId, email, emailVerified, sessionId, sessionUserId, expiresAt].some(field => !field.valid)) return null;
    return Object.freeze({ userId: userId.value, email: email.value, emailVerified: emailVerified.value,
      sessionId: sessionId.value, sessionUserId: sessionUserId.value, expiresAt: expiresAt.value });
  } catch { return null; }
}

/** Private context for the synthetic account-provisioning prerequisite; not a public identity response.
 * Email is copied from the same fresh provider result and returned only for an exact synthetic alias.
 * This does not create an account, select a role, or authorize any route.
 * @returns {Promise<{ok:true,identity:Readonly<{issuer:string,subject:string,sessionId:string,expiresAt:string,email:string,emailVerified:true}>}|{ok:false,category:'auth'|'unavailable'}>}
 */
export async function resolveSyntheticSeedIdentity(env, cookieHeader, getSession = managedSession, now = () => new Date()) {
  const config = sessionConfiguration(env);
  if (!config) return { ok: false, category: 'unavailable' };
  const allowedEmails = SYNTHETIC_SEED_EMAILS[config.environment];
  const token = sessionCookie(cookieHeader, config.cookie);
  if (!token) return { ok: false, category: 'auth' };
  if (clockNanoseconds(now) === null) return { ok: false, category: 'unavailable' };
  try {
    const result = await getSession(config, token);
    const provider = snapshotManagedSession(result, true);
    // Snapshot first: the injected clock callback must not be able to mutate provider data
    // between the SDK response and validation.
    const completedAtNs = clockNanoseconds(now);
    if (completedAtNs === null) return { ok: false, category: 'unavailable' };
    const expiresAtNs = provider ? expiryNanoseconds(provider.expiresAt) : null;
    if (!provider || typeof provider.userId !== 'string' || provider.userId.length !== 36 || !UUID.test(provider.userId) ||
        typeof provider.sessionId !== 'string' || provider.sessionId.length !== 36 || !UUID.test(provider.sessionId) ||
        provider.sessionUserId !== provider.userId || provider.emailVerified !== true ||
        typeof provider.email !== 'string' || !allowedEmails.has(provider.email) ||
        expiresAtNs === null || expiresAtNs <= completedAtNs) {
      return { ok: false, category: 'auth' };
    }
    const identity = Object.freeze({ issuer: config.issuer, subject: provider.userId,
      sessionId: provider.sessionId, expiresAt: provider.expiresAt, email: provider.email, emailVerified: true });
    return Object.freeze({ ok: true, identity });
  } catch {
    return { ok: false, category: 'unavailable' };
  }
}

/** Internal verified subject only; this does not create an application account or grant roles.
 * @returns {Promise<SessionIdentityResult>}
 */
export async function resolveSessionIdentity(env, cookieHeader, getSession = managedSession, now = () => new Date()) {
  const result = await readManagedSessionIdentity(env, cookieHeader, getSession, now);
  return result.ok ? { ok: true, identity: { issuer: result.identity.issuer, subject: result.identity.subject } } : result;
}

/** Fresh managed-auth identity context for trusted server checks; never return cookie or user profile data.
 * @returns {Promise<ManagedSessionIdentityResult>}
 */
export async function resolveManagedSessionIdentity(env, cookieHeader, getSession = managedSession, now = () => new Date()) {
  return readManagedSessionIdentity(env, cookieHeader, getSession, now);
}
