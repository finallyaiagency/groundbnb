# M1-01V — Factor PostgreSQL repository adapter candidate

Date: 2026-10-08
Base revision: `ada77b5ab2f6a02dd8710ef72a84b36787239b28`
Scope: new injected-port adapter and deterministic tests only; publication is identified by the Git checkpoint.

## Prepared contract

Added `lib/factor-postgres-repository.mjs` and `tests/factor-postgres-repository.test.mjs`. The repository has five methods matching the offline factor service protocol: `readChallengeState`, `recordChallengeAttempt`, `consumeTotpCandidate`, `consumeRecoveryCandidate`, and `readOperationReceipt`. Each maps to one fixed parameterized `SELECT groundbnb.<function>(...) AS result` call through an injected `runQuery(statement, values)` function. No Neon client, environment mode, connection, transaction batch, SQL executor, route, or grant is created here.

The chosen dormant function names are `read_factor_challenge_state`, `record_factor_challenge_attempt`, `consume_factor_totp_candidate`, `consume_factor_recovery_candidate`, and `read_factor_operation_receipt`. They do not yet exist in the database. The adapter contracts expect closed JSON results: full server-only challenge snapshot; `{status:"recorded"}` or unknown for failure audit; accepted/rejected/unknown for consume; and a receipt bound to operation ID, method, derived account, issuer, subject, and session. Database functions must derive account identity from issuer/subject/session; account ID is never sent as a SQL argument. Database time owns persistence timestamps; the app timestamp is not passed to the audit writer.

Read snapshots are exact-key validated, capped at 100 recovery rows, cloned/frozen, and only returned to the internal protocol. Writers expose only a copied status enum. Driver errors/details are suppressed. Unknown writer outcomes remain `unknown` after exactly one call; protocol-level receipt reconciliation remains a separate single read with no retry. No access-resource reader is exposed.

## Checks

- `node --test tests/factor-postgres-repository.test.mjs tests/factor-service-protocol.test.mjs tests/factor-service.test.mjs` — 41 passed, including end-to-end unknown-receipt resolution through the adapter.
- `pnpm exec eslint lib/factor-postgres-repository.mjs tests/factor-postgres-repository.test.mjs lib/factor-service-protocol.mjs tests/factor-service-protocol.test.mjs` — passed.
- `pnpm typecheck` — passed.
- `git diff --check` — passed.
- Parent combined gate: 336/336 tests, lint, build/TypeScript, state validation (249 IDs/frozen hash), and 308-file secret scan pass.

## Next SQL design and read-only metadata

M1-01W prepares the five-function design, immutable receipt semantics and session/account/factor lock ordering. Parent selected a fixed synthetic implementation policy of five failures per UTC-aligned 900-second window aggregated across account aliases and both methods. This is not a product amendment or enabled setting. Future SQL must reject a caller policy override.

Both pinned local and preview editors returned ten catalog columns for `neon_auth.session` using `SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='neon_auth' AND table_name='session' ORDER BY ordinal_position`. Metadata proves UUID `id`/`userId` and timestamptz `expiresAt`; no session values were read. A narrow future definer could bind these columns, but provider revocation persistence and transaction locking remain unproven. No Auth-table grant was made. Neon documents same-database sessions in [its staging guide](https://neon.com/blog/handling-auth-in-a-staging-environment); that source does not prove the required runtime semantics.

Installed SDK 0.5.0-beta source exposes getSession/signOut/revokeSession/revokeSessions. `lib/session-identity.mjs` explicitly passes the string `disableCookieCache: 'true'`, bypassing signed-cookie authority caching. The SDK server transport does not pass its fetchOptions through. Current resolver routes all export `dynamic = 'force-dynamic'`; installed Next 16.3.8 `dist/server/route-modules/app-route/module.js` and `dist/server/lib/patch-fetch.js` set forceDynamic/revalidation zero for that request context, including the SDK Cookie-bearing GET. This supports uncached transport under the normal framework path; it is code/config evidence, not a new live revocation observation. Future routes must preserve it.

Fake-port tests do not prove SQL function behavior, server-side owner derivation, transaction atomicity, actual Neon result shape, migration state, function ACLs, or MFA acceptance. No SQL was executed and no database/route/runtime integration was added.

Independent review identified a protocol/adapter receipt-query contract mismatch: the adapter requires the observed account ID for receipt validation, so the internal protocol request was aligned to include that binding. Added an end-to-end unknown-consume test proving receipt lookup can resolve the accepted result without retrying the writer. Final independent adapter review confirmed the corrected binding and test path and found no other actionable issue. The packet update follows the parent protocol checkpoint.
