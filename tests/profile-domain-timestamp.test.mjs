import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProfileAnswerRecords, validateProfilePatch, ProfileDomainValidationError } from '../lib/profile-domain.mjs';

const answerRecord = updatedAt => ({ hasPets: { value: false, answered: true, scope: 'account', updatedAt } });

test('stored profile timestamps accept unambiguous ISO offsets and up to six fractional digits without rewriting', () => {
  for (const updatedAt of [
    '2026-10-08T12:34:56.789Z',
    '2026-10-08T12:34:56.123456+00:00',
    '2024-02-29T23:59:59.000001-05:30',
    '2026-10-08T08:28:01.176146-04:00',
    '2026-01-01T00:00:00.1+14:00',
  ]) {
    assert.equal(validateProfileAnswerRecords(answerRecord(updatedAt)).hasPets.updatedAt, updatedAt);
  }
});

test('stored profile timestamps reject invalid dates, ambiguous zones, invalid offsets, and excess precision', () => {
  for (const updatedAt of [
    '2025-02-29T12:00:00Z',
    '2026-02-30T12:00:00Z',
    '2026-10-08T24:00:00Z',
    '2026-10-08T12:60:00Z',
    '2026-10-08T12:34:60Z',
    '2026-10-08T12:34:56',
    '2026-10-08 12:34:56+00:00',
    '2026-10-08T12:34:56+14:01',
    '2026-10-08T12:34:56.1234567Z',
    '2026-10-08T12:34:56z',
  ]) {
    assert.throws(() => validateProfileAnswerRecords(answerRecord(updatedAt)), error =>
      error instanceof ProfileDomainValidationError && error.code === 'invalid_answer_record', updatedAt);
  }
});

test('new profile mutation timestamps remain server-generated canonical JavaScript ISO values', () => {
  const result = validateProfilePatch({ hasPets: { value: false, answered: true, scope: 'account' } }, {
    now: new Date('2026-10-08T12:34:56.123Z'),
  });
  assert.equal(result.hasPets.updatedAt, '2026-10-08T12:34:56.123Z');
});
