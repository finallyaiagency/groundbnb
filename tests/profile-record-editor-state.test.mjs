import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfileRecordsOperation, buildReviewedProfileRecordsOperation } from '../lib/profile-record-editor-state.mjs';

const opId = '00000000-0000-4000-8000-000000000001';
const vehicleId = '00000000-0000-4000-8000-000000000002';
const noteId = '00000000-0000-4000-8000-000000000003';
const vehicle = {
  id: vehicleId, name: 'Van', type: 'Camper van', ownership: 'owned', propulsion: '', fuelValue: '', fuelUnit: '',
  lengthMeters: '', widthMeters: '', heightMeters: '', location: null, locationVerifiedAt: null,
};
const note = { id: noteId, text: 'Quiet places', origin: 'AI', selectedQuoteIds: ['quote-1'], userRemoved: true };

test('record operation preserves unknowns as null, accepts descriptive units, and omits provenance', () => {
  const result = buildProfileRecordsOperation({
    operationId: opId, expectedRevision: 7,
    vehicleDrafts: [{ ...vehicle, fuelValue: '2.5', fuelUnit: 'gallons/hour', widthMeters: '2.1' }],
    noteDrafts: [note], dirtyVehicleIds: [vehicleId], dirtyNoteIds: [],
  });
  assert.deepEqual(result, {
    operationId: opId, expectedRevision: 7,
    vehicleUpserts: [{ id: vehicleId, name: 'Van', type: 'Camper van', ownership: 'owned', propulsion: null,
      fuelEconomy: { value: 2.5, unit: 'gallons/hour' },
      dimensions: { lengthMeters: null, widthMeters: 2.1, heightMeters: null }, location: null, locationVerifiedAt: null }],
    noteUpserts: [],
  });
});

test('unknown fuel and all unknown dimensions remain null; note tombstones retain stable id and quote references', () => {
  const result = buildProfileRecordsOperation({
    operationId: opId, expectedRevision: 0, vehicleDrafts: [vehicle], noteDrafts: [note],
    dirtyVehicleIds: [vehicleId], dirtyNoteIds: [noteId],
  });
  assert.equal(result.vehicleUpserts[0].fuelEconomy, null);
  assert.equal(result.vehicleUpserts[0].dimensions, null);
  assert.equal(result.noteUpserts[0].id, noteId);
  assert.equal(result.noteUpserts[0].userRemoved, true);
  assert.deepEqual(result.noteUpserts[0].selectedQuoteIds, ['quote-1']);
  assert.equal('origin' in result.noteUpserts[0], false);
});

test('only changed records are included and client location-bearing records are blocked', () => {
  const other = { ...vehicle, id: '00000000-0000-4000-8000-000000000004', name: 'Other' };
  const result = buildProfileRecordsOperation({ operationId: opId, expectedRevision: 1,
    vehicleDrafts: [vehicle, other], noteDrafts: [], dirtyVehicleIds: [other.id], dirtyNoteIds: [] });
  assert.deepEqual(result.vehicleUpserts.map(item => item.id), [other.id]);
  assert.throws(() => buildProfileRecordsOperation({ operationId: opId, expectedRevision: 1,
    vehicleDrafts: [{ ...vehicle, location: { latitude: 40, longitude: -73, origin: 'user' } }], noteDrafts: [],
    dirtyVehicleIds: [vehicleId], dirtyNoteIds: [] }), /saved location/);
});

test('invalid zero, non-finite, incomplete fuel, blank name, and blank note drafts are rejected locally', () => {
  for (const changes of [{ fuelValue: '0', fuelUnit: 'mpg' }, { fuelValue: 'Infinity', fuelUnit: 'mpg' },
    { fuelValue: '2', fuelUnit: '' }, { name: '  ' }]) {
    assert.throws(() => buildProfileRecordsOperation({ operationId: opId, expectedRevision: 0,
      vehicleDrafts: [{ ...vehicle, ...changes }], noteDrafts: [], dirtyVehicleIds: [vehicleId], dirtyNoteIds: [] }));
  }
  assert.throws(() => buildProfileRecordsOperation({ operationId: opId, expectedRevision: 0,
    vehicleDrafts: [], noteDrafts: [{ ...note, text: '  ' }], dirtyVehicleIds: [], dirtyNoteIds: [noteId] }), /Enter text/);
});

test('review reapply uses a new operation and latest revision and only selected record kinds', () => {
  const nextId = '00000000-0000-4000-8000-000000000005';
  const result = buildReviewedProfileRecordsOperation({ operationId: nextId, currentRevision: 9,
    selectedKeys: [`notes:${noteId}`], pending: { vehicleUpserts: [{ ...vehicle, fuelEconomy: null, dimensions: null }],
      noteUpserts: [{ id: noteId, text: 'Edited note', selectedQuoteIds: ['quote-1'], userRemoved: true }] },
    fieldComparison: { vehicles: { [vehicleId]: { current: null } }, notes: { [noteId]: { current: note, proposed: note } } } });
  assert.equal(result.operationId, nextId);
  assert.equal(result.expectedRevision, 9);
  assert.deepEqual(result.vehicleUpserts, []);
  assert.deepEqual(result.noteUpserts.map(item => item.id), [noteId]);
});

test('review reapply refuses a newly located vehicle or a same-ID note restoration', () => {
  const pending = { vehicleUpserts: [{ ...vehicle, fuelEconomy: null, dimensions: null }],
    noteUpserts: [{ id: noteId, text: 'Restore', selectedQuoteIds: [], userRemoved: false }] };
  assert.throws(() => buildReviewedProfileRecordsOperation({ operationId: opId, currentRevision: 5,
    selectedKeys: [`vehicles:${vehicleId}`], pending,
    fieldComparison: { vehicles: { [vehicleId]: { current: { ...vehicle, location: { latitude: 1, longitude: 2 } } } } } }), /saved location/);
  assert.throws(() => buildReviewedProfileRecordsOperation({ operationId: opId, currentRevision: 5,
    selectedKeys: [`notes:${noteId}`], pending,
    fieldComparison: { notes: { [noteId]: { current: { ...note, userRemoved: true } } } } }), /removed note/);
});
