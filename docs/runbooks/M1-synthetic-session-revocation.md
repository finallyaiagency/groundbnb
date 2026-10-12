# M1 synthetic session revocation acceptance

Status: preparation only. No auth request, OTP, UI action, SQL, database call, credential, or runtime activation occurred for this runbook. The current app has no factor lifecycle route/service, so factor-race acceptance is not presently executable.

Reviewed: 2026-10-10. Frozen source hash: `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`.

## Read first and authority

Read `AGENTS.md`, `docs/STATE.md`, `docs/tasks/M1-01AA-factor-runtime-boundary.md`, `docs/spec/09-admin-usage.md`, `docs/spec/15-shared-safeguards.md`, and frozen Sections 11.15 and 11.22(D). This plan supports ACC-08, ADM-02, ADM-06, SYS-07, SYS-11, and LEG-12; it changes no requirement and promotes no ledger status. The frozen source controls.

## Source map and current limits

| Source | What it establishes | Limit |
| --- | --- | --- |
| `lib/session-identity.mjs` (`managedSession`) | Server identity lookup calls Neon `createAuthServer().getSession()` with `disableCookieCache: 'true'`, then validates matching user/session IDs and expiry. It returns only issuer, subject, session ID, and expiry. | This code and setting do not prove how the deployed Managed Auth service orders concurrent deletion and lookup. |
| Installed `@neondatabase/auth@0.5.0-beta`, `dist/server-b0OzGjXl.mjs` (SHA-256 `7767CC672691A051E49B2E912567A7386E382BD002D2128259426B983897C64B`) | The installed server adapter bypasses its cookie cache only when the query value is the string `"true"`; the resolver supplies that exact value. | Package code is not the managed backend's transaction or replication contract. |
| Installed `better-auth@1.6.23`, `dist/api/routes/sign-out.mjs` (SHA-256 `A130B00BD64C2E42BF2E7A1204E76B1D7493F4599DB9F0BD354032A8C0BB24C3`) | This version catches a session-delete exception, clears the cookie, and still returns `{ success: true }`. | Do not treat a sign-out success response or local cookie clearing as proof that the provider deleted the session. This dependency does not establish the deployed Managed Auth server's implementation. |
| `lib/browser-auth.mjs` logout path | The local synthetic logout proxy checks the same cookie with a fresh session read after upstream sign-out and refuses to claim success if a user/session is still returned. | It is self-sign-out coverage only; it does not implement ADM-02 cross-session administrative revocation. |
| `db/migrations/0012_factor_service.sql` and `0013_factor_service_principal.sql`, `_factor_lock_identity` | The factor guard selects the matching `neon_auth.session` row `FOR UPDATE` before account/identity rows when row locking is requested. | The lock is a serialization candidate. It does not prove the Managed Auth delete uses a conflicting lock or that a request rejected after deletion is observed immediately. Verify this against the pinned live branches before relying on it. |

Official references checked 2026-10-10:

- [Neon authentication flow](https://github.com/neondatabase/website/blob/main/content/docs/auth/authentication-flow.md) describes auth state in the branch's `neon_auth` schema and branch isolation; it does not specify concurrent revocation/row-lock behavior.
- [Better Auth session management](https://www.better-auth.com/docs/concepts/session-management) documents session lookup, selective revocation, and that cookie caching can leave a revoked session usable until cache expiry unless a fresh lookup is forced.
- [Neon Auth SDK README](https://github.com/neondatabase/neon-js/blob/main/packages/auth/README.md) describes client-side session caching and sign-out cache clearing. That client cache behavior is distinct from the server resolver path above.

## Acceptance prerequisites

1. Use only the existing synthetic fixture and the separately pinned local or preview branch. Run local and preview as separate records; never combine their cookies, issuer, database, or environment. Production and recovery are out of scope.
2. Require the later-reviewed factor lifecycle service, exact factor-role credential/grants, protected test route, and approved challenge flow before testing the factor race. None is enabled by this preparation. Do not create a direct database delete or a bypass route to simulate revocation.
3. Admit one bounded run of at most 60 minutes with synthetic email capture, scheduled work and metered dispatch off, exact source/branch pin, owned process, and explicit expiry. The current auth helper allows one code-send per run. Two independent sessions require an already-valid synthetic control session or a separately admitted sign-in run; never bypass that limiter. If two distinct sessions cannot be obtained within the approved window, mark selective-revocation coverage blocked/incomplete.
4. Use two separate browser contexts for the same synthetic account. Keep cookies, OTPs, tokens, and session IDs only in their browser/server memory. Confirm distinct session IDs only as a private boolean; never display or save them.

## Bounded acceptance steps

### Selective session revocation

1. Before revocation, use the normal protected profile read in contexts A and B. Both must succeed for the same synthetic account, and the server-side check must confirm the contexts hold distinct sessions without recording their identifiers.
2. Revoke only A through the supported managed-auth operation. Prefer the ordinary user sign-out path for the self-sign-out test. Test ADM-02 revocation of another session only after its authorized, audited, recent-step-up UI/API exists; do not call a private endpoint or copy a session token between contexts.
3. For self-sign-out, require the local proxy's fresh post-sign-out resolver check to deny A before it reports success. For remote revocation, retain A's cookie in its own context and reload a protected route; the fresh server resolver must deny it without returning profile data. In both cases, B must remain valid and continue to read only its own synthetic account. This control distinguishes targeted revocation from account-wide invalidation or a local UI-only sign-out.
4. At teardown, sign out B through the normal path and confirm a fresh lookup denies it. If the provider result is unavailable or ambiguous, keep the outcome unknown, do not claim revocation, and do not clear a retryable cookie as if deletion were proven.

### Revocation racing a factor challenge

Run only after the factor lifecycle route and real repository are enabled under their own reviewed gates. Use a newly admitted synthetic run and unique operation IDs; the operation must derive identity from the trusted resolver and the database must perform the actual migration function call. Do not use mocked SQL results as live evidence.

1. **Deletion wins first:** start a synthetic challenge request and pause it before the factor database call. Revoke that same session through Managed Auth, then release the request. The factor transaction must reject because the matching auth session row is absent; it must not consume a TOTP/recovery candidate, create a success receipt, or expose protected content. A follow-up protected request using the retained cookie must also be denied by a fresh resolver.
2. **Factor lock wins first:** use an integration barrier that proves the actual factor transaction has acquired the matching `neon_auth.session` row lock, then request revocation from the separate supported auth context. Revocation may wait for that transaction. If the factor transaction commits first, its durable operation status may record that committed result, but the application must perform a fresh post-commit identity/session/epoch/factor read before reporting enrollment success or returning protected content. Once revocation completes, the next fresh resolver/protected request must deny the session and return no protected content. If the delete commits first, the factor operation must reject with no consume/success. Never hold the lock while making the external OTP verification call.
3. Prove order from actual transaction completion and sanitized status results. If a reliable barrier cannot show which operation acquired/committed first, record the race as inconclusive. Unknown factor outcomes use the same operation ID and status lookup; never retry a consume with a new ID or automatic replay.

## Evidence and closure

Record the source commit, run ID/expiry, target branch alias, synthetic fixture alias, browser/version, whether two distinct sessions were privately confirmed, redacted request IDs, start/finish times, outcome categories, selective-control result, operation/status result, and exact environment/process restoration. Do not record session/user IDs, emails, cookies, OTPs, tokens, profile contents, raw provider responses, or secret values. Preserve failures and unknown outcomes. This plan is not evidence of ADM-02, ADM-06, ACC-08, provider deletion consistency, lock ordering, or M1 completion.
