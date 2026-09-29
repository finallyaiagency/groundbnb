# PCC-02 — Durable client workflows

Milestone: Project Control Center foundation. Goal: authenticated, durable Q&A, append-only decision history, and change-request submission/triage with stable IDs and audit evidence.

Read `AGENTS.md`, `docs/STATE.md`, this packet, `docs/source/Agency_Project_Control_Center_Spec_v1.1.md`, and `docs/spec/15-shared-safeguards.md`. Verify branch/revision first.

Dependencies: PCC-01 read-only portal deployed; server-side persistence and client identity selected and verified. No browser-only drafts may be shown as submitted.

Likely files: `app/**`, `lib/**`, `db/**`, `docs/decisions/**`, `docs/changes/**`, `docs/OPEN-DECISIONS.md`, `docs/STATE.md`.

Invariants: no secret in Git; no silent critical auto-resolution; frozen spec unchanged; decisions append-only; approved amendments tied to requirement IDs; production/preview data isolated; authorization on every write.

Exit: client can answer/defer/ignore questions, review/accept/modify/reject AI defaults, submit change requests, and see an auditable trail across sessions. Noncritical aging default and critical exclusion have deterministic tests. Exact checks to define after storage architecture is fixed; run lint/typecheck/unit/build and browser workflows.

Recommended model: GPT-5.6 Sol High for first auth/storage pattern; consider Luna High for bounded forms once tests and contracts exist. No subagents. Large; split by store/auth and workflow types if needed. Live-provider cost: none expected beyond infrastructure.
