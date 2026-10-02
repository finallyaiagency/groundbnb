# Groundbnb execution state

Updated: 2026-10-02 (M0-01 branch and migration evidence)

## Authority

- Frozen product specification: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md` (SHA-256 in `docs/spec/SOURCE-HASH.txt`).
- `docs/ledger.csv` contains 249 product requirements. SYS-14 is Verified by the repository gate, mutation test, and revisioned CI; all others remain Not started pending full integration evidence. No Control Center check verifies a Groundbnb requirement.
- GitHub product repository: `finallyaiagency/groundbnb`. Preserve its history and frozen source.
- Project Control Center now has its own GitHub repository, Vercel project, and Neon project. Its app code, migrations, authentication adapter, tests, and current QA are maintained there.

## Current milestone

M0 — repository and isolated product environments. The M0-01 contract, baseline SQL, provenance guard, documentation gate, health route, and recovery runbook are implemented. Isolated Neon branches and schema migrations exist; the production seed guard was observed live. M0 exit is not met: auth/credential isolation, branch-bound Vercel configuration, rollback, seven-day retention, and restore drill remain open. Read `docs/tasks/M0-01-repo-environments.md` before product implementation. `docs/tasks/M1-01-foundation.md` is prepared but M1 has not started.

## Groundbnb environments

- Vercel project `finally-ais-projects/groundbnb` serves the clean product holding page in production at `885f7d2`. Draft-PR preview `dpl_EQE2UwuZ4k152WQDDcpv9XfAJuYF` for `290b792` is Ready and protected; `/api/health` returns its exact revision and HTTP 503 because product variables are absent. The former Control Center preview secrets, Git branch, and 25 old deployments were removed.
- Neon project `groundbnb` (`divine-resonance-05443204`) has production `br-small-meadow-b8lh69jr`, schema-only template `br-frosty-poetry-b8ti8mml`, preview `br-bitter-hall-b8ibnrfy`, local `br-rough-flower-b8lerkcf`, and recovery controls `br-round-field-b8d4v5o4`. Baseline migration and pinned identity exist in production; it has zero synthetic identities and rejects synthetic insertion. Preview/local contain only one synthetic fixture each. The recovery branch has an empty control-event table. A disposable rollback-test branch expires automatically. Neon Auth remains disabled.
- Independent Auth, credentials, Vercel branch bindings, and restricted recovery access are still M0 work. No metered product dispatch is enabled. Neon Free plan history retention is 6 hours, short of the seven-day requirement; see Q-002.

## Verification and decisions

- Cleanup evidence and exact checks: `docs/qa/2026-10-02-separation-cleanup.md`.
- M0-01 evidence and blocked checks: `docs/qa/2026-10-02-M0-01-environments.md`. Local lint, typecheck, 8 tests, build, documentation/source scan, and dependency audit passed. CI passed for `11a1299` and `290b792`; preview health fails closed. Neon schema/branch and seed-guard checks passed; auth isolation, destructive rollback, and recovery remain open. Auto-review rejected the disposable branch `DROP SCHEMA ... CASCADE` rollback because that exact deletion lacked explicit user authorization.
- Client explicitly requested a separate reusable Control Center and a clean Groundbnb repository, hosted project, and database. The frozen product specification and requirement IDs were not amended.
- Product integration status and open decisions are in `docs/integrations.md` and `docs/OPEN-DECISIONS.md`.
- Task-level Codex credit usage is unavailable; `implementation-usage.csv` contains no invented values.
