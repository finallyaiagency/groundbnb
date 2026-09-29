export function previewAuthConfig(
  baseUrl: string | undefined,
  expectedHost: string | undefined,
  cookieSecret: string | undefined,
  deployment: string | undefined,
  gitRef: string | undefined,
) {
  if (deployment !== 'preview' || gitRef !== 'preview/control-center') {
    throw new Error('PCC Auth is limited to the Control Center preview');
  }
  if (!baseUrl || !expectedHost || !cookieSecret || cookieSecret.length < 32) {
    throw new Error('PCC Auth configuration is incomplete');
  }
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('Invalid PCC Auth URL'); }
  if (url.protocol !== 'https:' || url.hostname !== expectedHost ||
      !url.hostname.includes('.neonauth.') || !url.hostname.endsWith('.neon.tech') ||
      url.port || url.username || url.password || url.search || url.hash ||
      url.pathname.replace(/\/$/, '') !== '/groundbnb/auth') {
    throw new Error('PCC Auth target does not match the isolated preview');
  }
  return { baseUrl: url.href.replace(/\/$/, ''), cookieSecret };
}
