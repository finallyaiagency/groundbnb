import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareProfileRecordsUpdate,
  ProfileRecordRevisionConflict,
  ProfileRecordValidationError,
  validateProfileNote,
  validateProfileVehicle,
} from '../lib/profile-records.mjs';

const accountId = 'trusted-account-from-session';
const savedAt = '2026-10-07T16:30:00.000Z';
const vehicleId = '10000000-0000-4000-8000-000000000001';
const noteId = '20000000-0000-4000-8000-000000000002';
const operationId = '30000000-0000-4000-8000-000000000003';
const vehicle = {
  id: vehicleId, name: 'Family van', type: 'Van/Class B', ownership: 'owned', propulsion: 'gasoline',
  fuelEconomy: { value: 18.5, unit: 'mpg' },
  dimensions: { lengthMeters: 6.1, widthMeters: null, heightMeters: 2.7 },
  location: { latitude: 40, longitude: -73 }, locationVerifiedAt: savedAt,
};
const note = { id: noteId, text: 'Prefer quiet overnight stops.', origin: 'user', selectedQuoteIds: ['quote-1'], userRemoved: false };
const profile = { accountId, revision: 3, updatedAt: '2026-10-01T00:00:00.000Z', vehicles: [], notes: [] };

test('validates a canonical vehicle with source-named ownership and explicit user fuel units', () => {
  const result = validateProfileVehicle(vehicle);
  assert.deepEqual(result, {
    ...vehicle,
    fuelEconomy: { ...vehicle.fuelEconomy, origin: 'user' },
    location: { ...vehicle.location, origin: 'user' },
  });
  assert.deepEqual(validateProfileVehicle({
    id: vehicleId, name: 'Unknown fuel inputs', type: 'RV', ownership: 'rented', propulsion: null,
  }).fuelEconomy, null);
  assert.equal(validateProfileVehicle({
    id: vehicleId, name: 'Metric van', type: 'Van', ownership: 'owned', propulsion: 'electric',
    fuelEconomy: { value: 20, unit: 'L/100km' },
  }).fuelEconomy.unit, 'L/100km');
  const vesselFuel = validateProfileVehicle({
    id: vehicleId, name: 'Small vessel', type: 'Boat', ownership: 'owned', propulsion: 'gasoline',
    fuelEconomy: { value: 1.4, unit: 'gallons/hour' },
  }).fuelEconomy;
  assert.deepEqual(vesselFuel, { value: 1.4, unit: 'gallons/hour', origin: 'user' });
});

test('keeps unknown fuel and dimensions null; rejects invented zero numeric values', () => {
  const result = validateProfileVehicle({
    id: vehicleId, name: 'Unknowns', type: 'Car', ownership: 'owned', propulsion: null,
    fuelEconomy: null, dimensions: { lengthMeters: null, widthMeters: null, heightMeters: null },
  });
  assert.equal(result.fuelEconomy, null);
  assert.deepEqual(result.dimensions, { lengthMeters: null, widthMeters: null, heightMeters: null });
  assert.throws(() => validateProfileVehicle({ ...vehicle, fuelEconomy: { value: 0, unit: 'mpg' } }), ProfileRecordValidationError);
  assert.throws(() => validateProfileVehicle({ ...vehicle, dimensions: { lengthMeters: 0 } }), ProfileRecordValidationError);
});

test('validates vehicle location and verification time as a pair', () => {
  assert.throws(() => validateProfileVehicle({ ...vehicle, location: null }), /must be set or unset together/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, locationVerifiedAt: null }), /must be set or unset together/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, location: { latitude: 91, longitude: 0 } }), /valid decimal-degree/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, location: { latitude: 0, longitude: 181 } }), /valid decimal-degree/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, locationVerifiedAt: 'yesterday' }), /canonical ISO timestamp/);
});

test('rejects unsupported keys, privilege fields, malformed stable IDs, and non-user location provenance', () => {
  for (const key of ['accountId', 'ownerId', 'role', 'session', 'providerConsent']) {
    assert.throws(() => validateProfileVehicle({ ...vehicle, [key]: 'spoof' }), ProfileRecordValidationError);
    assert.throws(() => validateProfileNote({ ...note, [key]: 'spoof' }), ProfileRecordValidationError);
  }
  assert.throws(() => validateProfileVehicle({ ...vehicle, id: 'not-an-id' }), /stable UUID/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, ownership: 'leased' }), /owned or rented/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, fuelEconomy: { value: 10, unit: ' ' } }), /fuel economy unit/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, location: { ...vehicle.location, origin: 'provider' } }), /unsupported field/);
  assert.throws(() => validateProfileVehicle({ ...vehicle, dimensions: { wheelbase: 3 } }), /unsupported field/);
});

test('validates profile notes with stable IDs, exact origin choice, and selected quote IDs', () => {
  assert.deepEqual(validateProfileNote(note), note);
  assert.throws(() => validateProfileNote({ ...note, origin: 'summary' }), /origin must be user or AI/);
  assert.throws(() => validateProfileNote({ ...note, selectedQuoteIds: ['q', 'q'] }), /unique/);
  assert.throws(() => validateProfileNote({ ...note, userRemoved: 'true' }), /user-removed state/);
  assert.throws(() => validateProfileNote({ ...note, text: '' }), /non-empty text/);
  assert.throws(() => validateProfileNote({ ...note, text: 'x'.repeat(10_001) }), /at most 10000/);
});

test('prepares a revisioned profile-record update using the existing account owner and server timestamp', () => {
  const prepared = prepareProfileRecordsUpdate(profile, {
    operationId, expectedRevision: 3, vehicleUpserts: [vehicle], noteUpserts: [note],
  }, savedAt);
  assert.equal(prepared.operationId, operationId);
  assert.equal(prepared.savedAt, savedAt);
  assert.equal(prepared.profile.accountId, accountId);
  assert.equal(prepared.profile.revision, 4);
  assert.equal(prepared.profile.updatedAt, savedAt);
  assert.deepEqual(prepared.profile.vehicles, [{
    ...vehicle,
    fuelEconomy: { ...vehicle.fuelEconomy, origin: 'user' },
    location: { ...vehicle.location, origin: 'user' },
  }]);
  assert.deepEqual(prepared.profile.notes, [note]);
  assert.equal(profile.revision, 3);
});

test('rejects stale revisions, client ownership, unknown operation fields, and invalid timestamps', () => {
  assert.throws(() => prepareProfileRecordsUpdate(profile, {
    operationId, expectedRevision: 2, vehicleUpserts: [vehicle],
  }, savedAt), (error) => error instanceof ProfileRecordRevisionConflict && error.currentRevision === 3);
  assert.throws(() => prepareProfileRecordsUpdate(profile, {
    operationId, expectedRevision: 3, accountId: 'foreign', vehicleUpserts: [vehicle],
  }, savedAt), /unsupported field/);
  assert.throws(() => prepareProfileRecordsUpdate(profile, {
    operationId, expectedRevision: 3, vehicleUpserts: [vehicle], ownerId: 'foreign',
  }, savedAt), /unsupported field/);
  assert.throws(() => prepareProfileRecordsUpdate(profile, {
    operationId, expectedRevision: 3, vehicleUpserts: [vehicle],
  }, '2026-10-07'), /canonical ISO timestamp/);
});

test('does not let an old summary recreate a user-removed note under its stable ID', () => {
  const removed = { ...note, userRemoved: true };
  const current = { ...profile, notes: [removed] };
  assert.throws(() => prepareProfileRecordsUpdate(current, {
    operationId, expectedRevision: 3, noteUpserts: [{ ...note, text: 'Reintroduced from old summary.' }],
  }, savedAt), /cannot be restored with the same ID/);
  const prepared = prepareProfileRecordsUpdate(current, {
    operationId, expectedRevision: 3, noteUpserts: [{ ...removed, text: 'Edited removed note.' }],
  }, savedAt);
  assert.deepEqual(prepared.profile.notes, [removed]);
});

test('allows note removal as a tombstone and preserves its text and origin', () => {
  const current = { ...profile, notes: [note] };
  const prepared = prepareProfileRecordsUpdate(current, {
    operationId, expectedRevision: 3, noteUpserts: [{ ...note, userRemoved: true }],
  }, savedAt);
  assert.deepEqual(prepared.profile.notes, [{ ...note, userRemoved: true }]);
});
