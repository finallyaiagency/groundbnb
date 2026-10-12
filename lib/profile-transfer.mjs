import {
  PROFILE_FIELD_DEFINITIONS, TRIP_ONLY_PROFILE_FIELDS, V1_1_PROFILE_FIELDS, assertDatabaseSafeStrings,
  validateProfileAnswerRecords, validateProfilePatch,
} from './profile-domain.mjs';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const PROFILE_KEYS = new Set(Object.keys(PROFILE_FIELD_DEFINITIONS));
const HOME_KEYS = new Set(['homeAddress', 'homePoint', 'alwaysBeginEndAtHome']);
const AUTHORITY_WORD = /(?:^|-)(?:owner|account|user|identity|email|auth|password|credential|role|membership|entitlement|plan|payment|billing|session|token|provider|consent|secret|operation|revision|id|status|created-at|updated-at|expected-revision)(?:-|$)/;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const previewBindings = new WeakMap();

export class ProfileTransferError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.name = 'ProfileTransferError';
    this.code = code;
    this.field = field;
  }
}

function transferError(code, message, field) {
  throw new ProfileTransferError(code, message, field);
}

function isAuthorityKey(key) {
  const normalized = String(key).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return AUTHORITY_WORD.test(normalized);
}

function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value ||
      !value.endsWith('Z')) {
    transferError('invalid_timestamp', 'exportedAt must be a canonical UTC ISO timestamp.', 'exportedAt');
  }
  return value;
}

function normalizeNotes(profileNotes) {
  if (!Array.isArray(profileNotes) || profileNotes.some(note => typeof note !== 'string' || note.length > 10_000)) {
    transferError('invalid_notes', 'Profile notes must be an array of plain strings no longer than 10,000 characters.', 'profileNotes');
  }
  try { assertDatabaseSafeStrings(profileNotes); }
  catch (error) { transferError('invalid_notes', error.message, error.field ?? 'profileNotes'); }
  return [...profileNotes];
}

function exportSource(profile) {
  if (!plainRecord(profile) || !plainRecord(profile.answers)) {
    transferError('invalid_profile', 'Profile export requires canonical account answer records.', 'answers');
  }
  let answers;
  try { answers = validateProfileAnswerRecords(profile.answers); }
  catch (error) { transferError('invalid_profile', error.message, error.field ?? null); }
  return { answers, profileNotes: normalizeNotes(profile.profileNotes ?? []) };
}

function normalizedOptions(options = {}) {
  if (!plainRecord(options)) transferError('invalid_options', 'Transfer options must be an object.');
  const includeHome = options.includeHome === true;
  const includeQuotes = options.includeQuotes === true;
  return { includeHome, includeQuotes };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (plainRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sourceBinding(profile, options) {
  const source = exportSource(profile);
  const normalized = normalizedOptions(options);
  return { source, options: normalized, binding: stableJson({ answers: source.answers, profileNotes: source.profileNotes, options: normalized }) };
}

/** Preview the exact fields and notes proposed for export before building downloadable bytes. */
export function createProfileExportPreview(profile, options = {}) {
  const { source, options: normalized, binding } = sourceBinding(profile, options);
  const profileFields = {};
  const sensitiveFields = {};
  const warnings = [];

  for (const [field, answer] of Object.entries(source.answers)) {
    if (!answer.answered) continue;
    if (HOME_KEYS.has(field) && !normalized.includeHome) continue;
    if (field === 'homePoint' && normalized.includeHome) {
      warnings.push({ code: 'home_point_provenance_unknown', field,
        message: 'Home point was omitted because this transfer has no trusted authored-provenance record.' });
      continue;
    }
    profileFields[field] = answer.value;
    if (HOME_KEYS.has(field)) sensitiveFields[field] = answer.value;
  }

  const profileNotes = normalized.includeQuotes ? source.profileNotes : [];
  const preview = deepFreeze({
    kind: 'profile-export-preview',
    profileFields: Object.freeze({ ...profileFields }),
    profileNotes: Object.freeze([...profileNotes]),
    sensitiveFields: Object.freeze({ ...sensitiveFields }),
    sensitiveNotes: [...profileNotes],
    sensitiveNoteCount: profileNotes.length,
    includedHome: normalized.includeHome && Object.keys(sensitiveFields).length > 0,
    includedQuotes: normalized.includeQuotes && profileNotes.length > 0,
    requiresSensitiveConfirmation: Object.keys(sensitiveFields).length > 0 || profileNotes.length > 0,
    warnings: Object.freeze(warnings.map(warning => Object.freeze(warning))),
  });
  previewBindings.set(preview, binding);
  return preview;
}

/** Build native UTF-8 export only after the exact preview has been reviewed. */
export function buildProfileExport(profile, { preview, confirmSensitive = false, exportedAt = new Date().toISOString(), ...options } = {}) {
  if (!preview || typeof preview !== 'object' || !previewBindings.has(preview)) {
    transferError('preview_required', 'Create and review an export preview before building the profile file.');
  }
  const { binding } = sourceBinding(profile, options);
  if (previewBindings.get(preview) !== binding) {
    transferError('preview_mismatch', 'The profile or transfer options changed after the export preview. Review a new preview.');
  }
  if (preview.requiresSensitiveConfirmation && confirmSensitive !== true) {
    transferError('sensitive_confirmation_required', 'Confirm the reviewed home and quote fields before exporting them.');
  }
  const envelope = {
    format: 'groundbnb', formatVersion: 1, kind: 'profile', exportedAt: timestamp(exportedAt),
    profileFields: { ...preview.profileFields }, profileNotes: [...preview.profileNotes],
  };
  const text = JSON.stringify(envelope, null, 2);
  return { envelope, text, bytes: new TextEncoder().encode(text), contentType: 'application/json; charset=utf-8' };
}

function decodeNativeInput(input) {
  try {
    if (typeof input === 'string') {
      if (new TextEncoder().encode(input).byteLength > MAX_FILE_BYTES) transferError('file_too_large', 'Profile file exceeds the supported size.');
      return input;
    }
    if (input instanceof Uint8Array) {
      if (input.byteLength > MAX_FILE_BYTES) transferError('file_too_large', 'Profile file exceeds the supported size.');
      return new TextDecoder('utf-8', { fatal: true }).decode(input);
    }
  } catch (error) {
    if (error instanceof ProfileTransferError) throw error;
    transferError('invalid_utf8', 'Profile file must be valid UTF-8.');
  }
  transferError('invalid_input', 'Profile import requires UTF-8 JSON text or bytes.');
}

function warning(code, field, message) { return { code, field, message }; }

function validateImportedField(field, value) {
  if (!PROFILE_KEYS.has(field)) {
    if (V1_1_PROFILE_FIELDS.includes(field)) return { warning: warning('unsupported_tier', field, `${field} is unavailable in v1 and was not imported.`) };
    if (TRIP_ONLY_PROFILE_FIELDS.includes(field)) return { warning: warning('wrong_scope', field, `${field} belongs to trip state and was not imported into the account profile.`) };
    return { warning: warning(isAuthorityKey(field) ? 'authority_field' : 'unknown_field', field,
      isAuthorityKey(field) ? `${field} is authority data and was not imported.` : `${field} is not a supported account profile field and was not imported.`) };
  }
  try {
    const answer = validateProfilePatch({ [field]: { value, answered: true, scope: 'account' } })[field];
    return { answer };
  } catch (error) {
    return { warning: warning('invalid_field', field, error.message) };
  }
}

/** Parse and validate a native profile envelope, returning a reviewable import proposal only. */
export function previewProfileImport(input, options = {}) {
  const text = decodeNativeInput(input);
  let envelope;
  try { envelope = JSON.parse(text); }
  catch { transferError('invalid_json', 'Profile file is not valid JSON.'); }
  if (!plainRecord(envelope) || envelope.format !== 'groundbnb' || envelope.formatVersion !== 1 || envelope.kind !== 'profile') {
    transferError('invalid_envelope', 'Expected a groundbnb profile file with formatVersion 1.');
  }
  timestamp(envelope.exportedAt);
  if (!plainRecord(envelope.profileFields)) transferError('invalid_fields', 'profileFields must be an object.');
  const notes = normalizeNotes(envelope.profileNotes);
  const settings = normalizedOptions(options);
  const warnings = [];
  const knownEnvelope = new Set(['format', 'formatVersion', 'kind', 'exportedAt', 'profileFields', 'profileNotes']);
  for (const key of Object.keys(envelope)) {
    if (knownEnvelope.has(key)) continue;
    warnings.push(warning(isAuthorityKey(key) ? 'authority_field' : 'unknown_envelope_field', key,
      isAuthorityKey(key) ? `${key} is authority data and was ignored.` : `${key} is not part of the profile envelope and was ignored.`));
  }

  const proposedFields = {};
  const reviewOnlyFields = {};
  for (const [field, value] of Object.entries(envelope.profileFields)) {
    if (isAuthorityKey(field)) {
      warnings.push(warning('authority_field', field, `${field} is authority data and was not imported.`));
      continue;
    }
    if (HOME_KEYS.has(field) && !settings.includeHome) {
      warnings.push(warning('home_opt_in_required', field, `${field} was omitted; opt in to transfer home location fields.`));
      continue;
    }
    const result = validateImportedField(field, value);
    if (result.warning) warnings.push(result.warning);
    else if (field === 'homePoint' && result.answer.value !== null) {
      reviewOnlyFields[field] = result.answer.value;
      warnings.push(warning('home_point_unverified', field,
        'Imported home point provenance is unknown; it is visible for review but cannot be selected for a mutation until resolved.'));
    } else proposedFields[field] = result.answer;
  }

  const proposedNotes = settings.includeQuotes ? notes : [];
  if (notes.length && !settings.includeQuotes) {
    warnings.push(warning('quotes_opt_in_required', 'profileNotes', 'Profile notes were omitted; opt in to transfer personal quotes.'));
  }
  const preview = deepFreeze({
    kind: 'profile-import-preview',
    exportedAt: envelope.exportedAt,
    fields: Object.freeze(Object.fromEntries(Object.entries(proposedFields).map(([field, answer]) => [field, answer.value]))),
    reviewOnlyFields: Object.freeze({ ...reviewOnlyFields }),
    profileNotes: Object.freeze([...proposedNotes]),
    warnings: Object.freeze(warnings.map(item => Object.freeze(item))),
    requiresSensitiveConfirmation: [...Object.keys(proposedFields), ...Object.keys(reviewOnlyFields)].some(field => HOME_KEYS.has(field)) || proposedNotes.length > 0,
  });
  const binding = stableJson({ exportedAt: preview.exportedAt, fields: proposedFields, reviewOnlyFields, profileNotes: proposedNotes, options: settings });
  previewBindings.set(preview, binding);
  return preview;
}

/** Show before/after values and return only user-selected changes; this never persists them. */
export function createProfileMergeProposal(preview, currentProfile, { selectedFields = [], selectedNotes = [], confirmSensitive = false } = {}) {
  if (!preview || typeof preview !== 'object' || preview.kind !== 'profile-import-preview' || !previewBindings.has(preview)) {
    transferError('preview_required', 'Create and review an import preview before proposing profile changes.');
  }
  if (!plainRecord(currentProfile) || !plainRecord(currentProfile.answers)) {
    transferError('invalid_profile', 'Merge requires the current canonical profile answers.', 'answers');
  }
  let current;
  try { current = validateProfileAnswerRecords(currentProfile.answers); }
  catch (error) { transferError('invalid_profile', error.message, error.field ?? null); }
  if (!Array.isArray(selectedFields) || !Array.isArray(selectedNotes)) {
    transferError('invalid_selection', 'Selected fields and notes must be arrays.');
  }
  if (preview.requiresSensitiveConfirmation && confirmSensitive !== true) {
    transferError('sensitive_confirmation_required', 'Confirm the reviewed home and quote fields before proposing their import.');
  }
  const fields = preview.fields;
  if (new Set(selectedFields).size !== selectedFields.length || selectedFields.some(field => typeof field !== 'string' || !own(fields, field))) {
    transferError('invalid_selection', 'Select only unique fields shown in the import preview.');
  }
  if (new Set(selectedNotes).size !== selectedNotes.length || selectedNotes.some(index => !Number.isInteger(index) || index < 0 || index >= preview.profileNotes.length)) {
    transferError('invalid_selection', 'Select only unique note positions shown in the import preview.');
  }
  const changes = Object.entries(fields).map(([field, value]) => ({
    field,
    before: current[field]?.value ?? null,
    after: value,
    beforeAnswered: current[field]?.answered ?? false,
    changed: !current[field]?.answered || stableJson(current[field].value) !== stableJson(value),
    selected: selectedFields.includes(field),
  }));
  const patch = {};
  for (const field of selectedFields) {
    const { [field]: answer } = validateProfilePatch({ [field]: { value: fields[field], answered: true, scope: 'account' } });
    delete answer.updatedAt;
    patch[field] = answer;
  }
  return {
    changes,
    patch,
    selectedNoteTextPreview: selectedNotes.map(index => preview.profileNotes[index]),
    notesCommitAllowed: false,
    notesCommitReason: 'Profile note record persistence is not enabled by this transfer boundary.',
    selectedNoteIndexes: [...selectedNotes],
    warnings: [...preview.warnings],
  };
}
