# M0 approved read-only roles — 2026-10-04

Base revision: `fec6933dac88f56fa6db727ef32ac893e635692a`. D-006 records the client's explicit Q-005 approval of four roles. The frozen source and A-001 remain unchanged. No subagents, paid upgrade, or product metered dispatch.

## Live creation and permission evidence

Executed `db/operations/prepare-m0-readonly-roles.sql` separately against the four exact pinned branches as `neondb_owner`. Each returned BEGIN, DO, COMMIT successfully. Branch identity guards determine the sole role for each target; no existing role was altered and no credential was generated or entered.

| Branch | Role | Login | Metadata read | Metadata write | Neon admin |
| --- | --- | --- | --- | --- | --- |
| `br-bitter-hall-b8ibnrfy` / preview | groundbnb_preview_probe | false | true | false | false |
| `br-rough-flower-b8lerkcf` / local | groundbnb_local_probe | false | true | false | false |
| `br-small-meadow-b8lh69jr` / production | groundbnb_production_probe | false | true | false | false |
| `br-round-field-b8d4v5o4` / recovery | groundbnb_recovery_reader | false | true | false | false |

The read-only catalog assertion script `db/operations/verify-m0-readonly-roles.sql` checks login/admin/DDL attributes, absence of role memberships, connection limit 4, read-only/5-second timeout defaults, metadata read grants, denial of table writes and synthetic-fixture access, and auth user/session grants where those tables exist. Recovery additionally has SELECT on control events and no modification privileges. All four catalog checks passed before credential handoff.

An attempted preview `SET LOCAL ROLE groundbnb_preview_probe` failed with SQLSTATE 42501, permission denied to set role. ROLLBACK succeeded. The operator does not have SET access to that role; no new membership was granted to bypass this. Thus these observations prove effective catalog privileges, not direct application login or attempted reads/writes under the new credentials. Those tests remain pending until client credential activation. SQL creation made no product data changes.

## Credential handoff and remaining M0 work

All four roles remain NOLOGIN without passwords. Browser confirmation policy requires the client to perform new password entry/generation and credential activation. The preview Role actions menu exposes Reset password; it was opened but the reset was not clicked. `docs/runbooks/M0-credential-handoff.md` gives the four targets and activation statements. No production secret is copied to preview, Git, or task context. The recovery credential stays outside previews and restored snapshots. Q-005 approval is resolved; its manual credential activation remains open.

Distinct Auth services are provisioned empty, but shared provider email/callback defaults are not proof of app email/session isolation. Branch-bound app variables/connectivity, captured or verified-test-recipient email, direct session isolation, and timed quarantined baseline restore remain outstanding. No requirement becomes Verified from role creation alone; M0 remains incomplete and M1 has not started.

## Repository evidence and usage

[CI 37212278307](https://github.com/finallyaiagency/groundbnb/actions/runs/37212278307) passed every step at base `fec6933`, including frozen-lockfile install, state/secret scans, 10 tests, typecheck, lint, audit, and build. This turn's exact local checks passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (10/10), `pnpm build`, `pnpm state:check` (249 IDs and unchanged source hash), `pnpm secrets:check` (84 source files), `pnpm audit --audit-level high` (no known vulnerabilities), and `git diff --check`. The initial lint process produced no new output during a long wait; the permitted rerun outside the sandbox passed. Remote CI for the new checkpoint will be checked after push.

Task-level Codex credits and provider dollar cost are unavailable; do not infer them from elapsed time. No passwords, paid upgrade, metered product dispatch, or subagents were created in this task.
