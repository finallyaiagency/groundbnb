import { profileConfiguration } from './profile-persistence.mjs';
import { validateProfileVehicle, validateProfileNote, ProfileRecordValidationError } from './profile-records.mjs';
import { hasCanonicalRecordSnapshot } from './profile-record-snapshot.mjs';
import { profileJsonbByteLength } from './profile-jsonb-size.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS = new Set(['kind','operationId','expectedRevision','vehicleUpserts','noteUpserts']);
const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function profileRecordsConfiguration(env) {
  const config = profileConfiguration(env);
  return config?.fullDomain && env.GROUND_PROFILE_RECORDS_MODE === 'manual-v1' ? config : null;
}

export function validateProfileRecordsOperation(operation) {
  if (!plainRecord(operation) || operation.kind !== 'records' || Object.keys(operation).some(key=>!KEYS.has(key)) ||
      typeof operation.operationId !== 'string' || !UUID.test(operation.operationId) ||
      !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0 || operation.expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new ProfileRecordValidationError('A stable operation ID and expected profile revision are required.');
  }
  const vehicles = operation.vehicleUpserts ?? [];
  const notes = operation.noteUpserts ?? [];
  if (!Array.isArray(vehicles) || !Array.isArray(notes) || vehicles.length > 100 || notes.length > 100 || !(vehicles.length+notes.length)) {
    throw new ProfileRecordValidationError('Provide one or more vehicle or note changes.');
  }
  const vehicleUpserts = vehicles.map(input=>validateProfileVehicle(input));
  const noteUpserts = notes.map(input=>{
    if (!plainRecord(input) || Object.hasOwn(input,'origin')) {
      throw new ProfileRecordValidationError('Note provenance is server-managed.');
    }
    return validateProfileNote({...input,origin:'user'});
  });
  if (new Set(vehicleUpserts.map(item=>item.id)).size !== vehicleUpserts.length ||
      new Set(noteUpserts.map(item=>item.id)).size !== noteUpserts.length ||
      profileJsonbByteLength([vehicleUpserts,noteUpserts]) > 16384) {
    throw new ProfileRecordValidationError('Record IDs must be unique and the changes must fit the supported request size.');
  }
  return { operationId:operation.operationId.toLowerCase(), expectedRevision:operation.expectedRevision, vehicleUpserts,noteUpserts };
}

async function execute(config, values) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(config.connection);
  const [,rows] = await sql.transaction([sql.query('SET TRANSACTION READ WRITE'),
    sql.query('SELECT groundbnb.save_profile_records($1,$2,$3::uuid,$4::bigint,$5::jsonb,$6::jsonb) AS result', values)],
  {readOnly:false,fetchOptions:{signal:AbortSignal.timeout(8000),cache:'no-store'}});
  return rows?.[0]?.result;
}

export async function persistProfileRecords(env, identity, operation, run = execute) {
  const config = profileRecordsConfiguration(env);
  if (!config) return {ok:false,category:'unavailable'};
  if (!identity || identity.issuer !== config.issuer || typeof identity.subject !== 'string' || !identity.subject || identity.subject.length > 200) {
    return {ok:false,category:'auth'};
  }
  try {
    const input = validateProfileRecordsOperation(operation);
    const result = await run(config,[identity.issuer,identity.subject,input.operationId,input.expectedRevision,
      JSON.stringify(input.vehicleUpserts),JSON.stringify(input.noteUpserts)]);
    if (!result || typeof result.ok !== 'boolean') return {ok:false,category:'unavailable'};
    if (!result.ok) return ['auth','validation','conflict','unavailable'].includes(result.category) ? result : {ok:false,category:'unavailable'};
    const profile = result.profile;
    if (!hasCanonicalRecordSnapshot(profile) ||
        !Number.isSafeInteger(profile.revision) || profile.revision !== input.expectedRevision+1 || !profile.answers ||
        !Array.isArray(profile.vehicles) || !Array.isArray(profile.notes) || result.operationKind !== 'profile_records' || result.operationId !== input.operationId ||
        typeof result.savedAt !== 'string' || !Number.isFinite(Date.parse(result.savedAt)) || !Array.isArray(result.affectedIds)) {
      return {ok:false,category:'unavailable'};
    }
    const expectedIds = new Set([profile.accountId,...input.vehicleUpserts.map(item=>item.id),...input.noteUpserts.map(item=>item.id)]);
    if (result.affectedIds.length !== expectedIds.size || result.affectedIds.some(id=>!expectedIds.delete(id)) || expectedIds.size) {
      return {ok:false,category:'unavailable'};
    }
    return result;
  } catch(error) {
    return {ok:false,category:error instanceof ProfileRecordValidationError ? 'validation' : 'unavailable'};
  }
}
