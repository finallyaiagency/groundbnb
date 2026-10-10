import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_CATALOGS, PROFILE_CATALOG_GAPS, PROFILE_FIELD_DEFINITIONS, ProfileDomainValidationError,
  TRIP_ONLY_PROFILE_FIELDS, V1_1_PROFILE_FIELDS, createEmptyProfileAnswers,
  validateProfileAnswerRecords, validateProfilePatch,
} from '../lib/profile-domain.mjs';
import { PROFILE_CURRENCY_CODES } from '../lib/profile-currency-codes.mjs';

const savedAt = new Date('2026-10-07T18:00:00.000Z');
const answer = (value, changes = {}) => ({ value, answered: true, scope: 'account', ...changes });
const patch = (field, value, changes = {}) => ({ [field]: answer(value, changes) });

function validValue(field, definition) {
  switch (definition.type) {
    case 'text': return 'A user supplied preference';
    case 'boolean': return false;
    case 'nullableBoolean': return false;
    case 'choice': return PROFILE_CATALOGS[definition.catalog][0];
    case 'choiceList':
    case 'textList':
    case 'manualChoiceList': return [];
    case 'nullableInteger': return field === 'comfortLevel' ? 0 : definition.min ?? 1;
    case 'nullableNumber': return definition.minExclusive !== undefined ? 1 : 0;
    case 'nullableDecimal': return '0.00';
    case 'nullableCurrency': return 'USD';
    case 'nullablePoint': return { latitude: 0, longitude: 0 };
    default: throw new Error(`Uncovered field definition ${field}:${definition.type}`);
  }
}

function expectFieldError(action, field, code) {
  assert.throws(action, error => error instanceof ProfileDomainValidationError && error.field === field && error.code === code);
}

test('every v1 account-profile dictionary field has a typed validator and server timestamp', () => {
  const input = Object.fromEntries(Object.entries(PROFILE_FIELD_DEFINITIONS).map(([field, definition]) => [
    field, answer(validValue(field, definition)),
  ]));
  const result = validateProfilePatch(input, { now: savedAt });
  assert.deepEqual(Object.keys(result).sort(), Object.keys(PROFILE_FIELD_DEFINITIONS).sort());
  for (const [field, value] of Object.entries(result)) {
    assert.equal(value.answered, true, field);
    assert.equal(value.scope, 'account', field);
    assert.equal(value.updatedAt, savedAt.toISOString(), field);
  }
  assert.equal(result.comfortLevel.value, 0);
  assert.equal(result.hasPets.value, false);
  assert.deepEqual(result.activities.value, []);
});

test('empty and explicit answers preserve null, false, zero, and empty-list meaning', () => {
  const empty = createEmptyProfileAnswers();
  assert.deepEqual(Object.keys(empty).sort(), Object.keys(PROFILE_FIELD_DEFINITIONS).sort());
  assert.equal(empty.hasPets.value, null);
  assert.equal(empty.hasPets.answered, false);
  assert.deepEqual(empty.activities.value, []);
  assert.equal(empty.activities.answered, false);
  assert.equal(empty.activities.updatedAt, null);
  assert.deepEqual(validateProfileAnswerRecords(empty), empty);

  const saved = validateProfilePatch({
    hasPets: answer(false), comfortLevel: answer(0), activities: answer([]), homePoint: answer(null), budgetAmount: answer(null),
  }, { now: savedAt });
  assert.equal(saved.hasPets.value, false);
  assert.equal(saved.hasPets.answered, true);
  assert.equal(saved.comfortLevel.value, 0);
  assert.equal(saved.activities.answered, true);
  assert.deepEqual(saved.activities.value, []);
  assert.equal(saved.homePoint.value, null);
  assert.equal(saved.homePoint.answered, true);
  assert.equal(saved.budgetAmount.value, null);
  assert.equal(saved.budgetAmount.answered, true);
});

test('catalog-backed scalar and multi-choice fields accept only frozen labels and keep selected order', () => {
  for (const [catalogName, values] of Object.entries(PROFILE_CATALOGS)) {
    if (catalogName === 'comfortLevel') {
      assert.deepEqual(values.map((_, index) => validateProfilePatch(patch('comfortLevel', index), { now: savedAt }).comfortLevel.value),
        [0, 1, 2, 3, 4, 5]);
      continue;
    }
    const field = Object.entries(PROFILE_FIELD_DEFINITIONS).find(([, definition]) => definition.catalog === catalogName)?.[0];
    assert.ok(field, `catalog ${catalogName} is assigned to a profile field`);
    const isList = PROFILE_FIELD_DEFINITIONS[field].type === 'choiceList';
    for (const value of values) {
      const normalized = validateProfilePatch(patch(field, isList ? [value] : value), { now: savedAt });
      assert.deepEqual(normalized[field].value, isList ? [value] : value);
    }
  }
  assert.deepEqual(validateProfilePatch(patch('activities', ['camping', 'kayaking']), { now: savedAt }).activities.value,
    ['camping', 'kayaking']);
  expectFieldError(() => validateProfilePatch(patch('travelSeason', 'Autumn'), { now: savedAt }), 'travelSeason', 'invalid_choice');
  expectFieldError(() => validateProfilePatch(patch('activities', ['camping', 'camping']), { now: savedAt }), 'activities', 'duplicate_choice');
  expectFieldError(() => validateProfilePatch(patch('preferredRegions', ['Pacific', 'Pacific']), { now: savedAt }), 'preferredRegions', 'duplicate_choice');
});

test('frozen numeric types and ranges are enforced without extra bounds', () => {
  for (const value of [1, 999]) assert.equal(validateProfilePatch(patch('travelerCount', value), { now: savedAt }).travelerCount.value, value);
  for (const value of [0, 1000, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
    expectFieldError(() => validateProfilePatch(patch('travelerCount', value), { now: savedAt }), 'travelerCount', 'invalid_number');
  }
  for (const value of [0.01, 1, 24]) assert.equal(validateProfilePatch(patch('maxDrivingHoursPerDay', value), { now: savedAt }).maxDrivingHoursPerDay.value, value);
  for (const value of [0, -1, 24.0001, Infinity, NaN]) {
    expectFieldError(() => validateProfilePatch(patch('maxDrivingHoursPerDay', value), { now: savedAt }), 'maxDrivingHoursPerDay', 'invalid_number');
  }
  for (const value of [0, 5]) assert.equal(validateProfilePatch(patch('comfortLevel', value), { now: savedAt }).comfortLevel.value, value);
  for (const value of [-1, 6, 1.5]) expectFieldError(() => validateProfilePatch(patch('comfortLevel', value), { now: savedAt }), 'comfortLevel', 'invalid_number');
  const longRegion = 'x'.repeat(2000);
  assert.equal(validateProfilePatch(patch('preferredRegions', [longRegion]), { now: savedAt }).preferredRegions.value[0], longRegion);
});

test('money values use exact nonnegative decimal strings and ISO currency codes', () => {
  for (const value of ['0', '0.00', '1', '999999999999999999999999999999.123456789']) {
    assert.equal(validateProfilePatch(patch('budgetAmount', value), { now: savedAt }).budgetAmount.value, value);
  }
  for (const value of ['-1', '+1', '1e3', '1,000', '.25', '01', '', '1.'.padEnd(258, '0')]) {
    expectFieldError(() => validateProfilePatch(patch('budgetAmount', value), { now: savedAt }), 'budgetAmount', 'invalid_decimal');
  }
  for (const value of ['USD', 'EUR', 'JPY']) assert.equal(validateProfilePatch(patch('budgetCurrency', value), { now: savedAt }).budgetCurrency.value, value);
  for (const value of ['usd', 'ZZZ', 'US', 'USDD']) expectFieldError(() => validateProfilePatch(patch('budgetCurrency', value), { now: savedAt }), 'budgetCurrency', 'invalid_currency');
  assert.equal(validateProfilePatch(patch('splurgeAmount', null, { answered: false }), { now: savedAt }).splurgeAmount.value, null);
});

test('profile input strings are safe for PostgreSQL JSONB before a save is attempted', () => {
  for (const [field, value] of [
    ['homeAddress', `x${String.fromCharCode(0)}y`],
    ['dietaryRequirements', String.fromCharCode(0xd800)],
    ['specialRequirements', String.fromCharCode(0xdc00)],
    ['preferredRegions', [`Region${String.fromCharCode(0)}Name`]],
    ['overnightPreferences', [`Style${String.fromCharCode(0xd800)}`]],
    ['budgetAmount', `1${String.fromCharCode(0)}.00`],
  ]) {
    expectFieldError(() => validateProfilePatch(patch(field, value), { now: savedAt }), field, 'invalid_text_encoding');
  }
  const validUnicode = 'Route with 🏕 and café';
  assert.equal(validateProfilePatch(patch('homeAddress', validUnicode), { now: savedAt }).homeAddress.value, validUnicode);
});

test('currency acceptance uses the frozen SQL registry rather than runtime ICU updates', () => {
  assert.ok(Object.isFrozen(PROFILE_CURRENCY_CODES));
  assert.ok(PROFILE_CURRENCY_CODES.includes('USD'));
  assert.equal(PROFILE_CURRENCY_CODES.length, new Set(PROFILE_CURRENCY_CODES).size);
});

test('home address and point preserve unresolved state while enforcing point coordinates', () => {
  const entered = validateProfilePatch({ homeAddress: answer('Typed address, not yet resolved'), homePoint: answer(null) }, { now: savedAt });
  assert.equal(entered.homeAddress.value, 'Typed address, not yet resolved');
  assert.equal(entered.homePoint.value, null);
  assert.equal(entered.homePoint.answered, true);
  assert.deepEqual(validateProfilePatch(patch('homePoint', { latitude: -90, longitude: 180 }), { now: savedAt }).homePoint.value,
    { latitude: -90, longitude: 180 });
  for (const point of [
    { latitude: 90.1, longitude: 0 }, { latitude: 0, longitude: -180.1 }, { latitude: Infinity, longitude: 0 },
    { latitude: 0, longitude: 0, provider: 'unexpected' }, { lat: 0, lng: 0 },
  ]) expectFieldError(() => validateProfilePatch(patch('homePoint', point), { now: savedAt }), 'homePoint', 'invalid_point');
});

test('answer metadata is closed, scope is explicit, and updatedAt is server-owned', () => {
  const result = validateProfilePatch(patch('hasPets', false), { now: savedAt });
  assert.equal(result.hasPets.updatedAt, savedAt.toISOString());
  expectFieldError(() => validateProfilePatch(patch('hasPets', false, { scope: 'trip' }), { now: savedAt }), 'hasPets', 'wrong_scope');
  expectFieldError(() => validateProfilePatch(patch('hasPets', false, { updatedAt: '2000-01-01T00:00:00.000Z' }), { now: savedAt }), 'hasPets', 'server_managed');
  expectFieldError(() => validateProfilePatch(patch('hasPets', false, { accountId: 'spoofed' }), { now: savedAt }), 'hasPets', 'unknown_answer_key');
  expectFieldError(() => validateProfilePatch(patch('hasPets', false, { answered: false }), { now: savedAt }), 'hasPets', 'answer_state_mismatch');
  expectFieldError(() => validateProfilePatch(patch('activities', ['camping'], { answered: false }), { now: savedAt }), 'activities', 'answer_state_mismatch');
  expectFieldError(() => validateProfilePatch({ hasPets: { value: false, answered: true } }, { now: savedAt }), 'hasPets', 'invalid_answer');
  expectFieldError(() => validateProfilePatch({ hasPets: answer(false) }, { now: new Date(NaN) }), null, 'invalid_clock');
  assert.throws(() => validateProfileAnswerRecords({ hasPets: { ...result.hasPets, updatedAt: 'October 7' } }),
    error => error instanceof ProfileDomainValidationError && error.code === 'invalid_answer_record');
});

test('trip-only, v1.1, account-authority, and unknown fields fail with actionable categories', () => {
  for (const field of TRIP_ONLY_PROFILE_FIELDS) {
    expectFieldError(() => validateProfilePatch({ [field]: answer('x') }, { now: savedAt }), field, 'wrong_scope');
  }
  for (const field of V1_1_PROFILE_FIELDS) {
    expectFieldError(() => validateProfilePatch({ [field]: answer('x') }, { now: savedAt }), field, 'wrong_tier');
  }
  for (const field of ['ownerId', 'accountId', 'role', 'entitlements', 'session', 'email', 'consent']) {
    expectFieldError(() => validateProfilePatch({ [field]: answer('x') }, { now: savedAt }), field, 'forbidden_field');
  }
  expectFieldError(() => validateProfilePatch({ arbitraryClientField: answer('x') }, { now: savedAt }), 'arbitraryClientField', 'unknown_field');
  assert.throws(() => validateProfilePatch({}, { now: savedAt }), error => error.code === 'invalid_patch');
});

test('v1 concepts without an exact label catalog preserve bounded user-authored choices', () => {
  assert.match(PROFILE_CATALOG_GAPS.incomeOffsets, /does not define their choice labels/);
  assert.match(PROFILE_CATALOG_GAPS.overnightPreferences, /do not publish one exact canonical label catalog/);
  const overnight = ['Campgrounds', 'Tent/RV/van/boondocking/glamping/cabins/ultralight/boating styles', 'My exact lodging phrase'];
  assert.deepEqual(validateProfilePatch(patch('overnightPreferences', overnight), { now: savedAt }).overnightPreferences.value, overnight);
  const offsets = ['My own income offset label'];
  assert.deepEqual(validateProfilePatch(patch('incomeOffsets', offsets), { now: savedAt }).incomeOffsets.value, offsets);
  expectFieldError(() => validateProfilePatch(patch('incomeOffsets', ['x'.repeat(201)]), { now: savedAt }),
    'incomeOffsets', 'value_too_long');
  expectFieldError(() => validateProfilePatch(patch('overnightPreferences', Array(65).fill('Choice')), { now: savedAt }),
    'overnightPreferences', 'too_many_values');
});

test('unanswered values use null for scalars and an empty list for arrays; answered false and zero remain valid', () => {
  const scalar = validateProfilePatch({ hasPets: { value: null, answered: false, scope: 'account' },
    comfortLevel: answer(0), preferredRegions: { value: [], answered: false, scope: 'account' } }, { now: savedAt });
  assert.deepEqual(scalar, {
    hasPets: { value: null, answered: false, scope: 'account', updatedAt: savedAt.toISOString() },
    comfortLevel: { value: 0, answered: true, scope: 'account', updatedAt: savedAt.toISOString() },
    preferredRegions: { value: [], answered: false, scope: 'account', updatedAt: savedAt.toISOString() },
  });
  expectFieldError(() => validateProfilePatch({ activities: { value: null, answered: false, scope: 'account' } }, { now: savedAt }), 'activities', 'wrong_type');
});

