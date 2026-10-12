# M0 preview credential activation follow-up — 2026-10-04

Base revision: `7652587` (first-password handoff correction). The client replied **done** to the preview SQL/password handoff. Codex inspected only a cleared editor and executed password-free read-only catalog queries as `neondb_owner`, database `groundbnb`. No password, password hash, connection string, or saved password query was read. The password-query history title was visible but its content was never opened.

## Live observations

| Environment | Pinned branch | Role | LOGIN | Metadata SELECT | Metadata UPDATE | neon_superuser membership |
| --- | --- | --- | --- | --- | --- | --- |
| preview | br-bitter-hall-b8ibnrfy | groundbnb_preview_probe | true | true | false | false |
| local | br-rough-flower-b8lerkcf | groundbnb_local_probe | false | true | false | false |
| production | br-small-meadow-b8lh69jr | groundbnb_production_probe | false | true | false | false |
| recovery | br-round-field-b8d4v5o4 | groundbnb_recovery_reader | false | true | false | false |

Preview additionally reports false for SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, and BYPASSRLS. Its operator query returned one row, 115 ms; local 75 ms, production 58 ms, recovery 127 ms. These are console-reported query durations, not app latency measurements. Browser query-history labels show 2026-10-04 around 22:13–22:14; no timezone is inferred.

The follow-up query used on local, production, and recovery was:

```sql
SELECT e.kind, e.branch_id, r.rolname, r.rolcanlogin,
       has_table_privilege(r.oid, 'groundbnb.environment_identity', 'SELECT') AS metadata_read,
       has_table_privilege(r.oid, 'groundbnb.environment_identity', 'UPDATE') AS metadata_write,
       pg_has_role(r.oid, 'neon_superuser', 'MEMBER') AS neon_admin
FROM groundbnb.environment_identity e JOIN pg_roles r ON r.rolname = CASE e.kind
  WHEN 'production' THEN 'groundbnb_production_probe'
  WHEN 'preview' THEN 'groundbnb_preview_probe'
  WHEN 'local' THEN 'groundbnb_local_probe'
  WHEN 'recovery' THEN 'groundbnb_recovery_reader' END
WHERE e.singleton;
```

## Limits and required handoff

LOGIN=true confirms preview activation only. It does not prove password authentication, direct role denial behavior, app connectivity, email capture, production-session rejection, or recovery. SYS-11 stays Blocked. The other three branches require client-entered distinct passwords and LOGIN using `docs/runbooks/M0-credential-handoff.md`; browser credential policy requires the client to enter and submit these. No further role approval or grant change is needed. Keep every credential out of Git/chat and clear the editor after each secret-containing statement.

No provider role/grant, application code, dependency, deployment, frozen source, or amendment was changed by Codex. Metered dispatch remains disabled and no paid upgrade or subagent was used. Task-specific credits/provider cost are unavailable; no values are inferred.

Prepared the next local statement with an obvious password placeholder only, without executing it. The retained handoff tab identifies groundbnb-local / groundbnb. Local screenshot: `.tmp/evidence/m0-local-password-next.png` (ignored, no secret). The user also retains their preview tab. Clear the editor after each completed secret statement before returning control.

## Repository checks

Passed locally: `pnpm state:check` (249 IDs, frozen hash unchanged), `pnpm secrets:check` (86 files), and `git diff --check`. [GitHub Verify run 37243473480](https://github.com/finallyaiagency/groundbnb/actions/runs/37243473480) reports completed/success at base revision `7652587169ed348bd1f3dd9f060b93f8e465f9cf`. Runtime checks are not repeated for this evidence-only update; preceding local lint/typecheck/test/build results are recorded in `docs/qa/2026-10-04-M0-password-initialization.md`. No live direct-role authentication test is claimed.
