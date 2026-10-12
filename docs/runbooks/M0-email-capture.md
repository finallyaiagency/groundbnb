# M0 preview/local email capture handoff

Use only the synthetic `groundbnb-preview` and `groundbnb-local` branches. Keep production's provider separate. App login, scheduled work and metered dispatch remain off until their independent gates pass.

The [official Ethereal guide](https://nodemailer.com/guides/testing-with-ethereal), checked 2026-10-05, describes free SMTP capture with no delivery to recipients. Accounts are temporary and have development rate limits. Never put customer information, production authentication tokens or real bootstrap emails in these mailboxes. Capture still stores synthetic message contents with this third party.

## Prepared credentials

`scripts/m0-smtp.ps1 -Mode Prepare` was run once on 2026-10-05. Both client configuration handoffs are now complete. One original SMTP smoke message and one new Neon test message were captured per distinct account, with zero cross-recipient messages. See docs/qa/2026-10-05-M0-email-sessions.md. Do not repeat credential entry or replace accounts automatically.

Credentials are Windows DPAPI CurrentUser encrypted in ignored `.env.m0-smtp-preview.dpapi` and `.env.m0-smtp-local.dpapi`. They are outside Neon snapshots and are not application environment files. Never print decrypted values, open them in an agent response, or add them to Git. They are tied to this Windows user/machine; they are not portable disaster backups. The private Prepare child writes credentials only into the parent process's captured pipe; direct invocation without its wrapper flag refuses before network use. Raw provider errors are suppressed. The exact development dependency is `nodemailer@10.0.15`; it is not imported by the application.

The private Verify mode may unseal the existing accounts directly into transient worker stdin for read-only IMAP at the same Ethereal service. It returns only fixed-field counts/booleans, never credentials, subjects, addresses, message IDs or bodies. The worker pins imap.ethereal.email:993, validates account kinds/distinctness before connecting, requires certificate validation, disables protocol logging and caps mailbox inspection at ten synthetic messages. This continues the approved capture verification without a new credential-entry handoff. `Show` remains client-only. ImapFlow is an exact development dependency; its official read-only mailbox/envelope API was checked on 2026-10-05.

## Client action

The following SMTP handoff is complete and retained for maintenance. Current client action is docs/runbooks/M0-production-session.md. Private VerifyAuth uses documented Neon/Better Auth OTP sign-in for the existing ordinary synthetic fixtures, fresh get-session, foreign-cookie rejection, fixture-only prior-session cleanup and signout. Codes/cookies are transient private values; no passwords are initialized. Three failed diagnostics are retained; final preview/local run passed. This does not prove production-to-preview rejection. Run timestamps/expiry and attempt evidence prevent automatic repeated submissions.

Run this locally; do not paste its contents or passwords into chat:

```powershell
powershell -NoProfile -STA -File "C:\Users\17044\Documents\Code\Groundbnb\scripts\m0-smtp.ps1"
```

The local window has **preview** and **local** tabs, with Copy buttons. Passwords are masked until copied. Copying a field places it on the local clipboard; replace the clipboard with harmless text when finished.

1. On Neon, select **groundbnb-preview** (`br-bitter-hall-b8ibnrfy`) → Better Auth → Configure Auth → Configure email provider → Custom SMTP provider. The prepared form already has host `smtp.ethereal.email`, port `587`, and sender name `Groundbnb preview`.
2. From the local window's **preview** tab, copy **Username**, **Password**, and **Sender email** into matching fields. Confirm host/port/name, then click Save yourself. Browser credential-entry policy requires the client to perform entry and submission.
3. Select **groundbnb-local** (`br-rough-flower-b8lerkcf`) and repeat with the **local** tab, host `smtp.ethereal.email`, port `587`, and sender name `Groundbnb local`. These accounts must remain distinct.
4. Reply **SMTP saved**. Codex can read back provider/host metadata and continue the bounded Neon-generated synthetic-message and session-isolation checks. It must not reveal the saved SMTP password.

Do not rerun Prepare to replace existing credentials. Expired/unavailable capture accounts require a fresh explicit replacement handoff; email isolation remains unverified until the replacement is saved and tested. There is no paid upgrade or production mail configuration in this procedure.
