# M1-01 — Auth and profile foundation (in progress)

M0 exit passed October 6; read `docs/qa/2026-10-06-M0-complete.md` and D-007 before selecting bounded M1 work. M1-01A provides the candidate profile revision contract; M1-01B passes the local and bounded live server-reader gates. Browser login/account mapping remain open. M1-01C dormant roles are provisioned and catalog checked under D-008/Q-007. M1-01D normalized account/profile migration and two bounded function grants committed on local/preview at b236d01; rollback-only operator invariant checks pass. Restricted app credentials and deployment/browser activation remain pending. Retain synthetic-only preview/local, captured SMTP and disabled dispatch; Shared Google remains configured only on production. Revalidate isolation when enabling app authentication/callbacks. Full MFA, owner/bootstrap, recovery-key binding/portable backup and launch replay remain their own gates.

Milestone: M1. Read `AGENTS.md`, `docs/STATE.md`, this packet, `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, and `docs/spec/15-shared-safeguards.md` plus exact source rows for selected ledger IDs before editing.

Dependency: M0-01 must first prove a protected, synthetic preview with separate auth/database identity and a revisioned health check. Carry forward its environment and recovery controls.

Goal: authenticated account and profile foundation with ownership, optimistic revisions, durable save acknowledgment, MFA/step-up boundary, membership data, and atomic financial reservation substrate. Split into bounded follow-up packets after inspecting the named views and ledger.

Exit: each selected v1 requirement has a real pass observation on the isolated preview and revision-tied evidence; no mock is used to verify live auth. Update the ledger, QA, state, usage, and Git checkpoint.
