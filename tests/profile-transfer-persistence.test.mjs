import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import {
  persistProfileTransfer,
  profileTransferConfiguration,
  validateProfileTransferOperation,
} from '../lib/profile-transfer-persistence.mjs';

const target = PROFILE_TARGETS.local;
const url = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
url.username = target.role;
url.password = 'synthetic-fixture';
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
};
const identity = { issuer: env.GROUND_AUTH_ISSUER, subject: 'synthetic-subject' };
const accountId = '00000000-0000-4000-8000-000000000001';
const operationId = '00000000-0000-4000-8000-000000000002';
const noteId = '00000000-0000-4000-8000-000000000004';
const note = { id: noteId, text: 'Synthetic imported note', selectedQuoteIds: [], userRemoved: false };
const fieldPatch = { hasPets: { value: false, answered: true } };
const baseOperation = { kind: 'transfer', operationId, expectedRevision: 3 };

function expectedOperation(operation) {
  return validateProfileTransferOperation(operation);
}

function acknowledgment(operation = { ...baseOperation, patch: fieldPatch }) {
  const input = expectedOperation(operation);
  const answers = Object.fromEntries(Object.entries(input.patch).map(([field, answer]) => [field, {
    ...answer, scope: 'account', updatedAt: '2026-10-08T12:00:00.000000+00:00',
  }]));
  return {
    ok: true, operationKind: 'profile_transfer', operationId,
    savedAt: '2026-10-08T12:00:00.000Z',
    affectedIds: [accountId, ...input.noteUpserts.map(item => item.id)],
    profile: {
      accountId, revision: input.expectedRevision + 1,
      answers, vehicles: [], notes: input.noteUpserts,
    },
  };
}

test('transfer persistence is disabled unless all local synthetic profile gates and pins match', async () => {
  assert.ok(profileTransferConfiguration(env));
  const unsafe = [
    { GROUND_PROFILE_TRANSFER_MODE: undefined }, { GROUND_PROFILE_TRANSFER_MODE: 'off' },
    { GROUND_PROFILE_RECORDS_MODE: 'off' }, { GROUND_PROFILE_DOMAIN_MODE: 'off' },
    { GROUND_ENV: 'production' }, { GROUND_DATABASE_BRANCH_ID: 'br-other' },
    { GROUND_DATABASE_HOST: 'other.neon.tech' },
    { GROUND_PROFILE_DATABASE_URL: env.GROUND_PROFILE_DATABASE_URL.replace(target.role, 'groundbnb_preview_app') },
  ];
  let calls = 0;
  for (const change of unsafe) {
    const disabled = { ...env, ...change };
    assert.equal(profileTransferConfiguration(disabled), null);
    assert.deepEqual(await persistProfileTransfer(disabled, identity, { ...baseOperation, patch: fieldPatch }, async () => { calls++; }),
      { ok: false, category: 'unavailable' });
  }
  assert.equal(calls, 0);
});

test('field-only, notes-only, and combined transfers normalize to closed selected input', () => {
  const fields = validateProfileTransferOperation({ ...baseOperation, patch: fieldPatch });
  assert.deepEqual(fields.patch, fieldPatch);
  assert.deepEqual(fields.noteUpserts, []);

  const notes = validateProfileTransferOperation({ ...baseOperation, noteUpserts: [note] });
  assert.deepEqual(notes.patch, {});
  assert.equal(notes.noteUpserts[0].origin, 'user');
  assert.deepEqual(notes.noteUpserts[0].selectedQuoteIds, []);

  const combined = validateProfileTransferOperation({ ...baseOperation, patch: fieldPatch, noteUpserts: [note] });
  assert.deepEqual(combined.patch, fieldPatch);
  assert.equal(combined.noteUpserts.length, 1);
});

test('transfer refuses client home-point authority, ownership, AI provenance, deletion, and quote references', () => {
  const rejected = [
    { ...baseOperation, patch: { homePoint: { value: { latitude: 40, longitude: -73 }, answered: true } } },
    { ...baseOperation, patch: { hasPets: { value: false, answered: true }, ownerId: 'foreign' } },
    { ...baseOperation, noteUpserts: [{ ...note, origin: 'AI' }] },
    { ...baseOperation, noteUpserts: [{ ...note, userRemoved: true }] },
    { ...baseOperation, noteUpserts: [{ ...note, selectedQuoteIds: ['00000000-0000-4000-8000-000000000005'] }] },
  ];
  for (const operation of rejected) assert.throws(() => validateProfileTransferOperation(operation));
});

test('changing a home address clears the previous resolved point in the same transfer patch', () => {
  const operation = validateProfileTransferOperation({ ...baseOperation, patch: {
    homeAddress: { value: 'Synthetic typed address', answered: true },
  } });
  assert.deepEqual(operation.patch, {
    homeAddress: { value: 'Synthetic typed address', answered: true },
    homePoint: { value: null, answered: false },
  });
});

test('transfer uses one parameterized atomic function call with owner, operation, revision, fields, and notes', async () => {
  const operation = { ...baseOperation, patch: fieldPatch, noteUpserts: [note] };
  const expected = expectedOperation(operation);
  let calls = 0;
  const result = await persistProfileTransfer(env, identity, operation, async (config, values) => {
    calls++;
    assert.equal(config.role, target.role);
    assert.deepEqual(values.slice(0, 4), [identity.issuer, identity.subject, operationId, 3]);
    assert.deepEqual(JSON.parse(values[4]), expected.patch);
    assert.deepEqual(JSON.parse(values[5]), expected.noteUpserts);
    return acknowledgment(operation);
  });
  assert.equal(calls, 1);
  assert.equal(result.operationKind, 'profile_transfer');
  assert.equal(result.profile.revision, 4);
});

test('transfer acknowledgment must match operation kind, ID, exact revision, and all affected IDs', async () => {
  const operation = { ...baseOperation, patch: fieldPatch, noteUpserts: [note] };
  const valid = acknowledgment(operation);
  for (const result of [
    { ...valid, operationKind: 'profile_records' }, { ...valid, operationId: 'foreign' },
    { ...valid, profile: { ...valid.profile, revision: 5 } },
    { ...valid, affectedIds: [accountId] }, { ...valid, affectedIds: [accountId, noteId, 'foreign'] },
    { ...valid, affectedIds: [accountId, noteId, noteId] }, { ...valid, profile: { ...valid.profile, notes: null } },
    { ...valid, affectedIds: ['not-a-uuid', noteId], profile: { ...valid.profile, accountId: 'not-a-uuid' } },
    { ...valid, profile: { ...valid.profile, answers: 'not-an-answer-map' } },
    { ...valid, savedAt: 'not-a-timestamp' },
    { ok: true }, { ok: true, operationKind: 'profile_transfer' },
  ]) {
    assert.deepEqual(await persistProfileTransfer(env, identity, operation, async () => result),
      { ok: false, category: 'unavailable' });
  }
});

test('uncertain database outcomes are unavailable and never retried', async () => {
  let calls = 0;
  const result = await persistProfileTransfer(env, identity, { ...baseOperation, patch: fieldPatch }, async () => {
    calls++;
    throw new Error('connection lost after commit may have happened');
  });
  assert.deepEqual(result, { ok: false, category: 'unavailable' });
  assert.equal(calls, 1);
});
