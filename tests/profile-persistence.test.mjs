import test from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import { persistProfile, profileConfiguration, validatePersistentPatch, PROFILE_TARGETS } from '../lib/profile-persistence.mjs';

const target = PROFILE_TARGETS.local;
const fixtureUrl = new URL(`postgresql://${target.host}/groundbnb?sslmode=require&channel_binding=require`);
fixtureUrl.username = target.role;
fixtureUrl.password = 'synthetic-unit-fixture';
const env = {
  GROUND_ENV: 'local', GROUND_PROFILE_MODE: 'enabled', GROUND_LOGIN_MODE: 'session-check',
  GROUND_AUTH_ISSUER: 'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME: 'groundbnb_local_session',
  GROUND_AUTH_COOKIE_SECRET: 'synthetic-signing-secret-for-unit-test-only',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN: 'http://localhost:3000', GROUND_PRODUCTION_ORIGIN: 'https://production.example.test',
  GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_DATABASE_HOST: target.host, GROUND_DATABASE_BRANCH_ID: target.branch,
  GROUND_PROFILE_DATABASE_URL: fixtureUrl.href,
};
const identity = { issuer: env.GROUND_AUTH_ISSUER, subject: 'synthetic-subject' };
const operation = { kind: 'save', operationId: '00000000-0000-4000-8000-000000000001',
  expectedRevision: 0, patch: { hasPets: { value: false, answered: true } } };
const acknowledgment = { ok: true, operationId: operation.operationId, savedAt: '2026-10-07T19:00:00.000Z',
  profile: { accountId: 'synthetic-account', revision: 1, answers: { hasPets: { value: false, answered: true } } } };

test('typed persistence retains explicit false and empty list, denies undeclared authority and other field types', () => {
  assert.doesNotThrow(() => validatePersistentPatch({ hasPets: { value: false, answered: true },
    preferredRegions: { value: [], answered: true }, travelerCount: { value: null, answered: false } }));
  for (const patch of [
    { hasPets: { value: 'yes', answered: true } },
    { travelerCount: { value: 0, answered: true } },
    { travelerCount: { value: 1.5, answered: true } },
    { preferredRegions: { value: ['North','North'], answered: true } },
    { dietaryRequirements: { value: 42, answered: true } },
    { homeAddress: { value: 'a'.repeat(2001), answered: true } },
    { homePoint: { value: { lat: 1, lng: 2 }, answered: true } },
    { monitoringTargets: { value: [], answered: true } },
    { hasPets: { value: false, answered: true, scope: 'other-account' } },
    { role: { value: 'owner', answered: true } },
  ]) assert.throws(() => validatePersistentPatch(patch));
});

test('inactive, wrong role, foreign branch/host/issuer and ambiguous configuration refuse database calls', async () => {
  assert.ok(profileConfiguration(env));
  const unsafe = [
    { GROUND_PROFILE_MODE: 'off' }, { GROUND_ENV: 'production' }, { GROUND_LOGIN_MODE: 'off' },
    { GROUND_DATABASE_BRANCH_ID: 'br-other' }, { GROUND_DATABASE_HOST: 'foreign.neon.tech' },
    { GROUND_PROFILE_DATABASE_URL: env.GROUND_PROFILE_DATABASE_URL.replace(target.role, 'groundbnb_local_probe') },
    { GROUND_PROFILE_DATABASE_URL: env.GROUND_PROFILE_DATABASE_URL + '&sslmode=disable' },
    { GROUND_METERED_DISPATCH: 'bounded' }, { VERCEL: '1' }, { VERCEL_ENV: 'production' },
  ];
  let calls = 0;
  for (const changes of unsafe) {
    const result = await persistProfile({ ...env, ...changes }, identity, operation, async () => { calls++; });
    assert.deepEqual(result, { ok: false, category: 'unavailable' });
  }
  assert.equal(calls, 0);
});

test('verified subject is parameterized and no client owner is accepted', async () => {
  let calls = 0;
  const run = async (_config, statement, values) => {
    calls++;
    assert.equal(statement, 'SELECT groundbnb.save_profile($1,$2,$3::uuid,$4::bigint,$5::jsonb) AS result');
    assert.deepEqual(values, [identity.issuer, identity.subject, operation.operationId, 0, JSON.stringify(operation.patch)]);
    return acknowledgment;
  };
  assert.deepEqual(await persistProfile(env, identity, operation, run), acknowledgment);
  assert.equal((await persistProfile(env, identity, { ...operation, accountId: 'foreign' }, run)).category, 'validation');
  assert.equal((await persistProfile(env, { ...identity, issuer: 'foreign' }, operation, run)).category, 'auth');
  assert.equal(calls, 1);
});

test('conflicts pass current/proposed values; failed/unknown storage never becomes saved and never retries', async () => {
  const conflict = { ok: false, category: 'conflict', currentRevision: 2, fieldComparison: { hasPets: { current: true, proposed: false } } };
  assert.deepEqual(await persistProfile(env, identity, operation, async () => conflict), conflict);
  for (const value of [undefined, { ok: true }, { ...acknowledgment, operationId: 'different' }]) {
    assert.deepEqual(await persistProfile(env, identity, operation, async () => value), { ok: false, category: 'unavailable' });
  }
  let calls = 0;
  const result = await persistProfile(env, identity, operation, async () => { calls++; throw new Error('private connection details'); });
  assert.deepEqual(result, { ok: false, category: 'unavailable' });
  assert.equal(calls, 1);
});

test('installed Neon driver explicitly opens one read/write transaction and decodes committed JSON acknowledgment', async () => {
  const original = neonConfig.fetchFunction;
  let calls = 0;
  neonConfig.fetchFunction = async (_endpoint, options) => {
    calls++;
    assert.equal(options.headers['Neon-Batch-Read-Only'], 'false');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.queries.length, 2);
    assert.equal(body.queries[0].query, 'SET TRANSACTION READ WRITE');
    assert.deepEqual(body.queries[0].params, []);
    assert.deepEqual(body.queries[1].params, [identity.issuer, identity.subject, operation.operationId, '0', JSON.stringify(operation.patch)]);
    return new Response(JSON.stringify({ results: [{ fields: [], rows: [], rowCount: 0, command: 'SET' }, { fields: [{ name: 'result', dataTypeID: 3802 }],
      rows: [[JSON.stringify(acknowledgment)]], rowCount: 1, command: 'SELECT' }] }));
  };
  try {
    assert.deepEqual(await persistProfile(env, identity, operation), acknowledgment);
    assert.equal(calls, 1);
  } finally { neonConfig.fetchFunction = original; }
});
