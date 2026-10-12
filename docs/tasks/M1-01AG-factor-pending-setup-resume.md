# M1-01AG — Resume the same pending factor setup

Status: dormant 0015 SQL candidate plus offline orchestration and repository adapter candidates prepared. No resume route or application caller is wired. This packet defines a future explicit owner action for redisplaying the same pending TOTP setup material after a lost begin response. It adds no frozen requirement and does not authorize SQL execution, grants, routes, keys, credential activation, or MFA claims. The 0015 SQL and rollback-only verifier remain unapplied and unexecuted.

## Authority

- Frozen Section 11.22(D), `ACC-08`: owner/admin access requires a verified second factor; TOTP secrets are encrypted server-side; rate-limit factor attempts; audit factor changes without logging secrets or codes. The explicit one-use rule applies to hashed recovery codes, not to a TOTP setup QR.
- Frozen Section 11.15, `ADM-07`: trusted provider identity and immutable subject binding are required; email text or browser role is not authority.
- Shared safeguards Sections 15.B and 15.D: owner scope, fresh identity/session checks, closed requests, private outputs, auditable mutations, fail-closed unknown outcomes, and no automatic retry of uncertain writes.
- Current design and migration: `docs/tasks/M1-01AE-factor-enrollment-writer-design.md`, `lib/factor-enrollment-protocol.mjs`, and `db/migrations/0014_factor_enrollment.sql`. Corrected migration SHA-256 `B0F550D351D33D41A6FB1728692F61845DB56566935410DE56AFBB908AB8E1EE` was applied to both pinned synthetic branches at source revision `7e4d47468fa5b054eca4b19078d10e1d92b796ea`. The rollback-only catalog/unmapped-denial checks and baseline-14 restricted-app checks passed on both branches. The factor principal remains `NOLOGIN`; the new enrollment-operation table has zero rows. These checks do not establish successful enrollment, concurrency behavior, configured credentials or keys, or MFA acceptance. Migration 0014 supports only `begin` and `verify`; it does not implement this packet's `resume` action.

## Proposed behavior

An explicit `resume` action may redisplay only the encrypted seed already stored for the account's existing `pending` factor. It never creates a new factor, increments the security epoch, generates a seed, changes the envelope, or returns the seed from a status receipt. The action is tied to the original begin operation and the exact original managed-auth session, issuer, and subject. A current fresh resolver read must confirm that same session is still valid and maps to the same active owner/admin account. Any account, factor, epoch, begin-operation, issuer, subject, or session mismatch refuses the release.

The first candidate is intentionally limited to the same still-valid managed session used for begin. A different session, including signing in again after logout, cannot resume this operation under this proposal. Cross-session recovery needs a separate identity-binding and audit review; it must not be inferred from matching email or account text.

The trusted server decrypts the same envelope with the same key ID and the same AAD tuple `(environment, accountId, factorId, securityEpoch, keyId)`. It checks those bindings against the private pending-factor row before the release writer and rereads them after the writer. A verified, revoked, missing, replaced, expired, or wrong-epoch factor never releases setup material.

## Closed request and private port proposal

The browser body is exactly:

```json
{"operationId":"<new UUID>","beginOperationId":"<existing begin UUID>"}
```

Both IDs are canonical UUIDs. The resume operation ID is new and is used only for idempotency. The browser cannot supply account, identity, role, session, factor, epoch, key ID, envelope, secret, fingerprint, outcome, or rate policy. The request is an explicit user action, not an automatic retry or a status lookup.

The server uses the existing trusted managed-session resolver and the following fixed repository operations; there is no arbitrary SQL callback:

1. `readEnrollmentContext(identity)` obtains current active account/role/epoch and pending-factor metadata.
2. The repository maps the resume status lookup to the dedicated private `read_factor_enrollment_material_receipt(...)` function, binding operation, account, factor, epoch, begin operation, and trusted session. A prior receipt returns only its safe acknowledgment; it never returns material. Existing 0014's generic reader remains limited to `begin|verify`.
3. `readPendingFactor(identity, {expectedAccountId, expectedFactorId, expectedSecurityEpoch, expectedBeginOperationId})` obtains the existing key ID and ciphertext envelope for the exact pending begin record. The adapter must map these named values to fixed SQL parameters and accept no caller-selected authority.
4. `releaseMaterial(identity, {operationId, beginOperationId, expectedAccountId, expectedFactorId, expectedSecurityEpoch, expectedEnvelopeKeyId, requestFingerprint})` maps to `record_factor_enrollment_material_release(...)`. The adapter must resolve only after the transaction commits; offline tests cannot prove that. The SQL function atomically rederives and locks the active account/session, exact pending factor/epoch/begin row, and envelope key ID; it enforces the bounded release window, writes one release audit event, and stores a `resume` receipt. It does not return or store plaintext material.
5. After an exact first-commit writer response, the service repeats fresh identity/context and pending-envelope reads, comparing exact account, unchanged owner/admin role, issuer, subject, session, factor, epoch, begin operation, key ID, and envelope to the pre-writer snapshot. Only an unchanged pending binding permits key lookup and decryption for this invocation.

The private SQL writer is `record_factor_enrollment_material_release(text,text,text,timestamptz,uuid,uuid,uuid,uuid,bigint,text,bytea)`. Its internal JSON acknowledgment has nine fields: `{status, operationId, kind, accountId, factorId, securityEpoch, requestFingerprint, beginOperationId, newlyCommitted}`. `kind` is `resume`; `status` is `released`, `rejected`, or `unknown`. The server may deliver the same setup secret only when the writer reports `released` and `newlyCommitted: true`, and the service's post-write identity, session, factor, epoch, key, and envelope checks still match. The database does not return plaintext material.

The private SQL status reader is `read_factor_enrollment_material_receipt(text,text,text,timestamptz,uuid,uuid,uuid,bigint,uuid)`. Its eleven-field result is `{status, operationId, kind, accountId, issuer, subject, sessionId, factorId, securityEpoch, beginOperationId, requestFingerprint}` and never includes `newlyCommitted`, envelope, key, or plaintext. A historical receipt cannot authorize material delivery. Unknown or malformed writer results trigger at most one status-only lookup; a reconciled receipt must match the exact request fingerprint before its status is reported. There is no mutation retry.

The task packet, SQL, orchestrator, and repository adapter represent only candidate contracts. The orchestrator's private secret property is non-enumerable and does not implement a browser delivery path. No route or application caller is enabled. The candidate preserves the existing account and factor function ACLs, adds no `GRANT`, and does not make the dormant factor principal usable. Offline adapter tests do not prove environment/branch pinning by its injected query runner, transaction commit timing, SQL behavior, or provider-session semantics.

The pure offline orchestrator is in `lib/factor-enrollment-resume-protocol.mjs`. It accepts only a new resume operation UUID and the original begin UUID; the two must differ. It binds the initial owner/admin role, same managed-auth issuer/subject/session, active account, exact pending factor/epoch/begin fingerprint, key ID, and encrypted envelope across its read/write/read sequence. A historical receipt is status-only. Only a nine-field `released` acknowledgment with `newlyCommitted: true`, followed by fresh binding checks, may reach key lookup and decryption. After an uncertain writer result, it makes one status-only lookup and requires the stored request fingerprint to match; it never retries the mutation. The repository port must resolve only after its transaction commits, a condition not proven by these offline checks.

## Offline repository adapter candidate (2026-10-12)

`lib/factor-enrollment-postgres-repository.mjs` now includes a separate `createFactorEnrollmentResumePostgresRepository(environment, runQuery)` factory with exactly five resume operations: context read, begin-receipt read, material-receipt read, pending-factor read, and material-release write. It keeps the existing begin/verify repository API unchanged and maps the two resume operations to fixed parameterized calls for `read_factor_enrollment_material_receipt(...)` and `record_factor_enrollment_material_release(...)`. It accepts only a string environment and snapshots returned JSON recursively from plain objects/arrays with own data properties; accessors, symbols, custom serialization/prototypes, undefined values, and non-finite numbers are refused before use.

The adapter validates exact 11-field material receipts and 9-field release acknowledgments, canonical IDs/fingerprints, and bound status. A malformed or throwing release call returns `unknown`; it does not retry. Existing offline interop coverage exercises one uncertain write plus one status-only receipt lookup and verifies no key lookup, decryption, or material delivery occurs. The adapter is not wired to a route or caller; tests do not establish branch pinning, transaction commit timing, SQL correctness, or PostgreSQL locking behavior. Migration 0015 remains unapplied, with no keys, grants, credentials, or enrollment enabled. Checks and hashes are recorded in `docs/qa/2026-10-12-M1-01AG-resume-repository-adapter.md`.
## Rate and audit proposal

Use the existing account-wide five-attempt/15-minute window to bound explicit material-release attempts. The SQL candidate increments first and rejects the fifth attempt and later attempts in that window, so it allows at most four releases; this conservative behavior is an implementation candidate, not a new frozen limit. An existing operation receipt is checked before incrementing, so same-operation replay causes no second counter increment or audit event. The transaction rejects before material release when limited. This is an engineering proposal reusing existing bounds.

Migration review must add a distinct `enrollment_material_released` audit outcome to the allowlist rather than mislabeling a release as `enrollment_started`. Record actor/account, factor/epoch, original begin operation, resume operation, time, and outcome only. Never record the seed, QR URI, key, ciphertext copy, OTP, or raw errors. The event records an authorized release attempt, not proof that the browser received or retained the response.

## Replay, failure, and delivery rules

- A same-operation replay is status-only: it returns the original safe acknowledgment and never returns the seed or creates another audit/counter change.
- A changed or foreign operation binding is rejected. A missing, unknown, stale, or malformed status stays unknown/unavailable without repeating the writer.
- A new explicit resume operation may authorize redisplay of the same still-pending encrypted seed and must create a distinct audit receipt. It cannot mint a replacement secret or advance the epoch.
- No API or client path serializes setup secrets into ordinary JSON/logging. A future route must use a reviewed private delivery mechanism; the protocol's non-enumerable internal field alone does not make a secret appear in JSON and must not be treated as a delivery implementation.
- Logout, session expiry, account suspension, identity revocation, role change, factor verification/revocation, or epoch change prevents release. Cross-session reauthentication is outside this packet.

## Acceptance gates and open limits

Before any migration execution, review the new `resume` operation kind, release-window accounting, `enrollment_material_released` audit outcome, and exact PostgreSQL deparsed CHECK definitions against migration 0014 and the frozen constraints. A metadata-only query through existing restricted application bindings on both pinned branches confirmed the installed 0014 timestamp, kind, status, and begin/verify lifecycle definitions; the 0015 UP guard was aligned to those exact definitions. Since 0015 remains unapplied, its newly created CHECK deparse output is still unobserved; capture that metadata after a reviewed UP, then align the DOWN/operator guards before rollback verification. Offline static checks do not prove that SQL compiles or runs. The rollback-only SQL verifier exercises unmapped-identity denial and asserts row counts are unchanged; it does not test a live owner flow, SQL locking, durability, concurrency, or real provider-session semantics.

This proposal does not define cross-session recovery, pending expiry/cancellation, factor reset, recovery-code issuance, key custody, a QR transport, or an owner/admin fixture. It does not grant the dormant factor principal any functions or enable the existing candidate code. Live acceptance remains separate and must demonstrate the existing factor security requirements without relying on mocks.
