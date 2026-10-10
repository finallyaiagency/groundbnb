# M1-01AD — Privileged-factor enrollment, recovery, and reset contract

Status: offline preparation contract with a pure request/acknowledgment validator candidate. This packet does not authorize SQL execution, role activation, credential or key provisioning, MFA enrollment, route exposure, or privileged access. The frozen specification and its hash remain authoritative; this packet proposes implementation boundaries for existing requirements and creates no new product requirement.

## Read first and authority

Read `AGENTS.md`, `docs/STATE.md`, `docs/tasks/M1-01AA-factor-runtime-boundary.md`, `docs/spec/09-admin-usage.md`, `docs/spec/15-shared-safeguards.md`, frozen Section 11.15 and Section 11.22(D), and the exact current migrations/code named below. Relevant stable requirements are ACC-08, ADM-01, ADM-06, ADM-07, SYS-11, and LEG-12. ACC-09 is a dependent eligibility gate for owner transfer, not implementation scope here. The frozen source controls; do not mark these requirements implemented or verified from this packet.

## Current implementation boundary

- `db/migrations/0009_privileged_factors.sql` already defines account security epochs/events; append-only factor enrollment history with `pending`, `verified`, and `revoked` states; recovery rows containing a salted digest; accepted TOTP steps; session-bound factor attestations; attempt windows; and factor audit events. A partial unique index permits only one pending or verified factor per account and epoch. Its enrollment trigger requires inserts to begin `pending`; state/secret identity is immutable; factors and recovery history cannot be deleted or restored.
- `db/migrations/0010_factor_recovery_activity.sql` adds recovery-source attestations and session activity binding. Epoch changes are constrained to exactly one monotonic increment, and accepted-step, recovery-consumption, attestation, activity, and audit history are guarded.
- `db/migrations/0012_factor_service.sql` exposes five private challenge functions: challenge-state read, failed-attempt recording, TOTP candidate consume, recovery candidate consume, and operation receipt read. Challenge reads and consume require an already `verified` factor; there is no pending-enrollment verification operation. Its receipt table is challenge-only (`attempt`, `totp`, `recovery`) and cannot be reused as a lifecycle receipt without a reviewed schema change.
- `lib/factor-storage.mjs` provides context-bound AES-256-GCM envelope operations and salted recovery-code digest helpers. It does not select/provision a key, issue recovery codes, or persist enrollment. `lib/factor-verifier.mjs`, `lib/factor-service-protocol.mjs`, `lib/factor-postgres-repository.mjs`, and `lib/privileged-access.mjs` are offline candidates, not an active route or live service.
- There is no factor enrollment/reset/recovery issuance route, no configured key provider, no factor database connection, and no proof of provider session revocation behavior. `lib/admin-bootstrap.mjs` is only a pure candidate; the live synthetic users are not to be promoted as owners/admins by this task.
- Corrected migration `0013_factor_service_principal.sql` was applied under D-017 on the pinned local and preview branches; both exact NOLOGIN principals expose only the five existing 0012 factor functions, and the direct baseline-13 app boundary and rollback-only verifier passed on both. Lifecycle functions still require a separate exact function-grant contract and action gate. Ordinary app roles retain their exact allowlist and receive no factor function/table/helper access.

## Offline enrollment request/acknowledgment validator candidate (2026-10-10)

`lib/factor-enrollment-contract.mjs` is a pure shape validator for future `begin` and `verify` enrollment requests and their minimal acknowledgments. It accepts a canonical fixed-length operation UUID; `verify` also requires exactly six ASCII digits. Closed own-data-property validation rejects unknown keys, symbols, and accessors without invoking getters. The returned verification code is non-enumerable. Acknowledgments bind the exact expected operation UUID and a small operation-specific outcome set; an unknown outcome forbids mutation retry and requires status lookup. The module does not resolve identity/session/role, check a durable receipt, write a factor, verify a code, or grant access. The extended existing protocol test remains offline evidence only; see `docs/qa/2026-10-10-M1-01AD-enrollment-validator.md`.

## Proposed bounded implementation after prerequisites

Prepare a separate dormant forward/reverse migration and a server-only lifecycle service behind an off-by-default mode, after the corrected 0013 candidate is separately approved, applied, and verified on both pinned synthetic branches (completed under D-017). Keep the dedicated factor role NOLOGIN until its own later credential gate. Do not bind it or a key provider as part of this task.

The lifecycle writer surface should consist of fixed, parameterized, owner-scoped operations. Do not expose generic SQL, arbitrary transaction callbacks, table access, caller-selected accounts, client-provided roles, profile emails, or client-supplied factor/envelope authority. The server derives issuer, subject, managed-session ID/expiry, account, role, factor, and epoch from trusted providers and the pinned branch. Every function rechecks current identity/session/account/role and locks account, epoch, factor, then lifecycle receipt in one database transaction. Preserve the established lock ordering from 0012 and do not hold a database lock while JavaScript verifies a code.

### Enrollment

1. A begin operation is available only to the signed-in account's own active owner/admin identity after the trusted bootstrap gate. It creates one pending factor at the current server-owned epoch and appends an `enrollment_started` audit event atomically. It accepts no account ID, role, epoch, key ID, envelope, secret, or verification status from the browser. Secret generation and encryption happen server-side using the reviewed TOTP implementation, a CSPRNG, and the approved external key provider; no crypto scheme or key custody is invented here.
2. A separate confirmation operation verifies the submitted code against the pending secret in the server, then atomically rechecks the pending factor, account/session/epoch, current time, replay step, and rate state. Only the successful commit changes `pending` to `verified`, records the accepted step/attestation and `enrollment_verified` audit event. Invalid, stale, replayed, expired, throttled, or uncertain outcomes never grant factor access or reveal whether protected data exists.
3. Enrollment state and one-factor-per-epoch constraints are preserved. The function must define an explicit, reviewed policy for abandoned pending enrollments; the current schema has no pending expiry field, so this packet does not invent a duration. Until that policy is decided, a pending row cannot be silently overwritten or deleted.
4. The provisioning material or QR setup payload is shown only to its owner in the enrollment flow, never logged, persisted in plaintext, or returned by ordinary account APIs. A lost/uncertain enrollment response must not cause a second factor or secret to be issued by replay.

### Recovery-code issuance and use

1. Recovery codes are issued only after a verified factor challenge, using the existing factor/epoch-bound salted digest format. Persist only digests/salts and issuance audit metadata; show the plaintext set once through a deliberately sensitive response. Replays and status receipts return no plaintext codes.
2. Existing code format in `factor-storage.mjs` is a 32-byte base64url value with a 16-byte salt and 32-byte digest. The frozen source and current schema do not specify the number of codes or an explicit reissue UX; keep count and user-facing recovery flow as decisions to resolve before implementation, rather than inventing them here.
3. A recovery consume remains one-use, account/factor/epoch/session-bound, rate-limited, audited, and atomic with its attestation. Concurrent replay must produce at most one accepted result. A changed payload under an existing operation ID is rejected.
4. A recovery issuance whose commit result is uncertain is never automatically retried and never returns stored plaintext from a receipt. Define a safe user recovery path (for example, a fresh factor challenge followed by explicit replacement that invalidates prior unconsumed codes) before implementation; preserve consumed/history rows and append audit records.

### Reset, revocation, and epoch

1. Normal factor revocation/reset requires the account's current valid factor and a recent challenge, with the five-minute sensitive-action boundary from Section 11.22(D). It cannot be performed by a normal password/Google session alone. The operation atomically marks the factor revoked, advances the account security epoch exactly once, appends the corresponding `security_epoch_events` and `privileged_factor_audit` rows, and invalidates prior attestations/session activity before returning success.
2. New enrollment after revocation uses the new server-owned epoch. No previous factor, accepted step, recovery digest, attestation, bootstrap grant, or role can be restored by replay or re-registration. Factor rows and audit history are not deleted.
3. If all owner methods are lost, only the separate controlled direct-database break-glass process in Section 11.15 may recover access with verified identity evidence and a separate audited factor-reset step. This packet neither implements nor bypasses that operator workflow.
4. The epoch schema already permits reasons `factor_enrollment`, `factor_revocation`, and `factor_reset`; the implementation must choose and consistently audit the transition point for each event. The exact epoch increment point for starting versus completing first enrollment remains an explicit design decision; do not mutate immutable `factor_id/account_id/epoch/envelope/created_at` to cross epochs.

### Idempotency, audit, and output rules

- Each lifecycle mutation gets a fresh operation UUID and an immutable, owner/session/method-bound receipt in the same transaction as its changes. A lifecycle receipt must distinguish begin, verify, issue/replace recovery, revoke, and reset; do not overload 0012's challenge-only operation kinds without a reviewed migration. Same-operation/same-payload replay returns only the original safe acknowledgment; operation-ID collision or changed-payload replay refuses. Unknown commits receive one exact receipt lookup and no automatic mutation retry.
- Receipts and audits contain only IDs, operation kind, outcome/reason, epoch, and timestamps needed for accountability. They never contain OTPs, recovery codes/digests, secret envelopes, keys, provisioning URIs, raw provider errors, or protected resource data. Audit remains append-only and owner-scoped.
- No protected admin route/read is enabled by enrollment setup. Before a verified factor and current session-bound attestation, diagnostic, usage, audit, user-management, grant, role, cap, and factor-management protected content remains inaccessible. Sensitive changes require a challenge within five minutes; factor freshness is at most 12 hours and inactivity at most 30 minutes.
- Provider session revocation is checked using the pinned Neon Auth session row and fresh provider reads, but behavior under revoke/delete races must be established from current official provider documentation and a bounded synthetic acceptance run. A row lock alone is not proof of immediate provider revocation.

## Migration and authorization boundary

A later lifecycle migration must pin the exact current receipt baseline and both synthetic branches; preserve 0009–0012 history/constraints and private ACLs; add only fixed lifecycle functions/receipt storage needed by this contract; use fixed search paths and SECURITY DEFINER owner checks; and grant EXECUTE only to the exact branch factor principal after its own confirmation. It must not grant the ordinary app roles, `PUBLIC`, a shared owner role, or a broad runtime role. No direct table grants are permitted. Its reverse must refuse any lifecycle operation, factor/recovery/audit/epoch history, or runtime activation rather than deleting security history. Static SQL checks do not prove SQL runtime or effective ACL behavior.

Separate future gates are required for (a) approved 0013 NOLOGIN migration, (b) same-principal local/preview LOGIN activation and credential binding, (c) external key provider selection/provisioning/rotation/recovery, and (d) lifecycle function grants and runtime mode. Keys and database credentials are distinct, branch-pinned, and absent from repository, client, logs, diagnostics, and AI context. No production/recovery principal, key, user, or enrollment is in scope.

## Open decisions and dependencies

1. **0013 prerequisite:** closed for the dormant NOLOGIN principal migration under D-017 and the exact corrected hash. Same-principal LOGIN/credential activation and lifecycle-function grants remain separately gated.
2. **Trusted bootstrap:** decide and prove the durable first-owner/admin seed binding and revocation behavior before any synthetic account is assigned a privileged role. Existing fixtures are ordinary synthetic users.
3. **Server/key custody:** select the real trusted server boundary and external key provider; document per-environment key IDs, generation, rotation with old-key decryption, backup/recovery, and retirement. No key is available in this task.
4. **Pending enrollment:** define expiry/cancel/restart semantics without deleting history or overwriting an existing pending enrollment.
5. **Recovery issuance:** define number of codes, one-time display/reissue UX, and uncertain-commit recovery semantics without persisting plaintext.
6. **Epoch transition:** decide whether first-enrollment epoch advancement happens at pending creation or successful verification, consistent with immutable factor epoch binding and the monotonic event guard.
7. **Provider races:** verify Neon Auth session revocation/deletion semantics, lock ordering, and exact outcome when a session is revoked during challenge or lifecycle commit.
8. **Lifecycle grants:** define exact function signatures and lifecycle operation receipt shape; keep additional grants separate from 0013's five challenge functions and action-gated.

## Acceptance gates for a later implementation task

### Offline preparation

- Exact schema/function contracts and source requirement mapping reviewed before coding; no change to frozen requirements or status.
- Deterministic tests cover closed request keys, trusted owner/session mapping, pending-only begin, valid versus invalid/stale/replayed enrollment code, single accepted TOTP step under concurrency, recovery digest-only persistence and one-use consume, reset epoch advancement/attestation invalidation, audit append-only behavior, same-payload receipt replay, changed-payload refusal, unknown commit without automatic retry, no plaintext/code/key/secret in receipts/errors/logs, and rollback refusal with any retained lifecycle history.
- Static SQL guards assert exact role/function/ACL scope, branch pins, app baseline unchanged, owner/epoch/session checks, finite timestamps, fixed search path, and private helper/table access. Tests do not claim SQL execution or runtime MFA.

### Live synthetic acceptance, only after all separate gates

- On pinned local and preview synthetic environments, verify exact receipts, role attributes/effective ACLs, branch-specific credentials and key IDs without displaying them; production/recovery are untouched.
- Verify a verified synthetic owner/admin can begin enrollment, but pending enrollment grants no privileged read. Invalid/stale/replayed confirmation stays pending and exposes no protected data; one valid confirmation commits once and is tied to the trusted account, issuer, subject, epoch, factor, and managed session.
- Verify recovery codes display only once, are never returned from replay/status, persist only salted digests, and each is accepted at most once under concurrent use; invalid attempts are rate-limited/audited.
- Verify reset/revoke requires recent challenge except the separately controlled break-glass path, increments the epoch atomically, invalidates prior attestations and recovery material, and cannot restore a revoked bootstrap subject.
- Verify session revoke/delete races with current provider documentation and captured bounded acceptance; no mock or row lock alone is a pass.
- Verify 12-hour factor freshness, 30-minute inactivity, and five-minute sensitive step-up edges; all denials, unavailable/unknown outcomes, and errors reveal no protected data or secret and do not retry consumes.
- Run protected-route browser checks before enrollment, while pending, after valid challenge, after idle/freshness expiry, and after reset/revocation. Close the bounded window and restore exact prior local configuration.

No acceptance gate in this packet is claimed complete. The pure request/acknowledgment validator is offline preparation only; it does not authenticate a caller, persist lifecycle state, verify a factor, or grant access. No migration, grant, key, login credential, route, or live factor operation is authorized by this task packet.
