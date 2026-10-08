import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfileTransferOperation, buildReviewedProfileTransferOperation, isMatchingProfileTransferAcknowledgment,
  preferCurrentCanonicalProfile, selectCanonicalAfterStatusRefresh,
} from '../lib/profile-transfer-editor-state.mjs';

const opId = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const noteId = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000004';
const savedAt = '2026-10-08T12:00:00.000Z';

test('transfer operation allocates note IDs once and sends only value/answered plus manual note fields', () => {
  let ids = 0;
  const operation = buildProfileTransferOperation({ operationId: opId, expectedRevision: 4,
    patch: { hasPets: { value: false, answered: true, scope: 'account' } },
    noteTexts: ['A personal quote'], createId: () => { ids++; return noteId; } });
  assert.equal(ids, 1);
  assert.deepEqual(operation, { operationId: opId, expectedRevision: 4,
    patch: { hasPets: { value: false, answered: true } },
    noteUpserts: [{ id: noteId, text: 'A personal quote', selectedQuoteIds: [], userRemoved: false }] });
});

test('transfer operation sizes the exact JSON body and gives an actionable selection limit', () => {
  assert.throws(() => buildProfileTransferOperation({ operationId: opId, expectedRevision: 0,
    patch: { dietaryRequirements: { value: 'x'.repeat(17_000), answered: true } } }), /too large.*Deselect/i);
  assert.throws(() => buildProfileTransferOperation({ operationId: opId, expectedRevision: 0,
    patch: {}, noteTexts: [] }), /Select at least one/);
  assert.throws(() => buildProfileTransferOperation({ operationId: opId, expectedRevision: 0,
    noteTexts: ['one', 'two'], createId: () => noteId }), /unique note ID/);
});

test('home address import expects the server-managed unresolved point to be cleared in the acknowledgment', () => {
  const operation = buildProfileTransferOperation({ operationId: opId, expectedRevision: 2,
    patch: { homeAddress: { value: 'Typed address', answered: true, scope: 'account' } } });
  const profile = { accountId, revision: 3, answers: {
    homeAddress: { value: 'Typed address', answered: true }, homePoint: { value: null, answered: false },
  }, vehicles: [], notes: [] };
  assert.equal(isMatchingProfileTransferAcknowledgment({ ok: true, operationKind: 'profile_transfer', operationId: opId,
    requestId, savedAt, affectedIds: [accountId], profile }, operation, accountId), true);
  assert.equal(isMatchingProfileTransferAcknowledgment({ ok: true, operationKind: 'profile_transfer', operationId: opId,
    requestId, savedAt, affectedIds: [accountId], profile: { ...profile, answers: { ...profile.answers, homePoint: { value: null, answered: true } } } }, operation, accountId), false);
});

test('transfer acknowledgment requires exact owner, operation, kind, UUID request, revision, canonical answers, notes, and affected IDs', () => {
  const operation = buildProfileTransferOperation({ operationId: opId, expectedRevision: 8,
    patch: { hasPets: { value: false, answered: true } }, noteTexts: ['Imported note'], createId: () => noteId });
  const profile = { accountId, revision: 9, answers: { hasPets: { value: false, answered: true } }, vehicles: [],
    notes: [{ ...operation.noteUpserts[0], origin: 'user' }] };
  const result = { ok: true, operationKind: 'profile_transfer', operationId: opId, requestId, savedAt,
    affectedIds: [accountId, noteId], profile };
  assert.equal(isMatchingProfileTransferAcknowledgment(result, operation, accountId), true);
  for (const altered of [
    { ...result, operationKind: 'profile_records' }, { ...result, operationId: noteId }, { ...result, requestId: 'bad' },
    { ...result, affectedIds: [accountId] }, { ...result, affectedIds: [accountId, noteId, 'foreign'] },
    { ...result, profile: { ...profile, revision: 10 } },
    { ...result, profile: { ...profile, notes: [{ ...profile.notes[0], origin: 'AI' }] } },
    { ...result, profile: { ...profile, notes: [{ ...profile.notes[0], text: 'Changed' }] } },
    { ...result, profile: { ...profile, answers: { hasPets: { value: true, answered: true } } } },
  ]) assert.equal(isMatchingProfileTransferAcknowledgment(altered, operation, accountId), false);
});

test('reviewed transfer reapply uses new op/revision, selected fields, and same note IDs/text', () => {
  const newOperationId = '00000000-0000-4000-8000-000000000005';
  const pending = buildProfileTransferOperation({ operationId: opId, expectedRevision: 3,
    patch: { hasPets: { value: false, answered: true }, dietaryRequirements: { value: 'No nuts', answered: true } },
    noteTexts: ['Keep this quote'], createId: () => noteId });
  const result = buildReviewedProfileTransferOperation({ pending, operationId: newOperationId, currentRevision: 11,
    selectedKeys: ['profileFields:hasPets', `notes:${noteId}`],
    fieldComparison: { profileFields: { hasPets: { current: { value: true, answered: true } },
      dietaryRequirements: { current: { value: 'Current', answered: true } } },
      notes: { [noteId]: { current: null } } } });
  assert.equal(result.operationId, newOperationId);
  assert.equal(result.expectedRevision, 11);
  assert.deepEqual(Object.keys(result.patch), ['hasPets']);
  assert.deepEqual(result.noteUpserts, pending.noteUpserts);
});

test('reviewed reapply refuses to duplicate a note ID already present in conflict comparison', () => {
  const pending = buildProfileTransferOperation({ operationId: opId, expectedRevision: 3,
    noteTexts: ['Keep this quote'], createId: () => noteId });
  assert.throws(() => buildReviewedProfileTransferOperation({ pending, operationId: requestId, currentRevision: 4,
    selectedKeys: [`notes:${noteId}`], fieldComparison: { notes: { [noteId]: { current: { id: noteId } } } } }), /already present/);
});

test('an original status acknowledgment never regresses a newer same-owner canonical snapshot', () => {
  const acknowledged = { accountId, revision: 4, answers: { hasPets: { value: true, answered: true } } };
  const newer = { accountId, revision: 5, answers: { hasPets: { value: false, answered: true } } };
  assert.equal(preferCurrentCanonicalProfile(newer, acknowledged), newer);
  assert.equal(preferCurrentCanonicalProfile({ ...newer, accountId: 'other-owner' }, acknowledged).accountId, 'other-owner');
  assert.equal(preferCurrentCanonicalProfile({ accountId, revision: 3 }, acknowledged), acknowledged);
  assert.equal(preferCurrentCanonicalProfile(null, acknowledged), acknowledged);
  const local = { accountId, revision: 5, answers: {} };
  assert.equal(preferCurrentCanonicalProfile(local, null), local);
});

test('status refresh uses the latest same-owner revision and rejects foreign or malformed snapshots', () => {
  const readAtFour = { accountId, revision: 4, answers: { hasPets: { value: true, answered: true } } };
  const originalAck = { accountId, revision: 4, answers: { hasPets: { value: true, answered: true } } };
  const readAtFive = { accountId, revision: 5, answers: { hasPets: { value: false, answered: true } } };
  assert.equal(selectCanonicalAfterStatusRefresh(readAtFour, originalAck, readAtFive, accountId), readAtFive);
  assert.equal(selectCanonicalAfterStatusRefresh(readAtFive, originalAck, readAtFour, accountId), readAtFive);
  assert.equal(selectCanonicalAfterStatusRefresh(readAtFour, originalAck,
    { ...readAtFive, accountId: 'foreign-owner' }, accountId), originalAck);
  assert.equal(selectCanonicalAfterStatusRefresh(readAtFour, originalAck,
    { accountId, revision: '5', answers: {} }, accountId), originalAck);
  assert.equal(selectCanonicalAfterStatusRefresh(readAtFour, originalAck, null, accountId), originalAck);
  assert.equal(selectCanonicalAfterStatusRefresh(null, originalAck, { accountId: 'foreign-owner', revision: 8 }, accountId), originalAck);
});
