# Groundbnb execution state

Updated: 2026-10-02 (M0-01 local foundation)

## Authority

- Frozen product specification: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md` (SHA-256 in `docs/spec/SOURCE-HASH.txt`).
- `docs/ledger.csv` contains 249 product requirements. SYS-14 is Implemented locally; all others remain Not started. No Control Center check verifies a Groundbnb requirement.
- GitHub product repository: `finallyaiagency/groundbnb`. Preserve its history and frozen source.
- Project Control Center now has its own GitHub repository, Vercel project, and Neon project. Its app code, migrations, authentication adapter, tests, and current QA are maintained there.

## Current milestone

M0 — repository and isolated product environments. The M0-01 local environment contract, baseline SQL, provenance guard, documentation gate, health route, and recovery runbook are implemented. M0 exit is not met: live preview/local branches, auth isolation, migration/rollback, protected preview, recovery drill, and exact package/CI gates remain open. Read `docs/tasks/M0-01-repo-environments.md` before product implementation. `docs/tasks/M1-01-foundation.md` is prepared but M1 has not started.

## Groundbnb environments

- Vercel project `finally-ais-projects/groundbnb` serves the clean product holding page. CI passed and the live `/preview-sign-in` route returned 404. The former Control Center preview secrets, Git branch, and 25 old Vercel deployments were removed; only the new production deployment remains.
- Neon project `groundbnb` (`divine-resonance-05443204`) is retained for the product. Its only branch is production (`br-small-meadow-b8lh69jr`), with a named `groundbnb` database and 0 tables in `public`; Auth is disabled. The former Control Center preview branch `br-plain-grass-b8xotge6` was deleted after explicit client confirmation.
- Independent product Auth, sanitized preview, local, and recovery controls are still M0 work. No metered product dispatch is enabled. Environment values now have a fail-closed contract and a versioned baseline SQL script, but no new Neon branch or auth instance was provisioned.

## Verification and decisions

- Cleanup evidence and exact checks: `docs/qa/2026-10-02-separation-cleanup.md`.
- M0-01 local evidence, blocked live checks, and defects: `docs/qa/2026-10-02-M0-01-environments.md`. `pnpm lint`, `pnpm typecheck`, `pnpm test` (8 tests), `pnpm build`, documentation/source scan, and high-severity dependency audit passed after installing locked dependencies. Local health returned HTTP 503 without configuration. CI and live preview remain unverified.
- Client explicitly requested a separate reusable Control Center and a clean Groundbnb repository, hosted project, and database. The frozen product specification and requirement IDs were not amended.
- Product integration status and open decisions are in `docs/integrations.md` and `docs/OPEN-DECISIONS.md`.
- Task-level Codex credit usage is unavailable; `implementation-usage.csv` contains no invented values.
