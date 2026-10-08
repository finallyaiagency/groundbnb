import { createAuthServer, NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';

const TARGETS = Object.freeze({
  preview: { issuer: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_preview_session' },
  local: { issuer: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth', cookie: 'groundbnb_local_session' },
});
const PRODUCTION_ISSUER = 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';

export function sessionConfiguration(env) {
  const target = TARGETS[env.GROUND_ENV];
  try {
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

/** Internal verified subject only; this does not create an application account or grant roles. */
export async function resolveSessionIdentity(env, cookieHeader, getSession = managedSession, now = new Date()) {
  const config = sessionConfiguration(env);
  if (!config) return { ok: false, category: 'unavailable' };
  const token = sessionCookie(cookieHeader, config.cookie);
  if (!token) return { ok: false, category: 'auth' };
  try {
    const result = await getSession(config, token);
    const { user, session } = result?.data ?? {};
    if (result?.error || typeof user?.id !== 'string' || !user.id || user.id.length > 200 ||
        user.emailVerified !== true || session?.userId !== user.id ||
        typeof session.id !== 'string' || !session.id ||
        !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now.getTime()) {
      return { ok: false, category: 'auth' };
    }
    return { ok: true, identity: { issuer: config.issuer, subject: user.id } };
  } catch {
    return { ok: false, category: 'unavailable' };
  }
}
