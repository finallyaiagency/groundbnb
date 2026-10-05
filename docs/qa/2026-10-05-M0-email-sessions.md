# M0 email capture, synthetic sessions and recovery key

Implementation based on `9112cefdde2de1e573c48a3288faa539a9f7ad12`, working scripts in this checkpoint. Frozen source and stable IDs preserved. Supersedes the pending SMTP/user/key handoff in the earlier role/recovery checkpoint. SYS-11 remains Blocked: production-to-preview/local session rejection and remaining applicable destination bindings are unverified. M0 remains open; M1 has not started.

## Live email capture

The client saved distinct preview/local Custom SMTP configurations. Local console confirmed its update; preview read-back showed Custom SMTP. Submitted exactly one Neon **Send test email** per branch to `preview-01@example.test` / `local-01@example.test`, following run m0-smtp-20261005 at 13:18:12Z, expiry 14:18:12Z, maximum two Neon test submissions, $0.25 provider ceiling, application metered dispatch off.

Read-only IMAP observation passed at **13:25:11.531Z**, again at **13:44:21.637Z**: each separate mailbox has one earlier synthetic SMTP smoke message, one new Neon SMTP test message, zero messages addressed to the other branch's fixture. Both were opened read-only, with TLS validation and suppressed protocol logs. Ignored `.tmp/evidence/m0-email-capture-verified.json` contains counts/booleans only. No production mail configuration changed or real recipient used. Capture stores synthetic messages with the third party; its temporary account availability is not a permanent delivery guarantee.

Private wrappers unseal the existing DPAPI accounts directly into child stdin; decrypted credentials never enter AI context, stdout, Git, or application settings. Workers pin Ethereal SMTP/IMAP and the three known Neon issuers, validate destinations before transmission, cap messages at ten and message bodies at 50KB, disable raw logs, and suppress provider errors. Exact development dependencies: imapflow 2.2.5, mailparser 3.9.36, nodemailer 10.0.15. The application imports none of these testing packages.

## Ordinary synthetic Auth fixtures

Operator-created **M0 Preview Test** at 13:28:20.702Z and **M0 Local Test** at about 13:36Z, with the two example.test emails above. Console asked for email/name only; no password, admin promotion or new public-signup setting was entered. One ordinary user per synthetic branch. Production remained empty when observed in the current handoff. Template/recovery/quarantine Auth remains disabled.

Ignored screenshots: `.tmp/evidence/m0-preview-auth-fixture-2026-10-05.png`, `.tmp/evidence/m0-local-auth-fixture-2026-10-05.png`.

## Session checks, failures retained

| Attempt | Observation | Outcome |
| --- | --- | --- |
| 1, 13:41:04.845Z | One verification email requested; worker incorrectly expected a token link. Managed Neon delivery contained a code. Stopped before session checks. | FAIL, preview_verification_capture / HTTP 200. The old false distinctPublicKeys field meant missing failure metadata; it is not evidence of shared keys. |
| 2, 13:51:02.544Z | Correct OTP send/capture/sign-in; first successful response reported emailVerified false. Worker rejected it before session testing/cleanup registration. | FAIL, preview_sign_in / HTTP 200; distinct keys true. Potential residual session tracked. |
| 3, 13:52:33.982Z | Diagnostic fields limited to booleans. Preview own session, local/production rejection and signout pass. Local sign-in returns cookie, matching ordinary user, but first response emailVerified false; cleanup attempted. | Overall FAIL, local_sign_in / HTTP 200; preview partial evidence retained. |
| Client-authorized continuation, 22:14:27.362Z | Fresh sign-in per branch, revoke prior sessions for that dedicated fixture, list exactly one session, fresh server get-session validates verified ordinary user, other branch/production reject its actual cookie, signout followed by fresh get-session returns unauthenticated. | PASS for both preview and local; three distinct public JWKS sets. |

The initial bounded run used four Auth emails total (one verification plus three OTP requests). Its failures are retained in ignored m0-auth-check-attempt1/2/3.json. Client **continue** authorized a new twenty-minute run at **22:14:05.697Z**, maximum two synthetic OTP emails, same $0.25 ceiling, metered product dispatch off. Both completed; total Auth emails six. No passwords were initialized, and all dedicated synthetic sessions were cleaned up during the final passing run. No further SMTP/Auth submissions were made.

`scripts/verify-m0-auth.mjs` uses the actual OTP route and reads fresh server session state instead of treating the initial user snapshot as authoritative. Guards/refusal prevent blindly repeating a run, including its expiry. No credentials, codes, cookies, bodies, IDs, raw headers or subjects are saved. Ignored final `.tmp/evidence/m0-auth-check.json` ties the live observation to the starting revision plus these working scripts.

This proves preview/local cookies are rejected by the other branch and production. It does **not** prove the reverse production-session direction. No fake production user was seeded. The prepared client-only `docs/runbooks/M0-production-session.md` requests a real ordinary production identity and one private OTP check. Blank form proof: `.tmp/evidence/m0-production-account-handoff-2026-10-05.png`. Preparation is not a production pass.

## Recovery key foundation

At **13:42:11.0993894Z**, generated a native CSPRNG 32-byte HMAC key, sealed with Windows DPAPI CurrentUser in ignored `.env.m0-recovery-hmac.dpapi`, outside all Neon production snapshots. Key ID 329ae435-7cbb-4b05-8435-6a9d573c1253 is a random public reference, not key material. Script refuses to replace an existing key. Plaintext never displayed; ignored metadata records placement only.

Application binding and portable disaster backup are **not configured**. Machine/user-bound DPAPI is not a portable recovery backup. No recovery events were signed or production service restored. Missing control ledger/key must still block reopening. Representative six-hour horizon, four-hour recovery target and LEG-12 deletion/revocation/bootstrap replay remain launch/M8 gates.

## Checks and usage

Required pnpm lint/typecheck/build and all **16 tests** passed. pnpm audit --audit-level high: no known vulnerabilities. Node syntax checks passed for all three verification workers; PowerShell parsing passed for SMTP, recovery-key and private production handoff scripts. Malformed-input/private-wrapper guards return exit 1 and fixed sanitized metadata before network use. The production worker also refuses an example.test identity before network with its wrapper flag enabled. No production OTP was sent during these preparation checks.

Documentation check: **249 IDs**, frozen SHA-256 E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F unchanged. Secret scan: **104 source files**, no common credential patterns. Usage CSV parses four rows; Git ignores all three DPAPI files and raw evidence. git diff --check passed. Exact new release-age exceptions were added by pnpm for the pinned packages/transitives; vulnerability gate retained. No package manager upgrade.

Live worker SHA-256: verify-m0-auth.mjs **E5E830F7A479AE6ABE202BE47A2F6955A4077C9D9A7869E6CF04F1BEDAAC9E04**; verify-m0-mailboxes.mjs **860899848C8F9E8B44EDAADCB676DCDFD784381AF49ECA7A3FC0817807BAC4BA**. This checkpoint contains those exact worker bytes, tying the observations made before the checkpoint commit to its implementation.

No mock establishes live integration. Task-level Codex credits and provider charges unavailable. Two original SMTP smoke submissions, two Neon SMTP test messages and six synthetic Auth emails observed/requested; no customer messages, metered product dispatch or paid upgrades. One future real production OTP email requires the client's explicit private form action. Codex may launch the blank client prompt only; it must not inspect/operate the prompt or receive inputs.

## Published checkpoint

Implementation/evidence **63f759b1b33be1d06663f9c15b08c388316ec732** pushed to the existing draft-PR branch. [Verify 37382165951](https://github.com/finallyaiagency/groundbnb/actions/runs/37382165951) completed successfully. Preview **dpl_5Djo137EYQqBocxdtMSAZJ9oRG8d** is Ready at that exact revision. Protected health at **2026-10-05T22:24:31Z**: HTTP 200/database_ready, exact revision and br-bitter-hall-b8ibnrfy, no-store. Health deliberately retains auth/email unverified because it cannot prove those independent complete gates. This follow-up records publication and clarifies blank-prompt launch only; application code, credentials and live-test worker bytes are unchanged.
