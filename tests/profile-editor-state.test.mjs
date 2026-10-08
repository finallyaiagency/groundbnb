import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgedDraftFields, acknowledgedRecordIds, advanceRequestGeneration, createDebouncedTask, isCurrentRequestGeneration,
  isMatchingProfileAcknowledgment, isMatchingProfileRecordsAcknowledgment, pendingTextAutosaveFields,
} from '../lib/profile-editor-state.mjs';
import { PROFILE_FIELD_DEFINITIONS } from '../lib/profile-domain.mjs';

const opId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const ack = (overrides = {}) => ({ ok: true, operationId: opId, requestId, savedAt: '2026-10-08T13:00:00.000Z',
  affectedIds: ['account-a'], profile: { accountId: 'account-a', revision: 2, answers: {
    dietaryRequirements: { value: 'Vegetarian', answered: true, scope: 'account', updatedAt: '2026-10-08T13:00:00.000Z' },
  } }, ...overrides });
const operation = { operationId: opId, expectedRevision: 1, patch: { dietaryRequirements: { value: 'Vegetarian', answered: true } } };

test('save acknowledgment requires exact operation, active owner, request ID, durable time, revision, and affected account', () => {
  assert.equal(isMatchingProfileAcknowledgment(ack(), operation, 'account-a'), true);
  for (const result of [
    ack({ operationId: '33333333-3333-4333-8333-333333333333' }),
    ack({ requestId: '' }),
    ack({ savedAt: 'not-a-time' }),
    ack({ affectedIds: ['account-b'] }),
    ack({ affectedIds: ['account-a', 'account-b'] }),
    ack({ profile: { accountId: 'account-b', revision: 2, answers: {} } }),
    ack({ profile: { accountId: 'account-a', revision: 1, answers: {} } }),
    ack({ profile: { accountId: 'account-a', revision: 2, answers: { dietaryRequirements: { value: 'Vegan', answered: true } } } }),
  ]) assert.equal(isMatchingProfileAcknowledgment(result, operation, 'account-a'), false);
});

test('generation invalidation makes late read/write responses stale', () => {
  const readGeneration = 4;
  const logoutGeneration = advanceRequestGeneration(readGeneration);
  assert.equal(isCurrentRequestGeneration(readGeneration, logoutGeneration), false);
  assert.equal(isCurrentRequestGeneration(logoutGeneration, logoutGeneration), true);
});

test('record acknowledgments require exact revision, operation kind, IDs, affected records, and canonical values', () => {
  const operation = { operationId: opId, expectedRevision: 10,
    vehicleUpserts: [{ id: 'vehicle-a', name: 'Van', type: 'Van', ownership: 'owned', propulsion: null,
      fuelEconomy: { value: 18, unit: 'US mpg' }, dimensions: null, location: null, locationVerifiedAt: null }],
    noteUpserts: [{ id: 'note-a', text: 'My note', selectedQuoteIds: [], userRemoved: false }] };
  const result = { ok: true, operationKind: 'profile_records', operationId: opId, requestId,
    savedAt: '2026-10-08T13:00:00.000Z', affectedIds: ['note-a', 'account-a', 'vehicle-a'],
    profile: { accountId: 'account-a', revision: 11, answers: {},
      vehicles: [{ ...operation.vehicleUpserts[0], fuelEconomy: { value: 18, unit: 'US mpg', origin: 'user' } }],
      notes: [{ ...operation.noteUpserts[0], origin: 'user' }] } };
  assert.equal(isMatchingProfileRecordsAcknowledgment(result, operation, 'account-a'), true);
  assert.equal(isMatchingProfileRecordsAcknowledgment({ ...result, operationKind: 'profile' }, operation, 'account-a'), false);
  assert.equal(isMatchingProfileRecordsAcknowledgment({ ...result, affectedIds: ['account-a', 'vehicle-a'] }, operation, 'account-a'), false);
  assert.equal(isMatchingProfileRecordsAcknowledgment({ ...result, profile: { ...result.profile, revision: 12 } }, operation, 'account-a'), false);
  assert.equal(isMatchingProfileRecordsAcknowledgment({ ...result, profile: { ...result.profile,
    vehicles: [{ ...result.profile.vehicles[0], name: 'Other' }] } }, operation, 'account-a'), false);
});

test('record acknowledgment clears only unchanged submitted drafts and retains later same-record edits', () => {
  const submitted = [{ id: 'v1', name: 'Van', ownership: 'owned' }, { id: 'v2', name: 'Boat', ownership: 'owned' }];
  const operation = [{ id: 'v1' }, { id: 'v2' }];
  const current = [{ id: 'v1', name: 'Van II', ownership: 'owned' }, { id: 'v2', name: 'Boat', ownership: 'owned' }];
  assert.deepEqual(acknowledgedRecordIds(current, submitted, operation), ['v2']);
});

test('ack clears the submitted value but preserves a same-field edit queued after the operation began', () => {
  const dirty = { dietaryRequirements: true, travelerCount: true };
  assert.deepEqual(acknowledgedDraftFields({
    dietaryRequirements: { value: 'Vegetarian', answered: true },
    travelerCount: { value: '4', answered: true },
  }, dirty, { ...operation, patch: {
    dietaryRequirements: { value: 'Vegetarian', answered: true },
    travelerCount: { value: 4, answered: true },
  } }), ['dietaryRequirements', 'travelerCount']);
  assert.deepEqual(acknowledgedDraftFields({
    dietaryRequirements: { value: 'Vegan', answered: true },
  }, { dietaryRequirements: true }, operation), []);
});

test('text autosave filters out fields blocked after a validation failure until the user edits them', () => {
  const dirty = { dietaryRequirements: true, preferredRegions: true, travelerCount: true };
  assert.deepEqual(pendingTextAutosaveFields(dirty, PROFILE_FIELD_DEFINITIONS), ['dietaryRequirements', 'preferredRegions']);
  const blocked = new Set(['dietaryRequirements']);
  assert.deepEqual(pendingTextAutosaveFields(dirty, PROFILE_FIELD_DEFINITIONS, blocked), ['preferredRegions']);
  blocked.delete('dietaryRequirements');
  assert.deepEqual(pendingTextAutosaveFields(dirty, PROFILE_FIELD_DEFINITIONS, blocked), ['dietaryRequirements', 'preferredRegions']);
});

test('debounced scheduling replaces pending runs, can flush once, and cancellation prevents late work', async () => {
  const scheduler = createDebouncedTask(15);
  const calls = [];
  scheduler.schedule(() => calls.push('stale'));
  scheduler.schedule(() => calls.push('latest'));
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(calls, ['latest']);

  scheduler.schedule(() => calls.push('flushed'));
  scheduler.flush();
  scheduler.flush();
  scheduler.schedule(() => calls.push('canceled'));
  scheduler.cancel();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(calls, ['latest', 'flushed']);
});
