/** Fail closed before using a database, auth, mail, or provider configuration. */
export function validateEnvironment(env, now = new Date()) {
  const errors = [];
  const kind = env.GROUND_ENV;
  if (!['production', 'preview', 'local', 'recovery'].includes(kind)) errors.push('GROUND_ENV must identify production, preview, local, or recovery');
  const vercelKind = env.VERCEL_ENV;
  if (vercelKind && ((kind === 'production' && vercelKind !== 'production') || (kind === 'preview' && vercelKind !== 'preview') || (kind === 'local' && vercelKind !== 'development') || kind === 'recovery')) errors.push('GROUND_ENV conflicts with VERCEL_ENV');
  if (!vercelKind && env.VERCEL === '1') errors.push('Vercel deployment environment is missing');
  for (const key of ['GROUND_DATABASE_URL', 'GROUND_DATABASE_HOST', 'GROUND_DATABASE_BRANCH_ID', 'GROUND_AUTH_ISSUER', 'GROUND_AUTH_COOKIE_NAME', 'GROUND_PUBLIC_ORIGIN']) if (!env[key]) errors.push(`${key} is required`);
  let databaseHost;
  let originHost;
  try {
    const database = new URL(env.GROUND_DATABASE_URL || '');
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.username || !database.password) throw new Error();
    databaseHost = database.hostname.toLowerCase();
    if (databaseHost !== env.GROUND_DATABASE_HOST?.toLowerCase()) errors.push('Database host does not match its pinned host');
  } catch { errors.push('GROUND_DATABASE_URL must be a credentialed PostgreSQL URL'); }
  try {
    const origin = new URL(env.GROUND_PUBLIC_ORIGIN || '');
    if (origin.protocol !== 'https:' && !(kind === 'local' && origin.hostname === 'localhost')) throw new Error();
    if (origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
    originHost = origin.hostname.toLowerCase();
  } catch { errors.push('GROUND_PUBLIC_ORIGIN must be a secure origin (localhost allowed for local)'); }
  if (kind === 'production') {
    if (env.GROUND_DATABASE_BRANCH_ID !== env.GROUND_PRODUCTION_BRANCH_ID) errors.push('Production branch ID mismatch');
    if (env.GROUND_EMAIL_MODE !== 'live') errors.push('Production email mode must be live');
    if (env.GROUND_SEED_MODE === 'synthetic') errors.push('Production cannot seed synthetic identities');
  } else if (kind === 'preview' || kind === 'local') {
    if (!env.GROUND_PRODUCTION_DATABASE_HOST || !env.GROUND_PRODUCTION_BRANCH_ID || !env.GROUND_PRODUCTION_AUTH_ISSUER || !env.GROUND_PRODUCTION_AUTH_COOKIE_NAME || !env.GROUND_PRODUCTION_ORIGIN) errors.push('Production identity pins are required for isolation checks');
    if (databaseHost && databaseHost === env.GROUND_PRODUCTION_DATABASE_HOST?.toLowerCase()) errors.push('Nonproduction database host matches production');
    if (env.GROUND_DATABASE_BRANCH_ID === env.GROUND_PRODUCTION_BRANCH_ID) errors.push('Nonproduction database branch matches production');
    if (env.GROUND_AUTH_ISSUER === env.GROUND_PRODUCTION_AUTH_ISSUER) errors.push('Nonproduction auth issuer matches production');
    if (env.GROUND_AUTH_COOKIE_NAME === env.GROUND_PRODUCTION_AUTH_COOKIE_NAME) errors.push('Nonproduction cookie name matches production');
    try { if (originHost === new URL(env.GROUND_PRODUCTION_ORIGIN).hostname.toLowerCase()) errors.push('Nonproduction origin matches production'); } catch { errors.push('Production origin pin is invalid'); }
    if (env.GROUND_EMAIL_MODE !== 'capture') errors.push('Nonproduction email must be captured');
    if (env.GROUND_SCHEDULED_WORK !== 'off') errors.push('Nonproduction scheduled work must be off');
    if (env.GROUND_SEED_MODE !== 'synthetic') errors.push('Nonproduction seed mode must be synthetic');
  } else if (kind === 'recovery') {
    if (env.GROUND_EMAIL_MODE !== 'off' || env.GROUND_SCHEDULED_WORK !== 'off' || env.GROUND_METERED_DISPATCH !== 'off' || env.GROUND_LOGIN_MODE !== 'off') errors.push('Recovery must quarantine login, email, jobs, and dispatch');
    if (!env.GROUND_PRODUCTION_DATABASE_HOST || !env.GROUND_PRODUCTION_BRANCH_ID || !env.GROUND_RECOVERY_CONTROL_HOST) errors.push('Recovery requires pinned production and control identities');
    if (databaseHost === env.GROUND_PRODUCTION_DATABASE_HOST?.toLowerCase() || env.GROUND_DATABASE_BRANCH_ID === env.GROUND_PRODUCTION_BRANCH_ID) errors.push('Recovery restore target must differ from production');
    if (databaseHost === env.GROUND_RECOVERY_CONTROL_HOST?.toLowerCase()) errors.push('Recovery control ledger must differ from restore target');
  }
  let liveTest = null;
  if (kind === 'preview' && env.GROUND_METERED_DISPATCH === 'bounded') {
    const start = Date.parse(env.GROUND_LIVE_TEST_START || '');
    const until = Date.parse(env.GROUND_LIVE_TEST_UNTIL || '');
    const budget = Number(env.GROUND_LIVE_TEST_BUDGET_USD);
    const accountIds = (env.GROUND_LIVE_TEST_ACCOUNT_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    const recipients = (env.GROUND_LIVE_TEST_RECIPIENTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!env.GROUND_LIVE_TEST_RUN_ID || !accountIds.length || !recipients.length || !Number.isFinite(start) || !Number.isFinite(until) || until <= start || until - start > 60 * 60_000 || now.getTime() < start || now.getTime() >= until || !Number.isFinite(budget) || budget <= 0 || budget > 0.25) errors.push('Preview live test requires a current bounded run, approved accounts/recipients, and at most $0.25 for 60 minutes');
    else liveTest = { runId: env.GROUND_LIVE_TEST_RUN_ID, until: new Date(until).toISOString(), budgetUsd: budget,
      accountIds, recipients };
  } else if (kind !== 'production' && env.GROUND_METERED_DISPATCH !== 'off') errors.push('Metered dispatch must be off outside a bounded preview run');
  if (errors.length) return { ok: false, errors };
  return { ok: true, kind, databaseHost, liveTest };
}

/** A dispatcher must also make a durable, atomic per-run reservation before each call. */
export function admitPreviewAttempt(config, attempt) {
  if (!config.ok || config.kind !== 'preview' || !config.liveTest) return false;
  if (attempt.runId !== config.liveTest.runId || !Number.isFinite(attempt.estimatedUsd) || attempt.estimatedUsd <= 0) return false;
  if (!config.liveTest.accountIds.includes(attempt.accountId)) return false;
  if (attempt.recipient && !config.liveTest.recipients.includes(attempt.recipient.toLowerCase())) return false;
  return Number.isFinite(attempt.reservedUsd) && attempt.reservedUsd >= 0 && attempt.reservedUsd + attempt.estimatedUsd <= config.liveTest.budgetUsd;
}
