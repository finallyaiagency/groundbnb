import { PROFILE_FIELD_DEFINITIONS } from './profile-domain.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function isMatchingProfileAcknowledgment(result, operation, accountId) {
  return typeof accountId === 'string' && accountId.length > 0 && plainRecord(result) && result.ok === true && result.operationId === operation?.operationId &&
    UUID.test(result.requestId ?? '') && typeof result.savedAt === 'string' && Number.isFinite(Date.parse(result.savedAt)) &&
    plainRecord(result.profile) && result.profile.accountId === accountId && Number.isSafeInteger(result.profile.revision) &&
    result.profile.revision === operation.expectedRevision + 1 && plainRecord(result.profile.answers) &&
    Array.isArray(result.affectedIds) && result.affectedIds.length === 1 && result.affectedIds[0] === accountId &&
    Object.entries(operation.patch).every(([field, proposed]) => {
      const canonical = result.profile.answers[field];
      return plainRecord(canonical) && canonical.answered === proposed.answered && sameValue(canonical.value, proposed.value);
    });
}

function recordForComparison(record, isNote) {
  const result = { ...record };
  if (isNote) delete result.origin;
  else {
    if (plainRecord(result.fuelEconomy)) { result.fuelEconomy = { ...result.fuelEconomy }; delete result.fuelEconomy.origin; }
    if (plainRecord(result.location)) { result.location = { ...result.location }; delete result.location.origin; }
  }
  return result;
}

export function isMatchingProfileRecordsAcknowledgment(result, operation, accountId) {
  if (typeof accountId !== 'string' || !accountId || !plainRecord(result) || result.ok !== true ||
      result.operationKind !== 'profile_records' || result.operationId !== operation?.operationId ||
      !UUID.test(result.requestId ?? '') || typeof result.savedAt !== 'string' || !Number.isFinite(Date.parse(result.savedAt)) ||
      !plainRecord(result.profile) || result.profile.accountId !== accountId ||
      result.profile.revision !== operation.expectedRevision + 1 || !plainRecord(result.profile.answers) ||
      !Array.isArray(result.profile.vehicles) || !Array.isArray(result.profile.notes) ||
      !Array.isArray(result.affectedIds)) return false;
  const expectedIds = new Set([accountId,
    ...(operation.vehicleUpserts ?? []).map(item => item.id), ...(operation.noteUpserts ?? []).map(item => item.id)]);
  if (result.affectedIds.length !== expectedIds.size || result.affectedIds.some(id => !expectedIds.delete(id)) || expectedIds.size) return false;
  for (const vehicle of operation.vehicleUpserts ?? []) {
    const canonical = result.profile.vehicles.find(item => item?.id === vehicle.id);
    if (!canonical || !sameValue(recordForComparison(canonical, false), recordForComparison(vehicle, false))) return false;
  }
  for (const note of operation.noteUpserts ?? []) {
    const canonical = result.profile.notes.find(item => item?.id === note.id);
    if (!canonical || !['user', 'AI'].includes(canonical.origin) || !sameValue(recordForComparison(canonical, true), recordForComparison(note, true))) return false;
  }
  return true;
}

export function acknowledgedRecordIds(currentDrafts, submittedDrafts, submittedRecords) {
  return submittedRecords.flatMap(record => {
    const current = currentDrafts.find(item => item.id === record.id);
    const submitted = submittedDrafts.find(item => item.id === record.id);
    return current && submitted && sameValue(current, submitted) ? [record.id] : [];
  });
}

export function advanceRequestGeneration(current) {
  return Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1;
}

export function isCurrentRequestGeneration(captured, current) {
  return Number.isSafeInteger(captured) && captured === current;
}

function normalizeAnswer(field, answer) {
  const value = answer?.value;
  const type = PROFILE_FIELD_DEFINITIONS[field]?.type;
  if (typeof value === 'string' && value.trim() === '' &&
      ['nullableInteger', 'nullableNumber', 'nullableDecimal', 'nullableCurrency'].includes(type)) {
    return { value: null, answered: answer.answered };
  }
  if (typeof value === 'string' && ['nullableInteger', 'nullableNumber'].includes(type)) {
    const number = Number(value.trim());
    if (Number.isFinite(number)) return { value: number, answered: answer.answered };
  }
  if (Array.isArray(value) && ['textList', 'manualChoiceList'].includes(type)) {
    return { value: value.map(item => item.trim()).filter(Boolean), answered: answer.answered };
  }
  return { value, answered: answer?.answered };
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

/** Clear only operation fields whose current local draft still equals the acknowledged value. */
export function acknowledgedDraftFields(draftAnswers, dirtyFields, operation) {
  return Object.entries(operation?.patch ?? {}).flatMap(([field, proposed]) => {
    if (dirtyFields[field] !== true || !draftAnswers[field]) return [];
    const current = normalizeAnswer(field, draftAnswers[field]);
    return current.answered === proposed.answered && sameValue(current.value, proposed.value) ? [field] : [];
  });
}

export function pendingTextAutosaveFields(dirtyFields, fieldDefinitions, blockedFields = new Set()) {
  return Object.keys(dirtyFields).filter(field => dirtyFields[field] === true && !blockedFields.has(field) &&
    ['text', 'textList', 'manualChoiceList'].includes(fieldDefinitions[field]?.type));
}

/** Debounce behavior shared by the editor and deterministic timer tests. */
export function createDebouncedTask(delayMs) {
  let timer = null;
  let callback = null;
  return {
    schedule(next) {
      if (timer !== null) clearTimeout(timer);
      callback = next;
      timer = setTimeout(() => {
        const run = callback;
        timer = null;
        callback = null;
        run?.();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      callback = null;
    },
    flush() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const run = callback;
      callback = null;
      run?.();
    },
  };
}
