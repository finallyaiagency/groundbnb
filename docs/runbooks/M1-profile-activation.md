# M1 profile activation — prepared, not enabled

This is a synthetic preview/local foundation. Production/recovery are excluded. Apply only after action-time approval of migration 0002 and the two exact function grants. D-008 approved dormant roles only; it did not approve profile access or passwords.

## Approved migration gate

Run `db/migrations/0002_profile_foundation.sql` separately on groundbnb-local br-rough-flower-b8lerkcf and groundbnb-preview br-bitter-hall-b8ibnrfy, database groundbnb. It rejects any other branch, absent baseline/dormant app role or fixture inventory beyond the sole approved verified synthetic identity. It creates normalized tables and binds the pre-existing fixture as an ordinary member. Application roles receive EXECUTE on read_profile/save_profile only, with no direct table/Auth rights.

Run `db/operations/verify-m1-profile-foundation.sql` as the operator. Fixture mutations, replay/conflict/isolation/suspension/revocation and acknowledgment-failure injection are inside a rolled-back transaction. Only invariant labels and metadata counts/ACL booleans are output. Confirm one account and zero retained operations afterward. This proves database function behavior as operator, not application login or browser authentication.

## Client credential activation — later human handoff

Browser policy requires the client to enter and submit new credentials. Do not repeat M0 passwords; these are two new, separate application roles. Generate and save a different random password of at least 24 letters/numbers for each in the client's password manager. In each pinned SQL Editor/database, the client alone replaces the placeholder and runs:

```sql
-- Local only:
ALTER ROLE groundbnb_local_app WITH LOGIN PASSWORD 'REPLACE_WITH_NEW_LOCAL_APP_PASSWORD';
-- Preview only:
ALTER ROLE groundbnb_preview_app WITH LOGIN PASSWORD 'REPLACE_WITH_NEW_PREVIEW_APP_PASSWORD';
```

Clear the password-containing editor before returning browser control. Do not paste a password or connection string into chat/Git. Do not remove the read-only default or change grants. The application explicitly opens a read/write transaction for its bounded profile function call.

After credential activation, run `powershell -NoProfile -File scripts/verify-m1-profile-credentials.ps1` from the repository. Enter only these two new app passwords at the hidden prompts. The helper verifies pinned direct login, exact role attributes, migration and function/table/helper ACLs. It outputs pass/fail and saves only whitelisted metadata in ignored `.tmp/evidence/m1-profile-credentials.json`; passwords/URLs are not persisted. This read-only helper does not prove profile writes or browser authentication.

Local and preview bindings use server-only `GROUND_PROFILE_DATABASE_URL`, never overwrite the health probe's `GROUND_DATABASE_URL`. Pooled hosts: local ep-calm-sound-b8s8ckur-pooler.c-14.us-east-1.aws.neon.tech; preview ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech. Database groundbnb; query options sslmode=require&channel_binding=require. Preview Secret must be restricted to the existing preview Git branch and never Production. A dedicated private binding/direct-test helper and blank preview Secret form must be prepared before requesting the credential/binding handoff.

Keep `GROUND_PROFILE_MODE=off` and app login off until direct credentials/catalog and an isolated application-session flow pass. The route also requires session-check configuration and a separate signing secret. Browser/callback issuance, full typed profile fields, additional real synthetic account isolation, MFA/admin/bootstrap and recovery control binding remain open. No requirement is Verified from this runbook.
