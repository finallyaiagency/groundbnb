import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfileCompletion, createReadableProfileSummary } from '../lib/profile-completion.mjs';

test('completion uses the three frozen core categories and exact rounded percentages', () => {
  const empty = calculateProfileCompletion({ answers: {} });
  assert.equal(empty.percentage, 0);
  assert.deepEqual(empty.categories.map(item => item.complete), [false, false, false]);

  const traveler = calculateProfileCompletion({ answers: {
    groupComposition: { value: 'Solo', answered: true }, hasPets: { value: false, answered: true },
  } });
  assert.equal(traveler.percentage, 33);
  assert.equal(traveler.categories[0].complete, true);

  const twoCategories = calculateProfileCompletion({ answers: {
    groupComposition: { value: 'Solo', answered: true }, hasPets: { value: true, answered: true },
    travelModes: { value: ['On Foot/Transit'], answered: true },
  } });
  assert.equal(twoCategories.percentage, 67);
  assert.deepEqual(twoCategories.categories.map(item => item.complete), [true, true, false]);

  const complete = calculateProfileCompletion({ answers: {
    groupComposition: { value: 'Solo', answered: true }, hasPets: { value: false, answered: true },
    travelModes: { value: ['On Foot/Transit'], answered: true },
    activities: { value: ['Hiking'], answered: true },
  } });
  assert.equal(complete.percentage, 100);
  assert.equal(complete.coreComplete, true);
});

test('unanswered suggestions and advanced answers do not count; pets require explicit yes or no', () => {
  const profile = { answers: {
    groupComposition: { value: 'Solo', answered: false },
    hasPets: { value: false, answered: false },
    travelModes: { value: ['Car/SUV'], answered: false },
    overnightPreferences: { value: ['Campgrounds'], answered: false },
    activities: { value: ['Hiking'], answered: false },
    budgetAmount: { value: 0, answered: true },
  } };
  assert.equal(calculateProfileCompletion(profile).percentage, 0);
  assert.equal(calculateProfileCompletion({ answers: {
    groupComposition: { value: 'Solo', answered: true }, hasPets: { value: null, answered: true },
  } }).percentage, 0);
  assert.equal(calculateProfileCompletion({ answers: {
    groupComposition: { value: 'Solo', answered: true }, hasPets: { value: false, answered: true },
  } }).percentage, 33);
});

test('readable summary preserves false, zero, none, and unanswered distinctions without exposing IDs or coordinates', () => {
  const sections = createReadableProfileSummary({ answers: {
    hasPets: { value: false, answered: true }, travelerCount: { value: 0, answered: true },
    activities: { value: [], answered: true }, preferredRegions: { value: [''], answered: false },
    homePoint: { value: { latitude: 12.34, longitude: -56.78 }, answered: true },
  } }, [{ title: 'Traveler', fields: ['hasPets', 'travelerCount', 'activities', 'preferredRegions', 'homePoint', 'unlistedInternalId'] }], {
    hasPets: 'Traveling with pets', travelerCount: 'Number of travelers', activities: 'Activities',
    preferredRegions: 'Preferred regions', homePoint: 'Resolved home point',
  });
  assert.deepEqual(sections, [{ title: 'Traveler', text: 'Traveling with pets: No; Number of travelers: 0; Activities: None; Preferred regions: Not specified; Resolved home point: Saved' }]);
});
