# M1-01X — Membership repository adapter

**Status:** Offline adapter prepared; not wired or activated. No SQL, app-role grant, environment change, provider call, or credential access occurred.

## Changes

- Added `lib/membership-postgres-repository.mjs`: one injected-query call to the private membership reader, exact identity-only input, fail-closed response validation, deep-frozen snapshots, and a bridge to the existing pure evaluator.
- Added `tests/membership-postgres-repository.test.mjs`: synthetic fixtures covering query shape, closed inputs, auth/query failures, absent base assignment, malformed or drifted pinned definitions, policy constraints, half-open validity intervals, exact-microsecond overlay precedence and duplicate IDs, lifetime-overlay selection, report-only public evaluation, enforced test cohorts, archived pinned versions, and operational/future-feature denials.
- Added `docs/tasks/M1-01X-membership-repository.md` with scope, authority, contract, and remaining gates.

## Results

- `node --test tests/membership-postgres-repository.test.mjs`: 10/10 pass.
- `pnpm exec eslint lib/membership-postgres-repository.mjs tests/membership-postgres-repository.test.mjs`: pass.

The adapter accepts only the immutable v1 seed versions and exact feature/limit definitions. Any unknown version or catalog drift fails closed. It never invents a Free assignment, and uses a lifetime overlay only when the validated reader selects one. SQL/database privileges, a live evaluator path, audit persistence, service wiring, concurrency, and full version-aware plan evaluation remain unproven and outside this slice. MEM-01/02/05/06 remain open.

Independent final review passes after strict-calendar, immutable snapshot, pinned version metadata, explicit cohort, half-open window and unique/deterministic overlay fixes. Microsecond parser handles offsets by implementation inspection; no separate offset fixture is claimed. Combined362 tests, lint, build/TypeScript, state/source hash and327-file common-secret scan pass. No live query or app grant/service activation.
