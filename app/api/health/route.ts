import { NextResponse } from 'next/server';
import { checkHealth } from '@/lib/health.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkHealth(process.env);
  return NextResponse.json(result.body, {
    status: result.statusCode,
    headers: { 'Cache-Control': 'no-store' },
  });
}
