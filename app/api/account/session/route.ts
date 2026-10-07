import { resolveSessionIdentity } from '@/lib/session-identity.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  const result = await resolveSessionIdentity(process.env, request.headers.get('cookie'));
  const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
  if (!result.ok) {
    return Response.json({ authenticated: false, category: result.category },
      { status: result.category === 'auth' ? 401 : 503, headers });
  }
  return Response.json({ authenticated: true }, { headers });
}
