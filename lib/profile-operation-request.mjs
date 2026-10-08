import { randomUUID } from 'node:crypto';
import { resolveSessionIdentity } from './session-identity.mjs';
import { persistProfile, profileConfiguration } from './profile-persistence.mjs';
import { browserAuthConfiguration } from './browser-auth.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
function failure(category, requestId) {
  const safeCategory = ['auth', 'validation'].includes(category) ? category : 'unavailable';
  return Response.json({ ok: false, category: safeCategory, requestId,
    retryable: safeCategory === 'unavailable', message: safeCategory === 'auth' ? 'Sign in to an available account.'
      : safeCategory === 'validation' ? 'The save reference is invalid.'
      : 'Could not confirm your save. Keep your draft and check again.' },
  { status: { auth: 401, validation: 400, unavailable: 503 }[safeCategory], headers });
}

/** Owner comes only from a fresh session; UUID is not an ownership credential. */
export async function handleProfileOperationRequest(request, operationId, env,
  resolve = resolveSessionIdentity, store = persistProfile) {
  const requestId = randomUUID();
  if (!profileConfiguration(env) || (env.GROUND_BROWSER_AUTH_MODE === 'synthetic' && !browserAuthConfiguration(env))) {
    return failure('unavailable', requestId);
  }
  if (request.method !== 'GET' || new URL(request.url).search || typeof operationId !== 'string' || !UUID.test(operationId) ||
      ![null, 'same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) return failure('validation', requestId);
  try {
    const session = await resolve(env, request.headers.get('cookie'));
    if (!session.ok) return failure(session.category, requestId);
    const result = await store(env, session.identity, { kind: 'status', operationId: operationId.toLowerCase() });
    if (!result?.ok) return failure(result?.category, requestId);
    if (!['saved','not_found'].includes(result.status) || result.operationId !== operationId.toLowerCase()) {
      return failure('unavailable', requestId);
    }
    const body = { ok: true, status: result.status, operationId: result.operationId, requestId };
    if (result.status === 'saved') {
      if (!result.profile || !Number.isSafeInteger(result.profile.revision) || result.profile.revision < 0 ||
          !result.profile.answers || typeof result.profile.accountId !== 'string' ||
          !Number.isFinite(Date.parse(result.savedAt))) return failure('unavailable', requestId);
      Object.assign(body, { profile: result.profile, savedAt: result.savedAt, affectedIds: result.affectedIds });
    }
    // not_found is a current observation, not proof that an in-flight save cannot commit.
    return Response.json(body, { headers });
  } catch { return failure('unavailable', requestId); }
}
