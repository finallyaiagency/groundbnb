import { handleBrowserAuth } from '@/lib/browser-auth.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) { return handleBrowserAuth(request, process.env); }
