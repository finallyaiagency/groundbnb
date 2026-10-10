import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProfileUpdate, ProfileRevisionConflict, ProfileValidationError } from '../lib/profile-contract.mjs';

const now = '2026-10-07T15:00:00.000Z';
const profile = {
  accountId: 'synthetic-account', revision: 4, updatedAt: '2026-10-06T15:00:00.000Z',
  answers: { hasPets: { value: null, answered: false, scope: 'account', updatedAt: '2026-10-06T15:00:00.000Z' } },
};

test('prepares an account profile revision and preserves unanswered versus explicit values', () => {
  const prepared = prepareProfileUpdate(profile, {
    expectedRevision: 4, updatedAt: now,
    patch: { hasPets: { value: false, answered: true }, preferredRegions: { value: [], answered: true } },
  });

  assert.equal(prepared.profile.revision, 5);
  assert.equal(prepared.profile.answers.hasPets.value, false);
  assert.equal(prepared.profile.answers.hasPets.answered, true);
  assert.deepEqual(prepared.profile.answers.preferredRegions.value, []);
  assert.equal(prepared.profile.answers.preferredRegions.answered, true);
  assert.equal(prepared.profile.answers.hasPets.scope, 'account');
  assert.equal(prepared.profile.updatedAt, now);
  assert.equal(profile.revision, 4);
});

test('stale revision returns current and proposed field values without mutating profile', () => {
  assert.throws(() => prepareProfileUpdate(profile, {
    expectedRevision: 3, updatedAt: now, patch: { hasPets: { value: true, answered: true } },
  }), (error) => {
    assert.ok(error instanceof ProfileRevisionConflict);
    assert.equal(error.currentRevision, 4);
    assert.deepEqual(error.fieldComparison.hasPets, {
      current: profile.answers.hasPets,
      proposed: { value: true, answered: true },
    });
    return true;
  });
  assert.equal(profile.revision, 4);
});

test('rejects missing revisions, reserved authority fields, invalid answer states and unknown-as-zero', () => {
  const valid = { expectedRevision: 4, updatedAt: now, patch: { hasPets: { value: null, answered: false } } };
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, expectedRevision: undefined }), ProfileValidationError);
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, patch: { role: { value: 'owner', answered: true } } }), ProfileValidationError);
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, patch: { accountId: { value: 'other', answered: true } } }), ProfileValidationError);
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, patch: { arbitrary: { value: 'extra', answered: true } } }), ProfileValidationError);
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, patch: { hasPets: { value: 0, answered: false } } }), ProfileValidationError);
  assert.throws(() => prepareProfileUpdate(profile, { ...valid, patch: { hasPets: { value: NaN, answered: true } } }), ProfileValidationError);
});

test('does not carry arbitrary current profile properties into the candidate', () => {
  const prepared = prepareProfileUpdate({ ...profile, leakedAuthority: 'ignored' }, {
    expectedRevision: 4, updatedAt: now, patch: { hasPets: { value: false, answered: true } },
  });
  assert.equal(prepared.profile.accountId, profile.accountId);
  assert.equal(Object.hasOwn(prepared.profile, 'leakedAuthority'), false);
});
