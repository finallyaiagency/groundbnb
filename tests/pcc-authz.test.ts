import assert from 'node:assert/strict';
import test from 'node:test';
import { newStreamId, PccAuthorizationError, requireSponsor } from '../lib/pcc-authz.ts';

test('only a verified, explicitly enrolled sponsor may write', () => {
  const allowlist = ['auth-subject-1'];
  for (const actor of [null, { subject: 'auth-subject-1', verified: false }, { subject: 'other', verified: true }]) {
    assert.throws(() => requireSponsor(actor, allowlist), PccAuthorizationError);
  }
  assert.equal(requireSponsor({ subject: 'auth-subject-1', verified: true }, allowlist), 'auth-subject-1');
  assert.throws(() => requireSponsor({ subject: 'auth-subject-1', verified: true }, []), PccAuthorizationError);
});

test('stream IDs are stable-format, environment-independent public references', () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 255]);
  assert.equal(newStreamId('question', new Date('2026-09-29T15:00:00Z'), bytes), 'Q-20260929-000102030405060708ff');
  assert.equal(newStreamId('change_request', new Date('2026-09-29T15:00:00Z'), bytes), 'CR-20260929-000102030405060708ff');
});
