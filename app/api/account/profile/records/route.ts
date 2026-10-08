import { handleProfileRecordsRequest } from '@/lib/profile-records-request.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function PATCH(request: Request) {
  return handleProfileRecordsRequest(request,process.env);
}
