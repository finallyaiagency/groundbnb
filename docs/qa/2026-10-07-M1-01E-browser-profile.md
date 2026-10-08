# M1-01E inactive browser profile slice

Working-tree base: 2585b8b. This checkpoint contains the initial synthetic-only sign-in and profile editor. It does not prove a live browser login or durable application save.

The auth boundary pins the existing synthetic fixture, origin, issuer, app role and a maximum 30-minute activation. It accepts only send, verify and logout; fresh managed identity and an active mapped account precede cookie issuance. Cookies expire no later than the run window. Rejected newly minted sessions receive a sign-out attempt. Profile reads/writes also refuse an expired synthetic window. This process-local attempt guard is not a distributed production abuse limiter.

The editor exposes traveler count, pets and dietary requirements. It submits dirty fields with revision and operation ID, preserves uncertain saves for explicit replay, shows stale-revision comparisons, and creates a new operation only after explicit conflict review. Sign-out hides profile/draft values before requesting revocation. A generation check discards profile reads that finish after save/sign-out begins. The remaining profile fields and full account/security flows are open.

Checks: existing 34 deterministic tests pass; typecheck, build, state/hash (249 IDs), and secret scan pass. Initial lint found an effect scheduling issue, corrected before final lint. These existing tests do not directly exercise the new browser auth handler or React forms. Additional boundary coverage and genuine browser acceptance remain required before activation.

The in-app browser connection attempt failed because its trusted native bridge was unavailable. No local test window was enabled, development server started, OTP requested, profile changed, preview deployed, or production/recovery operation performed. Existing encrypted credentials remain usable; no password handoff is required. A supported alternative browser connection is the next verification step.

M1 remains in progress. Full ledger requirement statuses remain unchanged. Do not create the M2 successor chat until the actual M1 exit passes. Task-level credits, exact duration and charges are unavailable.
