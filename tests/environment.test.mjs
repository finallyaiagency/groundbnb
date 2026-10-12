import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment, admitPreviewAttempt } from '../lib/environment.mjs';

function databaseUrl(host) {
  const url = new URL(`postgresql://${host}/groundbnb`);
  url.username = 'synthetic';
  url.password = 'example';
  return url.toString();
}

const preview = {
  GROUND_ENV: 'preview', VERCEL: '1', VERCEL_ENV: 'preview',
  GROUND_DATABASE_URL: databaseUrl('preview.example.test'),
  GROUND_DATABASE_HOST: 'preview.example.test', GROUND_DATABASE_BRANCH_ID: 'br-preview',
  GROUND_AUTH_ISSUER: 'https://auth-preview.example.test', GROUND_AUTH_COOKIE_NAME: 'groundbnb_preview',
  GROUND_PUBLIC_ORIGIN: 'https://preview.example.test', GROUND_EMAIL_MODE: 'capture',
  GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_SEED_MODE: 'synthetic',
  GROUND_PRODUCTION_DATABASE_HOST: 'production.example.test', GROUND_PRODUCTION_BRANCH_ID: 'br-production',
  GROUND_PRODUCTION_AUTH_ISSUER: 'https://auth.example.test', GROUND_PRODUCTION_AUTH_COOKIE_NAME: 'groundbnb',
  GROUND_PRODUCTION_ORIGIN: 'https://groundbnb.example.test',
};

test('synthetic preview is accepted with paid work off', () => {
  const result = validateEnvironment(preview);
  assert.equal(result.ok, true);
  assert.equal(admitPreviewAttempt(result, { runId: 'x', estimatedUsd: 0.01, reservedUsd: 0 }), false);
});

test('preview refuses production database, auth, cookie, origin, email, and jobs', () => {
  for (const changes of [
    { GROUND_DATABASE_URL: databaseUrl('production.example.test'), GROUND_DATABASE_HOST: 'production.example.test' },
    { GROUND_DATABASE_BRANCH_ID: 'br-production' },
    { GROUND_AUTH_ISSUER: 'https://auth.example.test' },
    { GROUND_AUTH_COOKIE_NAME: 'groundbnb' },
    { GROUND_PUBLIC_ORIGIN: 'https://groundbnb.example.test' },
    { GROUND_EMAIL_MODE: 'live' },
    { GROUND_SCHEDULED_WORK: 'on' },
    { GROUND_SEED_MODE: 'off' },
    { VERCEL_ENV: 'production' },
  ]) assert.equal(validateEnvironment({ ...preview, ...changes }).ok, false, JSON.stringify(changes));
});

test('ambiguous configuration and unbounded metered preview fail closed', () => {
  assert.equal(validateEnvironment({}).ok, false);
  assert.equal(validateEnvironment({ ...preview, GROUND_METERED_DISPATCH: 'on' }).ok, false);
  const now = new Date('2026-10-02T12:30:00Z');
  const bounded = { ...preview, GROUND_METERED_DISPATCH: 'bounded', GROUND_LIVE_TEST_RUN_ID: 'run-1',
    GROUND_LIVE_TEST_START: '2026-10-02T12:00:00Z', GROUND_LIVE_TEST_UNTIL: '2026-10-02T13:00:00Z',
    GROUND_LIVE_TEST_BUDGET_USD: '0.25', GROUND_LIVE_TEST_ACCOUNT_IDS: 'synthetic-1',
    GROUND_LIVE_TEST_RECIPIENTS: 'test@example.test' };
  const config = validateEnvironment(bounded, now);
  assert.equal(config.ok, true);
  assert.equal(admitPreviewAttempt(config, { runId: 'run-1', accountId: 'synthetic-1', recipient: 'test@example.test', estimatedUsd: 0.05, reservedUsd: 0.2 }), true);
  assert.equal(admitPreviewAttempt(config, { runId: 'run-1', accountId: 'synthetic-1', estimatedUsd: 0.06, reservedUsd: 0.2 }), false);
  assert.equal(admitPreviewAttempt(config, { runId: 'run-1', accountId: 'unknown', estimatedUsd: 0.01, reservedUsd: 0 }), false);
  assert.equal(admitPreviewAttempt(config, { runId: 'run-1', accountId: 'synthetic-1', recipient: 'customer@example.com', estimatedUsd: 0.01, reservedUsd: 0 }), false);
  assert.equal(validateEnvironment(bounded, new Date('2026-10-02T13:00:00Z')).ok, false);
  assert.equal(validateEnvironment({ ...bounded, GROUND_LIVE_TEST_UNTIL: '2026-10-02T13:01:00Z' }, now).ok, false);
  assert.equal(validateEnvironment({ ...bounded, GROUND_LIVE_TEST_BUDGET_USD: '0.26' }, now).ok, false);
});

test('restore environment is quarantined', () => {
  const recovery = { ...preview, GROUND_ENV: 'recovery', VERCEL: undefined, VERCEL_ENV: undefined,
    GROUND_EMAIL_MODE: 'off', GROUND_LOGIN_MODE: 'off', GROUND_SCHEDULED_WORK: 'off', GROUND_METERED_DISPATCH: 'off', GROUND_RECOVERY_CONTROL_HOST: 'control.example.test' };
  assert.equal(validateEnvironment(recovery).ok, true);
  assert.equal(validateEnvironment({ ...recovery, GROUND_LOGIN_MODE: 'on' }).ok, false);
  assert.equal(validateEnvironment({ ...recovery, GROUND_DATABASE_BRANCH_ID: 'br-production' }).ok, false);
});
