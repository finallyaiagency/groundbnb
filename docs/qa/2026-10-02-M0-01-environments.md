# M0-01 environment evidence — 2026-10-02

Base revision: `885f7d2928bcb65885886f699350bba1a5d8901c` on clean `main`. Code checkpoint: `11a12997862737fd86c24cc7de6a496109b6b6b9`; evidence checkpoint: `290b79238127bf10c96c0ca1f0f8d0be092a16fb` on `codex/m0-01-environment-contract` ([draft PR #1](https://github.com/finallyaiagency/groundbnb/pull/1)). The frozen source was not amended.

## Repository and preview checks

- Fail-closed environment contract, bounded preview activation guard, revisioned `/api/health`, baseline/recovery SQL, provenance guard, source-row/tier documentation gate, and basic credential scan are implemented. The health route checks configuration shape, not database connectivity. No product auth, dispatcher, or recovery replay is implemented.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (8), `pnpm build`, `pnpm state:check` (249 IDs; source SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`), `pnpm secrets:check` (65 tracked source files), and `pnpm audit --audit-level high` passed. The scan is basic. Initial typecheck hit stale ignored `.next` output from the former Control Center; after clearing it, rebuild and typecheck passed. Local unconfigured `GET /api/health` returned 503, `configuration_required`, revision `unknown`.
- GitHub [CI 37057007239](https://github.com/finallyaiagency/groundbnb/actions/runs/37057007239) passed for `11a1299`; [push CI 37057546053](https://github.com/finallyaiagency/groundbnb/actions/runs/37057546053) and [PR CI 37057550749](https://github.com/finallyaiagency/groundbnb/actions/runs/37057550749) passed for `290b792`. Recheck CI after the final evidence commit.
- Protected Vercel preview `dpl_EQE2UwuZ4k152WQDDcpv9XfAJuYF` was Ready for `290b792`; authenticated `/api/health` returned HTTP 503, `configuration_required`, and that exact full revision. An unauthenticated request to the preceding preview returned a Vercel login page; project protection is `all_except_custom_domains`. The Vercel project has no environment variables. Production deployment remains at `885f7d2`; neither preview has database, auth, mail, or paid dispatch access.
- The next checkpoint `9053107cdddfa28a374fe8e52ceb648c81b0fd12` passed [push CI 37059639522](https://github.com/finallyaiagency/groundbnb/actions/runs/37059639522) and [PR CI 37059643929](https://github.com/finallyaiagency/groundbnb/actions/runs/37059643929). Vercel preview `dpl_GBY6QBq884Va1cfDss5zXPMcv7b3` was Ready; authenticated health returned HTTP 503 and the exact `9053107` revision. The 2026-10-03 audit subsequently found a new high-severity transitive advisory; see the dated rollback QA file.

## Neon branch and SQL observations

Neon project `divine-resonance-05443204`, database `groundbnb`, Postgres 18, Free plan. Console observations were made on 2026-10-02 EDT. No connection strings, tokens, or real identities were copied into Git or this record.

| Branch | ID | Observed state |
| --- | --- | --- |
| production | `br-small-meadow-b8lh69jr` | Preflight: no `groundbnb`/`neon_auth` schema and 0 public tables. Applied `0001_environment.sql` in a 9-statement transaction, then inserted the pinned `production` identity. Synthetic insert failed with `Synthetic seed requires a preview or local environment identity` (SQLSTATE P0001). Final query: one migration, zero synthetic identities. |
| groundbnb-schema-template | `br-frosty-poetry-b8ti8mml` | Created schema-only from production before production migration; 0 application/auth tables and Neon Auth disabled. Applied `0001_environment.sql`; migration row present, no environment identity or synthetic rows. |
| groundbnb-preview | `br-bitter-hall-b8ibnrfy` | Child of template. Pinned `preview` identity; one synthetic fixture `preview-01@example.test`; migration row present. No production user/session data was copied. Neon Auth remains disabled. |
| groundbnb-local | `br-rough-flower-b8lerkcf` | Child of template. Pinned `local` identity; inserted one synthetic fixture `local-01@example.test`; SQL editor reported COMMIT success. Neon Auth remains disabled. |
| groundbnb-recovery-controls | `br-round-field-b8d4v5o4` | Child of template, outside the production restore target. Pinned `recovery` identity and applied `db/recovery/0001_controls.sql`; query showed 0 control events. Access restriction and external HMAC key are not configured. |
| groundbnb-m0-rollback-test | `br-winter-dream-b84ythi8` | Disposable child of template, scheduled to auto-delete at 17:07 EDT. Down migration was prepared but **not executed**: automatic approval review rejected `DROP SCHEMA groundbnb CASCADE` because the user had not explicitly authorized that exact destructive deletion. The unrun query was cleared. Rollback remains unverified. |

The console shows **6 hours** of history retention, below the required **at least 7 days**. No recovery duration, last recoverable time, snapshot inventory, replay, or restore drill has been verified. The recovery-control branch is a schema foundation, not a working deletion/revocation recovery system.

## Remaining M0 work and defects

1. Resolve 7-day recovery retention (Q-002), then inventory restore points and run a timed quarantined restore/replay drill. A paid Neon plan or supported equivalent may be required.
2. Provision separate production/preview/local auth services, roles, credentials, callback origins, email capture, and restricted recovery-control access; inspect real auth users/sessions for isolation. Neon Auth is currently disabled, and no credentials have been changed or shared.
3. Bind branch-scoped Vercel variables and verify database identity/connectivity, preview deep links, login, email capture, and metered-dispatch denial. The current preview intentionally fails closed.
4. The client authorized the destructive down script on 2026-10-03; it passed on a fresh disposable branch while production remained intact. See `docs/qa/2026-10-03-M0-01-rollback.md`.
5. Finish field-specific provider rights, retention, AI-context, backup, and export review before persisting provider data.

Task-level Codex credit usage is unavailable. No metered product dispatch occurred. Neon reports usage in CU-hours, storage, and transfer; no dollar cost is inferred from those counters.
