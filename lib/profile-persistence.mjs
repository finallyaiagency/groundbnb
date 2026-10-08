import { prepareProfileUpdate, ProfileValidationError } from './profile-contract.mjs';
import { sessionConfiguration } from './session-identity.mjs';

export const PROFILE_TARGETS = Object.freeze({
  local: { role: 'groundbnb_local_app', host: 'ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech', branch: 'br-rough-flower-b8lerkcf' },
  preview: { role: 'groundbnb_preview_app', host: 'ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech', branch: 'br-bitter-hall-b8ibnrfy' },
});

// Bounded first persistence slice. Other dictionary fields require their typed adapters.
const TEXT_FIELDS = new Set(['homeAddress', 'dietaryRequirements', 'specialRequirements']);
const BOOLEAN_FIELDS = new Set(['hasPets', 'alwaysBeginEndAtHome']);
export function validatePersistentPatch(patch) {
  prepareProfileUpdate({ accountId: 'validation-only', revision: 0, answers: {} }, {
    expectedRevision: 0, patch, updatedAt: '2026-10-07T00:00:00.000Z',
  });
  for (const [field, answer] of Object.entries(patch)) {
    const value = answer.value;
    const valid = TEXT_FIELDS.has(field) ? value === null || (typeof value === 'string' && value.length <= 2000)
      : BOOLEAN_FIELDS.has(field) ? value === null || typeof value === 'boolean'
      : field === 'travelerCount' ? value === null || (Number.isSafeInteger(value) && value >= 1 && value <= 200)
      : field === 'preferredRegions' ? Array.isArray(value) && value.length <= 50 &&
        value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 200) && new Set(value).size === value.length
      : false;
    if (!valid || Object.keys(answer).some(key => !['answered', 'value'].includes(key))) {
      throw new ProfileValidationError(`Profile field "${field}" is invalid or not enabled for persistence.`);
    }
  }
  return patch;
}

export function profileConfiguration(env) {
  const auth = sessionConfiguration(env);
  const target = PROFILE_TARGETS[env.GROUND_ENV];
  try {
    const url = new URL(env.GROUND_PROFILE_DATABASE_URL);
    if (!auth || !target || env.GROUND_PROFILE_MODE !== 'enabled' ||
      env.GROUND_DATABASE_BRANCH_ID !== target.branch || env.GROUND_DATABASE_HOST !== target.host ||
      !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== target.host ||
      decodeURIComponent(url.username) !== target.role || !url.password || url.pathname !== '/groundbnb' ||
      (url.port && url.port !== '5432') || url.hash || url.searchParams.get('sslmode') !== 'require' ||
      [...url.searchParams].some(([key, value]) => !({ sslmode: ['require'], channel_binding: ['require'] })[key]?.includes(value) || url.searchParams.getAll(key).length !== 1)) return null;
    return { ...target, issuer: auth.issuer, connection: env.GROUND_PROFILE_DATABASE_URL };
  } catch { return null; }
}

async function execute(config, statement, values) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(config.connection);
  // One function call is one database transaction. Never retry uncertain commits.
  // Neon HTTP's false batch flag does not override this role's read-only default.
  // Switch only this admitted transaction before its locking profile function.
  const [, rows] = await sql.transaction([sql.query('SET TRANSACTION READ WRITE'), sql.query(statement, values)], {
    readOnly: false,
    fetchOptions: { signal: AbortSignal.timeout(8000), cache: 'no-store' },
  });
  return rows?.[0]?.result;
}

export async function persistProfile(env, identity, operation, run = execute) {
  const config = profileConfiguration(env);
  if (!config) return { ok: false, category: 'unavailable' };
  if (!identity || identity.issuer !== config.issuer || typeof identity.subject !== 'string' || !identity.subject || identity.subject.length > 200) {
    return { ok: false, category: 'auth' };
  }
  try {
    let statement, values;
    if (operation.kind === 'read') {
      statement = 'SELECT groundbnb.read_profile($1,$2) AS result';
      values = [identity.issuer, identity.subject];
    } else if (operation.kind === 'status') {
      if (typeof operation.operationId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation.operationId) ||
          Object.keys(operation).some(key => !['kind', 'operationId'].includes(key))) return { ok: false, category: 'validation' };
      statement = 'SELECT groundbnb.read_profile_operation($1,$2,$3::uuid) AS result';
      values = [identity.issuer, identity.subject, operation.operationId.toLowerCase()];
    } else if (operation.kind === 'save') {
      if (!Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0 ||
        typeof operation.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operation.operationId) ||
        Object.keys(operation).some(key => !['kind', 'operationId', 'expectedRevision', 'patch'].includes(key))) {
        return { ok: false, category: 'validation' };
      }
      validatePersistentPatch(operation.patch);
      statement = 'SELECT groundbnb.save_profile($1,$2,$3::uuid,$4::bigint,$5::jsonb) AS result';
      values = [identity.issuer, identity.subject, operation.operationId.toLowerCase(), operation.expectedRevision, JSON.stringify(operation.patch)];
    } else return { ok: false, category: 'validation' };
    const result = await run(config, statement, values);
    if (operation.kind === 'status' && result?.ok) {
      if (result.operationId !== operation.operationId.toLowerCase() || !['saved', 'not_found'].includes(result.status)) {
        return { ok: false, category: 'unavailable' };
      }
      if (result.status === 'not_found') return { ok: true, status: 'not_found', operationId: result.operationId };
      if (typeof result.savedAt !== 'string' || !Number.isFinite(Date.parse(result.savedAt))) {
        return { ok: false, category: 'unavailable' };
      }
    }
    if (!result || typeof result.ok !== 'boolean' || (result.ok && (!result.profile ||
      !Number.isSafeInteger(result.profile.revision) || typeof result.profile.accountId !== 'string' ||
      !result.profile.answers || (operation.kind === 'save' && (result.operationId !== operation.operationId.toLowerCase() ||
        typeof result.savedAt !== 'string' || !Number.isFinite(Date.parse(result.savedAt))))))) {
      return { ok: false, category: 'unavailable' };
    }
    if (!result.ok && !['auth', 'unavailable', 'conflict', 'validation'].includes(result.category)) return { ok: false, category: 'unavailable' };
    return result;
  } catch (error) {
    if (env.GROUND_BROWSER_AUTH_MODE === 'synthetic') {
      const sqlState = ['25006','42501','42883','42P01','23503','23505','40001','40P01','57014'].includes(error?.code) ? error.code : 'other';
      console.info(JSON.stringify({ event: 'groundbnb_synthetic_profile', operation: operation.kind === 'read' ? 'read' : 'save', sqlState }));
    }
    return { ok: false, category: error instanceof ProfileValidationError ? 'validation' : 'unavailable' };
  }
}
