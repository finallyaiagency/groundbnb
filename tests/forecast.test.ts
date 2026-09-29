import assert from 'node:assert/strict';
import test from 'node:test';
import { forecast, median, scenario } from '../lib/forecast.ts';

test('median rejects invalid samples and uses the middle of an even sample', () => {
  assert.equal(median([5, 1, 7, 3, -1, Number.NaN]), 4);
});

test('weekly ceiling can make observed dwell irrelevant', () => {
  const input = { remainingCredits: 100, fiveHourCapacity: 10, weeklyCapacity: 20, dwellSamples: [2, 3, 4], waitHours: 0, now: new Date('2026-09-29T00:00:00Z') };
  const result = forecast(input);
  assert.equal(result.minimum?.capacityPerWeek, 20);
  assert.equal(result.consistent?.capacityPerWeek, 20);
  assert.equal(result.consistent?.limiter, 'Weekly allowance');
});

test('consistent scenario needs three observed dwell measurements', () => {
  const input = { remainingCredits: 100, fiveHourCapacity: 10, weeklyCapacity: 500, dwellSamples: [3, 5], waitHours: 0, now: new Date('2026-09-29T00:00:00Z') };
  assert.equal(forecast(input).consistent, null);
  assert.equal(scenario({ ...input, remainingCredits: null }, 0), null);
});
