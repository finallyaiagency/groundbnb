# M0 direct roles, historical baseline recovery and SMTP preparation — 2026-10-05

Base/test revision: `e5abf0ab30a76f049454c166956af6292afc6d96`. Client reported **role checks done**. D-006 privileges and A-001/D-004 recovery amendment remain unchanged. This checkpoint is partial M0 evidence; SYS-11 remains Blocked, LEG-10/LEG-12 remain Not started, and M1 has not begun.

## Real direct credentials

The client ran `scripts/verify-m0-credentials.ps1`, entering existing passwords in hidden local prompts. Its credential-free result file reports UTC `2026-10-05T12:30:35.3693190Z` and the exact base revision:

| Environment | Restricted role | Result |
| --- | --- | --- |
| local | groundbnb_local_probe | PASS: real login, metadata identity, baseline and catalog safeguards |
| production | groundbnb_production_probe | PASS: real login, metadata identity, baseline and catalog safeguards |
| recovery | groundbnb_recovery_reader | PASS: same checks plus recovery events SELECT/no-write catalog safeguards |

Passwords were transient child-process stdin, not saved/read by Codex. These are read-only queries, not attempted-write denial tests. No profile/auth/event payloads were read. Local/production/recovery checks do not bind credentials to an application or deploy production.

Preview `dpl_BFh5e6iqaavYZ8YSFQFXsdVwkLoN` is Ready at the same SHA. Protected `/api/health` was checked at `2026-10-05T12:39:11Z`: HTTP 200, Cache-Control no-store, environment preview, exact revision and branch `br-bitter-hall-b8ibnrfy`, status database_ready/database verified. Real preview-role identity/catalog assertions pass; authIsolation/emailIsolation are explicitly unverified. [Verify 37309688270](https://github.com/finallyaiagency/groundbnb/actions/runs/37309688270) passed at this SHA. All four direct role logins now have live evidence.

## Historical baseline restore in quarantine

At about `2026-10-05T12:36Z`, production's Restore console showed a six-hour window, with earliest time Oct 5 02:36 EDT. This is a live available-point observation, not proof under representative writes.

Created `groundbnb-m0-restore-quarantine-20261005` (`br-cool-frost-b8sacwyc`) from **groundbnb-schema-template** (`br-frosty-poetry-b8ti8mml`) at historical point **2026-10-05 02:40 EDT / 06:40 UTC**. Creation started `12:38:49.231Z`; console created time 08:38:49 EDT and success toast “Branch forked in 0.34 sec”. The requested point was approximately 5h58m49s old. This was a historical fork of the empty baseline, not a production restore or clone of the unreviewed snapshot.

Restored branch compute `ep-soft-base-b8lyy27a`, database groundbnb. Overview shows Auth Get started (not enabled), and no app deployment/credential binding exists. No environment-identity row means the existing app probe would fail closed. No workers, mail configuration or metered dispatch were activated. Auto-delete Never; retain this quarantine for evidence, then remove obsolete resources within seven days of PR closure under the runbook's cleanup/confirmation rules.

Read-only operator SQL on this exact branch:

```sql
SELECT current_database() AS database_name,
 (SELECT count(*) FROM groundbnb.schema_migrations
  WHERE version = '0001_environment') AS baseline_rows,
 (SELECT count(*) FROM groundbnb.environment_identity) AS identity_rows,
 (SELECT count(*) FROM groundbnb.synthetic_identities) AS synthetic_rows,
 to_regnamespace('neon_auth') IS NULL AS auth_schema_absent,
 to_regnamespace('recovery_control') IS NULL AS controls_schema_absent;
```

Observed groundbnb / 1 / 0 / 0 / true / true. Query 126 ms, one row. Observation completed `12:45:45.121Z`, **6m55.890s** from creation start including intervening agent work. The provider's 0.34-second fork timing and this elapsed observation measure different stages. This passes the bounded M0 historical-baseline primitive; it does not establish representative production restore time, the full six-hour horizon, or deleted-account/session/bootstrap replay. The separate recovery-control branch was not restored. HMAC key placement/availability remains open; missing ledger/key must block reopening.

Restore inventory: the existing manual snapshot named preview at `2026-09-29 06:48:57 UTC` remains about 39.4 MB, Expires never, contents unknown. It was neither opened, restored nor removed. It is excluded from preview/local/quarantine parents and may extend future control retention until its capable contents and expiry are resolved.

Ignored screenshots: `.tmp/evidence/m0-production-history-2026-10-05.png`, `.tmp/evidence/m0-quarantine-restore-2026-10-05.png`.

## Auth/email observations and concrete handoff

Preview Auth still has no users. Configure Auth shows distinct preview issuer, no trusted domains, localhost off, email signup off/signin on, Google Shared keys, shared email `auth@mail.myneon.app`, webhooks off. Holding-app login off does not prove that the directly accessible Auth service rejects production sessions; Shared Google remains a separate direct sign-up path. No new signup exposure or Auth deletion was performed. Provider offers Shared or Custom SMTP, with no built-in capture option.

Prepared two distinct free Ethereal capture accounts using exact official `nodemailer@10.0.15` development dependency. One synthetic recipient (`preview-01@example.test` / `local-01@example.test`) SMTP submission each was accepted at `12:50:01.351Z` / `12:50:03.820Z`, with required STARTTLS and certificate validation. These submissions contain no auth tokens or customer data. Provider documentation says capture never delivers to recipients; no mailbox-content or Neon-generated-message observation is claimed. No production email provider changed.

Account credentials are Windows DPAPI CurrentUser encrypted in ignored `.env.m0-smtp-preview.dpapi` / `.env.m0-smtp-local.dpapi`, with only whitelisted pass/time/check metadata in `.tmp/evidence/m0-smtp-capture.json`. Codex did not read/decrypt credentials. Direct child invocation without its private-wrapper flag exits before network use. The client-only local viewer supplies Copy buttons without printing credentials to chat; Codex must not run its Show mode. Temporary capture account expiry/rate limits remain a limitation.

Prepared, unsaved preview Custom SMTP form: host smtp.ethereal.email, port 587, sender name Groundbnb preview; username/password/sender email blank. Browser credential-entry policy requires client entry and Save, then the separate local branch. Exact handoff: `docs/runbooks/M0-email-capture.md`. Ignored proof `.tmp/evidence/m0-smtp-handoff-2026-10-05.png`. Until saved and live-tested, emailIsolation remains unverified. Real cross-environment sessions, remaining destination binding, and external recovery-key placement remain independent M0 work.

## Checks, defects and usage

Node syntax and PowerShell parser passed. Private-wrapper guard exits 1 with only sanitized JSON before network use; encrypted files are ignored by Git. Required lint/typecheck/build and all 16 tests passed; audit reports no known vulnerabilities. Documentation check: 249 IDs and frozen hash unchanged; secret scan: 97 source files; git diff --check passed; usage CSV parses three records. The client-only viewer was syntax checked, not opened by Codex. pnpm automatically added an exact nodemailer@10.0.15 release-age exception, retaining the existing audit gate. Initial sandbox pnpm typecheck/test aborted before running because its dependency-directory context differed; permitted runs in the installed environment passed.

No paid upgrade or metered product dispatch. Two capture-only SMTP submissions. Neon UI shows six of ten branches; rounded provider usage is not precise task usage. Codex credits and actual task-attributable provider cost unavailable; no invented values. The prior three-password handoff is complete and must not be repeated.

## Published checkpoint

Implementation/evidence checkpoint `51383760fc073a361ecbf651b56f6e43a1d9cde5` pushed to the existing draft-PR branch. [Verify 37313570912](https://github.com/finallyaiagency/groundbnb/actions/runs/37313570912) completed successfully. Preview `dpl_3JT8nfLd1YpLbf1SmV3qeBqWeoGw` is Ready at this exact SHA. Protected health checked `2026-10-05T13:02:37Z`: HTTP 200/database_ready, branch br-bitter-hall-b8ibnrfy, exact SHA, no-store; auth/email unverified. This follow-up records published results only; application code and credentials are unchanged.
