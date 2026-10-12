# M1 profile activation — database foundation passed, app off

This is a synthetic preview/local foundation. D-009/Q-008 approved migration 0002 and the two exact function grants; both committed and operator checks passed at b236d01. Do not run the migration again. Both app roles now pass genuine login/catalog checks. D-010 approved reuse of the existing credentials; encrypted bindings and exact preview Secret metadata pass. Do not repeat password setup. The earlier browser setup blocker is resolved.

## Completed migration gate — reference only

Migration `db/migrations/0002_profile_foundation.sql` was run separately on groundbnb-local br-rough-flower-b8lerkcf and groundbnb-preview br-bitter-hall-b8ibnrfy, database groundbnb. It rejects any other branch, absent baseline/dormant app role or fixture inventory beyond the sole approved verified synthetic identity. It creates normalized tables and binds the pre-existing fixture as an ordinary member. Application roles receive EXECUTE on read_profile/save_profile only, with no direct table/Auth rights.

Run `db/operations/verify-m1-profile-foundation.sql` as the operator. Fixture mutations, replay/conflict/isolation/suspension/revocation and acknowledgment-failure injection are inside a rolled-back transaction. Only invariant labels and metadata counts/ACL booleans are output. Confirm one account and zero retained operations afterward. This proves database function behavior as operator, not application login or browser authentication.

## Historical client credential handoff — completed through D-010

Browser policy requires the client to enter and submit new credentials. Do not repeat M0 passwords; these are two new, separate application roles. Generate and save a different random password of at least 24 letters/numbers for each in the client's password manager. In each pinned SQL Editor/database, the client alone replaces the placeholder and runs:

```sql
-- Local only:
ALTER ROLE groundbnb_local_app WITH LOGIN PASSWORD 'REPLACE_WITH_NEW_LOCAL_APP_PASSWORD';
-- Preview only:
ALTER ROLE groundbnb_preview_app WITH LOGIN PASSWORD 'REPLACE_WITH_NEW_PREVIEW_APP_PASSWORD';
```

Clear the password-containing editor before returning browser control. Do not paste a password or connection string into chat/Git. Do not remove the read-only default or change grants. The application explicitly opens a read/write transaction for its bounded profile function call.

After credential activation, run these commands from `C:\Users\17044\Documents\Code\Groundbnb`:

```powershell
powershell -NoProfile -File scripts/verify-m1-profile-credentials.ps1 -SavePrivateBinding
powershell -NoProfile -File scripts/bind-m1-profile.ps1 -Kind local
powershell -NoProfile -File scripts/bind-m1-profile.ps1 -Kind preview
```

Only run the binding commands after both checks report PASS. If either fails, stop and report only failure. Enter only the two new app passwords at the hidden prompts. The checker verifies pinned direct login, exact role attributes, migration and function/table/helper ACLs. It outputs pass/fail and saves only whitelisted metadata in ignored `.tmp/evidence/m1-profile-credentials.json`. With `-SavePrivateBinding`, only passed bindings are saved encrypted with Windows CurrentUser DPAPI in ignored `.env.m1-profile-local.dpapi` and `.env.m1-profile-preview.dpapi`. It rejects matching passwords and requires at least 24 characters; symbols are supported. No password/URL is printed. Without the switch it persists no credential. This read-only check does not prove profile writes or browser authentication.

The local binding command preserves existing `.env.development.local` settings, adds the separate server-only profile URL and keeps `GROUND_PROFILE_MODE=off`. The preview command verifies the exact linked Groundbnb project/team, sends only the preview URL over Vercel CLI stdin, and creates a Secret restricted to `codex/m0-01-environment-contract`. It suppresses CLI output, does not deploy and does not enable profile mode. If the CLI fails, stop and report only failure; Codex will inspect metadata before any retry. The preview Secret is now saved and metadata verified. The earlier empty dashboard form is superseded; do not submit it.

Local and preview bindings use server-only `GROUND_PROFILE_DATABASE_URL`, never overwrite the health probe's `GROUND_DATABASE_URL`. Pooled hosts: local ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech; preview ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech. Database groundbnb; query options sslmode=require&channel_binding=require. Preview Secret must be restricted to the existing preview Git branch and never Production. Dedicated private binding/direct-test helper and blank preview Secret form are prepared. Existing credentials were reused and bound only after specific D-010 approval. No password was changed or disclosed.

Keep `GROUND_PROFILE_MODE=off` and app login off until direct credentials/catalog and an isolated application-session flow pass. The route also requires session-check configuration and a separate signing secret. Browser/callback issuance, full typed profile fields, additional real synthetic account isolation, MFA/admin/bootstrap and recovery control binding remain open. No requirement is Verified from this runbook.

## Existing-connection recovery path (completed)

The client approved reading only the existing restricted connections from Neon. The visible snippets were encrypted with a public RSA OAEP key before leaving the browser runtime; only ciphertext files were transferred. `import-m1-existing-connections.ps1` decrypts privately, invokes the pinned direct verifier, encrypts passed bindings with Windows CurrentUser DPAPI and emits only safe metadata. The private transport key is also DPAPI encrypted. Child credentials use stdin, not process arguments. Local/preview direct checks, distinctness and bindings pass; no further password handoff is needed. Never use this path for other roles/projects or without explicit authorization. Preserve failed evidence; do not resend OTP checks.
