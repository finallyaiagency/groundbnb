# M0 production session handoff

Preview/local SMTP and genuine session rejection tests pass. SYS-11 still needs the reverse direction: a valid **production** session must be rejected by preview/local. Distinct issuer URLs and public signing keys alone cannot prove that.

Production Auth was empty on 2026-10-05. Use your own real identity, never a synthetic production fixture. This creates an ordinary Auth account, not application owner/admin privileges; those belong to M1's controlled bootstrap and MFA implementation.

## Client steps

1. In the prepared **production → Better Auth → Create user** form, enter your own real email/name and click Create. No password is requested. Do not promote the account.
2. Run the following locally. Codex must not open or inspect its private form.

```powershell
powershell -NoProfile -STA -File "C:\Users\17044\Documents\Code\Groundbnb\scripts\m0-production-session.ps1"
```

3. Enter the same email in the upper masked box. **Send one code** requests one production Neon sign-in email to your real inbox. Enter its six-digit code in the lower masked box within five minutes and click **Verify and sign out**.
4. Close the window and reply **done** or **failed**. Do not paste email, code, password or session token into chat.

The client action authorizes only this ordinary sign-in and deliberate session-cookie rejection checks against the three pinned Groundbnb Auth issuers. The worker first proves its session works on production, sends only its cookie to preview/local get-session, checks both return unauthenticated, then signs the new production session out and checks revocation. It does not revoke your other sessions, grant privileges, change a password, or copy your profile to test databases. Only booleans, timestamp, revision, fixed phase and HTTP status are saved in ignored `.tmp/evidence/m0-production-session.json`.

Only one email request and one verification attempt are allowed per form. An attempt marker blocks reopening until its evidence is reviewed. No automatic retry or replacement of a failure with a pass. Timeouts leave cleanup unknown and require review. Preparation/syntax checks are not a live production-session pass.

Provider references checked 2026-10-05: [Neon's Next.js Auth guide](https://github.com/neondatabase/neon-js/blob/main/packages/auth/NEXT-JS.md), [Better Auth Email OTP](https://better-auth.com/docs/plugins/email-otp), and [session management](https://better-auth.com/docs/concepts/session-management). These support the OTP/session API; actual rejection requires the bounded real check above.
