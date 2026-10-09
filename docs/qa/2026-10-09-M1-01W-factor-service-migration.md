# M1-01W — Dormant factor-service SQL candidate

**Status:** Prepared and independently reviewed. No SQL executed; no grant, key, route, environment binding, login, OTP, or MFA activation occurred.

## Scope

Added `db/migrations/0012_factor_service.sql` and `_down.sql`. The forward candidate defines private SECURITY DEFINER functions for factor challenge-state read, failed-attempt write, TOTP consume, recovery consume, and operation-receipt read. Its account-scoped immutable receipt table distinguishes attempt and consume operations. The reverse is guarded against deleting any receipt or 0009/0010 factor history. No app EXECUTE grant is included.

Identity resolution pins the synthetic branch issuer and derives the active owner/admin account from the existing identity mapping. The candidate checks the exact managed `neon_auth.session` row by session ID and user ID, reads only expiry metadata, and uses a row lock in writer paths. The selected synthetic policy is fixed at five failed challenges per 900-second UTC-aligned window, aggregated account-wide across issuer/subject aliases and both methods. This is an implementation choice, not a frozen-spec numeric requirement.

## Checks

- `node --test tests/factor-service-migration.test.mjs tests/factor-service-operator-script.test.mjs`: 11/11 pass (7 migration checks, 4 operator-script checks).
- `pnpm exec eslint tests/factor-service-migration.test.mjs tests/factor-service-operator-script.test.mjs`: pass.
- Independent review found and the candidate corrected: missing explicit TOTP method; repeated same-session activity inserts instead of guarded upserts; relkind-unsafe privilege checks; and trigger-returning functions incorrectly included in callable-function scans. Final reviewer found no remaining blocker in the candidate.
- Parent reports the committed 0010/0011 baseline and rollback-only 0011 membership-reader acceptance passed on both pinned branches under D-014. The new 0012 operator script is prepared only; it has not been executed and uses an unmapped synthetic subject plus an absent fixed session marker. It does not create or query an actual provider session or handle credentials.

The tests inspect SQL text and closed contract markers only. They do not prove SQL parsing, function ownership/effective ACLs, transaction behavior, locking, provider session revocation semantics, or live MFA. The operator script has not been run. Migration 0012 remains unexecuted, ungranted, and unapplied.

## Open gates

- Run the prepared rollback-only 0012 closed-path operator acceptance on both pinned branches under its own exact action-time gate, then obtain separate approval before applying migration 0012.
- Inspect Neon Auth revocation/deletion semantics and verify same-database session-row behavior before claiming immediate provider revocation.
- After separate grant approval, perform bounded synthetic runtime tests for function compilation, app-role ACLs, expiry, concurrency, one-use sources, UTC boundary and alias aggregation, audit atomicity, and uncertain-receipt recovery.
- Keep browser/service activation, key provision, enrollment, real OTP/recovery, and production access separately gated.

## October9 live continuation

Reviewed source0012 SHA256 `7153DE1F058FC51DACA8C76B470B0F40FE219822F556E701FA8A6A721381D33F` committed BEGIN through COMMIT,25 statements, on local br-rough-flower-b8lerkcf and preview br-bitter-hall-b8ibnrfy. Client standing authorization covers this routine private continuation after D-014; no new app access is granted. Exact12 restricted app catalog checks PASS both.

Initial new operator script failed parsing SQLSTATE42601, missing closing EXISTS parenthesis; both failed transactions explicitly rolled back via console and showed Connected again. Parent had also corrected a declared attempt_count/column collision before execution. Reviewed corrected operator SHA256 `A6A384BE3D462A777E0B7A2A43002EB1CCC75C8D87A4AC4A347599B3558EC0DD` is being rerun; no pass inferred from static350-test run.

Corrected closed-path operator passed BEGIN/DO/SELECT/ROLLBACK on BOTH: unmapped state/receipt denied, failed-attempt unknown, both consume paths rejected, no operation/attempt/audit changes. Owner/ACL/search_path/private table checks passed. No actual provider session or successful challenge exercised; later branch-dependent SQL, revocation/concurrency and MFA remain unverified. Final metadata12 receipts, paused dispatch, rates/factors/recovery/activity0, users1 both.
