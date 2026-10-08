# M1-01E inactive browser profile slice

Working-tree base: 2585b8b. This checkpoint contains the initial synthetic-only sign-in and profile editor. It does not prove a live browser login or durable application save.

The auth boundary pins the existing synthetic fixture, origin, issuer, app role and a maximum 30-minute activation. It accepts only send, verify and logout; fresh managed identity and an active mapped account precede cookie issuance. Cookies expire no later than the run window. Rejected newly minted sessions receive a sign-out attempt. Profile reads/writes also refuse an expired synthetic window. This process-local attempt guard is not a distributed production abuse limiter.

The editor exposes traveler count, pets and dietary requirements. It submits dirty fields with revision and operation ID, preserves uncertain saves for explicit replay, shows stale-revision comparisons, and creates a new operation only after explicit conflict review. Sign-out hides profile/draft values before requesting revocation. A generation check discards profile reads that finish after save/sign-out begins. The remaining profile fields and full account/security flows are open.

Checks: existing 34 deterministic tests pass; typecheck, build, state/hash (249 IDs), and secret scan pass. Initial lint found an effect scheduling issue, corrected before final lint. These existing tests do not directly exercise the new browser auth handler or React forms. Additional boundary coverage and genuine browser acceptance remain required before activation.

The in-app browser connection attempt failed because its trusted native bridge was unavailable. No local test window was enabled, development server started, OTP requested, profile changed, preview deployed, or production/recovery operation performed. Existing encrypted credentials remain usable; no password handoff is required. A supported alternative browser connection is the next verification step.

M1 remains in progress. Full ledger requirement statuses remain unchanged. Do not create the M2 successor chat until the actual M1 exit passes. Task-level credits, exact duration and charges are unavailable.

## Luna continuation before live activation

User requested Luna agents at high reasoning to continue autonomously. Three agents reviewed the auth boundary, UI and full M1 scope. Eleven new direct auth-boundary tests pass, bringing the deterministic suite to 45 passing tests. Lint, typecheck, build, state/hash and secret scan pass. An intermediate full-suite run overlapped the clock API/test conversion and failed eight cases with a clock-type error; the stable rerun passes all 45. This failed attempt is retained, not silently counted as success.

Provider JSON is capped at 32 KiB; the clock is checked after asynchronous verification and before cookie issuance. Rejected minted sessions receive a sign-out attempt. The editor clears all draft/operation state on a load-time 401 and ignores stale save responses. Browser form acceptance remains unproved.

The Chrome connection is available after the in-app bridge failure. `scripts/m1-browser-window.ps1` prepares/restores a maximum 30-minute local-only synthetic window and records one admitted OTP request; existing app credentials and captured email credentials stay private. `scripts/capture-m1-browser-otp.mjs` reads only the pinned synthetic capture inbox, bounds message selection, and encrypts the sole code to a transient browser-runtime RSA key before filesystem transfer. No password/code plaintext file or value output is used. Helper syntax checks pass. No activation or OTP has occurred at this pre-live checkpoint.

Full-domain planning is in M1-01F. The current seven-field slice has an unsupported 1–200 traveler limit; frozen Section 11.2 allows 1–999. Correct it through a forward migration and validator/UI parity, preserving applied migration 0002. It does not affect the planned two/three-traveler smoke scenario, and the full requirement stays open.

## First genuine local attempt and reproduced transaction defect

The 30-minute local window started at 2026-10-08T01:29:54Z, expiring at 01:59:54Z. The first admission helper failed before requesting email because Windows DateTime.Parse converted the UTC expiry to local time; DateTimeOffset.UtcDateTime fixes that comparison without extending the original expiry. The one actual browser send was admitted at 01:30:49Z and returned 200. Capture read the sole fresh synthetic code privately. Browser verify returned 503; no application cookie/profile view/save was observed. Its exact failing phase was not logged and remains unknown; do not retroactively claim it.

A subsequent non-mutating restricted-app read with an intentionally unmapped synthetic subject reproduced SQLSTATE 25006 instead of the expected auth denial. Neon HTTP's false read-only batch flag did not override the app role's read-only transaction default, and the profile function takes account locks. The adapter now prepends SET TRANSACTION READ WRITE within the same admitted batch before the one profile function call. Role defaults, grants and direct-table denials are unchanged. The same non-mutating probe then returns auth as expected. This proves removal of that transaction blocker, not the original browser phase or full account mapping.

Safe server telemetry logs fixed phase/category/SQLSTATE labels, never bodies, tokens, URLs or raw errors. Transport mocks additionally cover genuine verify/logout endpoint construction, cookie parsing and non-2xx/body-failure cleanup. Native cookies survive failed body parsing for one sign-out attempt; error bodies are canceled. Targeted auth/transport/persistence checks pass 20/20. Failed first browser evidence is preserved in .tmp/evidence/m1-browser-sign-in-failed.png.

One controlled diagnostic retry is prepared after this reproduced defect, within the original window and a total ceiling of two synthetic email requests. Every attempt remains counted; no repeated retry-until-pass or expiry extension is permitted. Cleanup from the first failed verify was attempted but not independently confirmed by the old telemetry. No profile write or production/recovery change has occurred at this checkpoint.
