import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReadableProfileDraft } from '../lib/profile-readable-import.mjs';

const labels = { travelerCount: 'Number of travelers', hasPets: 'Traveling with pets', dietaryRequirements: 'Dietary requirements',
  ageGroups: 'Age groups traveling', homePoint: 'Resolved home point' };

test('readable text parser accepts only exact labeled lines and validates field values without inference', () => {
  const result = parseReadableProfileDraft([
    'Number of travelers: 4',
    'Traveling with pets: No',
    'Dietary requirements: Vegetarian: no peanuts',
    'Age groups traveling: Adults 18–64',
    'Age groups traveling: Children 0–12',
  ].join('\n'), labels);
  assert.deepEqual(result.fields, { travelerCount: 4, hasPets: false,
    dietaryRequirements: 'Vegetarian: no peanuts', ageGroups: ['Adults 18–64', 'Children 0–12'] });
  assert.deepEqual(result.warnings, []);
});

test('ambiguous, unknown, unanswered, invalid and resolved-point lines are visibly left out', () => {
  const result = parseReadableProfileDraft([
    'Number of travelers: 2', 'Number of travelers: 3', 'Number of travelers: 4',
    'Traveling with pets: maybe', 'Dietary requirements: Not specified', 'Resolved home point: 42,-71',
    'Unknown label: some text', 'this has no delimiter',
  ].join('\n'), labels);
  assert.deepEqual(result.fields, {});
  assert.equal(result.warnings.length, 7);
  assert.equal(result.warnings.some(item => item.field === 'homePoint' && item.message.includes('cannot be imported')), true);
});
