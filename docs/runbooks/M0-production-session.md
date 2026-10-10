# M0 production session handoff

Status: **Completed October 6**. Actual ordinary production own-session, preview/local rejection and sign-out pass at ac7f91f. Final M0 exit is `docs/qa/2026-10-06-M0-complete.md`. Steps below are preserved procedure; do not request another code for the completed M0 gate.

Preview/local SMTP and genuine session rejection tests pass. SYS-11 still needs the reverse direction: a valid **production** session must be rejected by preview/local. Distinct issuer URLs and public signing keys alone cannot prove that.

Production Auth was empty on 2026-10-05. Use your own real identity, never a synthetic production fixture. This creates an ordinary Auth account, not application owner/admin privileges; those belong to M1's controlled bootstrap and MFA implementation.

## Client steps

1. Use your existing ordinary production Auth account. If it has not been created yet, enter your own real email/name in **production → Better Auth → Create user** and click Create. No password is requested. Do not promote the account.
2. Open the prepared [private local browser page](http://127.0.0.1:4317/). The Windows popup was not visible to the client; this page supersedes it. Codex may open the blank page but must never inspect it after client input, enter values, click its controls or receive your inputs. It binds only 127.0.0.1 and closes after thirty minutes. If it has expired, start it locally:

```powershell
node "C:\Users\17044\Documents\Code\Groundbnb\scripts\m0-production-session-web.mjs"
```

3. Enter the same email. **Send one code** requests one production Neon sign-in email to your real inbox. Enter its six-digit code in the masked code box within five minutes and click **Verify and sign out**.
4. Close the page and reply **done** or **failed**. Do not paste email, code, password or session token into chat. Use only this browser page; do not operate any earlier popup.

The client action authorizes only this ordinary sign-in and deliberate session-cookie rejection checks against the three pinned Groundbnb Auth issuers. The worker first proves its session works on production, sends only its cookie to preview/local get-session, checks both return unauthenticated, then signs the new production session out and checks revocation. It does not revoke your other sessions, grant privileges, change a password, or copy your profile to test databases. Only booleans, timestamp, revision, fixed phase and HTTP status are saved in ignored `.tmp/evidence/m0-production-session.json`.

Only one email request and one verification attempt are allowed per handoff. Browser and legacy popup use the same atomic attempt marker, blocking concurrent requests and repetition until evidence is reviewed. The browser endpoint requires the exact Host, Origin, JSON content type and unpredictable per-process CSRF nonce; CSP prevents external scripts/framing, responses are no-store, and request bodies are not logged. Client inputs stay in transient local memory/private child stdin. No automatic retry or replacement of a failure with a pass. Timeouts leave cleanup unknown and require review. Preparation/syntax checks are not a live production-session pass.

If no email arrives, distinguish an accepted API request from actual inbox delivery. The helper now saves the fixed sendAccepted boolean, HTTP status and phase, with deliveryConfirmed null; it never saves the recipient or response body. An earlier attempt at 2026-10-06 02:43:15Z saved only a pre-request marker, so its send response is unavailable. Client reported no code; preserve that failure before one client-controlled diagnostic retry. Do not infer a successful send from that marker. Production was observed on Shared email with one visible Auth user; the exact inbox address is client-confirmed privately, not read by Codex. Check Spam/Junk for Neon's shared sender. [Neon's production checklist](https://neon.com/docs/auth/production-checklist) supports codes on shared SMTP but describes rate limits and recommends custom production delivery; this does not establish the cause of this missing email.

Provider references checked 2026-10-05: [Neon's Next.js Auth guide](https://github.com/neondatabase/neon-js/blob/main/packages/auth/NEXT-JS.md), [Better Auth Email OTP](https://better-auth.com/docs/plugins/email-otp), and [session management](https://better-auth.com/docs/concepts/session-management). These support the OTP/session API; actual rejection requires the bounded real check above.
