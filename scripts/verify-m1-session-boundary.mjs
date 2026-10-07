import { randomBytes } from 'node:crypto';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';
import { resolveSessionIdentity } from '../lib/session-identity.mjs';
import { createHash } from 'node:crypto';

const issuers = Object.freeze({
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  production: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
let phase = 'input';
let responseStatus = null;
const deadline = setTimeout(() => process.exit(1), 140000);
const activeSessions = [];
const results = [];
let distinctPublicKeys = null;
let loginShape = null;

async function request(kind, path, body, cookie = '') {
  const response = await fetch(`${issuers[kind]}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { Origin: new URL(issuers[kind]).origin, ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  responseStatus = response.status;
  if (!response.ok) throw new Error('Auth request failed');
  const data = await response.json();
  const cookies = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return { data, cookies };
}

try {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 8192) throw new Error('Too large');
  }
  const { accounts, startedAtUtc } = JSON.parse(input);
  input = '';
  const startedAt = new Date(startedAtUtc);
  if (!Number.isFinite(startedAt.getTime()) || Date.now() - startedAt > 3600000 || startedAt > new Date() ||
      accounts?.length !== 2 || accounts[0].kind !== 'preview' || accounts[1].kind !== 'local' ||
      accounts[0].user === accounts[1].user || accounts.some(account => account.host !== 'smtp.ethereal.email' ||
        account.port !== 587 || typeof account.user !== 'string' || !account.user.endsWith('@ethereal.email') ||
        typeof account.pass !== 'string' || !account.pass)) throw new Error('Unexpected target');
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');

  phase = 'public_keys';
  const fingerprints = [];
  for (const kind of Object.keys(issuers)) {
    const { data } = await request(kind, '/.well-known/jwks.json');
    if (!Array.isArray(data.keys) || !data.keys.length) throw new Error('Missing public keys');
    fingerprints.push(createHash('sha256').update(JSON.stringify(data.keys.map(key =>
      ({ kty: key.kty, n: key.n, e: key.e, x: key.x, y: key.y, crv: key.crv })))).digest('hex'));
  }
  if (new Set(fingerprints).size !== 3) throw new Error('Shared signing keys');
  distinctPublicKeys = true;

  async function capturedOtp(account, sentAt) {
    const client = new ImapFlow({ host: 'imap.ethereal.email', port: 993, secure: true,
      auth: { user: account.user, pass: account.pass }, tls: { rejectUnauthorized: true },
      logger: false, logRaw: false, emitLogs: false, disableAutoIdle: true,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 });
    client.on('error', () => {});
    try {
      await client.connect();
      for (let attempt = 0; attempt < 8; attempt++) {
        const lock = await client.getMailboxLock('INBOX', { readOnly: true });
        try {
          const count = client.mailbox.exists;
          if (!client.mailbox.readOnly || !Number.isInteger(count) || count > 10) throw new Error('Mailbox bound');
          if (count > 0) {
            const messages = await client.fetchAll(`1:${count}`, { envelope: true, internalDate: true, size: true });
            for (const message of messages.reverse()) {
              if (message.internalDate < sentAt || message.size > 50000 ||
                  !message.envelope?.to?.some(to => to.address === `${account.kind}-01@example.test`) ||
                  !message.envelope?.from?.some(from => from.address === account.user)) continue;
              const full = await client.fetchOne(message.uid, { source: true }, { uid: true });
              const mail = await simpleParser(full.source, { skipTextToHtml: true, skipImageLinks: true });
              const codes = new Set((mail.text ?? '').match(/\b\d{6}\b/g) ?? []);
              if (codes.size === 1) return [...codes][0];
            }
          }
        } finally { lock.release(); }
        if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Captured OTP unavailable');
    } finally { client.close(); }
  }

  for (const account of accounts) {
    const kind = account.kind;
    const email = `${kind}-01@example.test`;
    const sentAt = new Date();
    phase = `${kind}_otp_send`;
    await request(kind, '/email-otp/send-verification-otp', { email, type: 'sign-in' });
    phase = `${kind}_otp_capture`;
    const otp = await capturedOtp(account, sentAt);
    phase = `${kind}_sign_in`;
    const login = await request(kind, '/sign-in/email-otp', { email, otp });
    if (login.cookies) activeSessions.push({ kind, cookie: login.cookies });
    loginShape = { cookiePresent: Boolean(login.cookies), userPresent: Boolean(login.data?.user),
      wrappedUserPresent: Boolean(login.data?.data?.user), tokenPresent: typeof login.data?.token === 'string',
      emailMatches: login.data?.user?.email === email, emailVerified: login.data?.user?.emailVerified === true,
      ordinaryRole: !login.data?.user?.role || login.data.user.role === 'user' };
    if (!login.cookies || !loginShape.emailMatches || !loginShape.ordinaryRole) throw new Error('Unexpected sign-in');
    // Dedicated ordinary fixture only: remove any session left by a failed diagnostic.
    phase = `${kind}_prior_session_cleanup`;
    await request(kind, '/revoke-other-sessions', {}, login.cookies);
    const sessions = await request(kind, '/list-sessions', null, login.cookies);
    if (!Array.isArray(sessions.data) || sessions.data.length !== 1) throw new Error('Unexpected sessions');
    phase = `${kind}_own_session`;
    const own = await request(kind, '/get-session?disableCookieCache=true', null, login.cookies);
    if (own.data?.user?.email !== email || !own.data.session || own.data.user.emailVerified !== true ||
        (own.data.user.role && own.data.user.role !== 'user')) throw new Error('Own verified ordinary session missing');
    for (const other of Object.keys(issuers).filter(target => target !== kind)) {
      phase = `${kind}_rejected_by_${other}`;
      const foreign = await request(other, '/get-session?disableCookieCache=true', null, login.cookies);
      if (foreign.data?.user || foreign.data?.session) throw new Error('Foreign session accepted');
    }
    phase = `${kind}_sdk_session`;
    const nativeCookie = login.cookies.split(';').map(part => part.trim())
      .find(part => part.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`));
    if (!nativeCookie) throw new Error('Managed SDK session cookie missing');
    const token = nativeCookie.slice(NEON_AUTH_SESSION_COOKIE_NAME.length + 1);
    const appCookieName = `groundbnb_${kind}_session`;
    const sdkEnv = {
      GROUND_ENV: kind, GROUND_LOGIN_MODE: 'session-check', GROUND_AUTH_ISSUER: issuers[kind],
      GROUND_AUTH_COOKIE_NAME: appCookieName, GROUND_AUTH_COOKIE_SECRET: randomBytes(32).toString('base64'),
      GROUND_PRODUCTION_AUTH_ISSUER: issuers.production, GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
      GROUND_PUBLIC_ORIGIN: kind === 'local' ? 'http://localhost:3000' : new URL(issuers[kind]).origin,
      GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
    };
    const ownSdk = await resolveSessionIdentity(sdkEnv, `${appCookieName}=${token}`);
    if (!ownSdk.ok || ownSdk.identity.subject !== own.data.user.id) throw new Error('SDK identity mismatch');
    const foreignKind = kind === 'preview' ? 'local' : 'preview';
    const foreignSdkEnv = { ...sdkEnv, GROUND_ENV: foreignKind, GROUND_AUTH_ISSUER: issuers[foreignKind],
      GROUND_AUTH_COOKIE_NAME: `groundbnb_${foreignKind}_session`,
      GROUND_PUBLIC_ORIGIN: foreignKind === 'local' ? 'http://localhost:3000' : new URL(issuers[foreignKind]).origin };
    const foreignSdk = await resolveSessionIdentity(foreignSdkEnv, `${foreignSdkEnv.GROUND_AUTH_COOKIE_NAME}=${token}`);
    if (foreignSdk.ok) throw new Error('SDK accepted foreign session');
    phase = `${kind}_sign_out`;
    await request(kind, '/sign-out', {}, login.cookies);
    const loggedOut = await request(kind, '/get-session?disableCookieCache=true', null, login.cookies);
    if (loggedOut.data?.user || loggedOut.data?.session) throw new Error('Signout incomplete');
    const loggedOutSdk = await resolveSessionIdentity(sdkEnv, `${appCookieName}=${token}`);
    if (loggedOutSdk.ok) throw new Error('SDK accepted signed-out session');
    activeSessions.pop();
    results.push({ kind, ok: true, ownSessionVerified: true, otherSessionRejected: true,
      productionRejected: true, signOutVerified: true, sdkOwnSessionVerified: true, sdkForeignRejected: true, sdkSignOutVerified: true });
  }
  process.stdout.write(JSON.stringify({ ok: true, checkedAtUtc: new Date().toISOString(), distinctPublicKeys, results }));
} catch {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'auth_check_failed', phase, status: responseStatus, distinctPublicKeys, loginShape, results }));
  process.exitCode = 1;
} finally {
  for (const session of activeSessions) {
    try { await request(session.kind, '/sign-out', {}, session.cookie); } catch { /* Fail closed; report no secret details. */ }
  }
  clearTimeout(deadline);
}
