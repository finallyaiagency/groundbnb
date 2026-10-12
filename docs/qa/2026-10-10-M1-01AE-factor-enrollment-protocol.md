# M1-01AE offline factor-enrollment protocol QA

Base revision: `7f8996a` (working tree; candidate changes are not committed).

## Prepared

- Added the dormant server-side begin/verify orchestration candidate in `lib/factor-enrollment-protocol.mjs`.
- Updated exact-key validation in `lib/factor-storage.mjs` to accept exact own data properties whether enumerable or non-enumerable. Cryptography and AAD binding are unchanged.
- Extended the existing `tests/factor-service-protocol.test.mjs` case with maintained storage/TOTP interoperability, closed identity/fingerprint checks, throttled-attempt behavior, fully bound writer acknowledgments, and unknown begin outcome handling.
- Reconciled the AE task packet to the candidate's current internal acknowledgment/receipt shapes and marked migration 0014 unexecuted.

## Checks

- `pnpm test -- tests/factor-service-protocol.test.mjs`: pass, 15/15.
- `pnpm exec eslint lib/factor-enrollment-protocol.mjs lib/factor-storage.mjs tests/factor-service-protocol.test.mjs`: pass.
- `node --check lib/factor-enrollment-protocol.mjs`: pass.
- Latest `pnpm test`: failed in a concurrent migration operator-script assertion expecting `BEGIN; SET TRANSACTION READ WRITE; ... ROLLBACK;`. The failure is outside this protocol test; the full suite must be rerun after that migration-test mismatch is resolved.

## Limits

These are offline application-contract checks. They do not prove migration 0014 executes, database locks or receipts are correct, or writes are atomic/durable. The protocol is not wired to a route or runtime repository; no roles, credentials, encryption keys, SQL, or live MFA flow were activated. Bootstrap seed-to-subject history and key/fingerprint custody remain separate prerequisites.
