const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveOrNull(value, label) {
  if (value.trim() === '') return null;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number or left blank.`);
  return parsed;
}

function cleanVehicle(draft) {
  const fuelValue = positiveOrNull(draft.fuelValue, 'Fuel use');
  if ((fuelValue === null) !== (draft.fuelUnit.trim() === '')) {
    throw new Error('Enter both fuel use and its unit, or leave both blank.');
  }
  const lengthMeters = positiveOrNull(draft.lengthMeters, 'Length');
  const widthMeters = positiveOrNull(draft.widthMeters, 'Width');
  const heightMeters = positiveOrNull(draft.heightMeters, 'Height');
  if (!draft.name.trim() || !draft.type.trim()) throw new Error('Enter a name and type for each vehicle or vessel.');
  return {
    id: draft.id,
    name: draft.name,
    type: draft.type,
    ownership: draft.ownership,
    propulsion: draft.propulsion.trim() || null,
    fuelEconomy: fuelValue === null ? null : { value: fuelValue, unit: draft.fuelUnit.trim() },
    dimensions: lengthMeters === null && widthMeters === null && heightMeters === null
      ? null : { lengthMeters, widthMeters, heightMeters },
    location: null,
    locationVerifiedAt: null,
  };
}

function cleanNote(draft) {
  if (typeof draft.text !== 'string' || !draft.text.trim()) throw new Error('Enter text for each profile note, or discard the blank note.');
  return {
    id: draft.id,
    text: draft.text,
    selectedQuoteIds: [...draft.selectedQuoteIds],
    userRemoved: draft.userRemoved,
  };
}

function validateOperationId(operationId) {
  if (typeof operationId !== 'string' || !UUID.test(operationId)) throw new Error('A stable operation ID is required.');
}

function validateRevision(expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('A valid saved profile revision is required.');
  }
}

/** Build the exact client operation body without client-owned provenance or ownership fields. */
export function buildProfileRecordsOperation({ operationId, expectedRevision, vehicleDrafts, noteDrafts, dirtyVehicleIds, dirtyNoteIds }) {
  validateOperationId(operationId);
  validateRevision(expectedRevision);
  const vehicles = vehicleDrafts.filter(item => dirtyVehicleIds.includes(item.id));
  const notes = noteDrafts.filter(item => dirtyNoteIds.includes(item.id));
  if (vehicles.some(vehicle => vehicle.location !== null)) {
    throw new Error('A vehicle with a saved location cannot be edited here. Its location needs a separate safe update path.');
  }
  const vehicleUpserts = vehicles.map(cleanVehicle);
  const noteUpserts = notes.map(cleanNote);
  if (!vehicleUpserts.length && !noteUpserts.length) throw new Error('Make a record change before saving.');
  if (new Set([...vehicleUpserts, ...noteUpserts].map(item => item.id)).size !== vehicleUpserts.length + noteUpserts.length) {
    throw new Error('Record IDs must be unique.');
  }
  return { operationId, expectedRevision, vehicleUpserts, noteUpserts };
}

/** Make a new explicitly reviewed operation after a stale-revision comparison. */
export function buildReviewedProfileRecordsOperation({ pending, currentRevision, selectedKeys, fieldComparison, operationId }) {
  validateOperationId(operationId);
  validateRevision(currentRevision);
  const selected = new Set(selectedKeys);
  const vehicleUpserts = pending.vehicleUpserts.filter(item => selected.has(`vehicles:${item.id}`));
  const noteUpserts = pending.noteUpserts.filter(item => selected.has(`notes:${item.id}`));
  const vehicles = fieldComparison.vehicles ?? {};
  const notes = fieldComparison.notes ?? {};
  if (vehicleUpserts.some(item => vehicles[item.id]?.current?.location !== null && vehicles[item.id]?.current !== null)) {
    throw new Error('A selected vehicle now has a saved location and cannot be safely reapplied here.');
  }
  if (noteUpserts.some(item => notes[item.id]?.current?.userRemoved && !item.userRemoved)) {
    throw new Error('A removed note cannot be restored with the same ID.');
  }
  if (!vehicleUpserts.length && !noteUpserts.length) throw new Error('Select at least one safe change to reapply.');
  return { operationId, expectedRevision: currentRevision, vehicleUpserts, noteUpserts };
}
