import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProfileRequest } from '../lib/profile-request.mjs';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';

const target = PROFILE_TARGETS.local;
const fixtureUrl = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
fixtureUrl.username = target.role;
fixtureUrl.password = 'synthetic-test-only';
const env = {
  GROUND_ENV: 'local', GROUND_PROFILE_MODE: 'enabled', GROUND_LOGIN_MODE: 'session-check',
  GROUND_PROFILE_DATABASE_URL: fixtureUrl.href, GROUND_DATABASE_HOST: target.host, GROUND_DATABASE_BRANCH_ID: target.branch,
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session', GROUND_AUTH_COOKIE_SECRET: 'synthetic-signing-secret-unit-fixture-only',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
};
const identity = { issuer: env.GROUND_AUTH_ISSUER, subject: 'synthetic-subject' };
const payload = { operationId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0,
  patch: { hasPets: { answered: true, value: false } } };
function patch(body = JSON.stringify(payload), changes = {}) {
  return new Request('http://localhost:3000/api/account/profile', { method: 'PATCH', body,
    headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json',
      'sec-fetch-site': 'same-origin', cookie: 'groundbnb_local_session=synthetic-token', ...changes } });
}
const resolve = async () => ({ ok: true, identity });

test('invalid UTF-8 is refused without replacing the users input or reaching storage',async()=>{
  let calls=0;
  const response=await handleProfileRequest(patch(new Uint8Array([0x7b,0x22,0xc3,0x22,0x7d])),env,resolve,
    async()=>{calls++;return {ok:true};});
  assert.equal(response.status,400);assert.equal(calls,0);
});

test('manual record capability requires explicit modes and canonical record arrays',async()=>{
  const profile={accountId:'synthetic-account',revision:0,answers:{},vehicles:[],notes:[]};
  for(const [change,snapshot,expected] of [
    [{GROUND_PROFILE_DOMAIN_MODE:'full-v1',GROUND_PROFILE_RECORDS_MODE:'manual-v1'},profile,'manual-v1'],
    [{GROUND_PROFILE_DOMAIN_MODE:'full-v1'},profile,'off'],
    [{GROUND_PROFILE_RECORDS_MODE:'manual-v1'},profile,'off'],
    [{GROUND_PROFILE_DOMAIN_MODE:'full-v1',GROUND_PROFILE_RECORDS_MODE:'manual-v1'},{...profile,notes:undefined},'off']]) {
    const response=await handleProfileRequest(new Request('http://localhost:3000/api/account/profile'),
      {...env,...change},resolve,async()=>({ok:true,profile:snapshot,recordsMode:'forged'}));
    assert.equal((await response.json()).recordsMode,expected);
  }
});

test('successful profile reads expose only the server-configured editor mode', async () => {
  for (const mode of [undefined, 'off', 'full-v1']) {
    const response = await handleProfileRequest(new Request('http://localhost:3000/api/account/profile'),
      { ...env, GROUND_PROFILE_DOMAIN_MODE: mode }, resolve, async () => ({ ok: true,
        profile: { accountId: 'synthetic-account', revision: 0, answers: {} }, profileMode: 'client-must-not-select' }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).profileMode, mode === 'full-v1' ? 'full-v1' : 'smoke');
  }
});

test('profile route refuses disabled configuration, foreign origins, non-JSON and selector queries before adapters', async () => {
  let calls = 0;
  const denied = async () => { calls++; throw new Error('should not call'); };
  assert.equal((await handleProfileRequest(patch(), { ...env, GROUND_PROFILE_MODE: 'off' }, denied, denied)).status, 503);
  for (const request of [patch(undefined, { origin: 'https://foreign.example.test' }),
    patch(undefined, { 'sec-fetch-site': 'cross-site' }), patch(undefined, { 'content-type': 'text/plain' }),
    new Request('http://localhost:3000/api/account/profile?accountId=foreign')]) {
    assert.equal((await handleProfileRequest(request, env, denied, denied)).status, 400);
  }
  assert.equal(calls, 0);
});

test('unauthenticated profile request cannot touch storage and all responses are private/no-store', async () => {
  let calls = 0;
  const response = await handleProfileRequest(patch(), env, async () => ({ ok: false, category: 'auth' }), async () => { calls++; });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(calls, 0);
});

test('malformed, oversized without Content-Length, and owner-bearing JSON never reaches storage', async () => {
  let calls = 0;
  const store = async () => { calls++; };
  for (const body of ['invalid-json', 'null', '[]', ' '.repeat(16385), JSON.stringify({ ...payload, accountId: 'foreign' })]) {
    const response = await handleProfileRequest(patch(body), env, resolve, store);
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('canonical saved response passes verified identity and operation exactly once without reflected adapter diagnostics', async () => {
  let calls = 0;
  const response = await handleProfileRequest(patch(), env, resolve, async (_env, suppliedIdentity, operation) => {
    calls++;
    assert.deepEqual(suppliedIdentity, identity);
    assert.deepEqual(operation, { ...payload, kind: 'save' });
    return { ok: true, operationId: payload.operationId, savedAt: '2026-10-07T20:00:00.000Z', affectedIds: ['synthetic-account'],
      profile: { accountId: 'synthetic-account', revision: 1, answers: {} }, privateDiagnostic: 'must-not-reflect' };
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.profile.revision, 1);
  assert.equal(body.operationId, payload.operationId);
  assert.equal(Object.hasOwn(body, 'privateDiagnostic'), false);
  assert.equal(calls, 1);
});

test('conflicts retain field comparisons; storage/transport exceptions are retryable and never retried automatically', async () => {
  const conflict = await handleProfileRequest(patch(), env, resolve, async () => ({ ok: false, category: 'conflict', currentRevision: 2,
    fieldComparison: { hasPets: { current: true, proposed: false } }, privateDiagnostic: 'must-not-reflect' }));
  assert.equal(conflict.status, 409);
  const comparison = await conflict.json();
  assert.equal(comparison.currentRevision, 2);
  assert.deepEqual(comparison.fieldComparison.hasPets, { current: true, proposed: false });
  assert.equal(Object.hasOwn(comparison, 'privateDiagnostic'), false);
  let calls = 0;
  const failed = await handleProfileRequest(patch(), env, resolve, async () => { calls++; throw new Error('private driver detail'); });
  assert.equal(failed.status, 503);
  const failure = await failed.json();
  assert.equal(failure.retryable, true);
  assert.equal(JSON.stringify(failure).includes('private driver detail'), false);
  assert.equal(calls, 1);
});
