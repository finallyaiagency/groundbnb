import { handleProfileRequest } from '@/lib/profile-request.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleProfileRequest(request, process.env);
}

export async function PATCH(request: Request) {
  return handleProfileRequest(request, process.env);
}