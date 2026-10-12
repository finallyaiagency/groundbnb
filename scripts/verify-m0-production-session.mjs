// Client-only private pipe. Never print an email, OTP, session or provider error.
const issuers = Object.freeze({
  production: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  preview: 'https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  local: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
});
let phase = 'input';
let status = null;
let cookie = '';
let cleanupVerified = null;
let result;
const deadline = setTimeout(() => process.exit(1), 60000);
async function request(kind, path, body, sessionCookie = '') {
  const response = await fetch(`${issuers[kind]}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { Origin: new URL(issuers[kind]).origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  status = response.status;
  if (!response.ok) throw new Error('Request failed');
  return { data: await response.json(),
    cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
}
try {
  if (process.env.M0_CLIENT_PRIVATE_PIPE !== '1') throw new Error('Client wrapper required');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 2048) throw new Error('Input bound');
  }
  const { mode, email, otp } = JSON.parse(input);
  input = '';
  if (!['send', 'verify'].includes(mode) || typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      email.toLowerCase().endsWith('.test') || email.toLowerCase().endsWith('@ethereal.email')) throw new Error('Real client identity required');
  if (mode === 'send') {
    phase = 'production_otp_send';
    await request('production', '/email-otp/send-verification-otp', { email, type: 'sign-in' });
    result = { ok: true, phase: 'production_otp_request_accepted', status };
  } else {
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw new Error('OTP required');
    phase = 'production_sign_in';
    const login = await request('production', '/sign-in/email-otp', { email, otp });
    cookie = login.cookie;
    if (!cookie || login.data?.user?.email !== email ||
        (login.data.user.role && login.data.user.role !== 'user')) throw new Error('Ordinary account required');
    phase = 'production_own_session';
    const own = await request('production', '/get-session?disableCookieCache=true', null, cookie);
    if (own.data?.user?.email !== email || !own.data.session ||
        (own.data.user.role && own.data.user.role !== 'user')) throw new Error('Own session missing');
    for (const kind of ['preview', 'local']) {
      phase = `production_rejected_by_${kind}`;
      const foreign = await request(kind, '/get-session?disableCookieCache=true', null, cookie);
      if (foreign.data?.user || foreign.data?.session) throw new Error('Foreign session accepted');
    }
    result = { ok: true, productionOwnSessionVerified: true, previewRejected: true, localRejected: true };
  }
} catch { result = { ok: false, phase, status }; }
finally {
  if (cookie) {
    try {
      await request('production', '/sign-out', {}, cookie);
      const ended = await request('production', '/get-session?disableCookieCache=true', null, cookie);
      cleanupVerified = !ended.data?.user && !ended.data?.session;
    } catch { cleanupVerified = false; }
    cookie = '';
  }
  clearTimeout(deadline);
}
if (cleanupVerified === false) result.ok = false;
process.stdout.write(JSON.stringify({ ...result, cleanupVerified, checkedAtUtc: new Date().toISOString() }));
if (!result.ok) process.exitCode = 1;
