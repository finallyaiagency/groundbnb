# M0 credential setup — client handoff

The four approved database roles exist on **four separate branches**. A branch's Roles page shows its own role and `neondb_owner`, not all four roles together. Browser confirmation policy requires **you** to enter each new password and complete activation.

Progress checked 2026-10-04 after the client's **all three done**: all four LOGIN settings are enabled on their correct branches. Password authentication itself has not yet been tested. Do not repeat the initialization steps below; they remain the recovery reference. See `docs/qa/2026-10-04-M0-active-credentials.md`.

## Next: bind only the preview credential

2026-10-05 update: preview Secret saved by the client; initial Production scope corrected without reading its value. Live deployed health now passes direct preview-role login, metadata identity/baseline and restricted catalog assertions. No need to enter the preview Secret again. See `docs/qa/2026-10-05-M0-preview-secret.md`.

### Next manual step: check the other three existing passwords

Run `scripts/verify-m0-credentials.ps1` in PowerShell from this repository. It prompts with hidden input for local / groundbnb_local_probe, production / groundbnb_production_probe, then recovery / groundbnb_recovery_reader. Enter the different passwords already set for those roles. This performs read-only metadata checks at the three fixed, verified Neon hosts, including recovery-control SELECT/no-write catalog privileges. It creates no credential file, changes no role/grant/data, and saves only whitelisted pass/fail evidence in ignored `.tmp/evidence/m0-direct-roles.json` with the Git revision and UTC check time. Driver/raw errors are suppressed. Report **role checks done**; do not send passwords. This is direct authentication and catalog evidence, not an attempted-write denial or session/email isolation proof. Credentials are transient in the local child process; they are not persisted as app configuration by this command.

Codex saved the 16 public preview settings and prepared a blank [Vercel Secret form](https://vercel.com/finally-ais-projects/groundbnb/settings/environment-variables?create=true). Key: `GROUND_DATABASE_URL`. Type: **Secret**. Environment: **only** `codex/m0-01-environment-contract` under Preview Branches; Production, all-Preview and Development are unselected.

Use username `groundbnb_preview_probe`, the saved **preview** password, pooled host `ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech`, database `groundbnb`, and query options `sslmode=require&channel_binding=require`. The complete placeholder URL is in `.env.example`; replace its password only in the Vercel Value field. URL-encode punctuation in the password; the recommended generated letters/numbers need no encoding. Click Save yourself, close the form and reply **preview secret saved**. Never paste the completed URL into chat or Git. Codex will redeploy and verify connectivity/identity afterward.

Production/recovery passwords are not needed in Vercel Preview. Local binding/direct tests and recovery-control credential/key placement remain separate M0 work. No app sign-in or real email delivery is enabled by this binding.

## First-password reference (already completed)

Correction: the client reported **cannot update password for role without password** when using Reset password on the preview role. These roles were created without passwords, so initialize the first password using SQL. The previous Reset password instruction was incorrect for this state. [Neon's SQL instructions](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md) support setting a chosen password with ALTER USER/ROLE; [PostgreSQL ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html) supports LOGIN and PASSWORD together.

For each row below:

1. Open the branch below, then **SQL Editor**. Choose database `groundbnb` and operator role `neondb_owner` if a role selector is shown.
2. Generate and save a **different random password of at least 24 letters/numbers** for each role in your password manager. Letters/numbers avoid SQL quote-escaping problems.
3. Copy the statement for that branch into SQL Editor. Replace `REPLACE_WITH_YOUR_NEW_PASSWORD` inside the single quotes with your generated password, then click **Run** yourself. This initializes the password and enables login without changing the role's grants.
4. Clear the SQL editor before handing the browser back to Codex. Do not share the secret-containing query, screenshot, password, or connection string in chat, Git, or task documents. A local SQL client using a hidden password prompt is also supported if you already use one.

| Branch and Roles page | Exact role | First-password and login statement — client executes |
| --- | --- | --- |
| [groundbnb-preview](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-bitter-hall-b8ibnrfy/roles) | `groundbnb_preview_probe` | `ALTER ROLE groundbnb_preview_probe WITH LOGIN PASSWORD 'REPLACE_WITH_YOUR_NEW_PASSWORD';` |
| [groundbnb-local](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-rough-flower-b8lerkcf/roles) | `groundbnb_local_probe` | `ALTER ROLE groundbnb_local_probe WITH LOGIN PASSWORD 'REPLACE_WITH_YOUR_NEW_PASSWORD';` |
| [production](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-small-meadow-b8lh69jr/roles) | `groundbnb_production_probe` | `ALTER ROLE groundbnb_production_probe WITH LOGIN PASSWORD 'REPLACE_WITH_YOUR_NEW_PASSWORD';` |
| [groundbnb-recovery-controls](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-round-field-b8d4v5o4/roles) | `groundbnb_recovery_reader` | `ALTER ROLE groundbnb_recovery_reader WITH LOGIN PASSWORD 'REPLACE_WITH_YOUR_NEW_PASSWORD';` |

Tell Codex **passwords set and roles activated**, naming any incomplete row. No secret is needed in your reply. This completes credential activation only; it does not deploy or copy credentials. Codex will then prepare the destination-specific binding and direct credential checks. The recovery credential stays outside app previews and production restore snapshots.

If SQL fails, report only the error text without its secret-containing statement. Do not create a replacement role through **Add role**; Console-created roles receive broad admin membership and would invalidate the approved access scope. Direct password authentication remains unverified until the credential checks pass.
