import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProfileOperationRequest } from '../lib/profile-operation-request.mjs';
import { PROFILE_TARGETS, persistProfile } from '../lib/profile-persistence.mjs';
const target = PROFILE_TARGETS.local;
const connection = new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
connection.username = target.role;
connection.password = 'synthetic-fixture';
const env = {
  GROUND_ENV:'local', GROUND_PROFILE_MODE:'enabled', GROUND_LOGIN_MODE:'session-check',
  GROUND_PROFILE_DATABASE_URL:connection.href, GROUND_DATABASE_HOST:target.host, GROUND_DATABASE_BRANCH_ID:target.branch,
  GROUND_AUTH_ISSUER:'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME:'groundbnb_local_session', GROUND_AUTH_COOKIE_SECRET:'synthetic-signing-fixture-unit-only',
  GROUND_PRODUCTION_AUTH_ISSUER:'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN:'http://localhost:3000', GROUND_PRODUCTION_ORIGIN:'https://production.example.test',
  GROUND_EMAIL_MODE:'capture', GROUND_SCHEDULED_WORK:'off', GROUND_METERED_DISPATCH:'off', GROUND_SEED_MODE:'synthetic',
};
const id = '00000000-0000-4000-8000-000000000001';
const identity = { issuer:env.GROUND_AUTH_ISSUER, subject:'synthetic-subject' };
const resolve = async () => ({ok:true,identity});
const request = (suffix='') => new Request(`http://localhost:3000/api/account/profile/operations/${id}${suffix}`);

test('record status preserves kind and original owner references but refuses foreign snapshot IDs', async () => {
  const result = {ok:true,status:'saved',operationKind:'profile_records',operationId:id,
    savedAt:'2026-10-08T08:28:01.176146-04:00',affectedIds:['00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'],
    profile:{accountId:'00000000-0000-4000-8000-000000000003',revision:2,answers:{},vehicles:[],notes:[{id:'00000000-0000-4000-8000-000000000004',text:'Synthetic note',origin:'user',selectedQuoteIds:[],userRemoved:false}]}};
  const response = await handleProfileOperationRequest(request(),id,env,resolve,async()=>result);
  assert.equal(response.status,200);
  assert.equal((await response.json()).operationKind,'profile_records');
  const persisted = await persistProfile(env,identity,{kind:'status',operationId:id},async()=>result);
  assert.deepEqual(persisted,result);
  for (const change of [{affectedIds:['synthetic-account','foreign']},{operationKind:undefined}]) {
    const malformed={...result,...change};
    assert.equal((await handleProfileOperationRequest(request(),id,env,resolve,async()=>malformed)).status,503);
    assert.equal((await persistProfile(env,identity,{kind:'status',operationId:id},async()=>malformed)).category,'unavailable');
  }
});

test('operation status gates configuration, UUID, selectors and authentication before storage', async () => {
  let calls=0;
  const store=async()=>{ calls++; throw new Error('unexpected'); };
  assert.equal((await handleProfileOperationRequest(request(),id,{...env,GROUND_PROFILE_MODE:'off'},resolve,store)).status,503);
  assert.equal((await handleProfileOperationRequest(request(),'foreign-account',env,resolve,store)).status,400);
  assert.equal((await handleProfileOperationRequest(request('?accountId=foreign'),id,env,resolve,store)).status,400);
  assert.equal((await handleProfileOperationRequest(request(),id,env,async()=>({ok:false,category:'auth'}),store)).status,401);
  assert.equal(calls,0);
});
test('status exposes only original saved acknowledgment or current not-found observation', async () => {
  for (const status of ['saved','not_found']) {
    const result={ok:true,status,operationId:id,privateDiagnostic:'hidden',
      affectedIds:['synthetic-account'],
      profile:{accountId:'synthetic-account',revision:1,answers:{}}, savedAt:'2026-10-08T03:00:00.000Z'};
    const response=await handleProfileOperationRequest(request(),id,env,resolve,async(_env,owner,operation)=>{
      assert.deepEqual(owner,identity); assert.deepEqual(operation,{kind:'status',operationId:id}); return result;
    });
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store, private');
    const body=await response.json();
    assert.equal(body.status,status); assert.equal(body.privateDiagnostic,undefined);
    assert.equal(Boolean(body.profile),status==='saved');
  }
});
test('malformed status and thrown storage do not claim a save or expose errors', async()=>{
  for (const store of [async()=>({ok:true,status:'saved',operationId:id}),async()=>{throw new Error('private');}]) {
    const response=await handleProfileOperationRequest(request(),id,env,resolve,store);
    assert.equal(response.status,503); assert.equal((await response.json()).retryable,true);
  }
});
test('persistence status uses owner-scoped function and rejects authority keys before SQL',async()=>{
  const result=await persistProfile(env,identity,{kind:'status',operationId:id},async(_config,sql,values)=>{
    assert.equal(sql,'SELECT groundbnb.read_profile_operation($1,$2,$3::uuid) AS result');
    assert.deepEqual(values,[identity.issuer,identity.subject,id]);
    return {ok:true,status:'not_found',operationId:id,profile:{foreign:'must drop'}};
  });
  assert.deepEqual(result,{ok:true,status:'not_found',operationId:id});
  assert.equal((await persistProfile(env,identity,{kind:'status',operationId:id,accountId:'foreign'},async()=>{throw new Error('unexpected');})).category,'validation');
});
