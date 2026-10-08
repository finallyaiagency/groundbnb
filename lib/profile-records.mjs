const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVISION_LIMIT = Number.MAX_SAFE_INTEGER;
const VEHICLE_KEYS = new Set([
  'id', 'name', 'type', 'ownership', 'propulsion', 'fuelEconomy', 'dimensions', 'location', 'locationVerifiedAt',
]);
const NOTE_KEYS = new Set(['id', 'text', 'origin', 'selectedQuoteIds', 'userRemoved']);
const OPERATION_KEYS = new Set(['operationId', 'expectedRevision', 'vehicleUpserts', 'noteUpserts']);

export class ProfileRecordValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileRecordValidationError';
  }
}

export class ProfileRecordRevisionConflict extends Error {
  constructor(currentRevision) {
    super('Profile records changed since they were loaded. Review the current values before saving again.');
    this.name = 'ProfileRecordRevisionConflict';
    this.currentRevision = currentRevision;
  }
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ProfileRecordValidationError(`${label} must be an object.`);
  }
}

function closedKeys(value, allowed, label) {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ProfileRecordValidationError(`${label} contains an unsupported field.`);
  }
}

function text(value, label, { nullable = false, maxLength = 1000 } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new ProfileRecordValidationError(`${label} must be non-empty text of at most ${maxLength} characters.`);
  }
  return value;
}

function finitePositive(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ProfileRecordValidationError(`${label} must be a positive finite number or null.`);
  }
  return value;
}

function timestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new ProfileRecordValidationError(`${label} must be a canonical ISO timestamp or null.`);
  }
  return value;
}

function normalizeDimensions(value) {
  if (value === null) return null;
  record(value, 'Vehicle dimensions');
  const keys = ['lengthMeters', 'widthMeters', 'heightMeters'];
  closedKeys(value, new Set(keys), 'Vehicle dimensions');
  return Object.fromEntries(keys.map((key) => [key, finitePositive(value[key] ?? null, `Vehicle ${key}`, { nullable: true })]));
}

function normalizeLocation(value) {
  if (value === null) return null;
  record(value, 'Vehicle location');
  closedKeys(value, new Set(['latitude', 'longitude']), 'Vehicle location');
  const { latitude, longitude } = value;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ProfileRecordValidationError('Vehicle location must use valid decimal-degree coordinates.');
  }
  // This input contract accepts coordinates typed/supplied by the user. Provider
  // coordinates need a separate provenance/retention-aware path before storage.
  return { latitude, longitude, origin: 'user' };
}

/**
 * Validate a profile vehicle/vessel record. The 1000-character string limit is
 * an implementation payload guard, not a product-spec field-length rule.
 * Vehicle type and propulsion remain descriptive strings because the frozen
 * specification names these fields but supplies no enum catalogs for them.
 * Fuel unit text is preserved as explicit user input; no conversion or provider
 * measurement claim is made by this validator.
 */
export function validateProfileVehicle(input) {
  record(input, 'Vehicle');
  closedKeys(input, VEHICLE_KEYS, 'Vehicle');
  if (typeof input.id !== 'string' || !UUID.test(input.id)) {
    throw new ProfileRecordValidationError('Vehicle id must be a stable UUID.');
  }
  const ownership = input.ownership;
  if (!['owned', 'rented'].includes(ownership)) {
    throw new ProfileRecordValidationError('Vehicle ownership must be owned or rented.');
  }

  let fuelEconomy = null;
  if (input.fuelEconomy !== undefined && input.fuelEconomy !== null) {
    record(input.fuelEconomy, 'Vehicle fuel economy');
    closedKeys(input.fuelEconomy, new Set(['value', 'unit']), 'Vehicle fuel economy');
    fuelEconomy = {
      value: finitePositive(input.fuelEconomy.value, 'Vehicle fuel economy'),
      unit: text(input.fuelEconomy.unit, 'Vehicle fuel economy unit', { maxLength: 64 }),
      origin: 'user',
    };
  }

  const location = input.location === undefined ? null : normalizeLocation(input.location);
  const locationVerifiedAt = input.locationVerifiedAt === undefined ? null
    : timestamp(input.locationVerifiedAt, 'Vehicle location verification time', { nullable: true });
  if ((location === null) !== (locationVerifiedAt === null)) {
    throw new ProfileRecordValidationError('Vehicle location and its verification time must be set or unset together.');
  }

  return {
    id: input.id.toLowerCase(),
    name: text(input.name, 'Vehicle name'),
    type: text(input.type, 'Vehicle type'),
    ownership,
    propulsion: input.propulsion === undefined ? null : text(input.propulsion, 'Vehicle propulsion', { nullable: true }),
    fuelEconomy,
    dimensions: input.dimensions === undefined ? null : normalizeDimensions(input.dimensions),
    location,
    locationVerifiedAt,
  };
}

/** Validate a note without allowing its profile/account ownership to be supplied by the caller. */
export function validateProfileNote(input) {
  record(input, 'Profile note');
  closedKeys(input, NOTE_KEYS, 'Profile note');
  if (typeof input.id !== 'string' || !UUID.test(input.id)) {
    throw new ProfileRecordValidationError('Profile note id must be a stable UUID.');
  }
  if (!['user', 'AI'].includes(input.origin)) {
    throw new ProfileRecordValidationError('Profile note origin must be user or AI.');
  }
  // Count/ID-size caps are parser/payload guards, not product-spec limits.
  if (!Array.isArray(input.selectedQuoteIds) || input.selectedQuoteIds.length > 100 ||
      input.selectedQuoteIds.some((id) => typeof id !== 'string' || id.trim().length === 0 || id.length > 200) ||
      new Set(input.selectedQuoteIds).size !== input.selectedQuoteIds.length) {
    throw new ProfileRecordValidationError('Selected quote IDs must be unique, non-empty strings.');
  }
  if (typeof input.userRemoved !== 'boolean') {
    throw new ProfileRecordValidationError('Profile note must include its user-removed state.');
  }
  return {
    id: input.id.toLowerCase(),
    text: text(input.text, 'Profile note text', { maxLength: 10_000 }),
    origin: input.origin,
    selectedQuoteIds: [...input.selectedQuoteIds],
    userRemoved: input.userRemoved,
  };
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new ProfileRecordValidationError('A server-generated canonical ISO timestamp is required.');
  }
  return value;
}

function uniqueById(records, validator, label) {
  if (!Array.isArray(records)) throw new ProfileRecordValidationError(`${label} must be an array.`);
  const normalized = records.map(validator);
  if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
    throw new ProfileRecordValidationError(`${label} IDs must be unique.`);
  }
  return normalized;
}

/**
 * Prepare a revision-checked local candidate. The authenticated account ID is
 * copied from the current profile; client operation fields cannot override it.
 * Persistence must perform this candidate and operation acknowledgment in one
 * durable transaction before reporting success.
 */
export function prepareProfileRecordsUpdate(currentProfile, operation, updatedAt) {
  record(currentProfile, 'Current profile');
  if (typeof currentProfile.accountId !== 'string' || !currentProfile.accountId ||
      !Number.isSafeInteger(currentProfile.revision) || currentProfile.revision < 0 ||
      currentProfile.revision > REVISION_LIMIT) {
    throw new ProfileRecordValidationError('Current profile account and revision are invalid.');
  }
  record(operation, 'Profile-record operation');
  closedKeys(operation, OPERATION_KEYS, 'Profile-record operation');
  if (typeof operation.operationId !== 'string' || !UUID.test(operation.operationId) ||
      !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0 ||
      operation.expectedRevision >= REVISION_LIMIT) {
    throw new ProfileRecordValidationError('Operation ID and expected profile revision are required.');
  }
  if (operation.expectedRevision !== currentProfile.revision) {
    throw new ProfileRecordRevisionConflict(currentProfile.revision);
  }
  const savedAt = canonicalTimestamp(updatedAt);
  const existingVehicles = uniqueById(currentProfile.vehicles ?? [], validateProfileVehicle, 'Current vehicle');
  const existingNotes = uniqueById(currentProfile.notes ?? [], validateProfileNote, 'Current note');
  const vehicleUpserts = uniqueById(operation.vehicleUpserts ?? [], validateProfileVehicle, 'Vehicle update');
  const noteUpserts = uniqueById(operation.noteUpserts ?? [], validateProfileNote, 'Note update');
  const vehicleMap = new Map(existingVehicles.map((vehicle) => [vehicle.id, vehicle]));
  const noteMap = new Map(existingNotes.map((note) => [note.id, note]));

  for (const vehicle of vehicleUpserts) vehicleMap.set(vehicle.id, vehicle);
  for (const incoming of noteUpserts) {
    const existing = noteMap.get(incoming.id);
    // A tombstone is terminal for this stable note ID. Reintroducing the same
    // ID from an old summary cannot restore it; a deliberate new note needs a new ID.
    if (existing?.userRemoved && !incoming.userRemoved) {
      throw new ProfileRecordValidationError('A removed profile note cannot be restored with the same ID.');
    }
    if (existing?.userRemoved) continue;
    noteMap.set(incoming.id, incoming);
  }

  const profile = {
    ...currentProfile,
    vehicles: [...vehicleMap.values()],
    notes: [...noteMap.values()],
    revision: currentProfile.revision + 1,
    updatedAt: savedAt,
  };
  return {
    operationId: operation.operationId.toLowerCase(),
    expectedRevision: currentProfile.revision,
    savedAt,
    profile,
  };
}
