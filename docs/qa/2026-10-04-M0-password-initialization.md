# M0 first-password handoff correction — 2026-10-04

Base revision: `38c98753f0caa5e05653c76edfad3a0f0dd47eda`. The client reported that preview lists only neondb_owner and groundbnb_preview_probe, and Reset password returns **cannot update password for role without password**. This is client-reported live evidence; Codex did not repeat the credential-changing action.

The previous handoff incorrectly assumed the console reset could initialize a SQL-created passwordless NOLOGIN role. Catalog permission verification did not establish that capability. Each approved role was created on its respective branch; two visible roles on the preview branch are expected, as Neon's roles are branch-scoped.

Checked current [Neon role documentation](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md) and [PostgreSQL 18 ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html), 2026-10-04. They document SQL password setting and LOGIN/PASSWORD role options. Corrected the handoff to use client-executed `ALTER ROLE ... WITH LOGIN PASSWORD ...` with a distinct password for each branch. Templates contain obvious placeholders only, never usable credentials. Client clears the editor before returning browser control. New credential entry/submission remains a required user handoff under browser policy.

No role, password, permission, provider setting, frozen source, or approved amendment changed in this correction. Initialization success remains unverified until the client performs it; direct login/read/denial checks remain open. SYS-11 remains Blocked on credential activation, not Verified. Historical QA/decisions are retained.

GitHub CI [37233238201](https://github.com/finallyaiagency/groundbnb/actions/runs/37233238201) reports success at the base revision. Local checks for this documentation correction passed: `pnpm state:check` (249 IDs, frozen hash unchanged), `pnpm secrets:check` (85 files), `pnpm test` (10/10), `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`. No new local dependency audit was run. No metered product dispatch, paid upgrade, or subagents. Task-level credits and provider dollar cost remain unavailable.
