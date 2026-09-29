export function validatePccDatabaseTarget(raw: string | undefined, expectedHost: string | undefined, deployment: string | undefined): string {
  if (deployment === 'production') throw new Error('PCC writes are disabled in production');
  if (!raw || !expectedHost) throw new Error('PCC database is not configured');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid PCC database URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== expectedHost ||
      !url.hostname.endsWith('.neon.tech') || decodeURIComponent(url.pathname) !== '/groundbnb' ||
      url.searchParams.get('sslmode') !== 'require') {
    throw new Error('PCC database target does not match the isolated configuration');
  }
  return raw;
}
