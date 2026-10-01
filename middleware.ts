import { NextResponse, type NextRequest } from 'next/server';
import { getPreviewAuth } from './lib/pcc-auth-server';

export const config = {
  matcher: ['/preview-sign-in'],
};

export async function middleware(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'preview/control-center') {
    return NextResponse.next();
  }

  return getPreviewAuth().middleware()(request);
}
