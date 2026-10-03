import { NextResponse } from 'next/server';
import { validateEnvironment } from '@/lib/environment.mjs';

export const dynamic = 'force-dynamic';

export function GET() {
  const config = validateEnvironment(process.env);
  return NextResponse.json({ status: config.ok ? 'configuration_valid' : 'configuration_required', environment: config.ok ? config.kind : null, revision: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GROUND_REVISION || 'unknown' }, { status: config.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
