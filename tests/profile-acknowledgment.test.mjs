import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOwnedProfileAcknowledgment } from '../lib/profile-acknowledgment.mjs';

const profile = { accountId:'account', revision:2, answers:{}, vehicles:[{id:'vehicle'}], notes:[{id:'note'}] };
test('original record acknowledgment references only its owner snapshot without duplicate or foreign IDs', () => {
  const result = {profile, operationKind:'profile_records', affectedIds:['account','vehicle','note']};
  assert.equal(hasOwnedProfileAcknowledgment(result),true);
  for (const change of [{affectedIds:['vehicle']},{affectedIds:['account','foreign']},
    {affectedIds:['account','note','note']},{operationKind:'unknown'},
    {profile:{...profile,revision:-1}},{profile:{...profile,notes:undefined}}]) {
    assert.equal(hasOwnedProfileAcknowledgment({...result,...change}),false);
  }
  assert.equal(hasOwnedProfileAcknowledgment({profile,affectedIds:['account']}),true);
  assert.equal(hasOwnedProfileAcknowledgment({profile,affectedIds:['account','vehicle']}),false);
});
