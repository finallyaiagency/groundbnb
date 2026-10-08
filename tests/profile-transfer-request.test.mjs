import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { handleProfileTransferRequest } from '../lib/profile-transfer-request.mjs';

const target = PROFILE_TARGETS.local;
const url = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
url.username = target.role;
url.password = 'synthetic-fixture';
const now = Date.now();
const env = {
  GROUND_ENV: 'local', GROUND_PROFILE_MODE: 'enabled', GROUND_PROFILE_DOMAIN_MODE: 'full-v1',
  GROUND_PROFILE_RECORDS_MODE: 'manual-v1', GROUND_PROFILE_TRANSFER_MODE: 'reviewed-v1',
  GROUND_LOGIN_MODE: 'session-check', GROUND_PROFILE_DATABASE_URL: url.href,
  GROUND_DATABASE_HOST: target.host, GROUND_DATABASE_BRANCH_ID: target.branch,
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session', GROUND_AUTH_COOKIE_SECRET: 'synthetic-signing-fixture-unit-only',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_BROWSER_AUTH_MODE: 'synthetic', GROUND_BROWSER_AUTH_RUN_ID: 'transfer-run-2026',
  GROUND_BROWSER_AUTH_START: new Date(now - 1000).toISOString(),
  GROUND_BROWSER_AUTH_UNTIL: new Date(now + 60_000).toISOString(),
};
const identity = { issuer: env.GROUND_AUTH_ISSUER, subject: 'synthetic-subject' };
const operationId = '00000000-0000-4000-8000-000000000002';
const payload = { operationId, expectedRevision: 3, patch: { hasPets: { value: false, answered: true } } };
const accountId = '00000000-0000-4000-8000-000000000001';
const saved = {
  ok: true, operationKind: 'profile_transfer', operationId, savedAt: '2026-10-08T12:00:00.000Z',
  affectedIds: [accountId],
  profile: { accountId, revision: 4,
    answers: { hasPets: { value: false, answered: true, scope: 'account', updatedAt: '2026-10-08T12:00:00.000000+00:00' } },
    vehicles: [], notes: [] },
};
const request = (body = JSON.stringify(payload), changes = {}) => new Request('http://localhost:3000/api/account/profile/transfer', {
  method: 'PATCH', body,
  headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin',
    cookie: 'groundbnb_local_session=synthetic-token', ...changes },
});
const resolve = async () => ({ ok: true, identity });

test('transfer handler requires live profile gates, valid synthetic run window, same origin, and patch JSON', async () => {
  let calls = 0;
  const store = async () => { calls++; return saved; };
  assert.equal((await handleProfileTransferRequest(request(), { ...env, GROUND_PROFILE_TRANSFER_MODE: 'off' }, resolve, store)).status, 503);
  assert.equal((await handleProfileTransferRequest(request(), { ...env, GROUND_BROWSER_AUTH_UNTIL: new Date(now - 1).toISOString() }, resolve, store)).status, 503);
  for (const req of [
    request(undefined, { origin: 'https://foreign.example.test' }),
    request(undefined, { 'sec-fetch-site': 'cross-site' }),
    request(undefined, { 'content-type': 'text/plain' }),
    new Request('http://localhost:3000/api/account/profile/transfer?accountId=foreign', { method: 'PATCH',
      body: JSON.stringify(payload), headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json' } }),
  ]) assert.equal((await handleProfileTransferRequest(req, env, resolve, store)).status, 400);
  assert.equal(calls, 0);
});

test('transfer request requires fresh authenticated identity and rejects closed-body violations before storage', async () => {
  let calls = 0;
  let resolveCalls = 0;
  const resolveFresh = async (...args) => { resolveCalls++; assert.equal(args[0], env); return { ok: true, identity }; };
  const store = async () => { calls++; return saved; };
  const invalidUtf8 = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]);
  const invalid = [
    request('not-json'), request('null'), request('[]'), request(' '.repeat(16_385)),
    request(JSON.stringify({ ...payload, accountId })), request(JSON.stringify({ ...payload, issuer: identity.issuer })),
    request(JSON.stringify({ ...payload, kind: 'save' })), request(invalidUtf8),
  ];
  for (const req of invalid) assert.equal((await handleProfileTransferRequest(req, env, resolveFresh, store)).status, 400);
  assert.equal(resolveCalls, 8);
  assert.equal(calls, 0);
  assert.equal((await handleProfileTransferRequest(request(), env, async () => ({ ok: false, category: 'auth' }), store)).status, 401);
  assert.equal(calls, 0);
});

test('successful transfer sends only the server-assigned kind and exposes only the safe acknowledgment', async () => {
  let calls = 0;
  const response = await handleProfileTransferRequest(request(), env, async (_env, cookie) => {
    assert.equal(cookie, 'groundbnb_local_session=synthetic-token');
    return { ok: true, identity };
  }, async (_env, owner, operation) => {
    calls++;
    assert.deepEqual(owner, identity);
    assert.deepEqual(operation, { ...payload, kind: 'transfer' });
    return { ...saved, privateDiagnostic: 'must not leak', databaseUrl: 'secret' };
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
  const body = await response.json();
  assert.equal(body.operationKind, 'profile_transfer');
  assert.equal(body.profile.revision, 4);
  assert.equal(body.privateDiagnostic, undefined);
  assert.equal(body.databaseUrl, undefined);
  assert.equal(calls, 1);
});

test('conflict details are reviewable; uncertain storage response is private and never retried automatically', async () => {
  const conflict = await handleProfileTransferRequest(request(), env, resolve, async () => ({ ok: false,
    category: 'conflict', currentRevision: 5,
    fieldComparison: { profileFields: { hasPets: { current: { value: true }, proposed: { value: false } } }, notes: {} },
    privateDiagnostic: 'must not leak' }));
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.currentRevision, 5);
  assert.equal(body.privateDiagnostic, undefined);
  assert.equal(body.fieldComparison.profileFields.hasPets.proposed.value, false);
  let calls = 0;
  const failed = await handleProfileTransferRequest(request(), env, resolve, async () => { calls++; throw new Error('private provider detail'); });
  assert.equal(failed.status, 503);
  const failure = await failed.json();
  assert.equal(failure.retryable, true);
  assert.equal(JSON.stringify(failure).includes('private provider detail'), false);
  assert.equal(calls, 1);
});
