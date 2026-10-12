# M0 preview Secret scope and direct database check — 2026-10-05

Base revision: `3dadbf2ca3d15f64a4fe426fadcfe2a01263682e`. Client reported done after entering GROUND_DATABASE_URL directly in Vercel. No credential value was read, decrypted, copied, replaced or logged by Codex.

## Scope defect and correction

Vercel metadata (decrypt=false) showed the sensitive Secret existed under Production only, with no Git branch. This differs from the prepared preview-only form. Corrected the same variable's target to Preview and gitBranch to codex/m0-01-environment-contract using a metadata-only edit; value omitted. Sensitive type retained. Read-back: the Secret is sensitive, target=[preview], exact branch; all 16 public settings retain the same branch scope; zero Production variables and hiddenProductionEnvCount=0. No deployment occurred between the client's save and this correction in the three latest project deployments; the latest was the prior preview dpl_ATZUofLHkJXgaLCCJnyWdud7j4Nc at the base revision.

Published scope checkpoint: `c5c0c99c39a85703b835f83dee4c5ca91ed86774`. Preview `dpl_8H9QUHz65kiAp2BaEPGC8HrksRZr` is Ready at that exact SHA. Authenticated GET `/api/health` returned 200, Cache-Control no-store, environment preview, database verified, status database_ready, branchId br-bitter-hall-b8ibnrfy and the exact revision. This is a real preview-role password login and read-only metadata/identity/baseline/catalog check through the deployed official Neon driver. No credential was exposed by the health response. Auth/email remain explicitly unverified; no attempted-write denial is claimed. [GitHub Verify 37308030924](https://github.com/finallyaiagency/groundbnb/actions/runs/37308030924) passed at the same SHA.

Production is not a deployment target. Auth/email isolation, other environments' credential checks, recovery-control key placement and actual recovery horizon/restore are still open. SYS-11 remains Blocked; M1 not started.

## Remaining direct role handoff

Prepared scripts/verify-m0-credentials.ps1 and scripts/verify-m0-credential.mjs for the client to enter the three existing local/production/recovery passwords through hidden local prompts. Fixed role/host/branch targets; transient stdin only, no password/URL files or arguments, no raw error output. Reuses the tested read-only probe and adds recovery_control.events SELECT/no-write catalog assertions. Only whitelisted evidence is saved in ignored .tmp/evidence/m0-direct-roles.json with revision/UTC time. It does not bind app credentials or claim actual attempted-write denials, auth/email isolation or restoration. Browser password-entry handoff remains with the client. All three direct checks remain pending.

Local and recovery full pooled hosts were verified from masked console connection details, without Reveal/Copy: ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech and ep-shy-sunset-b8ftbxnu-pooler.c-14.us-east-1.aws.neon.tech. Production host was verified on 2026-10-04. Vercel UI shows the Secret under Preview/exact M0 branch; ignored proof screenshot .tmp/evidence/m0-preview-secret-scope-2026-10-05.png. Reveal was never clicked.

## Checks and usage

Local checks: 16/16 tests, typecheck, lint, build, PowerShell parser and Node syntax pass; invalid/empty credential input returns exit 1 and only sanitized JSON without a network call. The sandbox lint process stalled; the permitted run outside the sandbox passed. Documentation gate: 249 IDs/source hash unchanged; secret scan: 93 source files pass; git diff --check passes. Direct three-role checks are client-dependent and unverified. Codex credits and provider costs are unavailable; none inferred. No paid upgrade or metered product dispatch.
