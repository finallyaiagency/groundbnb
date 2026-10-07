# M1-01C — Restricted application role boundary

Status: dormant role provisioning and operator catalog read-back complete; application activation remains open.

Read `AGENTS.md`, `docs/STATE.md`, M1-01, `docs/spec/00-overview.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md` and `docs/spec/15-shared-safeguards.md`. Binding source: SYS-07, SYS-11, DATA-01, OP-02 and Section 11.22 C/D. Frozen scope and source remain authoritative.

The existing M0 probe roles are read-only. Reserve separate dormant `groundbnb_preview_app` and `groundbnb_local_app` principals for subsequent account/profile integration without altering those probes. Proposed SQL is `db/operations/prepare-m1-app-roles.sql`: exact branch/database/baseline guards, collision refusal, NOLOGIN/no password, no admin membership or create/BYPASSRLS powers, four connections, read-only default, five-second statements, and SELECT only on the two environment/migration metadata tables. Catalog assertions roll back unsafe grants.

Client answered “Approve both roles” to Q-007. On October 7 at approximately 1:54–1:57 PM EDT, the exact SQL at cb01fe3 committed successfully on both pinned groundbnb databases. Its catalog assertions passed, followed by independent SELECT read-backs from `db/operations/verify-m1-app-roles.sql`. Both roles are NOLOGIN, restricted, have no memberships, four connections, read-only defaults, five-second statements and metadata SELECT; synthetic identities are denied. See D-008 and `docs/qa/2026-10-07-M1-01C-app-roles.md`. No direct-login pass is possible or claimed for dormant roles.

After approval, create/read back each dormant role on its pinned branch. Then prepare the account/profile schema with owner-scoped writes, optimistic revisions and atomic operation acknowledgments. Profile privileges and distinct client-entered credentials remain separate activation steps. No full product requirement becomes Verified from role provisioning.
