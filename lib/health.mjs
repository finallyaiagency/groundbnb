import { validateEnvironment } from './environment.mjs';
import { probeDatabase } from './database-probe.mjs';

export async function checkHealth(env, probe = probeDatabase) {
  const config = validateEnvironment(env);
  const base = {
    environment: config.ok ? config.kind : null,
    revision: env.VERCEL_GIT_COMMIT_SHA || env.GROUND_REVISION || 'unknown',
    // These require independent M0 evidence; a healthy database cannot prove them.
    authIsolation: 'unverified',
    emailIsolation: 'unverified',
  };
  if (!config.ok) return { statusCode: 503, body: { ...base, status: 'configuration_required', database: 'not_checked' } };
  let database;
  try { database = await probe(env); } catch { database = { ok: false }; }
  if (database?.ok !== true) return { statusCode: 503, body: { ...base, status: 'database_unavailable', database: 'unverified' } };
  return { statusCode: 200, body: { ...base, status: 'database_ready', database: 'verified', branchId: database.branchId } };
}
