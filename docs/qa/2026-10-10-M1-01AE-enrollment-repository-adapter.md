# M1-01AE offline enrollment repository adapter

Date: 2026-10-10
Status: local offline candidate; no requirement status change.

## Scope

Added `lib/factor-enrollment-postgres-repository.mjs` and extended the existing `tests/factor-postgres-repository.test.mjs` case. The adapter exposes six closed methods mapped to the candidate 0014 SQL function names with fixed parameterized `SELECT` calls through an injected single-query port. It creates no database client, SQL transaction, generic query method, route, role, credential, or key.

Input identity, event, and receipt bindings are exact-key snapshots before asynchronous calls. UUIDs, timestamps, key IDs, encrypted-envelope shapes, safe epochs, fingerprints, and database JSON result shapes are bounded and validated. The fingerprint is converted to 32-byte `bytea`; encrypted envelope JSON is passed only to the fixed begin writer. Reader values are cloned/frozen and validation/driver errors are suppressed to a generic error. Writer uncertainty returns `unknown` after one call.

Failed verification audit uses logical receipt kind `verify`, matching the SQL candidate. The adapter returns the full seven-field bound acknowledgment for `recorded` or `rejected`; a bare status without the operation/account/factor/epoch/fingerprint binding is treated as `unknown`. This acknowledgment reports an operation result only and does not grant or assert current privileges.

## Checks

- `pnpm exec node --test tests/factor-postgres-repository.test.mjs` — 9/9 passed. The existing fixed-function test case now covers all six calls, bound `recorded` and `rejected` ACKs, bare-status rejection, exact string boundaries, inconsistent context, and mutation of caller objects while a query is pending.
- `pnpm exec eslint lib/factor-enrollment-postgres-repository.mjs tests/factor-postgres-repository.test.mjs` — passed.

## Limits

These checks exercise an injected synthetic query port only. Migration 0014 is a candidate and was not executed; function signatures/results, PostgreSQL execution, ACLs, locking, atomicity, actual driver JSON/bytea behavior, durable replay, provider identity, recovery-control mirroring, role activation, and MFA acceptance are not established. No live SQL, Auth/provider call, browser action, credential, key, grant, account mutation, or enrollment occurred. No ledger status or M1 completion claim follows.
