import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TARGETS } from '../lib/profile-persistence.mjs';
import { profileRecordsConfiguration, validateProfileRecordsOperation, persistProfileRecords } from '../lib/profile-records-persistence.mjs';
import { handleProfileRecordsRequest } from '../lib/profile-records-request.mjs';

const target=PROFILE_TARGETS.local;
const url=new URL(`postgresql://${target.host}/groundbnb?sslmode=require`);
url.username=target.role;url.password='synthetic-fixture';
const env={GROUND_ENV:'local',GROUND_PROFILE_MODE:'enabled',GROUND_PROFILE_DOMAIN_MODE:'full-v1',GROUND_PROFILE_RECORDS_MODE:'manual-v1',GROUND_LOGIN_MODE:'session-check',
  GROUND_PROFILE_DATABASE_URL:url.href,GROUND_DATABASE_HOST:target.host,GROUND_DATABASE_BRANCH_ID:target.branch,
  GROUND_AUTH_ISSUER:'https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_AUTH_COOKIE_NAME:'groundbnb_local_session',GROUND_AUTH_COOKIE_SECRET:'synthetic-signing-fixture-unit-only',
  GROUND_PRODUCTION_AUTH_ISSUER:'https://ep-snowy-morning-b8ax7lm3.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth',
  GROUND_PUBLIC_ORIGIN:'http://localhost:3000',GROUND_PRODUCTION_ORIGIN:'https://production.example.test',
  GROUND_EMAIL_MODE:'capture',GROUND_SCHEDULED_WORK:'off',GROUND_METERED_DISPATCH:'off',GROUND_SEED_MODE:'synthetic'};
const identity={issuer:env.GROUND_AUTH_ISSUER,subject:'synthetic-subject'};
const accountId='00000000-0000-4000-8000-000000000001';
const operationId='00000000-0000-4000-8000-000000000002';
const vehicleId='00000000-0000-4000-8000-000000000003';
const noteId='00000000-0000-4000-8000-000000000004';
const vehicle={id:vehicleId,name:'Synthetic van',type:'Van',ownership:'owned',propulsion:null,fuelEconomy:{value:18,unit:'US mpg'},dimensions:null,location:null,locationVerifiedAt:null};
const note={id:noteId,text:'Synthetic note',selectedQuoteIds:[],userRemoved:false};
const operation={kind:'records',operationId,expectedRevision:3,vehicleUpserts:[vehicle],noteUpserts:[note]};
const normalized=validateProfileRecordsOperation(operation);
const ack={ok:true,operationKind:'profile_records',operationId,savedAt:'2026-10-08T12:00:00.000Z',affectedIds:[accountId,vehicleId,noteId],
  profile:{accountId,revision:4,answers:{},vehicles:normalized.vehicleUpserts,notes:normalized.noteUpserts}};
const request=(body=JSON.stringify({...operation,kind:undefined}),headers={})=>new Request('http://localhost:3000/api/account/profile/records',{
  method:'PATCH',body,headers:{origin:env.GROUND_PUBLIC_ORIGIN,'content-type':'application/json','sec-fetch-site':'same-origin',...headers}});

test('record storage stays explicitly off unless both full profile and manual records modes are enabled',async()=>{
  assert.ok(profileRecordsConfiguration(env));
  for (const change of [{GROUND_PROFILE_RECORDS_MODE:undefined},{GROUND_PROFILE_RECORDS_MODE:'off'},{GROUND_PROFILE_DOMAIN_MODE:'off'},{GROUND_ENV:'production'}]) {
    let calls=0;assert.equal(profileRecordsConfiguration({...env,...change}),null);
    assert.equal((await persistProfileRecords({...env,...change},identity,operation,async()=>{calls++;})).category,'unavailable');
    assert.equal(calls,0);
  }
});
test('record input stamps manual provenance and rejects owner or client provenance authority',()=>{
  assert.equal(normalized.vehicleUpserts[0].fuelEconomy.origin,'user');
  assert.equal(normalized.noteUpserts[0].origin,'user');
  for(const input of [{...operation,accountId:'foreign'},{...operation,noteUpserts:[{...note,origin:'AI'}]},
    {...operation,vehicleUpserts:[{...vehicle,ownerId:'foreign'}]},{...operation,vehicleUpserts:[normalized.vehicleUpserts[0]]},
    {...operation,vehicleUpserts:[],noteUpserts:[]},{...operation,expectedRevision:Number.MAX_SAFE_INTEGER},
    {...operation,noteUpserts:[note,note]}]) assert.throws(()=>validateProfileRecordsOperation(input));
});
test('record persistence passes only verified identity and normalized values to one admitted transaction',async()=>{
  let calls=0;
  const result=await persistProfileRecords(env,identity,operation,async(config,values)=>{
    calls++;assert.equal(config.role,target.role);assert.deepEqual(values.slice(0,4),[identity.issuer,identity.subject,operationId,3]);
    assert.deepEqual(JSON.parse(values[4]),normalized.vehicleUpserts);assert.deepEqual(JSON.parse(values[5]),normalized.noteUpserts);
    return ack;
  });
  assert.deepEqual(result,ack);assert.equal(calls,1);
  assert.equal((await persistProfileRecords(env,{...identity,issuer:'foreign'},operation,async()=>{throw new Error('unexpected');})).category,'auth');
});
test('unknown/partial record acknowledgments never report saved and exceptions are not retried',async()=>{
  for (const result of [{...ack,affectedIds:[accountId]},{...ack,affectedIds:[accountId,vehicleId,'foreign']},
    {...ack,profile:{...ack.profile,revision:5}},{...ack,savedAt:null},{ok:true},{ok:false,category:'private-detail'}]) {
    assert.deepEqual(await persistProfileRecords(env,identity,operation,async()=>result),{ok:false,category:'unavailable'});
  }
  let calls=0;assert.equal((await persistProfileRecords(env,identity,operation,async()=>{calls++;throw new Error('private');})).category,'unavailable');
  assert.equal(calls,1);
});
test('record request validates origin/body/owner selectors and fresh authentication before storage',async()=>{
  let calls=0;const store=async()=>{calls++;return ack;};const resolve=async()=>({ok:true,identity});
  for (const req of [request('null'),request('invalid'),request(' '.repeat(16385)),request(JSON.stringify({...operation,accountId:'foreign'})),
    request(undefined,{origin:'https://foreign.example.test'}),request(undefined,{'content-type':'text/plain'})]) {
    assert.equal((await handleProfileRecordsRequest(req,env,resolve,store)).status,400);
  }
  assert.equal((await handleProfileRecordsRequest(request(),env,async()=>({ok:false,category:'auth'}),store)).status,401);
  assert.equal(calls,0);
  const response=await handleProfileRecordsRequest(request(),env,resolve,async(_env,owner,input)=>{
    assert.deepEqual(owner,identity);assert.deepEqual(input,operation);return {...ack,privateDiagnostic:'hidden'};
  });
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store, private');
  const body=await response.json();assert.equal(body.privateDiagnostic,undefined);assert.match(body.requestId,/^[0-9a-f-]{36}$/);
});
