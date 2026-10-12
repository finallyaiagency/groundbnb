import { profileConfiguration, validatePersistentPatch } from './profile-persistence.mjs';
import { validateProfileRecordsOperation } from './profile-records-persistence.mjs';
import { ProfileRecordValidationError } from './profile-records.mjs';
import { ProfileValidationError } from './profile-contract.mjs';
import { ProfileDomainValidationError } from './profile-domain.mjs';
import { hasCanonicalRecordSnapshot } from './profile-record-snapshot.mjs';
import { profileJsonbByteLength } from './profile-jsonb-size.mjs';

export function profileTransferConfiguration(env) {
  const config = profileConfiguration(env);
  return config?.fullDomain && env.GROUND_PROFILE_RECORDS_MODE === 'manual-v1' &&
    env.GROUND_PROFILE_TRANSFER_MODE === 'reviewed-v1' ? config : null;
}

export function validateProfileTransferOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation) || operation.kind !== 'transfer' ||
      Object.keys(operation).some(key => !['kind','operationId','expectedRevision','patch','noteUpserts'].includes(key))) {
    throw new ProfileValidationError('Provide selected profile fields and personal notes.');
  }
  const patch = operation.patch ?? {};
  const notes = operation.noteUpserts ?? [];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Array.isArray(notes) ||
      (!Object.keys(patch).length && !notes.length)) throw new ProfileValidationError('Select at least one change.');
  if (Object.keys(patch).length) validatePersistentPatch(patch,{fullDomain:true});
  // Reuse the identity/revision and closed manual-note contract without allowing vehicles.
  if (typeof operation.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation.operationId) ||
      !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0 || operation.expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new ProfileValidationError('A stable operation ID and expected profile revision are required.');
  }
  const noteUpserts = notes.length ? validateProfileRecordsOperation({kind:'records',operationId:operation.operationId,
    expectedRevision:operation.expectedRevision,noteUpserts:notes}).noteUpserts : [];
  if (noteUpserts.some(note=>note.userRemoved || note.selectedQuoteIds.length)) {
    throw new ProfileValidationError('Transferred notes must be new plain text without quote authority.');
  }
  const safePatch = Object.hasOwn(patch,'homeAddress') ? {...patch,homePoint:{value:null,answered:false}} : patch;
  if (profileJsonbByteLength([safePatch,noteUpserts]) > 16384) {
    throw new ProfileValidationError('Selected changes exceed the supported save size. Select a smaller set.');
  }
  return {operationId:operation.operationId.toLowerCase(),expectedRevision:operation.expectedRevision,patch:safePatch,noteUpserts};
}

async function execute(config,values) {
  const {neon}=await import('@neondatabase/serverless');
  const sql=neon(config.connection);
  const [,rows]=await sql.transaction([sql.query('SET TRANSACTION READ WRITE'),
    sql.query('SELECT groundbnb.save_profile_transfer($1,$2,$3::uuid,$4::bigint,$5::jsonb,$6::jsonb) AS result',values)],
  {readOnly:false,fetchOptions:{signal:AbortSignal.timeout(8000),cache:'no-store'}});
  return rows?.[0]?.result;
}

export async function persistProfileTransfer(env,identity,operation,run=execute) {
  const config=profileTransferConfiguration(env);
  if(!config) return {ok:false,category:'unavailable'};
  if(!identity || identity.issuer!==config.issuer || typeof identity.subject!=='string' || !identity.subject || identity.subject.length>200) {
    return {ok:false,category:'auth'};
  }
  try {
    const input=validateProfileTransferOperation(operation);
    const result=await run(config,[identity.issuer,identity.subject,input.operationId,input.expectedRevision,
      JSON.stringify(input.patch),JSON.stringify(input.noteUpserts)]);
    if(!result || typeof result.ok!=='boolean') return {ok:false,category:'unavailable'};
    if(!result.ok) return ['auth','validation','conflict','unavailable'].includes(result.category) ? result : {ok:false,category:'unavailable'};
    const profile=result.profile;
    if(result.operationKind!=='profile_transfer' || result.operationId!==input.operationId ||
      !hasCanonicalRecordSnapshot(profile) || profile.revision!==input.expectedRevision+1 ||
      !profile.answers || !Array.isArray(profile.notes) || !Array.isArray(profile.vehicles) ||
      typeof result.savedAt!=='string' || !Number.isFinite(Date.parse(result.savedAt)) || !Array.isArray(result.affectedIds)) {
      return {ok:false,category:'unavailable'};
    }
    const expectedIds=new Set([profile.accountId,...input.noteUpserts.map(note=>note.id)]);
    if(result.affectedIds.length!==expectedIds.size || result.affectedIds.some(id=>!expectedIds.delete(id)) || expectedIds.size) {
      return {ok:false,category:'unavailable'};
    }
    return result;
  } catch(error) {
    return {ok:false,category:error instanceof ProfileValidationError || error instanceof ProfileDomainValidationError ||
      error instanceof ProfileRecordValidationError ? 'validation' : 'unavailable'};
  }
}
