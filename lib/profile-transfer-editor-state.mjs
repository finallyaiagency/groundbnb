const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BYTES = 16_384;

function plainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && sameValue(left[key], right[key]));
}

/** Keep a known newer same-owner snapshot when an idempotency status returns an older original ack. */
export function preferCurrentCanonicalProfile(current, acknowledged) {
  if (!acknowledged || typeof acknowledged !== 'object') return current ?? null;
  if (!current || typeof current !== 'object') return acknowledged;
  if (current.accountId && acknowledged.accountId && current.accountId !== acknowledged.accountId) return current;
  if (Number.isSafeInteger(current.revision) && Number.isSafeInteger(acknowledged.revision) &&
      current.revision > acknowledged.revision) return current;
  return acknowledged;
}

/** Pick a same-owner refresh at least as new as the acknowledged operation, never downgrading known state. */
export function selectCanonicalAfterStatusRefresh(current, acknowledged, refreshed, accountId) {
  const valid = profile => profile && typeof profile === 'object' && profile.accountId === accountId &&
    Number.isSafeInteger(profile.revision) && profile.revision >= 0;
  const safeAck = valid(acknowledged) ? acknowledged : null;
  const safeCurrent = valid(current) ? current : null;
  let best = safeCurrent && safeAck
    ? (safeCurrent.revision > safeAck.revision ? safeCurrent : safeAck)
    : safeCurrent ?? safeAck;
  if (valid(refreshed) && safeAck && refreshed.revision >= safeAck.revision &&
      (!best || refreshed.revision >= best.revision)) best = refreshed;
  return best;
}

function validateOperationRef(operationId, expectedRevision) {
  if (typeof operationId !== 'string' || !UUID.test(operationId)) throw new Error('A stable save ID is required.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('A valid saved profile revision is required.');
  }
}

function normalizePatch(patch) {
  if (!plainRecord(patch)) throw new Error('Select profile fields to import.');
  const result = {};
  for (const [field, answer] of Object.entries(patch)) {
    if (!plainRecord(answer) || !Object.hasOwn(answer, 'value') || typeof answer.answered !== 'boolean') {
      throw new Error('A selected profile value could not be prepared. Review the import again.');
    }
    result[field] = { value: answer.value, answered: answer.answered };
  }
  return result;
}

function enforceRequestSize(operation) {
  const bytes = new TextEncoder().encode(JSON.stringify(operation)).byteLength;
  if (bytes > MAX_REQUEST_BYTES) {
    throw new Error('This selection is too large for one save. Deselect some fields or quotes, then apply a smaller reviewed selection.');
  }
  return operation;
}

/** Allocate note IDs once and return the exact body that must be replayed on uncertainty. */
export function buildProfileTransferOperation({ operationId, expectedRevision, patch = {}, noteTexts = [], createId = () => crypto.randomUUID() }) {
  validateOperationRef(operationId, expectedRevision);
  if (!Array.isArray(noteTexts) || noteTexts.some(text => typeof text !== 'string' || !text.trim() || text.length > 10_000)) {
    throw new Error('Each selected quote must contain profile note text.');
  }
  const noteUpserts = noteTexts.map(text => {
    const id = createId();
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('A stable note ID could not be created.');
    return { id, text, selectedQuoteIds: [], userRemoved: false };
  });
  const cleanPatch = normalizePatch(patch);
  if (!Object.keys(cleanPatch).length && !noteUpserts.length) throw new Error('Select at least one reviewed change.');
  if (new Set(noteUpserts.map(note => note.id)).size !== noteUpserts.length) throw new Error('A unique note ID could not be created.');
  return enforceRequestSize({ operationId, expectedRevision, patch: cleanPatch, noteUpserts });
}

/** A conflict reapply gets a new operation ID/revision but retains selected note IDs and text. */
export function buildReviewedProfileTransferOperation({ pending, currentRevision, selectedKeys, fieldComparison = {}, operationId }) {
  validateOperationRef(operationId, currentRevision);
  if (!pending || !Array.isArray(selectedKeys)) throw new Error('Review the saved and proposed values before reapplying.');
  const selected = new Set(selectedKeys);
  const profileComparison = fieldComparison.profileFields ?? {};
  const noteComparison = fieldComparison.notes ?? {};
  const patch = Object.fromEntries(Object.entries(pending.patch ?? {}).filter(([field]) => selected.has(`profileFields:${field}`)));
  const noteUpserts = (pending.noteUpserts ?? []).filter(note => selected.has(`notes:${note.id}`));
  for (const [field, answer] of Object.entries(patch)) {
    const comparison = profileComparison[field];
    if (!comparison) continue;
    const currentAnswer = comparison.current;
    if (currentAnswer && typeof currentAnswer === 'object' && currentAnswer.answered === true &&
        sameValue(currentAnswer.value, answer.value) && currentAnswer.answered === answer.answered) {
      throw new Error(`The saved ${field} value already matches your proposed value.`);
    }
  }
  if (noteUpserts.some(note => noteComparison[note.id]?.current !== null && noteComparison[note.id]?.current !== undefined)) {
    throw new Error('A transferred note ID is already present. Review the latest saved profile.');
  }
  if (!Object.keys(patch).length && !noteUpserts.length) throw new Error('Select at least one change to reapply.');
  return enforceRequestSize({ operationId, expectedRevision: currentRevision, patch, noteUpserts });
}

function expectedPatch(operation) {
  const patch = { ...operation.patch };
  if (Object.hasOwn(patch, 'homeAddress')) patch.homePoint = { value: null, answered: false };
  return patch;
}

/** Accept only the exact durable operation snapshot, owner, revision, notes, and affected IDs. */
export function isMatchingProfileTransferAcknowledgment(result, operation, accountId) {
  if (typeof accountId !== 'string' || !accountId || !plainRecord(result) || result.ok !== true ||
      result.operationKind !== 'profile_transfer' || result.operationId !== operation?.operationId ||
      !UUID.test(result.requestId ?? '') || typeof result.savedAt !== 'string' || !Number.isFinite(Date.parse(result.savedAt)) ||
      !plainRecord(result.profile) || result.profile.accountId !== accountId ||
      result.profile.revision !== operation.expectedRevision + 1 || !plainRecord(result.profile.answers) ||
      !Array.isArray(result.profile.vehicles) || !Array.isArray(result.profile.notes) || !Array.isArray(result.affectedIds)) return false;
  const expectedIds = new Set([accountId, ...(operation.noteUpserts ?? []).map(note => note.id)]);
  if (result.affectedIds.length !== expectedIds.size || result.affectedIds.some(id => !expectedIds.delete(id)) || expectedIds.size) return false;
  for (const [field, proposed] of Object.entries(expectedPatch(operation))) {
    const canonical = result.profile.answers[field];
    if (!plainRecord(canonical) || canonical.answered !== proposed.answered || !sameValue(canonical.value, proposed.value)) return false;
  }
  for (const note of operation.noteUpserts ?? []) {
    const canonical = result.profile.notes.find(item => item?.id === note.id);
    if (!canonical || canonical.origin !== 'user' || canonical.userRemoved !== false ||
        canonical.text !== note.text || !sameValue(canonical.selectedQuoteIds, [])) return false;
  }
  return true;
}
