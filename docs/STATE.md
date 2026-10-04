# Groundbnb execution state

Updated: 2026-10-03 (approved six-hour launch recovery amendment A-001)

## Authority

- Frozen product specification: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md` (SHA-256 in `docs/spec/SOURCE-HASH.txt`).
- Approved client amendment A-001 (D-004, LEG-10) overlays Section 11.16: six-hour production recovery-history minimum at launch. Frozen source and stable IDs remain unchanged. Four-hour recovery time and LEG-12 replay remain required.
- `docs/ledger.csv` contains 249 product requirements. SYS-14 is Verified by the repository gate, mutation tests, and revisioned CI; LEG-09 is Blocked by an unpatched high-severity lint dependency. LEG-10 returns to Not started after the approved retention change; its privacy page and real restore evidence remain pending. All other requirements remain Not started pending full integration evidence. No Control Center check verifies a Groundbnb requirement.
- GitHub product repository: `finallyaiagency/groundbnb`. Preserve its history and frozen source.
- Project Control Center now has its own GitHub repository, Vercel project, and Neon project. Its app code, migrations, authentication adapter, tests, and current QA are maintained there.

## Current milestone

M0 — repository and isolated product environments. The M0-01 contract, baseline SQL, provenance guard, documentation gate, health route, and recovery runbook are implemented. Isolated Neon branches and schema migrations exist; the production seed guard and disposable baseline rollback were observed live. Remaining order: repair dependency audit/CI, finish auth/credential isolation and branch-bound protected preview configuration, then record recovery availability and a quarantined baseline restore. The full LEG-12 account/revocation replay remains the M8 launch gate. Read `docs/tasks/M0-01-repo-environments.md` before product implementation. Start the prepared `docs/tasks/M1-01-foundation.md` only after M0 exit passes.

## Groundbnb environments

- Vercel project `finally-ais-projects/groundbnb` serves the clean product holding page in production at `885f7d2`. Last checked draft-PR preview `dpl_8fk1Wbnvj2inp5dAGP7pmaSd1Pxz` for `dda6418` is Ready and protected; `/api/health` returns its exact revision and HTTP 503 because product variables are absent. The former Control Center preview secrets, Git branch, and 25 old deployments were removed.
- Neon project `groundbnb` (`divine-resonance-05443204`) has production `br-small-meadow-b8lh69jr`, schema-only template `br-frosty-poetry-b8ti8mml`, preview `br-bitter-hall-b8ibnrfy`, local `br-rough-flower-b8lerkcf`, and recovery controls `br-round-field-b8d4v5o4`. Baseline migration and pinned identity exist in production; it has zero synthetic identities and rejects synthetic insertion. Preview/local contain only one synthetic fixture each. The recovery branch has an empty control-event table. A disposable rollback-test branch expires automatically. Neon Auth remains disabled.
- Independent Auth, credentials, Vercel branch bindings, and restricted recovery access are still M0 work. No metered product dispatch is enabled. Client chose to keep Neon Free and approved A-001's six-hour launch minimum (D-004, Q-002 closed). Free's change-history cap may shorten actual availability; verify it rather than treating configuration as evidence.

## Verification and decisions

- Cleanup evidence and exact checks: `docs/qa/2026-10-02-separation-cleanup.md`.
- M0-01 environment and rollback evidence: `docs/qa/2026-10-02-M0-01-environments.md` and `docs/qa/2026-10-03-M0-01-rollback.md`. Prior local lint, typecheck, 8 tests, build, documentation/source scan passed; dependency audit fails on GHSA-vfj7-8cjw-p6xm with no published patched `braces` version observed. Earlier CI passed for `11a1299`, `290b792`, and `9053107`; CI at `dda6418` failed at the dependency audit. Preview health fails closed. Neon schema/branch, seed-guard, and disposable rollback checks passed. Client approved the rollback after an earlier automatic approval rejection; production remained intact. Auth isolation and recovery remain open.
- Amendment implementation/check evidence: `docs/qa/2026-10-03-A-001-recovery-window.md`. Local lint, typecheck, 9 tests, build, state/secret scans, and diff checks passed; audit still fails on the existing finding. Approved overlays are generated explicitly and checked for record/content drift; views-only regeneration preserves ledger evidence. No live recovery pass is claimed.
- Client explicitly requested a separate reusable Control Center and a clean Groundbnb repository, hosted project, and database. The frozen source bytes and requirement IDs are preserved; A-001 is the explicit approved contractual amendment.
- Product integration status and open decisions are in `docs/integrations.md` and `docs/OPEN-DECISIONS.md`.
- Task-level Codex credit usage is unavailable; `implementation-usage.csv` contains no invented values.
