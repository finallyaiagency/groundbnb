import { NextResponse, type NextRequest } from 'next/server';
import { getPreviewAuth } from './lib/pcc-auth-server';

export const config = {
  matcher: ['/preview-sign-in'],
};

export async function middleware(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'preview/control-center') {
    return NextResponse.next();
  }

  const response = await getPreviewAuth().middleware()(request);
  // This page is the preview's own sign-in screen; do not redirect it to the
  // package default /auth/sign-in route, which is intentionally not mounted.
  if (response.headers.get('location')?.endsWith('/auth/sign-in')) {
    return NextResponse.next();
  }
  return response;
}
