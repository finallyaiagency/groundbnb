import { handleProfileTransferRequest } from '@/lib/profile-transfer-request.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function PATCH(request: Request) {
  return handleProfileTransferRequest(request, process.env);
}
