# M1-01 — Auth and profile foundation (prepared; do not start before M0 exit)

Milestone: M1. Read `AGENTS.md`, `docs/STATE.md`, this packet, `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, and `docs/spec/15-shared-safeguards.md` plus exact source rows for selected ledger IDs before editing.

Dependency: M0-01 must first prove a protected, synthetic preview with separate auth/database identity and a revisioned health check. Carry forward its environment and recovery controls.

Goal: authenticated account and profile foundation with ownership, optimistic revisions, durable save acknowledgment, MFA/step-up boundary, membership data, and atomic financial reservation substrate. Split into bounded follow-up packets after inspecting the named views and ledger.

Exit: each selected v1 requirement has a real pass observation on the isolated preview and revision-tied evidence; no mock is used to verify live auth. Update the ledger, QA, state, usage, and Git checkpoint.
