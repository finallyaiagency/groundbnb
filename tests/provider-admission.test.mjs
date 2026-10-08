import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProviderAdmission, parseUsdNanodollars } from '../lib/provider-admission.mjs';

const accountId = '00000000-0000-4000-8000-000000000001';
const operationId = '00000000-0000-4000-8000-000000000002';
const attemptId = '00000000-0000-4000-8000-000000000003';
const providerId = 'provider-a';
const period = { dayKey: '2026-10-08', monthKey: '2026-10' };

function context(overrides = {}) {
  const window = (key, ownerId, periodKey, capUsd = '10', heldEmergencyUsd = '0') => ({
    key, ownerId, periodKey, spentUsd: '0', pendingUsd: '0', capUsd, heldEmergencyUsd,
  });
  return {
    identity: { accountId, verified: true },
    policy: { versionId: 'policy-v1', status: 'Active', commercialMode: 'report_only' },
    rate: { versionId: 'rate-v1', providerId, maximumCostUsd: '0.000000001' },
    operationId,
    attemptId,
    currentPeriod: period,
    freePoolRequired: true,
    windows: [
      window('account:day', accountId, period.dayKey, '0.25', '0.02'),
      window('account:month', accountId, period.monthKey),
      window('provider:day', providerId, period.dayKey),
      window('provider:month', providerId, period.monthKey),
      window('application:day', 'application', period.dayKey, '5', '0.5'),
      window('application:month', 'application', period.monthKey, '100', '5'),
      window('free_pool:day', 'free-pool', period.dayKey, '2.5', '0'),
    ],
    ...overrides,
  };
}

test('decimal USD parser uses exact nanodollars and rejects ambiguous precision', () => {
  assert.equal(parseUsdNanodollars('0.000000001'), 1n);
  assert.equal(parseUsdNanodollars('1.20'), 1_200_000_000n);
  assert.equal(parseUsdNanodollars('0.0000000001'), null);
  assert.equal(parseUsdNanodollars('1e-3'), null);
  assert.equal(parseUsdNanodollars('-1'), null);
  assert.equal(parseUsdNanodollars(' 1'), null);
});

test('candidate requires complete applicable windows and returns no reservation authority', () => {
  const result = evaluateProviderAdmission(context());
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'admission_candidate');
  assert.equal(result.durableReservation, false);
  assert.equal(result.dispatchAuthorized, false);
  assert.equal(result.candidate.maximumCostUsd, '0.000000001');
  assert.equal(result.candidate.windows.length, 7);
});

test('all windows must fit including pending, maximum, and held emergency reserve', () => {
  const input = context();
  input.windows[0].spentUsd = '0.22';
  input.windows[0].pendingUsd = '0.01';
  assert.equal(evaluateProviderAdmission(input).ok, false);
  input.windows[0].pendingUsd = '0.009999999';
  assert.equal(evaluateProviderAdmission(input).ok, true);
});

test('report-only commercial mode does not relax application or provider ceilings', () => {
  const input = context();
  const globalDaily = input.windows.find(({ key }) => key === 'application:day');
  globalDaily.spentUsd = '4.5';
  globalDaily.pendingUsd = '0.000000001';
  assert.equal(evaluateProviderAdmission(input).ok, false);
});

test('missing or unknown spend/rate information refuses rather than treating it as zero', () => {
  const missingWindow = context();
  missingWindow.windows.pop();
  assert.equal(evaluateProviderAdmission(missingWindow).reason, 'incomplete_or_extra_windows');
  const unknownSpend = context();
  unknownSpend.windows[0].pendingUsd = null;
  assert.equal(evaluateProviderAdmission(unknownSpend).reason, 'unknown_or_invalid_window_amount');
  const unknownRate = context();
  unknownRate.rate.maximumCostUsd = null;
  assert.equal(evaluateProviderAdmission(unknownRate).reason, 'unknown_or_invalid_maximum_cost');
});

test('unverified identity, paused policy, invalid period and reserve-over-cap refuse', () => {
  assert.equal(evaluateProviderAdmission(context({ identity: { accountId, verified: false } })).reason, 'unverified_identity');
  assert.equal(evaluateProviderAdmission(context({ policy: { ...context().policy, status: 'Paused' } })).reason, 'paused');
  assert.equal(evaluateProviderAdmission(context({ currentPeriod: { dayKey: '2026-02-30', monthKey: '2026-02' } })).reason, 'invalid_period_context');
  const reserve = context();
  reserve.windows[0].heldEmergencyUsd = '0.26';
  assert.equal(evaluateProviderAdmission(reserve).reason, 'reserve_exceeds_cap');
});

test('account, provider, and period ownership cannot be mixed to bypass a limit', () => {
  const wrongAccount = context();
  wrongAccount.windows[0].ownerId = '00000000-0000-4000-8000-000000000099';
  assert.equal(evaluateProviderAdmission(wrongAccount).reason, 'window_owner_mismatch');
  const wrongProvider = context();
  wrongProvider.windows[2].ownerId = 'provider-b';
  assert.equal(evaluateProviderAdmission(wrongProvider).reason, 'window_owner_mismatch');
  const wrongPeriod = context();
  wrongPeriod.windows[4].periodKey = '2026-10-07';
  assert.equal(evaluateProviderAdmission(wrongPeriod).reason, 'window_period_mismatch');
});

test('closed contract rejects extra client-controlled authority and missing Free-pool scope', () => {
  const extra = context();
  extra.identity.role = 'admin';
  assert.equal(evaluateProviderAdmission(extra).ok, false);
  const absentPool = context({ freePoolRequired: false });
  assert.equal(evaluateProviderAdmission(absentPool).reason, 'incomplete_or_extra_windows');
});
