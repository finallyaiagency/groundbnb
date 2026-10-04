# M0 credential setup — client handoff

The four approved database roles exist on **four separate branches**. A branch's Roles page shows its own role and `neondb_owner`, not all four roles together. Browser confirmation policy requires **you** to enter each new password and complete activation.

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

If SQL fails, report only the error text without its secret-containing statement. Do not create a replacement role through **Add role**; Console-created roles receive broad admin membership and would invalidate the approved access scope. Successful first-password initialization remains unverified until the client completes it.
