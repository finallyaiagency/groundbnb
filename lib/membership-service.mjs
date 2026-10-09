import { sessionConfiguration, sessionCookie, resolveManagedSessionIdentity } from './session-identity.mjs';
import { profileConfiguration } from './profile-persistence.mjs';
import { browserAuthConfiguration } from './browser-auth.mjs';
import { createMembershipPostgresRepository } from './membership-postgres-repository.mjs';

const QUERY_DEPS = ['resolve', 'transaction', 'clock'];
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, keys) => plainRecord(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const opaqueIdentity = value => typeof value === 'string' && value.length > 0 && value.length <= 200 &&
  value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function sessionExpiryNanoseconds(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, fraction = '', zone, , offsetH, offsetM] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!year || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null;
  if (zone !== 'Z' && (Number(offsetH) > 14 || Number(offsetM) > 59 ||
      (Number(offsetH) === 14 && Number(offsetM) !== 0))) return null;
  const wholeSecond = value.replace(/\.\d+(?=Z|[+-])/, '');
  const wholeSecondMilliseconds = Date.parse(wholeSecond);
  if (!Number.isFinite(wholeSecondMilliseconds)) return null;
  return BigInt(wholeSecondMilliseconds) * 1_000_000n + BigInt((fraction + '000000000').slice(0, 9));
}

function currentNanoseconds(clock) {
  try {
    const milliseconds = clock();
    if (!Number.isSafeInteger(milliseconds)) return null;
    return BigInt(milliseconds) * 1_000_000n;
  } catch { return null; }
}

function captureEnvironment(env) {
  try {
    if (env === null || typeof env !== 'object' || Array.isArray(env)) return null;
    const captured = Object.create(null);
    for (const key of Object.keys(env)) {
      const descriptor = Object.getOwnPropertyDescriptor(env, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') return null;
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch { return null; }
}

function normalizeIdentity(result, expectedIssuer) {
  if (exactKeys(result, ['ok', 'category']) && result.ok === false && ['auth', 'unavailable'].includes(result.category)) {
    return { ok: false, category: result.category };
  }
  if (!exactKeys(result, ['ok', 'identity']) || result.ok !== true ||
      !exactKeys(result.identity, ['issuer', 'subject', 'sessionId', 'expiresAt']) ||
      result.identity.issuer !== expectedIssuer || !opaqueIdentity(result.identity.subject) ||
      !opaqueIdentity(result.identity.sessionId)) {
    return { ok: false, category: 'unavailable' };
  }
  const expiresAtNs = sessionExpiryNanoseconds(result.identity.expiresAt);
  if (expiresAtNs === null) return { ok: false, category: 'unavailable' };
  // Deliberately extract only the fields needed by the owner-scoped reader.
  return { ok: true, identity: Object.freeze({ issuer: expectedIssuer, subject: result.identity.subject }), expiresAtNs };
}

async function executeMembershipBatch(configuration, statements, options) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(configuration.connection);
  const commands = statements.map(({ statement, values }) => sql.query(statement, values));
  const results = await sql.transaction(commands, {
    readOnly: options.readOnly,
    fetchOptions: { signal: AbortSignal.timeout(8000), cache: 'no-store' },
  });
  return results?.[1]?.[0]?.result;
}

/**
 * Server-only membership read. It has no route or client binding. The request
 * supplies only its cookie header; identity and account ownership are resolved
 * server-side, and the database URL remains in the local configuration closure.
 * The reader needs a row-locking, read-write transaction; the fixed batch has
 * no product-data DML and never retries.
 */
export async function readMembershipForRequest(request, env, dependencies = {}) {
  try {
    if (!plainRecord(dependencies) || Object.keys(dependencies).some(key => !QUERY_DEPS.includes(key)) ||
        (dependencies.resolve !== undefined && typeof dependencies.resolve !== 'function') ||
        (dependencies.transaction !== undefined && typeof dependencies.transaction !== 'function') ||
        (dependencies.clock !== undefined && typeof dependencies.clock !== 'function')) {
      return { ok: false, category: 'unavailable' };
    }
    const capturedEnv = captureEnvironment(env);
    if (!capturedEnv) return { ok: false, category: 'unavailable' };
    const sessionConfig = sessionConfiguration(capturedEnv);
    const profileConfig = profileConfiguration(capturedEnv);
    if (!sessionConfig || !profileConfig || sessionConfig.issuer !== profileConfig.issuer) {
      return { ok: false, category: 'unavailable' };
    }
    const configuration = Object.freeze({ ...profileConfig });
    const clock = dependencies.clock ?? Date.now;
    const windowOpen = now => capturedEnv.GROUND_BROWSER_AUTH_MODE !== 'synthetic' ||
      Boolean(browserAuthConfiguration(capturedEnv, now));
    const beforeAuthNs = currentNanoseconds(clock);
    if (beforeAuthNs === null || !windowOpen(Number(beforeAuthNs / 1_000_000n))) return { ok: false, category: 'unavailable' };
    const cookie = request?.headers?.get?.('cookie');
    if (!sessionCookie(cookie, sessionConfig.cookie)) return { ok: false, category: 'auth' };
    const resolver = dependencies.resolve ?? resolveManagedSessionIdentity;
    const identityResult = normalizeIdentity(await resolver(capturedEnv, cookie), sessionConfig.issuer);
    if (!identityResult.ok) return identityResult;
    const afterAuthNs = currentNanoseconds(clock);
    if (afterAuthNs === null || !windowOpen(Number(afterAuthNs / 1_000_000n))) return { ok: false, category: 'unavailable' };
    if (identityResult.expiresAtNs <= afterAuthNs) return { ok: false, category: 'auth' };
    const transaction = dependencies.transaction ?? executeMembershipBatch;
    const repository = createMembershipPostgresRepository((statement, values) =>
      transaction(configuration, [
        { statement: 'SET TRANSACTION READ WRITE', values: [] },
        { statement, values },
      ], { readOnly: false }));
    const membership = await repository.readMembership(identityResult.identity);
    const afterReadNs = currentNanoseconds(clock);
    if (afterReadNs === null || !windowOpen(Number(afterReadNs / 1_000_000n))) return { ok: false, category: 'unavailable' };
    if (identityResult.expiresAtNs <= afterReadNs) return { ok: false, category: 'auth' };
    return membership;
  } catch {
    return { ok: false, category: 'unavailable' };
  }
}
