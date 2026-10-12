# M1-01T — Trusted factor service contract

## Purpose and limits

Prepare the server-side contract that will make the existing factor verifier, encrypted storage, and privileged-access policy usable by trusted application code. This task is offline only: no live enrollment, OTP/recovery-code generation, key provisioning, route activation, SQL execution, database grants, or production identity changes. It must not claim MFA is active or verified.

The current components are decision/crypto primitives, not a service: `lib/factor-verifier.mjs` returns a candidate TOTP step; `lib/factor-storage.mjs` encrypts/decrypts a supplied secret and hashes/checks a supplied recovery code; `lib/privileged-access.mjs` evaluates trusted state but does not load it or persist an attestation. Migrations 0009 and 0010 are dormant storage only. The current session resolver verifies a managed session but deliberately returns only issuer and subject. No factor route or durable writer exists.

## Authority

- Frozen spec Section 11.22(D), ACC-08 and ACC-09: require verified second factor for owner/admin access; factor challenge at least every 12 hours; 30-minute idle expiry; sensitive actions require a challenge in the prior five minutes; log outcomes without secrets; rate-limit; factor reset revokes privileged sessions; ordinary owner recovery cannot bypass MFA; transfer is a separate atomic two-party process.
- Frozen spec ADM-01, ADM-06, ADM-07, SYS-07 and Section 11.15: roles come only from trusted server-side records/bootstrap; preserve audit and account ownership; do not allow public signup or request fields to create authority.
- The governing lifecycle details are in `docs/tasks/M1-01I-privileged-policy.md`, `M1-01L-factor-verifier.md`, `M1-01N-factor-storage.md`, `M1-01P-factor-records.md`, and `M1-01S-factor-service-context.md`. Shared rules are in views 00, 07, 12 and 15. These packets and views do not amend the frozen source.

## Proposed bounded implementation

Build a server-only service boundary with exact inputs and outputs, injected dependencies, closed failure results, and no route/UI wiring. Split the work into two reviewable layers:

1. **Managed-session identity prerequisite.** Add a separate internal resolver (proposed `resolveManagedSessionIdentity`) that performs a fresh managed-auth SDK read and returns only the pinned issuer, verified subject, managed session ID, and validated expiry. It must reject missing/malformed/expired session data and invalid server time. Keep the existing `resolveSessionIdentity` return shape unchanged so current account APIs cannot accidentally expose session IDs. Never accept session identity or expiry from request JSON, cookies decoded by application code, or caller-supplied headers. This layer gets its own offline tests before factor orchestration.
2. **Factor service contract.** Add a server-only `lib/factor-service.mjs` that accepts trusted resolved identity, server clock, environment/key provider interface, and a narrow injected persistence interface. It must not import a generic SQL client or use direct table access. It must not be wired into an HTTP route in this task. Until a separately reviewed durable writer exists, repository calls are contract doubles only and results are explicitly non-live.

Define the service operations and repository calls for: begin enrollment; verify/complete pending enrollment; challenge with TOTP; challenge with one-time recovery code; evaluate privileged access for a requested read/action; record valid privileged activity; revoke/reset a factor. Keep owner transfer, bootstrap grants, account deletion, and break-glass recovery outside this service; they need their own authorized lifecycle operations.

### Trust and atomicity contract

- Resolve account, role, status, suspension, identity binding, current security epoch, factor state, managed session, and recent revocation from trusted persistence for every operation. Email, profile fields, client role, submitted account IDs, epoch, factor state, clock, freshness, challenge result, and `sensitive` authorization are never caller authority.
- Require exact issuer + subject + managed session ID binding for the attestation. The managed session must be freshly verified and unexpired. No raw auth cookie/token is stored or returned.
- A TOTP match is only a candidate until one transaction locks/rechecks current account/factor/epoch/rate state, inserts the unique accepted step, writes the challenge audit and session-bound attestation, and commits. Two concurrent uses of one step yield at most one successful attestation. Report accepted only after commit.
- A recovery candidate is compared with stored salted digests and consumed exactly once in the same transaction that writes its recovery-source attestation and audit. It cannot manufacture a TOTP step. Concurrent replay has at most one winner.
- Invalid, expired, stale-epoch, cross-account/session, suspended, revoked, unknown, rate-limited, or storage/key-error cases fail closed and reveal no protected data. Persist only bounded outcome/reason metadata; never log or persist submitted codes, plaintext secrets, enrollment URIs, raw cookies/session tokens, or recovery codes.
- Failed-attempt throttling and its audit must survive a rejected challenge; successful consumption, attestation, and success audit must be atomic. An uncertain commit is not retried automatically and is reported as an unavailable/unknown outcome, not success.
- Enrollment is pending until a valid first challenge is durably consumed. Pending factors never authorize access. Secrets are encrypted with the existing context-bound AES-GCM helper and an externally supplied environment-specific key; this task does not create, store, rotate, or provision that key. Recovery material is high-entropy and only salted digests persist; this task does not issue real recovery codes.
- Factor reset/revocation must atomically advance the security epoch, revoke privileged attestations/activity, preserve append-only audit/history, and immediately invalidate privileged sessions. The normal owner path requires a currently valid step-up; recovery/break-glass remains the separately controlled direct-database process.
- Before any privileged data read, evaluate fresh trusted state with the existing policy: active owner/admin, current epoch, enrolled verified factor, same account/issuer/subject/session, challenge no older than 12 hours, activity younger than 30 minutes, and (for sensitive actions) challenge no older than five minutes. Missing state denies before protected data is read. Activity is server-timestamped and cannot extend factor freshness or step-up age.

## Files and checks

Expected files for the offline contract slice:

- `lib/session-identity.mjs`: additive internal managed-session resolver; preserve current resolver behavior.
- `lib/factor-service.mjs`: service orchestration and exact dependency contracts only; no route wiring or live persistence.
- `tests/session-identity.test.mjs`: add identity/session/expiry/clock rejection cases for the new resolver without weakening current assertions.
- `tests/factor-service.test.mjs`: deterministic contract tests using injected persistence/clock/key doubles.

Run only the focused tests and repository lint/type checks relevant to these files. Test exact closed inputs, account/session/epoch binding, stale and boundary timestamps, two concurrent TOTP candidates, two concurrent recovery candidates, failure before protected read, audit/attestation commit ordering, rollback/unknown outcomes, rate limits, key absence/error, and secret-free diagnostics. These tests prove service contract behavior with doubles; they do not prove SQL locking, Neon runtime behavior, browser acceptance, or effective authorization.

## Separate prerequisites and approval gates

The durable service cannot be activated by this slice. Migrations 0009/0010 remain unapplied, and their tables have no reviewed factor writer functions or application EXECUTE grants. A later, separately reviewed writer migration must provide a small closed set of `SECURITY DEFINER` transaction functions with fixed `search_path`, owner/issuer/subject/session binding, function-only ACLs, exact app-role allowlist, status/receipt contracts, and guarded rollback behavior. Do not grant direct table access. Do not add grants or execute SQL in M1-01T.

Before any runtime activation, require explicit owner approval for the exact migration and branch scope, review the external key-provider/configuration and rotation/recovery design, then separately approve narrow function grants and environment binding. Preview/local runtime acceptance must use only the sole synthetic identity, synthetic factor data, disabled dispatch/email as already required, and a bounded approved run. Production factor enrollment/activation requires a distinct explicit gate and real operator-controlled key provisioning. No real OTP or recovery code may be requested or entered as part of offline acceptance.

## Acceptance and remaining evidence

Pass this preparation only when focused offline tests and lint/type checks pass, old account-session API behavior is unchanged, the service has no route/activation path, and diagnostics/results contain no secrets. Record the exact revision and checks in the task evidence when implemented.

This does not verify ACC-08 or ACC-09. Still required later: real database transaction/concurrency proof for step/recovery one-use, durable rate-limit behavior, audit/attestation atomicity, effective app-role ACLs, key rotation/recovery, live synthetic login/enrollment/challenge/expiry/reset, immediate session revocation, and separate owner-transfer acceptance. A mock or dormant schema is not live MFA evidence.

## Offline implementation subset and current limits

The current offline service slice implements only TOTP/recovery challenge orchestration and a read-only privileged-access wrapper over injected interfaces. It does not implement enrollment issuance/completion, recovery-code issuance, factor activity persistence, factor reset/revocation, any database repository adapter, route wiring, or grants. Access callbacks receive only the repository's frozen narrow read scope; they must not mutate. The service rechecks current policy after the read and again after the repository transaction reply, withholding the result if the session or challenge expires or access is revoked. Resolver expiry timestamps retain all one-to-nine fractional digits in nanosecond comparisons; database policy timestamps use PostgreSQL microsecond precision. The repository must enforce serialized bindings, current-session expiry, and transaction guarantees; test doubles prove interface behavior only. No MFA activation or live acceptance is claimed.
