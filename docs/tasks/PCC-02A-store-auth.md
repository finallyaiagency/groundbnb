# PCC-02A — Client store and authorization foundation

Milestone: Project Control Center. This is the first bounded part of PCC-02. Establish an isolated server-side persistence and identity contract for later Q&A, decisions, and change requests. Do not expose a live submission control until its authenticated write and audit path is verified.

## Read first

1. `AGENTS.md`
2. `docs/STATE.md`
3. This packet
4. `docs/source/Agency_Project_Control_Center_Spec_v1.1.md`, especially sections 4, 6, 8, and 10
5. `docs/spec/15-shared-safeguards.md`

Then verify Git branch/revision and inspect only the relevant app/data files. Do not reread the full Groundbnb product specification.

## Scope and dependencies

- In scope: identity choice, preview-only Control Center store schema/migrations, server-side authorization checks, stable submission/audit IDs, local deterministic tests, environment boundary, documented recovery and secret handling.
- Product requirement IDs in scope: none; this packet implements Control Center governance infrastructure. Preserve all 249 Groundbnb requirement statuses.
- Out of scope: Groundbnb product data schemas and requirements, public product launch, full Q&A/decision UI, change-request UI, automated critical decision resolution, production Neon database changes.
- Dependency: PCC-01 is deployed; `preview/control-center` is Ready at the URL in `docs/STATE.md`. Neon `preview` branch `br-plain-grass-b8xotge6` has database `groundbnb`, PCC event tables, and active Better Auth. Production branch has only `neondb` and Auth is disabled.

## Contract to establish

- Repository files remain authoritative for specification, requirement ledger, task state, tests, and approved amendments. A database may hold incoming client submissions and their append-only event history; define the projection/reconciliation path back to repository records.
- Authenticate every write server-side. Make the sponsor identity explicit and keep the authorization policy least-privilege. Never use a browser-held shared write key as the sole authorization check. Avoid public anonymous write endpoints.
- Keep preview, production, and local configuration isolated. Do not copy existing production data into preview or write to the production Neon branch in this packet. Do not commit credentials, connection strings, session secrets, or user identifiers.
- Give every event an immutable ID, actor, timestamp, and related question/change ID; never overwrite historical decision events. Document optimistic revision or transaction behavior for concurrent updates.
- Critical security, money, legal, destructive, credential, and similarly consequential questions must never auto-resolve. The later workflow must support Answer, Defer to AI, Ignore for now, and review of AI defaults.
- Schema and code changes must be reversible or have an explicit recovery path. Verify the exact branch/database target before any live migration.

## Likely files

`lib/**`, `app/api/**`, `db/**`, `tests/**`, `.env.example`, `docs/integrations.md`, `docs/decisions/**`, `docs/OPEN-DECISIONS.md`, `docs/STATE.md`, `docs/qa/**`. Add dependencies only when needed.

## Exit criteria

1. An architecture decision records identity provider, database driver, table/event model, authorization rules, environment boundary, and repository projection path with alternatives and rationale.
2. Migrations and a persistence adapter are implemented for the isolated preview database; no production schema change is made.
3. Deterministic tests cover unauthorized writes, actor attribution, immutable event history, stable IDs, and concurrent revision handling. If live connection is available, run a bounded preview-only migration and read/write smoke check with disposable test records; record cleanup/recovery.
4. Typecheck, lint, unit tests, source-state check, and build pass. Record revision-linked evidence in `docs/qa/`; update `docs/STATE.md`, `docs/integrations.md`, and task status. Publish a coherent Git checkpoint and check CI/preview.
5. Prepare PCC-02B handoff with exact contracts and files. Do not claim the client workflows are complete at this stage.

## Execution configuration

Recommended model: GPT-5.6 Sol High. Reason: this establishes the first security-sensitive auth, persistence, and concurrency pattern. Escalate only for a concrete unresolved architectural failure. Subagents: no. Complexity: Medium; intended for one normal context. Relative credit demand: moderate. Live provider cost should be limited to preview infrastructure and a bounded smoke check.

## Current task status — 2026-09-29

Event-store migration, rollback smoke test, server-side adapter, and fail-closed authorization contract are complete on preview. Auth activation initially failed with `permission denied for database groundbnb`; after specific client approval, the preview-only `CREATE` grant to `neon_service` succeeded and Better Auth activated with nine `neon_auth` tables. See `docs/qa/2026-09-29-pcc-auth.md`. The disposable manually created user was removed; the client then completed Google sign-in with the designated preview inbox and Neon showed a verified user. Its subject is stored only in encrypted Vercel preview configuration. Preview-only Auth proxy and server session adapter require the exact preview branch, provider host, cookie secret, and sponsor allowlist. A redeploy and server session authorization check remain; no live submission route or product requirement is Verified by this work.
