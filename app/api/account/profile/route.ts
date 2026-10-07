import { randomUUID } from 'node:crypto';
import { resolveSessionIdentity, sessionConfiguration } from '@/lib/session-identity.mjs';
import { persistProfile } from '@/lib/profile-persistence.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };

function response(result: Record<string, unknown>, requestId: string) {
  const category = String(result.category ?? '');
  const status = result.ok ? 200 : ({ auth: 401, validation: 400, conflict: 409, unavailable: 503 }[category] ?? 503);
  return Response.json({ ...result, requestId, ...(!result.ok ? {
    retryable: category === 'unavailable',
    message: category === 'conflict' ? 'Your profile changed. Review the current values before saving again.'
      : category === 'validation' ? 'Review the profile fields and revision.'
      : category === 'auth' ? 'Sign in to an available account.'
      : 'Profile storage is unavailable. Keep your draft and retry with the same operation ID.',
  } : {}) }, { status, headers });
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  if (new URL(request.url).search) return response({ ok: false, category: 'validation' }, requestId);
  const session = await resolveSessionIdentity(process.env, request.headers.get('cookie'));
  if (!session.ok) return response(session, requestId);
  return response(await persistProfile(process.env, session.identity, { kind: 'read' }), requestId);
}

export async function PATCH(request: Request) {
  const requestId = randomUUID();
  const config = sessionConfiguration(process.env);
  // Exact same-origin JSON mutation. Cookies alone cannot authorize a cross-origin write.
  if (!config || request.headers.get('origin') !== config.origin ||
      !['same-origin', null].includes(request.headers.get('sec-fetch-site')) ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || new URL(request.url).search) {
    return response({ ok: false, category: config ? 'validation' : 'unavailable' }, requestId);
  }
  const session = await resolveSessionIdentity(process.env, request.headers.get('cookie'));
  if (!session.ok) return response(session, requestId);
  try {
    // Stream limit applies even without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return response({ ok: false, category: 'validation' }, requestId);
    let size = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); return response({ ok: false, category: 'validation' }, requestId); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key =>
      !['operationId', 'expectedRevision', 'patch'].includes(key))) return response({ ok: false, category: 'validation' }, requestId);
    return response(await persistProfile(process.env, session.identity, { ...body, kind: 'save' }), requestId);
  } catch { return response({ ok: false, category: 'validation' }, requestId); }
}
