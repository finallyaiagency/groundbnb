import { PROFILE_CURRENCY_CODES } from './profile-currency-codes.mjs';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export const PROFILE_CATALOGS = Object.freeze({
  groupComposition: Object.freeze(['Solo', 'Couple', 'Friends', 'Family', 'Grandparents + Grandkids', 'Large Group', 'Custom Group Size']),
  ageGroups: Object.freeze(['Children 0–12', 'Teens 13–17', 'Adults 18–64', 'Seniors 65+']),
  petTypes: Object.freeze(['Dog', 'Small Dog', 'Large Dog', 'Cat', 'Other']),
  travelModes: Object.freeze(['RV', 'Van/Class B', 'Car/SUV', 'On Foot/Transit', 'Hike/Backpack', 'Plane/Flight', 'Train/Rail', 'Rental Car',
    'Bicycle', 'Truck Camper', 'Travel Trailer', 'Fifth Wheel', 'Class A', 'Class C', 'Boat/Yacht']),
  travelSeason: Object.freeze(['Spring', 'Summer', 'Fall', 'Winter', 'Year-round']),
  activities: Object.freeze(['hiking/backpacking', 'camping', 'climbing', 'scuba/snorkeling', 'skiing/snowboarding', 'extreme sports',
    'sailing/boating', 'fishing', 'kayaking', 'biking', 'off-roading', 'nature walks', 'spa/hot springs', 'beach leisure',
    'scenic cruises', 'wellness', 'swimming', 'stargazing', 'guided tours', 'historical sites', 'local food', 'festivals', 'bowling',
    'volunteer travel', 'photography', 'wildlife watching', 'community meals', 'local resources']),
  drivingPace: Object.freeze(['Fastest', 'Balanced', 'Scenic']),
  budgetLevel: Object.freeze(['Free/Minimal Cost', 'Budget', 'Moderate', 'Comfort', 'Luxury']),
  budgetMode: Object.freeze(['per_person', 'total']),
  budgetTimeframe: Object.freeze(['daily', 'weekly', 'monthly', 'full_trip']),
  comfortLevel: Object.freeze(['Rugged/Survival', 'Minimalist', 'Balanced', 'Comfortable', 'Luxury', 'Ultra-Luxury']),
  splurgeMode: Object.freeze(['per_person', 'total']),
  splurgeTimeframe: Object.freeze(['per_day', 'per_week', 'per_month', 'per_event']),
  splurgeFrequency: Object.freeze(['Once per Trip', 'Once per Month', 'Once per Week', 'Every Few Days', 'Whenever Available']),
  splurgeTypes: Object.freeze(['Accommodation', 'Experience', 'Comfort', 'Transportation upgrade']),
  accessibility: Object.freeze(['Mobility-Friendly Only', 'Low-Impact Activities', 'No Restrictions']),
  needHookups: Object.freeze(['Yes', 'Nice to Have', 'No']),
  climate: Object.freeze(['Warm', 'Cold', 'Seasonal', 'No Preference']),
  terrain: Object.freeze(['Coastal', 'Mountains', 'Forest', 'Urban', 'Mixed']),
  sustainability: Object.freeze(['Budget First', 'Balanced', 'Eco-Priority']),
  planningStyle: Object.freeze(['Fully Structured', 'Flexible Framework', 'Highly Spontaneous']),
  budgetSensitivity: Object.freeze(['Strict', 'Flexible', 'Optimized']),
  preferredTransport: Object.freeze(['Flight', 'Train', 'Bus', 'Car Rental', 'RV', 'Boat']),
  travelScope: Object.freeze(['Domestic Only', 'International Allowed']),
  riskTolerance: Object.freeze(['Low Risk', 'Moderate Adventure', 'High Adrenaline']),
  physicalCapacity: Object.freeze(['Sedentary', 'Moderately Active', 'High Endurance', 'Elite/Extreme']),
  planningHorizon: Object.freeze(['under 30 days', '1–3 months', '3–12 months', 'Long-Term/Open-Ended']),
  legalSafety: Object.freeze(['Legal Camping Only', 'Permit Alerts Required', 'Insurance Recommendations', 'No Special Requirements']),
  emotionalGoals: Object.freeze(['Recharge/Rest', 'Family Bonding', 'Achievement/Challenge', 'Escape/Reset', 'Status/Premium', 'Simplicity/Minimalism']),
});

export const PROFILE_CATALOG_GAPS = Object.freeze({
  overnightPreferences: 'IN-03/IN-04 define overnight concepts, but do not publish one exact canonical label catalog; user-entered values are preserved verbatim.',
  incomeOffsets: 'IN-05 includes income offsets, but the v1 source does not define their choice labels. OPT-06 labels are v1.1 and are not imported into this v1 catalog.',
});

const catalog = key => Object.freeze({ type: 'choice', catalog: key });
const list = key => Object.freeze({ type: 'choiceList', catalog: key });
const freeList = Object.freeze({ type: 'textList' });
const manualChoiceList = Object.freeze({ type: 'manualChoiceList', maxItems: 64, maxItemLength: 200 });
const text = Object.freeze({ type: 'text' });
const bool = Object.freeze({ type: 'boolean' });
const nullableBool = Object.freeze({ type: 'nullableBoolean' });
const nullableDecimal = Object.freeze({ type: 'nullableDecimal' });
const nullableCurrency = Object.freeze({ type: 'nullableCurrency' });
const nullablePoint = Object.freeze({ type: 'nullablePoint' });

/** Account defaults only; trip-scoped, authority, and v1.1 fields are listed separately below. */
export const PROFILE_FIELD_DEFINITIONS = Object.freeze({
  homeAddress: text,
  homePoint: nullablePoint,
  alwaysBeginEndAtHome: bool,
  groupComposition: catalog('groupComposition'),
  travelerCount: Object.freeze({ type: 'nullableInteger', min: 1, max: 999 }),
  ageGroups: list('ageGroups'),
  hasPets: nullableBool,
  petTypes: list('petTypes'),
  preferredRegions: freeList,
  dietaryRequirements: text,
  specialRequirements: text,
  travelModes: list('travelModes'),
  travelSeason: catalog('travelSeason'),
  overnightPreferences: manualChoiceList,
  activities: list('activities'),
  drivingPace: catalog('drivingPace'),
  maxDrivingHoursPerDay: Object.freeze({ type: 'nullableNumber', minExclusive: 0, max: 24 }),
  budgetLevel: catalog('budgetLevel'),
  budgetMode: catalog('budgetMode'),
  budgetTimeframe: catalog('budgetTimeframe'),
  budgetAmount: nullableDecimal,
  budgetCurrency: nullableCurrency,
  comfortLevel: Object.freeze({ type: 'nullableInteger', min: 0, max: 5 }),
  allowSplurge: nullableBool,
  splurgeAmount: nullableDecimal,
  splurgeCurrency: nullableCurrency,
  splurgeMode: catalog('splurgeMode'),
  splurgeTimeframe: catalog('splurgeTimeframe'),
  splurgeFrequency: catalog('splurgeFrequency'),
  splurgeTypes: list('splurgeTypes'),
  needsFoodAccess: nullableBool,
  needsFacilities: nullableBool,
  needsWalkableTransit: nullableBool,
  includeSupportServices: nullableBool,
  avoidHighways: nullableBool,
  preferScenic: nullableBool,
  avoidTolls: nullableBool,
  avoidMountainRoutes: nullableBool,
  accessibility: catalog('accessibility'),
  needHookups: catalog('needHookups'),
  sustainability: catalog('sustainability'),
  planningStyle: catalog('planningStyle'),
  budgetSensitivity: catalog('budgetSensitivity'),
  preferredTransport: list('preferredTransport'),
  travelScope: catalog('travelScope'),
  climate: catalog('climate'),
  riskTolerance: catalog('riskTolerance'),
  physicalCapacity: catalog('physicalCapacity'),
  planningHorizon: catalog('planningHorizon'),
  willingToReposition: nullableBool,
  comparisonMode: nullableBool,
  terrain: list('terrain'),
  incomeOffsets: manualChoiceList,
  legalSafety: list('legalSafety'),
  emotionalGoals: list('emotionalGoals'),
});

export const TRIP_ONLY_PROFILE_FIELDS = Object.freeze([
  'startLocation', 'destination', 'tripLengthDays', 'startDate', 'endDate', 'travelWindow', 'notes',
  'departureLocation', 'needsSameDayOvernight',
]);
export const V1_1_PROFILE_FIELDS = Object.freeze([
  'units', 'proPlannerInterested', 'recurringChecks', 'monitoringTargets', 'monitoringFrequency', 'monitoringStopRule',
  'refundableOnly', 'alertSavingsThreshold', 'nearbyAirportFlexibility', 'nearbyStayFlexibility', 'dateFlexibility',
  'keepSameQuality', 'alertChannels', 'fundTheFunEnabled', 'fundTheFunPaths', 'fundTheFunIncomeSources',
  'fundTheFunVolunteerPrograms', 'fundTheFunSkills', 'incomeNeededPerDay', 'fundTheFunSkillNotes', 'fundTheFunStayDuration',
]);
const RESERVED_FIELDS = new Set([
  'accountId', 'ownerId', 'id', 'revision', 'membership', 'role', 'entitlements', 'email', 'providers', 'session',
  'status', 'createdAt', 'updatedAt', 'authProvider', 'payment', 'consent',
]);

export class ProfileDomainValidationError extends Error {
  constructor(field, code, message) {
    super(message);
    this.name = 'ProfileDomainValidationError';
    this.field = field;
    this.code = code;
  }
}

function fail(field, code, message) {
  throw new ProfileDomainValidationError(field, code, message);
}

function canonicalTimestamp(value) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

export function validStoredTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > monthDays[month - 1]) return false;
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function databaseSafeString(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 0) return false;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

export function assertDatabaseSafeStrings(value) {
  const pending = [{ value, field: null }];
  const seen = new WeakSet();
  while (pending.length) {
    const { value: current, field } = pending.pop();
    if (typeof current === 'string') {
      if (!databaseSafeString(current)) {
        fail(field, 'invalid_text_encoding', 'Text must not contain NUL characters or unmatched UTF-16 surrogates.');
      }
      continue;
    }
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const key of Object.keys(current)) {
      const childField = field ?? key;
      pending.push({ value: key, field: childField }, { value: current[key], field: childField });
    }
  }
}

function validateValue(field, value, definition) {
  if (value === null) {
    if (['text', 'boolean', 'nullableBoolean', 'choice', 'nullableInteger', 'nullableNumber', 'nullableDecimal',
      'nullableCurrency', 'nullablePoint'].includes(definition.type)) return null;
    fail(field, 'wrong_type', `Use an empty list for an unanswered ${field} list.`);
  }
  switch (definition.type) {
    case 'text':
      if (typeof value !== 'string' || value.trim().length === 0) fail(field, 'wrong_type', `${field} must be non-empty text or null when unanswered.`);
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') fail(field, 'wrong_type', `${field} must be true, false, or null when unanswered.`);
      return value;
    case 'nullableBoolean':
      if (typeof value !== 'boolean') fail(field, 'wrong_type', `${field} must be true, false, or null.`);
      return value;
    case 'choice': {
      if (typeof value !== 'string' || !PROFILE_CATALOGS[definition.catalog].includes(value)) {
        fail(field, 'invalid_choice', `Choose a listed ${field} value: ${PROFILE_CATALOGS[definition.catalog].join(', ')}.`);
      }
      return value;
    }
    case 'choiceList':
      return validateStringList(field, value, PROFILE_CATALOGS[definition.catalog]);
    case 'textList':
      return validateStringList(field, value, null);
    case 'manualChoiceList':
      return validateStringList(field, value, null, definition);
    case 'nullableInteger':
      if (!Number.isSafeInteger(value) || (definition.min !== undefined && value < definition.min) ||
          (definition.max !== undefined && value > definition.max)) {
        const range = definition.min !== undefined && definition.max !== undefined ? ` from ${definition.min} to ${definition.max}` : '';
        fail(field, 'invalid_number', `${field} must be a safe integer${range}, or null when unknown.`);
      }
      return value;
    case 'nullableNumber':
      if (typeof value !== 'number' || !Number.isFinite(value) ||
          (definition.minExclusive !== undefined && value <= definition.minExclusive) ||
          (definition.max !== undefined && value > definition.max)) {
        fail(field, 'invalid_number', `${field} must be a finite number${definition.minExclusive !== undefined ? ' greater than zero' : ''}${definition.max !== undefined ? ` no greater than ${definition.max}` : ''}, or null when unknown.`);
      }
      return value;
    case 'nullableDecimal':
      if (typeof value !== 'string' || value.length > 256 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
        fail(field, 'invalid_decimal', `${field} must be a nonnegative decimal string without exponent notation, or null when unknown.`);
      }
      return value;
    case 'nullableCurrency':
      if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value) || !currencyCodes().has(value)) {
        fail(field, 'invalid_currency', `${field} must be a supported three-letter ISO currency code, or null when unspecified.`);
      }
      return value;
    case 'nullablePoint':
      return validatePoint(field, value);
    default:
      fail(field, 'unsupported_type', `The profile field ${field} has no v1 validator.`);
  }
}

function validateStringList(field, value, allowed, limits = null) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
    fail(field, 'wrong_type', `${field} must be an array of non-empty strings.`);
  }
  if (limits && value.length > limits.maxItems) {
    fail(field, 'too_many_values', `${field} can contain at most ${limits.maxItems} choices per update.`);
  }
  if (limits && value.some(item => item.length > limits.maxItemLength)) {
    fail(field, 'value_too_long', `${field} values can contain at most ${limits.maxItemLength} characters.`);
  }
  const seen = new Set();
  for (const item of value) {
    if (seen.has(item)) fail(field, 'duplicate_choice', `${field} contains a duplicate value; remove the duplicate and try again.`);
    seen.add(item);
    if (allowed && !allowed.includes(item)) fail(field, 'invalid_choice', `“${item}” is not a listed ${field} choice.`);
  }
  return [...value];
}

function validatePoint(field, value) {
  if (value === null) return null;
  if (!plainRecord(value) || Object.keys(value).length !== 2 || !own(value, 'latitude') || !own(value, 'longitude') ||
      typeof value.latitude !== 'number' || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90 ||
      typeof value.longitude !== 'number' || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    fail(field, 'invalid_point', 'homePoint must be null or resolved decimal-degree latitude/longitude within valid ranges.');
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

let cachedCurrencyCodes;
function currencyCodes() {
  if (!cachedCurrencyCodes) {
    cachedCurrencyCodes = new Set(PROFILE_CURRENCY_CODES);
  }
  return cachedCurrencyCodes;
}

function validateFieldName(field) {
  if (RESERVED_FIELDS.has(field)) fail(field, 'forbidden_field', `${field} is account or authority data and cannot be set through the profile.`);
  if (V1_1_PROFILE_FIELDS.includes(field)) fail(field, 'wrong_tier', `${field} is a v1.1 profile field and is unavailable in this v1 profile.`);
  if (TRIP_ONLY_PROFILE_FIELDS.includes(field)) fail(field, 'wrong_scope', `${field} belongs to trip state; edit it in the selected trip instead of the account profile.`);
  if (!own(PROFILE_FIELD_DEFINITIONS, field)) fail(field, 'unknown_field', `Unknown or unsupported account profile field: ${field}.`);
}

/** Validate an account-profile patch. `updatedAt` is always server-generated. */
export function validateProfilePatch(patch, { now = new Date() } = {}) {
  if (!plainRecord(patch) || Object.keys(patch).length === 0) {
    fail(null, 'invalid_patch', 'Provide one or more account profile answers to update.');
  }
  assertDatabaseSafeStrings(patch);
  const updatedAt = canonicalTimestamp(now instanceof Function ? now() : now);
  if (!updatedAt) fail(null, 'invalid_clock', 'A valid server timestamp is required to validate profile updates.');
  const result = {};
  for (const [field, answer] of Object.entries(patch)) {
    validateFieldName(field);
    if (!plainRecord(answer)) fail(field, 'invalid_answer', `${field} must include value, answered, and account scope.`);
    const extraKeys = Object.keys(answer).filter(key => !['value', 'answered', 'scope'].includes(key));
    if (extraKeys.length) {
      if (extraKeys.includes('updatedAt')) fail(field, 'server_managed', 'updatedAt is server-managed; omit it from the profile change.');
      fail(field, 'unknown_answer_key', `${field} contains unsupported answer metadata.`);
    }
    if (!own(answer, 'value') || typeof answer.answered !== 'boolean' || !own(answer, 'scope')) {
      fail(field, 'invalid_answer', `${field} must include value and answered state.`);
    }
    if (answer.scope !== 'account') {
      fail(field, 'wrong_scope', `${field} is an account default; send trip-scoped changes to the selected trip operation.`);
    }
    const value = validateValue(field, answer.value, PROFILE_FIELD_DEFINITIONS[field]);
    if (!answer.answered && value !== null && !(Array.isArray(value) && value.length === 0)) {
      fail(field, 'answer_state_mismatch', `An unanswered ${field} must use null${Array.isArray(value) ? ' or an empty list' : ''}.`);
    }
    if (answer.answered && value === null && !['nullableBoolean', 'nullableInteger', 'nullableNumber', 'nullableDecimal',
      'nullableCurrency', 'nullablePoint'].includes(PROFILE_FIELD_DEFINITIONS[field].type)) {
      fail(field, 'answer_state_mismatch', `An answered ${field} needs a value; use answered=false for an unanswered field.`);
    }
    result[field] = { value, answered: answer.answered, scope: 'account', updatedAt };
  }
  return result;
}

/** Validate stored canonical answers, including server-owned timestamps. */
export function validateProfileAnswerRecords(records) {
  if (!plainRecord(records)) fail(null, 'invalid_profile', 'Profile answers must be an object.');
  const result = {};
  for (const [field, answer] of Object.entries(records)) {
    validateFieldName(field);
    if (!plainRecord(answer) || Object.keys(answer).some(key => !['value', 'answered', 'scope', 'updatedAt'].includes(key)) ||
        !own(answer, 'value') || typeof answer.answered !== 'boolean' || answer.scope !== 'account' ||
        !(answer.updatedAt === null && answer.answered === false) && !validStoredTimestamp(answer.updatedAt)) {
      fail(field, 'invalid_answer_record', `${field} must be a canonical account answer with a valid server timestamp.`);
    }
    const { [field]: normalized } = validateProfilePatch({ [field]: {
      value: answer.value, answered: answer.answered, scope: answer.scope,
    } }, { now: new Date(answer.updatedAt) });
    normalized.updatedAt = answer.updatedAt;
    result[field] = normalized;
  }
  return result;
}

export function createEmptyProfileAnswers() {
  return Object.fromEntries(Object.entries(PROFILE_FIELD_DEFINITIONS).map(([field, definition]) => [field, {
    value: ['choiceList', 'textList', 'manualChoiceList'].includes(definition.type) ? [] : null,
    answered: false,
    scope: 'account',
    updatedAt: null,
  }]));
}
