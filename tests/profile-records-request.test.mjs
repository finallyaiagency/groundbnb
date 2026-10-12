import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { validateProfileRecordsOperation, persistProfileRecords } from '../lib/profile-records-persistence.mjs';
import { handleProfileRecordsRequest } from '../lib/profile-records-request.mjs';

const target = PROFILE_TARGETS.local;
const databaseUrl = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
databaseUrl.username = target.role;
databaseUrl.password = 'offline-only-fixture';
const now = Date.now();
const env = {
  GROUND_ENV: 'local', GROUND_PROFILE_MODE: 'enabled', GROUND_PROFILE_DOMAIN_MODE: 'full-v1',
  GROUND_PROFILE_RECORDS_MODE: 'manual-v1', GROUND_LOGIN_MODE: 'session-check',
  GROUND_PROFILE_DATABASE_URL: databaseUrl.href, GROUND_DATABASE_HOST: target.host,
  GROUND_DATABASE_BRANCH_ID: target.branch,
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session', GROUND_AUTH_COOKIE_SECRET: 'offline-only-signing-fixture-value',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_BROWSER_AUTH_MODE: 'synthetic', GROUND_BROWSER_AUTH_RUN_ID: 'records-offline-run',
  GROUND_BROWSER_AUTH_START: new Date(now - 1000).toISOString(),
  GROUND_BROWSER_AUTH_UNTIL: new Date(now + 60_000).toISOString(),
};
const identity = { issuer: env.GROUND_AUTH_ISSUER, subject: 'offline-synthetic-subject' };
const accountId = '00000000-0000-4000-8000-000000000001';
const operationId = '00000000-0000-4000-8000-000000000002';
const vehicleId = '00000000-0000-4000-8000-000000000003';
const noteId = '00000000-0000-4000-8000-000000000004';
const vehicle = {
  id: vehicleId, name: 'Synthetic vehicle', type: 'Van', ownership: 'owned', propulsion: null,
  fuelEconomy: { value: 18, unit: 'US mpg' }, dimensions: null, location: null, locationVerifiedAt: null,
};
const note = { id: noteId, text: 'Synthetic note', selectedQuoteIds: [], userRemoved: false };
const operation = { operationId, expectedRevision: 3, vehicleUpserts: [vehicle], noteUpserts: [note] };
const normalized = validateProfileRecordsOperation({ ...operation, kind: 'records' });
const saved = {
  ok: true, operationKind: 'profile_records', operationId, savedAt: '2026-10-08T12:00:00.000Z',
  affectedIds: [accountId, vehicleId, noteId],
  profile: { accountId, revision: 4, answers: {}, vehicles: normalized.vehicleUpserts, notes: normalized.noteUpserts },
};
const cookie = 'groundbnb_local_session=offline-synthetic-cookie';
const request = (body = JSON.stringify(operation), changes = {}) => new Request('http://localhost:3000/api/account/profile/records', {
  method: 'PATCH', body,
  headers: {
    origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', cookie,
    ...changes,
  },
});
const noFetchSiteRequest = () => new Request('http://localhost:3000/api/account/profile/records', {
  method: 'PATCH', body: JSON.stringify(operation),
  headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json', cookie },
});
const resolve = async () => ({ ok: true, identity });

test('records request fails closed when profile, records, or synthetic-run gates are off or expired', async () => {
  let resolves = 0;
  const store = async () => assert.fail('closed gate must not reach storage');
  const fresh = async () => { resolves++; return { ok: true, identity }; };
  for (const gated of [
    { ...env, GROUND_PROFILE_MODE: 'off' },
    { ...env, GROUND_PROFILE_RECORDS_MODE: 'off' },
    { ...env, GROUND_PROFILE_DOMAIN_MODE: 'off' },
    { ...env, GROUND_BROWSER_AUTH_UNTIL: new Date(now - 1).toISOString() },
    { ...env, GROUND_BROWSER_AUTH_START: new Date(now - 31 * 60_000).toISOString(), GROUND_BROWSER_AUTH_UNTIL: new Date(now + 1).toISOString() },
    { ...env, GROUND_BROWSER_AUTH_RUN_ID: 'bad' },
  ]) assert.equal((await handleProfileRecordsRequest(request(), gated, fresh, store)).status, 503);
  assert.equal(resolves, 0);
});

test('records request rejects cross-origin, fetch-site, method, query, and content-type violations before identity or storage', async () => {
  let resolves = 0;
  let stores = 0;
  const fresh = async () => { resolves++; return { ok: true, identity }; };
  const store = async () => { stores++; return saved; };
  const invalid = [
    request(undefined, { origin: 'https://foreign.example.test' }),
    request(undefined, { 'sec-fetch-site': 'cross-site' }),
    request(undefined, { 'sec-fetch-site': 'same-site' }),
    request(undefined, { 'content-type': 'text/plain' }),
    new Request('http://localhost:3000/api/account/profile/records?accountId=foreign', {
      method: 'PATCH', body: JSON.stringify(operation), headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json' },
    }),
    new Request('http://localhost:3000/api/account/profile/records', {
      method: 'POST', body: JSON.stringify(operation), headers: { origin: env.GROUND_PUBLIC_ORIGIN, 'content-type': 'application/json' },
    }),
  ];
  for (const req of invalid) assert.equal((await handleProfileRecordsRequest(req, env, fresh, store)).status, 400);
  assert.equal(resolves, 0);
  assert.equal(stores, 0);
  assert.equal((await handleProfileRecordsRequest(noFetchSiteRequest(), env, fresh, store)).status, 200);
  assert.equal(resolves, 1);
  assert.equal(stores, 1);
});

test('records body parser rejects malformed, oversized, invalid UTF-8, owner, authority, and provenance input before persistence', async () => {
  let resolveCalls = 0;
  let persistenceCalls = 0;
  let writes = 0;
  const fresh = async () => { resolveCalls++; return { ok: true, identity }; };
  const store = (_env, owner, input) => persistProfileRecords(env, owner, input, async () => {
    writes++;
    return saved;
  });
  const malformedUtf8 = new Uint8Array([0x7b, 0x22, 0x74, 0x65, 0x78, 0x74, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]);
  const badVehicle = { ...vehicle, location: { latitude: 1, longitude: 2, origin: 'provider' }, locationVerifiedAt: '2026-10-08T12:00:00.000Z' };
  const badFuelOrigin = { ...vehicle, fuelEconomy: { ...vehicle.fuelEconomy, origin: 'provider' } };
  const invalid = [
    request('not-json'), request('null'), request('[]'), request(' '.repeat(16_385)), request(malformedUtf8),
    request(JSON.stringify({ ...operation, accountId })), request(JSON.stringify({ ...operation, ownerId: 'foreign' })),
    request(JSON.stringify({ ...operation, issuer: identity.issuer })),
    request(JSON.stringify({ ...operation, subject: identity.subject })),
    request(JSON.stringify({ ...operation, vehicleUpserts: [{ ...vehicle, ownerId: 'foreign' }] })),
    request(JSON.stringify({ ...operation, vehicleUpserts: [badVehicle] })),
    request(JSON.stringify({ ...operation, vehicleUpserts: [badFuelOrigin] })),
    request(JSON.stringify({ ...operation, noteUpserts: [{ ...note, origin: 'AI' }] })),
    request(JSON.stringify({ ...operation, noteUpserts: [{ ...note, text: 'unsafe\u0000note' }] })),
    request(JSON.stringify({ ...operation, noteUpserts: [{ ...note, text: '\ud800' }] })),
  ];
  const observed = [];
  for (const req of invalid) observed.push(await handleProfileRecordsRequest(req, env, fresh, async (...args) => {
    persistenceCalls++;
    return store(...args);
  }));
  assert.ok(observed.every(response => response.status === 400));
  assert.equal(resolveCalls, invalid.length);
  assert.equal(persistenceCalls, 6); // Five parse failures and four closed-body authority fields stop before persistence.
  assert.equal(writes, 0);
});

test('records handling requires a fresh authenticated session and never leaks storage or provider diagnostics', async () => {
  let resolutions = 0;
  let stores = 0;
  const fresh = async (_env, receivedCookie) => {
    resolutions++;
    assert.equal(receivedCookie, cookie);
    return { ok: true, identity };
  };
  const success = await handleProfileRecordsRequest(request(), env, fresh, async (_env, owner, input) => {
    stores++;
    assert.deepEqual(owner, identity);
    assert.deepEqual(input, { ...operation, kind: 'records' });
    return { ...saved, providerBody: 'private upstream detail', databaseUrl: 'private connection', cookie: 'private cookie' };
  });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store, private');
  assert.equal(success.headers.get('vary'), 'Cookie');
  const body = await success.json();
  assert.equal(body.profile.revision, 4);
  assert.equal(body.operationKind, 'profile_records');
  assert.equal(body.providerBody, undefined);
  assert.equal(body.databaseUrl, undefined);
  assert.equal(body.cookie, undefined);
  assert.match(body.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(resolutions, 1);
  assert.equal(stores, 1);

  const denied = await handleProfileRecordsRequest(request(), env, async () => {
    resolutions++;
    return { ok: false, category: 'auth', secret: 'do not expose' };
  }, async () => { stores++; return saved; });
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).secret, undefined);
  assert.equal(resolutions, 2);
  assert.equal(stores, 1);
});

test('mismatched durable snapshot and uncertain persistence errors return private unavailable without retry', async () => {
  let databaseCalls = 0;
  let storeCalls = 0;
  const mismatched = { ...saved, profile: { ...saved.profile, revision: 5 } };
  const mismatchResponse = await handleProfileRecordsRequest(request(), env, resolve, (_env, owner, input) => {
    storeCalls++;
    return persistProfileRecords(env, owner, input, async () => { databaseCalls++; return mismatched; });
  });
  assert.equal(mismatchResponse.status, 503);
  assert.equal(databaseCalls, 1);
  assert.equal(storeCalls, 1);
  const mismatchBody = await mismatchResponse.json();
  assert.equal(mismatchBody.retryable, true);
  assert.equal(mismatchBody.profile, undefined);
  assert.equal(JSON.stringify(mismatchBody).includes('accountId'), false);

  let uncertainCalls = 0;
  const uncertain = await handleProfileRecordsRequest(request(), env, resolve, async () => {
    uncertainCalls++;
    throw new Error('offline synthetic database diagnostic');
  });
  assert.equal(uncertain.status, 503);
  const body = await uncertain.json();
  assert.equal(body.retryable, true);
  assert.equal(JSON.stringify(body).includes('offline synthetic database diagnostic'), false);
  assert.equal(uncertainCalls, 1);
});

test('validation and conflict responses expose only their safe categories and bounded conflict comparison', async () => {
  const invalid = await handleProfileRecordsRequest(request(), env, resolve, async () => ({
    ok: false, category: 'validation', secret: 'hidden',
  }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).secret, undefined);
  const conflict = await handleProfileRecordsRequest(request(), env, resolve, async () => ({
    ok: false, category: 'conflict', currentRevision: 9,
    fieldComparison: { vehicles: { [vehicleId]: { current: { name: 'Current' }, proposed: { name: 'Proposed' } } },
      notes: { [noteId]: { current: null, proposed: { text: 'Proposed note' } } } },
    privateDiagnostic: 'hidden',
  }));
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.currentRevision, 9);
  assert.equal(body.fieldComparison.vehicles[vehicleId].proposed.name, 'Proposed');
  assert.equal(body.privateDiagnostic, undefined);
});
