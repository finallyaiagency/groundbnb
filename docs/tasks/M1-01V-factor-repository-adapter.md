# M1-01V — Private factor repository boundary

Status: In progress — offline protocol prepared; database adapter and live acceptance pending.

## Purpose and limits

Define the next offline-only implementation slice: a private PostgreSQL boundary for factor challenge state, one-use challenge consumption, and privileged-read context. This packet does not enroll or reset a factor, enable authentication, add routes, provision keys, grant EXECUTE/table privileges, execute SQL, or claim live MFA.

At packet preparation, migrations 0003–0009 are approved/applied on the pinned synthetic databases. Migrations 0010 and 0011 remain outside that approval. 0009 stores encrypted enrollments, recovery digests, accepted TOTP steps, attestations, factor-attempt windows, and append-only audit; 0010 adds recovery-source attestations and privileged activity. Neither migration defines callable factor reader/writer functions or grants app access. The application role has no direct factor-table privileges.

## Authority and existing boundary

- Frozen Section 11.22(D), ACC-08, ACC-09, ADM-01, ADM-06, SYS-07, plus Sections 11.15 and 11.22 govern verified identity, second-factor access, one-use challenges, rate limits, step-up, ownership, and audit. This packet does not change those requirements.
- Follow `docs/tasks/M1-01I-privileged-policy.md`, `M1-01L-factor-verifier.md`, `M1-01N-factor-storage.md`, `M1-01P-factor-records.md`, `M1-01S-factor-service-context.md`, and `M1-01T-factor-service.md`; read the named shared views 00/07/12/15 before implementation.
- Existing `lib/factor-service.mjs` is an offline contract over injected repositories. Its callback-shaped `withChallengeTransaction` describes one open transaction that reads factor state into JavaScript, performs key lookup/TOTP verification, then consumes a step. The existing profile adapter uses Neon HTTP transactions with a fixed query list; it cannot safely interleave a result-dependent JavaScript verifier inside that list. Do not implement an adapter that pretends separate HTTP requests are one transaction.

## Repository protocol

Use narrowly scoped `SECURITY DEFINER` database functions, fixed `search_path=pg_catalog,pg_temp`, closed argument/result schemas, owner-derived identity lookup, and no direct app table grants. The function definitions and adapter remain dormant until a separate migration/grant approval. The adapter must not run against absent functions or be wired to an environment mode in this task.

### Challenge state read

Provide a private reader taking only pinned issuer, verified subject, exact managed session ID, and the SDK-validated session expiry. It derives the application account with the existing trusted account-identity helper; callers cannot submit an account ID, role, factor ID, epoch, rate result, timestamp, or challenge outcome. Using database time, it returns a closed server-only context containing the currently active privileged role/status, security epoch, verified factor ID/key ID/encrypted envelope/last accepted step, rate decision, and bounded unconsumed recovery digest rows for that exact owner/factor/epoch. Reject suspended/inactive accounts, revoked or expired sessions, stale epochs, missing/unverified factors, and malformed state. Never serialize this reader result to an HTTP/client response, diagnostic, or log.

### Atomic result writers

The adapter performs cryptographic verification only after the state read. Each subsequent result is one atomic database function call that locks/revalidates current state; the state read alone never authorizes access.

- **TOTP consume:** accept only the bound identity/session expiry, factor ID/epoch observed by the reader, candidate step, and server-generated operation ID. In one transaction, lock rows in a documented canonical order; recheck current owner binding, role/status/suspension, session expiry, epoch, factor state, rate window, and that the step remains in the verifier's ±30-second window; insert the unique accepted step, session-bound attestation, operation receipt, and accepted audit. Return success only after commit. A step already consumed by this same operation returns its original receipt; another operation cannot create a second attestation for that step.
- **Recovery consume:** accept the same identity/session/factor/epoch binding, one matched recovery-row ID, and operation ID. Atomically recheck/lock the row, require the exact owner/factor/epoch and unconsumed state, mark it consumed, and insert a recovery-source attestation, operation receipt, and audit. Never invent a TOTP step. Ambiguous matches are rejected by the service before calling the writer. A consumed row cannot be reused by another operation.
- **Attempt record:** invalid code, rate-limited, unavailable-key, and other eligible failed attempts use a separate atomic function to increment the persisted window and append a bounded outcome audit. It receives a closed outcome enum and a server-derived account-wide bucket; never receive or store the submitted token, recovery code, secret, cookie, or raw client IP. Define the exact attempt threshold/window in implementation from an explicit reviewed policy constant; do not silently invent it in this packet.
- **Unknown commit:** never retry a consume call automatically. Persist a private operation receipt keyed by server-generated operation UUID and bound to account/issuer/subject/session/method. A read-only status function resolves a timed-out result to the original `accepted`, `rejected`, or `not_found` outcome. Replaying an operation ID for another identity/session or another method returns a closed denial. Store no token/code or unsalted code fingerprint in the receipt. Operation ID is an idempotency handle only; it grants no authority.

Every writer rechecks expiry using `clock_timestamp()` at the write point, never the application clock. For success, the challenge source, unique consumption, attestation, operation receipt, and success audit commit together. For failure, its rate update and outcome audit commit together. Database errors, malformed results, and uncertain outcomes remain unavailable/unknown and do not reveal raw provider or SQL errors.

### Privileged reads

Do not preserve an arbitrary `readProtected(tx)` callback or expose a generic SQL/transaction reader. A context reader may return only the exact role/status, epoch, current factor-attestation times, session activity, suspension, revocation, and rate facts required by `decidePrivilegedAccess`.

Any future protected admin resource must use a closed resource-specific database reader that rechecks the current identity/session, role, epoch, factor freshness, idle activity, and five-minute sensitive-action requirement in the same database operation that returns that resource. Resource name and arguments are fixed server code, not caller-selected SQL. No admin data route is part of this task. If a later feature needs a multi-query transaction, it must prove an interactive Neon transaction can keep locks and authorization valid through the entire read; otherwise keep reads resource-specific.

## Adapter scope and tests

After the function signatures and result shapes are reviewed, add `lib/factor-postgres-repository.mjs` as a thin server-only adapter around an injected Neon SQL/transaction port. It may issue only the allowlisted function calls above, with fixed parameterized SQL and no table statements. Keep connection creation lazy and environment/branch pinning identical to existing server persistence. Make no automatic retries. Validate every returned JSON value with exact keys/enums, cap recovery rows, and suppress driver details. Never return ciphertext, salt, digest, operation receipt internals, or raw IDs to client-facing code beyond what the factor service needs internally.

Add focused adapter tests using a deterministic fake SQL port. Cover exact function names/arguments, one-call atomic writer boundaries, state/identity/expiry binding, malformed/unknown result handling, timeout/unknown commit without retry, receipt status/replay binding, no secret/raw-code serialization, recovery-row bounds, no generic SQL/table calls, and access reads restricted to explicit future resource methods. Static tests prove adapter construction only; they do not prove PostgreSQL locks, effective privileges, or live authorization.

The current service interface must be revised in a coordinated slice with exact tests before adapter integration: replace its assumed long-lived challenge callback with explicit state-read, attempt-record, consume, and operation-status calls. Replace generic access callback plumbing with closed resource readers. Do not leave a transitional adapter that implements the old callback contract by opening several independent transactions and calling it atomic.

## Dependencies and separate gates

1. Review the function contract and service-interface change before implementation. Confirm exact operation receipt semantics, allowed result enums, and a concrete rate-limit threshold/window.
2. Prepare a new dormant forward/reverse migration for the private functions and operation receipts after approved 0010/0011 ordering is known. It must pin the exact local/preview database, branch, complete receipts, sole synthetic identity, and function-only app-role baseline. Rollback must refuse any factor history or operation receipts and preserve existing factor records.
3. Obtain explicit approval for that migration and exact branches, then separately approve narrowly scoped function EXECUTE grants. No table grants. No SQL run or grants in this task.
4. Separately review external key sourcing/rotation and enablement. Do not place key material in SQL, source, test output, environment files in Git, or client responses.
5. Only after these gates, perform bounded synthetic runtime acceptance for transaction replay/concurrency, expiry, audit, rate limiting, and owner isolation. Real enrollment, OTP, recovery codes, production activation, and admin routes need their own explicit gates.

## Acceptance and open evidence

The packet is ready when the service/adapter protocol is reviewed and its unresolved rate policy and receipt semantics are decided before code. The subsequent offline adapter slice passes focused tests, lint, typecheck, and build while remaining unreachable from routes or active configuration.

This packet and its mock/static checks do not verify ACC-08/ACC-09 and do not establish MFA. PostgreSQL transaction/locking, function ACLs, rate-limit durability, commit-uncertainty resolution, live session expiry, activity advancement, factor reset/revocation, enrollment, owner transfer, and browser enforcement remain unproven until their separately approved runtime gates pass.

## Offline protocol preparation (2026-10-08)

`lib/factor-service-protocol.mjs` now defines an additive two-phase challenge contract without changing `lib/factor-service.mjs` or assuming a live SQL function. It resolves managed identity, reads a closed owner/session/epoch/factor snapshot, verifies TOTP/recovery candidates in application code, then issues exactly one atomic consume or failure-audit call. The writer receives the full observed binding for database revalidation. No open transaction spans cryptographic verification and no generic database callback or reader is exposed.

An unknown writer result gets one owner/session/method-bound operation-receipt read; the protocol never retries the writer. Accepted results, including accepted receipts, are returned only after a fresh managed-session read and current owner/factor/epoch/revocation/rate-state read. A stale or expired context withholds success. The operation UUID is generated inside the service and never accepted from request input.

The frozen source requires rate limiting but gives no attempt threshold/window. This implementation exports a proposed bounded 5-failure/900-second policy and requires the trusted caller to supply a valid explicit policy; it is not a source-spec amendment or a production setting. The policy is copied/frozen during construction. Focused tests use synthetic fixtures only. This contract is not integrated with `factor-service.mjs`, a route, SQL, grants, or runtime configuration and makes no MFA claim.

Independent read-only review found no actionable defect in this offline contract candidate. The repository adapter gate remains incomplete until the receipt schema, proposed rate policy, SQL function contracts, and effective ACLs receive parent review and separate approval.
