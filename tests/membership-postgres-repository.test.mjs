import assert from 'node:assert/strict';
import test from 'node:test';
import { MEMBERSHIP_PLAN_CATALOG } from '../lib/membership-catalog.mjs';
import {
  createMembershipPostgresRepository,
  evaluateMembershipSnapshot,
} from '../lib/membership-postgres-repository.mjs';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '20000000-0000-4000-8000-000000000001';
const GRANT = '20000000-0000-4000-8000-000000000002';
const GRANT_TIE = '20000000-0000-4000-8000-000000000003';
const ISSUER = 'https://local-auth.example.test';
const SUBJECT = 'synthetic-user-1';
const EVALUATED_AT = '2030-01-01T00:00:00.000Z';
const policy = Object.freeze({ commercialMode: 'report_only', enforcedTestCohorts: 'explicit',
  checkoutEnabled: false, supplierTransactionsEnabled: false, updatedAt: EVALUATED_AT });
const plan = key => MEMBERSHIP_PLAN_CATALOG.find(entry => entry.plan.key === key);

function assignmentFor(key, extra = {}) {
  const entry = plan(key);
  return {
    assignmentId: ASSIGNMENT,
    planVersionId: entry.version.id,
    planId: entry.plan.id,
    planKey: key,
    displayName: entry.plan.displayName,
    planStatus: 'active',
    versionNumber: entry.version.number,
    releaseTier: entry.version.releaseTier,
    featureDefinitions: structuredClone(entry.version.features),
    limitDefinitions: structuredClone(entry.version.limits),
    effectiveFrom: '2029-01-01T00:00:00.000Z',
    effectiveUntil: null,
    status: 'active',
    grantType: 'base',
    ...extra,
  };
}

function grantFor(key, extra = {}) {
  const entry = plan(key);
  return {
    grantId: GRANT,
    grantType: 'lifetime',
    planVersionId: entry.version.id,
    planId: entry.plan.id,
    planKey: key,
    displayName: entry.plan.displayName,
    planStatus: 'active',
    versionNumber: entry.version.number,
    releaseTier: entry.version.releaseTier,
    featureDefinitions: structuredClone(entry.version.features),
    limitDefinitions: structuredClone(entry.version.limits),
    grantedAt: '2029-01-01T00:00:00.000Z',
    startsAt: '2029-01-01T00:00:00.000Z',
    expiresAt: null,
    ...extra,
  };
}

function snapshot({ base = assignmentFor('free'), grants = [], selected = grants[0] ?? null,
  snapshotPolicy = policy, accountId = ACCOUNT } = {}) {
  return { ok: true, accountId, evaluatedAt: EVALUATED_AT, policy: snapshotPolicy,
    baseAssignment: base, effectiveLifetimeGrants: grants, effectiveLifetimeGrant: selected };
}

function harness(responses = []) {
  const calls = [];
  const repository = createMembershipPostgresRepository(async (statement, values) => {
    calls.push({ statement, values });
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return result;
  });
  return { repository, calls };
}

test('reads only by authenticated issuer and subject through one fixed private reader call', async () => {
  const expected = snapshot();
  const h = harness([expected]);
  const result = await h.repository.readMembership({ issuer: ISSUER, subject: SUBJECT });
  assert.deepEqual(h.calls, [{
    statement: 'SELECT groundbnb.read_membership($1,$2) AS result',
    values: [ISSUER, SUBJECT],
  }]);
  assert.deepEqual(Object.keys(h.repository), ['readMembership']);
  assert.equal(Object.hasOwn(h.repository, 'query'), false);
  assert.deepEqual(result, expected);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.baseAssignment.featureDefinitions), true);
});

test('rejects malformed identities locally and never accepts an account selector', async () => {
  const h = harness([snapshot()]);
  for (const identity of [null, {}, { issuer: ISSUER, subject: SUBJECT, accountId: ACCOUNT },
    { issuer: ' ', subject: SUBJECT }, { issuer: ISSUER, subject: `${SUBJECT}\n` },
    { issuer: ISSUER, subject: 'x'.repeat(513) }]) {
    assert.deepEqual(await h.repository.readMembership(identity), { ok: false, category: 'auth' });
  }
  assert.equal(h.calls.length, 0);
});

test('preserves reader auth denial and fails closed on missing base, query error, or malformed data', async () => {
  const h = harness([
    { ok: false, category: 'auth' },
    { ok: false, category: 'membership_unavailable' },
    new Error('database diagnostic must not escape'),
    { ...snapshot(), baseAssignment: null },
    { ...snapshot(), baseAssignment: { ...assignmentFor('free'), planVersionId: '20000000-0000-4000-8000-000000000099' } },
  ]);
  const identity = { issuer: ISSUER, subject: SUBJECT };
  assert.deepEqual(await h.repository.readMembership(identity), { ok: false, category: 'auth' });
  for (let i = 0; i < 4; i += 1) {
    assert.deepEqual(await h.repository.readMembership(identity), { ok: false, category: 'membership_unavailable' });
  }
});

test('rejects catalog drift, unconfigured or future definitions, and inconsistent selected overlays', async () => {
  const changedFeatures = assignmentFor('free');
  changedFeatures.featureDefinitions['export.geojson'].included = true;
  const futureTier = assignmentFor('free');
  futureTier.featureDefinitions['export.geojson'].releaseTier = 'v3';
  const wrongNumber = assignmentFor('free', { versionNumber: 2 });
  const wrongTier = assignmentFor('free', { releaseTier: 'v1.1' });
  const impossibleDate = assignmentFor('free', { effectiveFrom: '2030-02-31T00:00:00.000Z' });
  const grant = grantFor('plus');
  const h = harness([
    { ...snapshot(), baseAssignment: changedFeatures },
    { ...snapshot(), baseAssignment: futureTier },
    { ...snapshot(), baseAssignment: wrongNumber },
    { ...snapshot(), baseAssignment: wrongTier },
    { ...snapshot(), baseAssignment: impossibleDate },
    { ...snapshot(), policy: { ...policy, enforcedTestCohorts: 'none' } },
    snapshot({ grants: [grant], selected: grantFor('pro') }),
    snapshot({ grants: [grant], selected: null }),
  ]);
  for (let i = 0; i < 8; i += 1) {
    assert.deepEqual(await h.repository.readMembership({ issuer: ISSUER, subject: SUBJECT }),
      { ok: false, category: 'membership_unavailable' });
  }
});

test('validates effective windows, unique overlay IDs, exact microsecond precedence, and selected-first consistency', async () => {
  const first = grantFor('plus', { grantId: GRANT, startsAt: '2029-01-01T00:00:00.000001Z' });
  const second = grantFor('pro', { grantId: GRANT_TIE, startsAt: '2029-01-01T00:00:00.000002Z' });
  const tieHigherId = grantFor('pro', { grantId: GRANT_TIE, startsAt: '2029-01-01T00:00:00.000001Z' });
  const tieLowerId = grantFor('plus', { grantId: GRANT, startsAt: '2029-01-01T00:00:00.000001Z' });
  const validOrdered = snapshot({ grants: [second, first], selected: second });
  const validTieOrdered = snapshot({ grants: [tieLowerId, tieHigherId], selected: tieLowerId });
  const futureBase = assignmentFor('free', { effectiveFrom: '2031-01-01T00:00:00.000000Z' });
  const endedBase = assignmentFor('free', { effectiveUntil: '2030-01-01T00:00:00.000000Z' });
  const futureGrant = grantFor('plus', { startsAt: '2031-01-01T00:00:00.000000Z' });
  const duplicate = grantFor('pro', { grantId: GRANT });
  const h = harness([
    validOrdered,
    validTieOrdered,
    { ...snapshot(), baseAssignment: futureBase },
    { ...snapshot(), baseAssignment: endedBase },
    snapshot({ grants: [futureGrant] }),
    snapshot({ grants: [first, duplicate], selected: first }),
    snapshot({ grants: [first, second], selected: second }),
  ]);
  const identity = { issuer: ISSUER, subject: SUBJECT };
  assert.equal((await h.repository.readMembership(identity)).ok, true);
  assert.equal((await h.repository.readMembership(identity)).ok, true);
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(await h.repository.readMembership(identity), { ok: false, category: 'membership_unavailable' });
  }
});

test('never invents a Free assignment when the reader does not return a valid one', () => {
  for (const unavailable of [null, { ok: false, category: 'membership_unavailable' },
    { ...snapshot(), baseAssignment: null }]) {
    assert.equal(evaluateMembershipSnapshot(unavailable, {
      actionFeature: 'maps.basic', implementedFeatures: ['maps.basic'], operational: {
        ownership: 'allowed', security: 'allowed', financial: 'allowed', abuse: 'allowed',
      },
    }).reason, 'membership_unavailable');
  }
});

const OPERATIONAL_OK = Object.freeze({ ownership: 'allowed', security: 'allowed', financial: 'allowed', abuse: 'allowed' });

test('uses the pinned base version with the existing pure public report-only evaluator', () => {
  const result = evaluateMembershipSnapshot(snapshot(), {
    actionFeature: 'export.geojson', implementedFeatures: ['export.geojson'], operational: OPERATIONAL_OK,
  });
  assert.deepEqual({ allowed: result.allowed, reason: result.reason, wouldDeny: result.wouldDeny },
    { allowed: true, reason: 'commercial_report_only', wouldDeny: true });
  assert.equal(result.auditEvent.accountId, ACCOUNT);
  assert.equal(result.auditEvent.planVersionId, plan('free').version.id);
});

test('selects the effective lifetime overlay while retaining the underlying base assignment', () => {
  const grant = grantFor('plus');
  const result = evaluateMembershipSnapshot(snapshot({ grants: [grant] }), {
    actionFeature: 'export.geojson', implementedFeatures: ['export.geojson'], operational: OPERATIONAL_OK,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'allowed');
  assert.equal(result.planVersionId, plan('plus').version.id);
});

test('enforced test cohort denies commercial restrictions but never bypasses operational or unimplemented gates', () => {
  const context = { audience: 'enforced_test', actionFeature: 'export.geojson',
    implementedFeatures: ['export.geojson'], operational: OPERATIONAL_OK };
  const denied = evaluateMembershipSnapshot(snapshot(), context);
  assert.deepEqual({ allowed: denied.allowed, reason: denied.reason },
    { allowed: false, reason: 'feature_not_included' });
  assert.equal(evaluateMembershipSnapshot(snapshot(), { ...context, actionFeature: 'mcp.agent' }).reason,
    'feature_unimplemented');
  assert.equal(evaluateMembershipSnapshot(snapshot({ snapshotPolicy: { ...policy, enforcedTestCohorts: 'none' } }), context)
    .reason, 'membership_unavailable');
  assert.equal(evaluateMembershipSnapshot(snapshot(), { ...context,
    operational: { ...OPERATIONAL_OK, financial: 'unknown' } }).reason, 'operational_authority_unknown');
});

test('keeps an already-issued archived version eligible by its immutable pinned version', () => {
  const archived = assignmentFor('free', { planStatus: 'archived' });
  const result = evaluateMembershipSnapshot(snapshot({ base: archived }), {
    actionFeature: 'maps.basic', implementedFeatures: ['maps.basic'], operational: OPERATIONAL_OK,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'allowed');
});
