import test from 'node:test';
import assert from 'node:assert/strict';
import { neonConfig } from '@neondatabase/serverless';
import { probeDatabase } from '../lib/database-probe.mjs';
import { checkHealth } from '../lib/health.mjs';

function settings() {
  const url = new URL('postgresql://ep-synthetic.neon.tech/groundbnb');
  url.username = 'groundbnb_preview_probe';
  url.password = 'example';
  return {
    GROUND_ENV: 'preview', VERCEL_ENV: 'preview',
    GROUND_DATABASE_URL: url.toString(), GROUND_DATABASE_HOST: url.hostname,
    GROUND_DATABASE_BRANCH_ID: 'br-preview', GROUND_AUTH_ISSUER: 'https://auth-preview.example.test',
    GROUND_AUTH_COOKIE_NAME: 'groundbnb_preview', GROUND_PUBLIC_ORIGIN: 'https://preview.example.test',
    GROUND_EMAIL_MODE: 'capture', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off',
    GROUND_SEED_MODE: 'synthetic', GROUND_PRODUCTION_DATABASE_HOST: 'ep-production.neon.tech',
    GROUND_PRODUCTION_BRANCH_ID: 'br-production', GROUND_PRODUCTION_AUTH_ISSUER: 'https://auth.example.test',
    GROUND_PRODUCTION_AUTH_COOKIE_NAME: 'groundbnb', GROUND_PRODUCTION_ORIGIN: 'https://groundbnb.example.test',
    VERCEL_GIT_COMMIT_SHA: 'fixture-revision',
  };
}

const row = {
  kind: 'preview', branch_id: 'br-preview', database_name: 'groundbnb',
  role_name: 'groundbnb_preview_probe', baseline_present: true, privileges_safe: true,
};

test('connection host and role are checked before any credential transmission', async () => {
  let calls = 0;
  const query = async () => { calls++; return [row]; };
  for (const change of [
    { GROUND_DATABASE_HOST: 'ep-other.neon.tech' },
    { GROUND_DATABASE_BRANCH_ID: '' },
    { GROUND_ENV: 'unknown' },
    { GROUND_DATABASE_URL: 'invalid' },
    { GROUND_DATABASE_URL: settings().GROUND_DATABASE_URL + '?host=ep-production.neon.tech' },
    { GROUND_DATABASE_URL: settings().GROUND_DATABASE_URL + '?user=neondb_owner' },
    { GROUND_DATABASE_URL: settings().GROUND_DATABASE_URL + '?sslmode=disable' },
    { GROUND_DATABASE_URL: settings().GROUND_DATABASE_URL + '?sslmode=require&sslmode=verify-full' },
  ]) assert.deepEqual(await probeDatabase({ ...settings(), ...change }, query), { ok: false });
  for (const [field, value] of [['username', 'neondb_owner'], ['pathname', '/other'], ['hostname', 'attacker.example.test'], ['password', '']]) {
    const env = settings();
    const url = new URL(env.GROUND_DATABASE_URL);
    url[field] = value;
    env.GROUND_DATABASE_URL = url.toString();
    env.GROUND_DATABASE_HOST = url.hostname;
    assert.deepEqual(await probeDatabase(env, query), { ok: false });
  }
  assert.equal(calls, 0);
});

test('cross-branch, wrong role, missing baseline and unknown privilege evidence fail closed', async () => {
  for (const changes of [
    { kind: 'production' }, { branch_id: 'br-production' }, { role_name: 'neondb_owner' },
    { database_name: 'other' }, { baseline_present: false }, { baseline_present: null },
    { privileges_safe: false }, { privileges_safe: null }, { privileges_safe: 't' },
  ]) assert.deepEqual(await probeDatabase(settings(), async () => [{ ...row, ...changes }]), { ok: false });
  for (const rows of [[], [row, row], null, {}]) {
    assert.deepEqual(await probeDatabase(settings(), async () => rows), { ok: false });
  }
});

test('real driver serializes a read-only metadata batch and parses PostgreSQL booleans', async () => {
  const original = neonConfig.fetchFunction;
  let requests = 0;
  neonConfig.fetchFunction = async (endpoint, options) => {
    requests++;
    assert.match(endpoint, /^https:\/\//);
    assert.equal(options.headers['Neon-Batch-Read-Only'], 'true');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    const request = JSON.parse(options.body);
    assert.equal(request.queries.length, 1);
    assert.match(request.queries[0].query, /current_user AS role_name/);
    const fields = Object.keys(row).map(name => ({ name, dataTypeID: typeof row[name] === 'boolean' ? 16 : 25 }));
    return new Response(JSON.stringify({ results: [{ fields, rows: [Object.values(row).map(value => value === true ? 't' : value)], rowCount: 1, command: 'SELECT' }] }));
  };
  try {
    assert.deepEqual(await probeDatabase(settings()), { ok: true, branchId: 'br-preview' });
    assert.equal(requests, 1);
  } finally { neonConfig.fetchFunction = original; }
});

test('health checks configuration before network use and never report readiness on failure', async () => {
  let calls = 0;
  const probe = async () => { calls++; return { ok: true, branchId: 'br-preview' }; };
  assert.equal((await checkHealth({}, probe)).statusCode, 503);
  assert.equal(calls, 0);
  const isolated = await checkHealth({ ...settings(), GROUND_AUTH_ISSUER: 'https://auth.example.test' }, probe);
  assert.equal(isolated.statusCode, 503);
  assert.equal(calls, 0);
  const failure = await checkHealth(settings(), async () => ({ ok: false }));
  assert.equal(failure.statusCode, 503);
  assert.equal(failure.body.database, 'unverified');
});

test('database readiness preserves revision and does not claim auth or email isolation', async () => {
  const result = await checkHealth(settings(), async () => ({ ok: true, branchId: 'br-preview' }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.revision, 'fixture-revision');
  assert.equal(result.body.authIsolation, 'unverified');
  assert.equal(result.body.emailIsolation, 'unverified');
});

test('database and health failures suppress credential-bearing driver errors', async () => {
  const fail = async () => { throw new Error(settings().GROUND_DATABASE_URL); };
  assert.deepEqual(await probeDatabase(settings(), fail), { ok: false });
  const result = await checkHealth(settings(), fail);
  assert.equal(result.statusCode, 503);
  assert.ok(!JSON.stringify(result).includes('postgresql:'));
  assert.ok(!JSON.stringify(result).includes('example@'));
});
