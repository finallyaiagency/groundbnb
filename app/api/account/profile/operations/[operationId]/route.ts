import { handleProfileOperationRequest } from '@/lib/profile-operation-request.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request, context: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await context.params;
  return handleProfileOperationRequest(request, operationId, process.env);
}
