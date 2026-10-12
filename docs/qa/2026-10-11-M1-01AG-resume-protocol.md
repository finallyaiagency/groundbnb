# M1-01AG same-session resume protocol — October 11

## Scope

Prepared `lib/factor-enrollment-resume-protocol.mjs` as a pure offline orchestrator for the dormant 0015 contract. Assertions were added inside the existing `tests/factor-service-protocol.test.mjs` case; no new test case or test file was added. This does not wire a repository adapter, route, key source, or caller.

The orchestrator accepts a new resume UUID distinct from the original begin UUID. It reads the original begin receipt and the 0015 status receipt, then releases only the same pending factor under the same active account, owner/admin role, issuer, subject, and managed session. It snapshots repository data before subsequent awaits. Only a nine-field `released` writer acknowledgment with `newlyCommitted: true`, followed by fresh identity/context/envelope checks, permits key lookup and decryption. The private secret property is non-enumerable. Historical receipts are status-only. An uncertain writer gets one read-only status reconciliation that must match the computed request fingerprint; no mutation retry occurs.

## Checks

- `pnpm test -- tests/factor-service-protocol.test.mjs`: 15/15 passed; test count unchanged.
- `pnpm test`: 407/407 passed. The initial sandbox run had two unrelated `EPERM` failures creating disposable `.tmp` fixtures; the authorized rerun passed.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed.
- `pnpm secrets:check`: passed; no common credential patterns in 397 source files.
- `pnpm state:check`: passed, 249 requirement IDs and frozen source hash validated.
- Scoped whitespace scan: passed.

Coverage added within the existing case includes status-only replay, unknown writer reconciliation with and without an exact fingerprint, no retry, strict request shape, captured dependency functions, mutation of a receipt during the next resolver await, role change, session loss after rejected/replay acknowledgments, and context drift after decryption. The synthetic unit fixture uses the existing maintained factor-storage crypto helper; it is not a provider, database, browser, or MFA acceptance test.

## Limits

Migration 0015 remains unapplied and the rollback-only operator has not run. No SQL, credentials, keys, grants, routes, or provider operations were performed. The injected `releaseMaterial` port is required to resolve only after database transaction commit, but this is not proven by the offline tests. The non-enumerable value is not a browser delivery mechanism. ACC-08 remains Not started; no MFA acceptance is claimed.

Usage accounting was unavailable; no token or credit estimate is claimed.
