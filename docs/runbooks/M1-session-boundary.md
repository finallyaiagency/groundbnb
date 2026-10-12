# M1 server session check

The code and private verifier are ready. The sandbox cannot decrypt the previously saved SMTP capture files; a metadata-only approved escalation confirmed they are readable outside it. Codex can use that approved private path for the authorized bounded synthetic run. To run a separately authorized check manually, use a normal PowerShell terminal under the Windows account that saved the files:

```powershell
cd C:\Users\17044\Documents\Code\Groundbnb
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-m1-session-boundary.ps1
```

It reads the existing DPAPI-encrypted capture credentials privately and sends at most one captured OTP to each existing approved synthetic fixture (`preview-01@example.test`, `local-01@example.test`). No real recipient, password initialization, provider setting change, production login, paid dispatch or upgrade. The fixed worker checks managed SDK own-session, foreign-session refusal and post-signout refusal, then cleans up created sessions. The ten-minute run marker prevents automatic repetition. Credentials/codes/cookies stay in transient process memory and never enter the evidence output. The SDK uses temporary independent signing secrets solely inside this verifier; deployment secrets are not provisioned.

Only PASS/FAIL is displayed. Share that result; do not paste credentials or codes. Safe metadata is recorded in `.tmp/evidence/m1-01b-session-check.json` with the Git revision. The preview read uses the provider origin; this is a server-reader protocol check, not a deployed login/callback/browser pass. The product's login mode stays off.

On failure, preserve the attempt/evidence files and report FAIL; a new attempt needs investigation and explicit authorization. On timeout, confirm cleanup of the approved synthetic sessions before another run. If the saved capture files cannot be decrypted by their original Windows account, a replacement capture setup needs a separate handoff; do not repeat M0 passwords, SMTP configuration or production OTP requests.

Even a live reader PASS does not complete M1. App login/callbacks, account mapping/status/revocation, a separate restricted profile writer and durable transactions, MFA/step-up, membership and reservations remain pending.
