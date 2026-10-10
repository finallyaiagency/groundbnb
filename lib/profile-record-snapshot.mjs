import { validateProfileAnswerRecords } from './profile-domain.mjs';
import { validateProfileVehicle, validateProfileNote } from './profile-records.mjs';

/** A broken storage result is unavailable; it must never become a saved acknowledgment. */
export function hasCanonicalRecordSnapshot(profile) {
  try {
    if (!profile || typeof profile.accountId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profile.accountId) ||
        !Number.isSafeInteger(profile.revision) || profile.revision < 0 ||
        !Array.isArray(profile.vehicles) || !Array.isArray(profile.notes)) return false;
    validateProfileAnswerRecords(profile.answers);
    const vehicles = profile.vehicles.map(item=>validateProfileVehicle(item,{canonical:true}));
    const notes = profile.notes.map(item=>validateProfileNote(item));
    return new Set(vehicles.map(item=>item.id)).size === vehicles.length &&
      new Set(notes.map(item=>item.id)).size === notes.length;
  } catch { return false; }
}
