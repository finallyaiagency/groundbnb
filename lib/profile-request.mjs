import { randomUUID } from 'node:crypto';
import { resolveSessionIdentity, sessionConfiguration } from './session-identity.mjs';
import { persistProfile, profileConfiguration } from './profile-persistence.mjs';
import { browserAuthConfiguration } from './browser-auth.mjs';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
function response(result, requestId, profileMode, recordsMode, transferMode) {
  if (result.ok) {
    const body = { ok: true, profile: result.profile, requestId };
    if (profileMode) body.profileMode = profileMode;
    if (recordsMode) body.recordsMode = recordsMode;
    if (transferMode) body.transferMode = transferMode;
    if (result.operationId) Object.assign(body, { operationId: result.operationId, savedAt: result.savedAt, affectedIds: result.affectedIds });
    return Response.json(body, { headers });
  }
  const category = ['auth','validation','conflict','unavailable'].includes(result.category) ? result.category : 'unavailable';
  const body = { ok: false, category, requestId, retryable: category === 'unavailable',
    message: category === 'conflict' ? 'Your profile changed. Review the current values before saving again.'
      : category === 'validation' ? 'Review the profile fields and revision.'
      : category === 'auth' ? 'Sign in to an available account.'
      : 'Profile storage is unavailable. Keep your draft and retry with the same operation ID.' };
  if (category === 'conflict') Object.assign(body, { currentRevision: result.currentRevision, fieldComparison: result.fieldComparison });
  return Response.json(body, { status: { auth: 401, validation: 400, conflict: 409, unavailable: 503 }[category], headers });
}

/** Server request boundary; injected adapters are for deterministic checks, never live evidence. */
export async function handleProfileRequest(request, env, resolve = resolveSessionIdentity, store = persistProfile) {
  const requestId = randomUUID();
  const persistenceConfig = profileConfiguration(env);
  if (!persistenceConfig) return response({ ok: false, category: 'unavailable' }, requestId);
  if (env.GROUND_BROWSER_AUTH_MODE === 'synthetic' && !browserAuthConfiguration(env)) {
    return response({ ok: false, category: 'unavailable' }, requestId);
  }
  if (!['GET','PATCH'].includes(request.method) || new URL(request.url).search) return response({ ok: false, category: 'validation' }, requestId);
  if (request.method === 'PATCH') {
    const config = sessionConfiguration(env);
    if (request.headers.get('origin') !== config.origin ||
        !['same-origin', null].includes(request.headers.get('sec-fetch-site')) ||
        request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      return response({ ok: false, category: 'validation' }, requestId);
    }
  }
  try {
    const session = await resolve(env, request.headers.get('cookie'));
    if (!session.ok) return response(session, requestId);
    if (request.method === 'GET') {
      const result = await store(env, session.identity, { kind: 'read' });
      const recordsReady = persistenceConfig.fullDomain && env.GROUND_PROFILE_RECORDS_MODE === 'manual-v1' &&
        Array.isArray(result?.profile?.vehicles) && Array.isArray(result?.profile?.notes);
      return response(result, requestId, persistenceConfig.fullDomain ? 'full-v1' : 'smoke', recordsReady ? 'manual-v1' : 'off',
        recordsReady && env.GROUND_PROFILE_TRANSFER_MODE === 'reviewed-v1' ? 'reviewed-v1' : 'off');
    }
    const reader = request.body?.getReader();
    if (!reader) return response({ ok: false, category: 'validation' }, requestId);
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          return response({ ok: false, category: 'validation' }, requestId);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let body;
    try { body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))); }
    catch { return response({ ok: false, category: 'validation' }, requestId); }
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key =>
        !['operationId','expectedRevision','patch'].includes(key))) return response({ ok: false, category: 'validation' }, requestId);
    return response(await store(env, session.identity, { ...body, kind: 'save' }), requestId);
  } catch { return response({ ok: false, category: 'unavailable' }, requestId); }
}
