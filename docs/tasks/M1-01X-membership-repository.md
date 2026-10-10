# M1-01X — Offline membership snapshot repository adapter

## Purpose and authority

Prepare a dormant server-side adapter over the existing private `groundbnb.read_membership(text,text)` reader and map its validated snapshot into the existing pure membership evaluator. This slice adds no route, runtime binding, environment switch, app grant, SQL, or entitlement activation.

Authority: frozen specification Sections 11.14–11.15 (MEM-01, MEM-02, MEM-05, MEM-06), shared ownership/security safeguards, and the derived views `docs/spec/12-membership.md` and `docs/spec/15-shared-safeguards.md`. The reader contract is in M1-01U; database implementation is `db/migrations/0011_membership_reader.sql`. The adapter does not amend these sources.

## Closed adapter contract

- Accept only `{ issuer, subject }`; pass those values to one fixed parameterized reader call. Never accept account ID, plan, grant, role, provider, or client membership claims.
- Validate the reader's exact success/failure envelopes and the base assignment, policy, pinned feature/limit definitions, and effective lifetime overlays. Require the migration's explicit-cohort policy value, active half-open base/grant windows, unique overlay IDs, and the defined start-time-descending/UUID-ascending precedence using exact microseconds. Clone and deeply freeze successful snapshots. Query failures and malformed data return a generic `membership_unavailable`; the reader's closed `auth` denial is preserved.
- Require the database-pinned version ID, plan ID/key, version number, release tier, and feature/limit definitions to match the known immutable v1 seed. Unknown versions or catalog drift fail closed until a later version-aware evaluator is explicitly prepared. Keep archived plan versions usable when their already-issued pinned version remains valid.
- An absent base assignment never selects Free. If a lifetime overlay is present, evaluate its selected pinned plan while retaining the base assignment in the returned snapshot. The adapter does not write audit events or grants.
- `evaluateMembershipSnapshot` delegates to the existing pure evaluator. Public evaluation uses database policy; `enforced_test` requires the database's explicit-cohort setting and enables enforcement only for commercial restrictions. Operational/security/financial checks, unknowns, supplier transactions, and unimplemented/future-tier features remain denied.

## Checks and limits

Run `node --test tests/membership-postgres-repository.test.mjs` and ESLint on the new module/test. These deterministic tests use a fake query port and synthetic seed snapshots. They do not prove database query execution, live app-role privilege, service wiring, durable audit, or runtime authorization. No live SQL or credentials are used.

Open decisions for a later slice: a version-aware evaluator for newly published definitions, persistence of report-only audit events, trusted route/service inputs for operational checks and enforced cohorts, and application grant/runtime integration. Do not claim MEM-01/02/05/06 acceptance from this adapter alone.
