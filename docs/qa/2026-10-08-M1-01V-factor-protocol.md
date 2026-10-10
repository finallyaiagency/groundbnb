# M1-01V — Offline factor challenge protocol preparation

Date: 2026-10-08
Base revision: `a8c2a7dd2fdd8762e8353e69ef06972132fd80e1`
Scope: offline service protocol and deterministic tests only; published revision is identified by its Git checkpoint.

## Prepared

Added `lib/factor-service-protocol.mjs` and `tests/factor-service-protocol.test.mjs`; updated the M1-01V packet. The additive protocol performs a managed-session read, closed owner/session/epoch/factor state read, cryptographic candidate check, then one atomic repository writer call. No transaction callback is held across verification. Writer inputs include the observed binding for database revalidation. Failure attempts use a closed outcome and never receive the submitted code.

Unknown outcomes make one receipt-status read bound to the generated operation UUID, method, account, issuer, subject, and session. No writer is retried. Accepted writer responses and accepted receipts require another managed-session read and current state read; expired sessions, revoked bindings, changed epochs, and current rate limitation suppress success. The service accepts no client operation ID and exposes no generic database or protected-resource callback.

The source requires rate limiting but does not set a threshold/window. The module exports a proposed 5 failures / 900 seconds policy; trusted runtime wiring must pass the complete bounded policy explicitly. It is a proposed implementation value, not a frozen-spec amendment or active production configuration.

## Checks

- `node --test tests/factor-service-protocol.test.mjs tests/factor-service.test.mjs` — 32 passed, including factor replacement and mutable configuration regressions.
- `pnpm exec eslint lib/factor-service-protocol.mjs tests/factor-service-protocol.test.mjs` — passed.
- `pnpm typecheck` — passed.
- `git diff --check` — passed.
- Parent combined gate: 327/327 tests; lint, production build/TypeScript, state validation (249 IDs/frozen hash), and 305-file secret scan pass.

These tests use synthetic in-memory doubles. No SQL, grants, routes, keys, auth changes, or live factor data were used. They do not prove database locking, durable audit/receipt behavior, effective function ACLs, session revocation, or MFA acceptance. The protocol is not wired into the existing service or runtime. No requirement status is changed.

Independent review corrected original-binding preservation after uncertain receipt resolution and added a factor-replacement regression. Parent review corrected recovery verification to use the captured environment instead of the mutable dependency object. Final focused checks pass. SQL function contract review, adapter integration, effective ACL proof, and runtime acceptance remain outstanding; this QA note records offline preparation only.
