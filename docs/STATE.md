# Groundbnb execution state

Updated: 2026-10-02

## Authority

- Frozen product specification: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md` (SHA-256 in `docs/spec/SOURCE-HASH.txt`).
- `docs/ledger.csv` contains 249 product requirements; all remain Not started. No Control Center check verifies a Groundbnb requirement.
- GitHub product repository: `finallyaiagency/groundbnb`. Preserve its history and frozen source.
- Project Control Center now has its own GitHub repository, Vercel project, and Neon project. Its app code, migrations, authentication adapter, tests, and current QA are maintained there.

## Current milestone

M0 — repository and isolated product environments. This cleanup removes the former Control Center app from the Groundbnb checkout and leaves a simple product holding page. M0 exit is not met. Read `docs/tasks/M0-01-repo-environments.md` before product implementation.

## Groundbnb environments

- Vercel project `finally-ais-projects/groundbnb` is retained for the product. The former Control Center preview secrets were removed on 2026-10-02. Verify the clean deployment before treating it as a new product baseline.
- Neon project `groundbnb` (`divine-resonance-05443204`) is retained for the product. Its production branch `br-small-meadow-b8lh69jr` had only default `neondb`, no public tables, and Auth disabled before this cleanup. The former Control Center preview branch `br-plain-grass-b8xotge6` must be removed before M0 creates fresh product branches.
- The named product database `groundbnb`, independent product Auth, sanitized preview, local, and recovery controls are M0 work. No metered product dispatch is enabled.

## Verification and decisions

- Cleanup evidence and exact checks: `docs/qa/2026-10-02-separation-cleanup.md`.
- Client explicitly requested a separate reusable Control Center and a clean Groundbnb repository, hosted project, and database. The frozen product specification and requirement IDs were not amended.
- Product integration status and open decisions are in `docs/integrations.md` and `docs/OPEN-DECISIONS.md`.
- Task-level Codex credit usage is unavailable; `implementation-usage.csv` contains no invented values.
