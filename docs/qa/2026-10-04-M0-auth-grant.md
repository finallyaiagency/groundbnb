# M0 approved auth grant — 2026-10-04

Base revision: `49ba905`. Client replied "I approve" to the exact Q-004 request. D-005 records the grant and branch scope. Frozen source and A-001 remain unchanged.

## Live transaction evidence

The first preview transaction refused to grant because the prepared guard incorrectly assumed the managed `neon_service` role was NOLOGIN. ROLLBACK succeeded. Read-only preflight showed `rolcanlogin=true`, `rolsuper=false`, and CREATE=false. Neon's [current role documentation](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md), checked 2026-10-04, identifies this internal role as provider-managed; its credentials must not be used or modified by the app.

Corrected that assumption and strengthened the guard to require the exact approved kind/branch pair. No role attribute changed. Both transactions returned BEGIN, DO, GRANT, COMMIT success. No production SQL or credential changed.

| Check | Preview | Local |
| --- | --- | --- |
| Branch | `br-bitter-hall-b8ibnrfy` | `br-rough-flower-b8lerkcf` |
| Database/operator | groundbnb / neondb_owner | groundbnb / neondb_owner |
| Persisted environment kind | preview | local |
| Synthetic fixtures | 1 | 1 |
| Managed service CREATE after grant | true | true |
| Auth enablement | succeeded | succeeded |
| Auth users / sessions / linked accounts | 0 / 0 / 0 | 0 / 0 / 0 |
| Email signup | off | off |
| Localhost redirect permission | off | on, local only |

Preview Auth URL: `https://ep-red-night-b8pf2mdl.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth`.
Local Auth URL: `https://ep-calm-sound-b8s8ckur.neonauth.c-14.us-east-1.aws.neon.tech/groundbnb/auth`.
Both differ from the previously recorded production URL. These are provider provisioning observations, not live application session-isolation evidence.

Preview email configuration offers Shared or Custom SMTP; the latter requires host/port/credentials/sender. Inspection was canceled without saving. Shared delivery remains configured; email capture has not been provisioned. No email, user registration, or product dispatch was performed. Google shared keys remain a provider default; no trusted preview callback origin or app binding exists yet. Do not treat the GROUND_EMAIL_MODE contract as an enforced provider restriction.

Vercel's branch-filtered environment query returned zero variables and hiddenProductionEnvCount=0. App connectivity remains blocked on restricted credentials.

## Recovery inventory observation

At about 11:05 EDT, the local branch's Restore page defaulted its source to production. It displayed the earliest production restore time as Oct 4, 2026 05:05 EDT and a six-hour window. Date picker granularity was one minute; no sub-minute or latest durable-point guarantee was shown. No restore was submitted. This observation does not prove retention under representative writes or the recovery-time target.

The same page showed an existing manual snapshot named `preview at 2026-09-29 06:48:57 UTC (manual)`, 39.4 MB, expiry never. Its contents are unknown and predate repository/environment cleanup. Preserve it as unreviewed historical recovery material; do not clone it into preview/local or reopen it as service. Its perpetual expiry must be included in future LEG-12 control retention/inventory decisions. No snapshot was deleted or restored.

## Next dependency and proposal

Q-005 covers `db/operations/prepare-m0-readonly-roles.sql`, not yet executed. It proposes SQL-created, passwordless NOLOGIN principals:

- Production/preview/local probe roles: CONNECT, groundbnb schema USAGE, SELECT on identity and migration metadata only.
- Recovery reader: same metadata plus SELECT on the separate recovery-control events table.

No app write, auth-table, role membership, schema-create, or future-table grant is proposed. SQL creation avoids the automatic broad neon_superuser membership of Console/API-created roles. Explicit branch guards and role-collision refusal are included. Actual effective grants/denials must be checked after approval; this unexecuted SQL is not live verification. Client must enter distinct passwords directly during credential activation under browser handoff policy. The recovery credential/key must stay outside application previews and restored snapshots.

M0 remains incomplete. SYS-11 stays Blocked on Q-005, with the earlier Q-004 blocker resolved. M1 has not begun. Timed quarantined baseline restore and complete live session/email isolation remain outstanding; LEG-12 account replay stays M8.

## Checks and usage

Exact repository checks passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (10/10), `pnpm build`, `pnpm state:check` (249 IDs and frozen hash unchanged), `pnpm secrets:check` (80 source files), `pnpm audit --audit-level high` (no known vulnerabilities), and `git diff --check`. The unexecuted role proposal still needs live grant/denial evidence. Prior Linux CI at `51aa557` remains the latest recorded passing CI; this checkpoint's remote result will be checked after push.

No paid upgrade, metered product calls, or subagents. Task-specific Codex credits and provider dollar cost are unavailable; no values inferred. Approval request for Q-005 was presented after the concrete SQL proposal and checks were complete.
