/** Validate references against the owner-scoped original transaction snapshot. */
export function hasOwnedProfileAcknowledgment(result) {
  const profile = result?.profile;
  if (!profile || typeof profile.accountId !== 'string' || !profile.accountId ||
      !Number.isSafeInteger(profile.revision) || profile.revision < 0 ||
      !Array.isArray(result.affectedIds) || !result.affectedIds.length ||
      new Set(result.affectedIds).size !== result.affectedIds.length ||
      !result.affectedIds.includes(profile.accountId)) return false;
  if (result.operationKind === undefined) return result.affectedIds.length === 1;
  if (!['profile_records','profile_transfer'].includes(result.operationKind) || !Array.isArray(profile.vehicles) || !Array.isArray(profile.notes)) return false;
  const owned = new Set([profile.accountId, ...profile.vehicles.map(item => item?.id), ...profile.notes.map(item => item?.id)]);
  return result.affectedIds.every(id => typeof id === 'string' && owned.has(id));
}
