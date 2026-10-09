import assert from 'node:assert/strict';
import test from 'node:test';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { MEMBERSHIP_PLAN_CATALOG } from '../lib/membership-catalog.mjs';
import { readMembershipForRequest } from '../lib/membership-service.mjs';

const ISSUER = 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth';
const SUBJECT = 'verified-synthetic-subject';
const SESSION = 'verified-synthetic-session';
const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const NOW = '2030-01-01T00:00:00.000Z';
const target = PROFILE_TARGETS.local;
const connectionUrl = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
connectionUrl.username = target.role;
connectionUrl.password = 'synthetic-unit-fixture-only';

function environment(changes = {}) {
  return {
    GROUND_ENV: 'local', GROUND_PROFILE_MODE: 'enabled', GROUND_LOGIN_MODE: 'session-check',
    GROUND_AUTH_ISSUER: ISSUER, GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session',
    GROUND_AUTH_COOKIE_SECRET: 'synthetic-unit-signing-secret-only',
    GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
    GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
    GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
    GROUND_DATABASE_HOST: target.host, GROUND_DATABASE_BRANCH_ID: target.branch,
    GROUND_PROFILE_DATABASE_URL: connectionUrl.href,
    ...changes,
  };
}

const plan = MEMBERSHIP_PLAN_CATALOG[0];
const resultSnapshot = {
  ok: true,
  accountId: ACCOUNT,
  evaluatedAt: NOW,
  policy: { commercialMode: 'report_only', enforcedTestCohorts: 'explicit', checkoutEnabled: false,
    supplierTransactionsEnabled: false, updatedAt: NOW },
  baseAssignment: { assignmentId: '20000000-0000-4000-8000-000000000001',
    planVersionId: plan.version.id, planId: plan.plan.id, planKey: plan.plan.key, displayName: plan.plan.displayName,
    planStatus: 'active', versionNumber: plan.version.number, releaseTier: plan.version.releaseTier,
    featureDefinitions: structuredClone(plan.version.features), limitDefinitions: structuredClone(plan.version.limits),
    effectiveFrom: '2029-01-01T00:00:00.000Z', effectiveUntil: null, status: 'active', grantType: 'base' },
  effectiveLifetimeGrants: [], effectiveLifetimeGrant: null,
};
const successfulIdentity = Object.freeze({ ok: true, identity: Object.freeze({ issuer: ISSUER, subject: SUBJECT,
  sessionId: SESSION, expiresAt: '2031-01-01T00:00:00.000Z' }) });
const request = cookie => ({ headers: new Headers(cookie === undefined ? {} : { cookie }) });

test('derives narrow identity from fresh managed session, then performs one pinned read and returns no session/config data', async () => {
  const env = environment();
  const transactions = [];
  let resolveCalls = 0;
  const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-session-cookie'), env, {
    resolve: async (captured, cookie) => {
      resolveCalls += 1;
      assert.notEqual(captured, env);
      assert.equal(Object.isFrozen(captured), true);
      assert.equal(cookie, 'groundbnb_local_session=synthetic-session-cookie');
      // Mutating the caller-owned environment during the auth await must not retarget the DB call.
      env.GROUND_ENV = 'preview';
      return successfulIdentity;
    },
    transaction: async (config, statements, options) => {
      transactions.push({ config, statements, options });
      assert.equal(Object.isFrozen(config), true);
      return resultSnapshot;
    },
  });
  assert.equal(resolveCalls, 1);
  assert.equal(transactions.length, 1);
  assert.deepEqual(transactions[0].statements, [
    { statement: 'SET TRANSACTION READ WRITE', values: [] },
    { statement: 'SELECT groundbnb.read_membership($1,$2) AS result', values: [ISSUER, SUBJECT] },
  ]);
  assert.deepEqual(transactions[0].options, { readOnly: false });
  assert.equal(transactions[0].config.host, target.host);
  assert.equal(transactions[0].config.branch, target.branch);
  assert.match(transactions[0].config.connection, /groundbnb_local_app/);
  assert.deepEqual(result, resultSnapshot);
  assert.equal(Object.isFrozen(result.baseAssignment), true);
  for (const privateValue of ['synthetic-session-cookie', SESSION, 'expiresAt', connectionUrl.password, 'email']) {
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  }
});

test('profile/auth gate failures and missing cookies stop before resolver or database access', async () => {
  for (const env of [environment({ GROUND_PROFILE_MODE: 'off' }), environment({ GROUND_LOGIN_MODE: 'off' }),
    environment({ GROUND_ENV: 'production' }), environment({ GROUND_DATABASE_BRANCH_ID: 'foreign-branch' })]) {
    let resolveCalls = 0, queryCalls = 0;
    const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), env, {
      resolve: async () => { resolveCalls += 1; return successfulIdentity; },
      transaction: async () => { queryCalls += 1; return resultSnapshot; },
    });
    assert.deepEqual(result, { ok: false, category: 'unavailable' });
    assert.equal(resolveCalls, 0);
    assert.equal(queryCalls, 0);
  }
  for (const cookie of [undefined, '', 'other_cookie=synthetic',
    'groundbnb_local_session=a; groundbnb_local_session=b']) {
    let resolveCalls = 0, queryCalls = 0;
    const result = await readMembershipForRequest(request(cookie), environment(), {
      resolve: async () => { resolveCalls += 1; return successfulIdentity; },
      transaction: async () => { queryCalls += 1; return resultSnapshot; },
    });
    assert.deepEqual(result, { ok: false, category: 'auth' });
    assert.equal(resolveCalls, 0);
    assert.equal(queryCalls, 0);
  }
});

test('captures own string data fields from process-env-shaped objects and rejects accessors', async () => {
  const env = Object.setPrototypeOf(environment(), null);
  const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), env, {
    resolve: async captured => {
      assert.equal(Object.getPrototypeOf(captured), null);
      return successfulIdentity;
    },
    transaction: async () => resultSnapshot,
  });
  assert.equal(result.ok, true);

  const accessorEnv = environment();
  Object.defineProperty(accessorEnv, 'GROUND_ENV', { get() { throw new Error('must not execute getter'); } });
  let resolveCalls = 0;
  assert.deepEqual(await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), accessorEnv, {
    resolve: async () => { resolveCalls += 1; return successfulIdentity; },
    transaction: async () => resultSnapshot,
  }), { ok: false, category: 'unavailable' });
  assert.equal(resolveCalls, 0);
});

test('synthetic browser-auth run window is checked before auth, before DB, and after DB awaits', async () => {
  const runEnv = environment({ GROUND_BROWSER_AUTH_MODE: 'synthetic', GROUND_BROWSER_AUTH_RUN_ID: 'm1-y-run-01',
    GROUND_BROWSER_AUTH_START: '2030-01-01T00:00:00.000Z', GROUND_BROWSER_AUTH_UNTIL: '2030-01-01T00:10:00.000Z' });
  const open = Date.parse('2030-01-01T00:09:59.000Z');
  const closed = Date.parse('2030-01-01T00:10:00.000Z');

  let resolverCalls = 0, transactionCalls = 0;
  const closedBeforeResolver = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), runEnv, {
    clock: () => closed,
    resolve: async () => { resolverCalls += 1; return successfulIdentity; },
    transaction: async () => { transactionCalls += 1; return resultSnapshot; },
  });
  assert.deepEqual(closedBeforeResolver, { ok: false, category: 'unavailable' });
  assert.equal(resolverCalls, 0);

  const afterResolverClock = [open, closed];
  const closedDuringAuth = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), runEnv, {
    clock: () => afterResolverClock.shift(),
    resolve: async () => { resolverCalls += 1; return successfulIdentity; },
    transaction: async () => { transactionCalls += 1; return resultSnapshot; },
  });
  assert.deepEqual(closedDuringAuth, { ok: false, category: 'unavailable' });
  assert.equal(transactionCalls, 0);

  const afterDatabaseClock = [open, open, closed];
  const closedDuringRead = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), runEnv, {
    clock: () => afterDatabaseClock.shift(),
    resolve: async () => { resolverCalls += 1; return successfulIdentity; },
    transaction: async () => { transactionCalls += 1; return resultSnapshot; },
  });
  assert.deepEqual(closedDuringRead, { ok: false, category: 'unavailable' });
  assert.equal(resolverCalls, 2);
  assert.equal(transactionCalls, 1);
});

test('rejects a session expiring during auth or database await, using exact nanoseconds', async () => {
  const atStart = Date.parse('2030-01-01T00:00:00.000Z');
  const expiredAuthIdentity = { ok: true, identity: { ...successfulIdentity.identity,
    expiresAt: '2030-01-01T00:00:00.001Z' } };
  let transactionCalls = 0;
  const duringAuthClock = [atStart, atStart + 1];
  const duringAuth = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    clock: () => duringAuthClock.shift(),
    resolve: async () => expiredAuthIdentity,
    transaction: async () => { transactionCalls += 1; return resultSnapshot; },
  });
  assert.deepEqual(duringAuth, { ok: false, category: 'auth' });
  assert.equal(transactionCalls, 0);

  const duringReadClock = [atStart, atStart, atStart + 1];
  const duringRead = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    clock: () => duringReadClock.shift(),
    resolve: async () => expiredAuthIdentity,
    transaction: async () => { transactionCalls += 1; return resultSnapshot; },
  });
  assert.deepEqual(duringRead, { ok: false, category: 'auth' });
  assert.equal(transactionCalls, 1);

  const stillValidSubMillisecond = await readMembershipForRequest(
    request('groundbnb_local_session=synthetic-cookie'), environment(), {
      clock: () => atStart,
      resolve: async () => ({ ok: true, identity: { ...successfulIdentity.identity,
        expiresAt: '2030-01-01T00:00:00.000000001Z' } }),
      transaction: async () => resultSnapshot,
    });
  assert.equal(stillValidSubMillisecond.ok, true);
});

test('invalid injected clock fails closed before auth or query', async () => {
  for (const clock of [() => Number.NaN, () => 1.5, () => { throw new Error('clock failed'); }]) {
    let resolverCalls = 0, transactionCalls = 0;
    const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
      clock,
      resolve: async () => { resolverCalls += 1; return successfulIdentity; },
      transaction: async () => { transactionCalls += 1; return resultSnapshot; },
    });
    assert.deepEqual(result, { ok: false, category: 'unavailable' });
    assert.equal(resolverCalls, 0);
    assert.equal(transactionCalls, 0);
  }
});

test('only exact issuer-matched verified-session shape proceeds; no caller identity or account selector exists', async () => {
  const badResults = [
    { ok: true, identity: { ...successfulIdentity.identity, issuer: 'https://foreign.example.test' } },
    { ok: true, identity: { ...successfulIdentity.identity, email: 'synthetic@example.test' } },
    { ok: true, identity: { ...successfulIdentity.identity, subject: '' } },
    { ok: true, identity: { ...successfulIdentity.identity, expiresAt: '2030-02-31T00:00:00Z' } },
    { ok: true, identity: { ...successfulIdentity.identity, sessionId: 'session\nforged' } },
    { ok: false, category: 'admin' },
  ];
  for (const identityResult of badResults) {
    let queryCalls = 0;
    const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
      resolve: async () => identityResult,
      transaction: async () => { queryCalls += 1; return resultSnapshot; },
    });
    assert.deepEqual(result, { ok: false, category: 'unavailable' });
    assert.equal(queryCalls, 0);
  }
  const result = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    accountId: ACCOUNT,
    resolve: async () => successfulIdentity,
    transaction: async () => resultSnapshot,
  });
  assert.deepEqual(result, { ok: false, category: 'unavailable' });
});

test('maps resolver denials and reader/query failures to closed sanitized results', async () => {
  const auth = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    resolve: async () => ({ ok: false, category: 'auth' }), transaction: async () => assert.fail('must not query'),
  });
  assert.deepEqual(auth, { ok: false, category: 'auth' });
  const unavailable = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    resolve: async () => successfulIdentity, transaction: async () => { throw new Error('private database details'); },
  });
  assert.deepEqual(unavailable, { ok: false, category: 'membership_unavailable' });
  assert.equal(JSON.stringify(unavailable).includes('private database details'), false);
  const missingBase = await readMembershipForRequest(request('groundbnb_local_session=synthetic-cookie'), environment(), {
    resolve: async () => successfulIdentity,
    transaction: async () => ({ ...resultSnapshot, baseAssignment: null }),
  });
  assert.deepEqual(missingBase, { ok: false, category: 'membership_unavailable' });
});
