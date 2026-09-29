import { getPreviewAuth } from '@/lib/pcc-auth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

async function handle(method: Method, request: Request, context: Context): Promise<Response> {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'preview/control-center') {
    return new Response(null, { status: 404 });
  }
  const { path } = await context.params;
  // Preview accounts are created deliberately in Neon; no self-registration via this app.
  if (path[0] === 'sign-up') return new Response(null, { status: 404 });
  try {
    return await getPreviewAuth().handler()[method](request, context);
  } catch {
    return Response.json({ error: 'Preview authentication is unavailable' }, { status: 503 });
  }
}

export const GET = (request: Request, context: Context) => handle('GET', request, context);
export const POST = (request: Request, context: Context) => handle('POST', request, context);
export const PUT = (request: Request, context: Context) => handle('PUT', request, context);
export const DELETE = (request: Request, context: Context) => handle('DELETE', request, context);
export const PATCH = (request: Request, context: Context) => handle('PATCH', request, context);
