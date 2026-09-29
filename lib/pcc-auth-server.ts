import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';
import { previewAuthConfig } from './pcc-auth-config';
import type { VerifiedActor } from './pcc-authz';

let cached: ReturnType<typeof createNeonAuth> | undefined;

export function getPreviewAuth() {
  if (!cached) {
    const config = previewAuthConfig(
      process.env.NEON_AUTH_BASE_URL,
      process.env.PCC_AUTH_HOST,
      process.env.NEON_AUTH_COOKIE_SECRET,
      process.env.VERCEL_ENV,
      process.env.VERCEL_GIT_COMMIT_REF,
    );
    cached = createNeonAuth({ baseUrl: config.baseUrl, cookies: { secret: config.cookieSecret } });
  }
  return cached;
}

/** Provider-verified identity only. Authorization remains a separate subject allowlist. */
export async function getVerifiedPccActor(): Promise<VerifiedActor | null> {
  try {
    const { data } = await getPreviewAuth().getSession();
    const user = data?.user;
    return user?.id && user.emailVerified ? { subject: user.id, verified: true } : null;
  } catch {
    return null;
  }
}
