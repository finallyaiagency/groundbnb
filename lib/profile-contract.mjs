const RESERVED_FIELDS = new Set([
  'accountId', 'ownerId', 'id', 'revision', 'membership', 'role', 'entitlements',
  'email', 'providers', 'session', 'status', 'createdAt', 'updatedAt',
]);

// Section 11.3 profile interchange dictionary (trip-only fields excluded).
// A closed allowlist prevents arbitrary client keys becoming durable profile data.
const PROFILE_FIELDS = new Set(`
homeAddress homePoint alwaysBeginEndAtHome groupComposition travelerCount ageGroups hasPets petTypes preferredRegions
 dietaryRequirements specialRequirements travelModes travelSeason overnightPreferences activities drivingPace
 maxDrivingHoursPerDay budgetLevel budgetMode budgetTimeframe budgetAmount budgetCurrency comfortLevel allowSplurge
 splurgeAmount splurgeCurrency splurgeMode splurgeTimeframe splurgeFrequency splurgeTypes needsFoodAccess needsFacilities
 needsWalkableTransit includeSupportServices avoidHighways preferScenic avoidTolls avoidMountainRoutes accessibility
 needHookups sustainability planningStyle budgetSensitivity travelScope climate riskTolerance physicalCapacity
 planningHorizon willingToReposition comparisonMode terrain incomeOffsets legalSafety emotionalGoals proPlannerInterested
 recurringChecks monitoringTargets monitoringFrequency monitoringStopRule refundableOnly alertSavingsThreshold
 nearbyAirportFlexibility nearbyStayFlexibility dateFlexibility keepSameQuality alertChannels fundTheFunEnabled
 fundTheFunPaths fundTheFunIncomeSources fundTheFunVolunteerPrograms fundTheFunSkills incomeNeededPerDay
 fundTheFunSkillNotes fundTheFunStayDuration
`.trim().split(/\s+/));

export class ProfileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

export class ProfileRevisionConflict extends Error {
  constructor(currentProfile, patch, changedFields) {
    super('Profile changed since it was loaded. Review the current values before saving again.');
    this.name = 'ProfileRevisionConflict';
    this.currentRevision = currentProfile.revision;
    this.fieldComparison = Object.fromEntries(changedFields.map((field) => [
      field,
      { current: structuredClone(currentProfile.answers[field] ?? null), proposed: structuredClone(patch[field]) },
    ]));
  }
}

function isJsonValue(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 200 && value.every((item) => isJsonValue(item, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const entries = Object.entries(value);
  return entries.length <= 100 && entries.every(([key, item]) =>
    key.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(key) && isJsonValue(item, depth + 1));
}

export function prepareProfileUpdate(currentProfile, { expectedRevision, patch, updatedAt }) {
  if (!currentProfile || !Number.isSafeInteger(currentProfile.revision) || currentProfile.revision < 0 ||
      !currentProfile.answers || typeof currentProfile.answers !== 'object' || Array.isArray(currentProfile.answers)) {
    throw new ProfileValidationError('Current profile is invalid.');
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new ProfileValidationError('An expected profile revision is required.');
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0 || Object.keys(patch).length > 100) {
    throw new ProfileValidationError('Provide between 1 and 100 profile fields to update.');
  }
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) {
    throw new ProfileValidationError('A server-generated ISO timestamp is required.');
  }

  const fields = Object.keys(patch);
  if (fields.some((field) => field.length > 100 || RESERVED_FIELDS.has(field) || !PROFILE_FIELDS.has(field))) {
    throw new ProfileValidationError('Profile patch contains an invalid or reserved field.');
  }

  if (expectedRevision !== currentProfile.revision) {
    throw new ProfileRevisionConflict(currentProfile, patch, fields);
  }

  const answers = structuredClone(currentProfile.answers);
  for (const field of fields) {
    const answer = patch[field];
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) ||
        typeof answer.answered !== 'boolean' || !Object.hasOwn(answer, 'value') ||
        !isJsonValue(answer.value) || (answer.answered === false && answer.value !== null &&
          !(Array.isArray(answer.value) && answer.value.length === 0))) {
      throw new ProfileValidationError(`Profile answer "${field}" must include a valid value and answered state.`);
    }
    answers[field] = {
      value: structuredClone(answer.value),
      answered: answer.answered,
      scope: 'account',
      updatedAt,
    };
  }

  return {
    expectedRevision,
    profile: {
      accountId: currentProfile.accountId,
      ...(currentProfile.createdAt ? { createdAt: currentProfile.createdAt } : {}),
      answers,
      revision: currentProfile.revision + 1,
      updatedAt,
    },
    changedFields: fields,
  };
}
