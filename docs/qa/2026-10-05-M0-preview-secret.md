# M0 preview Secret scope and direct database check — 2026-10-05

Base revision: `3dadbf2ca3d15f64a4fe426fadcfe2a01263682e`. Client reported done after entering GROUND_DATABASE_URL directly in Vercel. No credential value was read, decrypted, copied, replaced or logged by Codex.

## Scope defect and correction

Vercel metadata (decrypt=false) showed the sensitive Secret existed under Production only, with no Git branch. This differs from the prepared preview-only form. Corrected the same variable's target to Preview and gitBranch to codex/m0-01-environment-contract using a metadata-only edit; value omitted. Sensitive type retained. Read-back: the Secret is sensitive, target=[preview], exact branch; all 16 public settings retain the same branch scope; zero Production variables and hiddenProductionEnvCount=0. No deployment occurred between the client's save and this correction in the three latest project deployments; the latest was the prior preview dpl_ATZUofLHkJXgaLCCJnyWdud7j4Nc at the base revision.

Publishing this evidence checkpoint triggers the existing Git preview integration with the corrected scope. A saved variable is not a successful login; live health and direct read-only assertions remain pending until the new deployment is Ready. Production is not a deployment target. Auth/email isolation, other environments' credential checks, recovery-control key placement and actual recovery horizon/restore are still open. SYS-11 remains Blocked; M1 not started.

## Checks and usage

Documentation/source consistency, secret scan and diff check are run for this checkpoint. No application code changed. CI and live health results will be appended with the exact published revision. Codex credits and provider costs are unavailable; none inferred. No paid upgrade or metered product dispatch.
