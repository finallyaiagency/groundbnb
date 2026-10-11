# M1-01AF — Synthetic bootstrap and durable role-binding design

Status: offline design candidate only. No schema, function, role, account, provider session, or privilege fixture is created by this packet. It does not authorize production bootstrap, account-role writes, operator recovery, factor activation, or changes to frozen requirements.

## Authority and scope

Read `AGENTS.md`, `docs/STATE.md`, `docs/spec/09-admin-usage.md`, `docs/spec/15-shared-safeguards.md`, frozen Section 11.15 and Section 11.22(D), plus `lib/admin-bootstrap.mjs`, migrations 0002, 0009–0013, and `db/recovery/0001_controls.sql` before implementation. The frozen source is authoritative. This design maps only existing requirements: ADM-01, ADM-06, ADM-07, ACC-08, SYS-11, and LEG-12. ACC-09 owner transfer remains a separate dependent flow. No requirement status changes follow from this document.

Section 11.15 specifies the first trusted verified sign-in for three seed identities, immutable account-subject binding, no duplicate account/password, one-time bootstrap completion, and no deployment-time regrant of a deliberately revoked role. Section 11.22(D) requires enrolled and verified second factor before privileged content, recent step-up for sensitive actions, retained/audited bootstrap revocation, and a separate controlled direct-database break-glass owner-recovery path. Section 11.22(C) requires local/preview to use synthetic identities rather than the three production seed identities. Section 11.22(D) also requires recovery controls outside the restored production target; if that control ledger is unavailable, a restore stays quarantined.

## Current boundary

- `lib/admin-bootstrap.mjs` is a pure candidate evaluator. It has no durable role writer, transaction, receipt, audit, or recovery-ledger integration.
- `groundbnb.accounts.role` supports `member`, `admin`, and `owner`; `account_identities` binds `(issuer, subject)` to an account and has a `revoked_at` field. Migration 0002 is synthetic-only, seeds one `@example.test` identity, and constrains `verified_email` to `@example.test`; it is not a production bootstrap schema.
- Migrations 0009–0013 provide factor state, security epochs, factor/service boundaries, and a dormant factor principal. They do not grant bootstrap roles or implement owner recovery.
- `db/recovery/0001_controls.sql` defines an isolated `recovery_control.events` ledger with `bootstrap_revoked` among its event kinds and HMAC-keyed identifiers. It has no bootstrap writer, cross-database transaction, or live app lookup. Its existence does not prove revocations are mirrored or enforced.
- The current synthetic Auth fixture is an ordinary member and must remain so. Do not turn it, the production seed addresses, production subjects, or copied production auth rows into a synthetic owner/admin fixture.

## Proposed closed synthetic-only contract

The first implementation should exercise the authorization boundary with a separate, environment-bound test mapping, for example three aliases under `@example.test`. The fixture identities and their immutable provider subjects are generated only inside the isolated local/preview test environment. They are not derived from or copied from the three production seed email addresses or any production subject. The test mapping is unavailable to production configuration; an environment/policy mismatch refuses closed.

Bootstrap itself never creates an account. A normal account-provisioning flow may create a standard member account independently, but a seed activation only considers an already-existing account that is active, has role `member`, and is linked to the exact trusted `(issuer, subject)` for the current sign-in. The server obtains verified email, issuer, and immutable subject from the trusted provider; profile values, request fields, unverified claims, aliases, or another issuer cannot select a seed or establish identity.

### Private durable records

Prepare a versioned, private schema candidate (names are provisional) with these records:

| Record | Required semantics |
| --- | --- |
| `bootstrap_control` | One row per environment/policy version. Records one-time policy initialization and completion timestamps, with monotonic state and no reset-on-deploy path. Bound to `environment_identity`; a local/preview policy accepts only its synthetic seed map. |
| `bootstrap_bindings` | One immutable binding per configured seed slot: account ID, issuer, subject, role, activation time, and optional revocation time/reason. Unique constraints prevent a seed slot, account, or `(issuer, subject)` from being activated twice. In this synthetic implementation, identity values are fixture-only. No delete or rebinding transition is allowed. |
| `bootstrap_operations` | Immutable operation UUID and minimal original acknowledgment, bound to seed slot, account, issuer/subject binding, outcome, and timestamp. A same-operation replay returns the original safe acknowledgment; changed input or an unknown commit cannot cause a second grant. No email, token, secret, provider error, or protected content is returned in an acknowledgment. |
| `admin_audit` (or the reviewed existing audit table) | Append-only actor/action/target/role-change metadata for initialization, activation, revocation, and controlled resolution. The write commits with the role and binding change. No codes, credentials, provider tokens, or profile payloads. |
| `bootstrap_revocations` | Retained tombstone for every deliberately revoked seed binding. A revoked `(issuer, subject)` can never reactivate; a new subject claiming the same seed slot/email also refuses pending separately authorized controlled resolution. The tombstone is not erased by ordinary account deletion or redeployment. |

The synthetic contract uses one-time policy initialization plus three independent seed activations. Each slot can activate once; the durable bootstrap state becomes `complete` only after all three slots have an accounted activation or retained refusal/revocation outcome, and is immutable afterward. A single boolean must not stop the other first sign-ins or permit deployment replay. This is an implementation interpretation of Section 11.15, not a frozen-source amendment; production semantics and live activation remain separately gated.

### Protocol-only service boundary

The first code slice is an offline protocol over injected resolver and repository ports. It does not add or call SQL, create accounts, configure an Auth provider, issue credentials, write a role, or enable a route. Freeze these closed value shapes before a database adapter is authored:

| Value | Exact fields and semantics |
| --- | --- |
| Trusted session input | `{ issuer, subject, sessionId, expiresAt, email, emailVerified }`. `emailVerified` must be literal `true`; `issuer`, immutable `subject`, session UUID, finite expiry, and provider-sourced verified email come from one fresh managed-session resolver result. The service snapshots and validates the value before each repository await and re-resolves after each await. Environment is fixed in the service constructor, never supplied per request. |
| Context result | `{ status, issuer, subject, sessionId, accountId, accountStatus, accountRole, seedSlot, seedRole, bindingState, ownerState, completionState }`. `status` is `eligible`, `refused`, or `unknown`; `accountId` is a UUID or null; account status/role and slot/role use closed enums; binding, owner, and completion values distinguish known safe states from `unknown`. This result is private to the protocol and never returned to the caller. The writer rechecks every eligibility fact atomically. |
| Activation writer ACK | `{ status, kind, operationId, issuer, subject, sessionId, accountId, seedSlot, role }`. `status` is `activated`, `rejected`, or `unknown`; `kind` is `activate`. Every field must exactly bind to the trusted session, operation, and preflight context. The public protocol result contains only `{ ok, outcome, operationId }`; it never returns account, role, email, slot, policy, or privilege data. |
| Receipt result | `{ status, kind, operationId, issuer, subject, sessionId, accountId, seedSlot, role }`. `status` is `not_found`, `activated`, `rejected`, or `unknown`; not-found has null account/slot/role, and every other status is bound to the same identity/session and operation. A receipt confirms only the original operation outcome; it never grants current role or privileged access. |

The proposed closed port is `readBootstrapContext(session)`, `activateBootstrapSeed(session, { operationId })`, and `readBootstrapReceipt(session, { operationId })`; the session object and operation are exact-key values. The adapter must use fixed parameterized calls only after the SQL author freezes the exact function names/signatures. The service performs at most one writer call per invocation. After a writer `unknown`, it may re-resolve the same session and perform exactly one read-only receipt lookup; it never retries the writer. A fresh resolver mismatch/expiry or an unknown receipt remains `unknown`. No generic transaction/query callback is exposed.

Local and preview use separate exact synthetic alias maps only: `local-seed-owner@example.test`, `local-seed-admin-a@example.test`, `local-seed-admin-b@example.test`; and `preview-seed-owner@example.test`, `preview-seed-admin-a@example.test`, `preview-seed-admin-b@example.test`. They map respectively to the owner/admin/admin slots and are unrelated to production addresses or subjects. These values remain within migration 0002's existing `@example.test` constraint; no schema constraint is weakened. The service refuses any other environment or issuer. Fixture users and their subjects are created only by separately reviewed isolated setup; the protocol does not provision them. Existing local browser helpers that admit only `local-01@example.test` must be extended through a separately reviewed exact synthetic allowlist before these fixtures can be used in an acceptance run. A recovery readiness boolean is not accepted as evidence of a mirrored external revocation ledger. Until the outbox/reconciliation/key-custody contract exists, code and receipts make no claim of cross-database recovery safety.

### Atomic activation and revocation behavior

The fixed server operation accepts only an operation UUID and a fresh server-resolved managed-session context; it does not accept a caller-selected account, role, seed slot, issuer, or subject. The trusted resolver must bind session ID, subject, issuer, finite expiry, and provider-sourced `emailVerified=true` plus verified email to the same current provider session. The database operation independently locks and matches the exact `neon_auth.session` row and rechecks its owner and expiry; profile or request email is never evidence. In one transaction it:

1. Verifies the environment/policy binding and required recovery-control readiness. Uses one shared lock order: managed provider session row first, then the singleton bootstrap control, then account and identity rows. Any future role/owner mutation that needs the bootstrap control must follow this order; no path may acquire the control after locking an account. Factor lifecycle operations retain their existing session-before-account order and do not acquire the bootstrap lock. Role/owner transfer code must use the same shared order for every lock it shares.
2. Resolves exactly one configured seed by the trusted verified email and expected issuer. Requires the identity mapping and existing account to agree on immutable subject, active status, and `member` role. Rejects ambiguous, duplicate, unverified, revoked, previously bound, previously revoked, or changed-subject cases.
3. Checks the one-active-owner invariant before changing roles. Only the frozen owner seed can create the initial owner; admins cannot appoint another admin through bootstrap or self-elevate. No account, auth user, password, membership, Pro access, or booking consent is created.
4. Atomically writes the role, immutable binding, minimal append-only audit row, operation receipt, and one-time control progress. Serialization makes concurrent first sign-ins yield at most one durable grant. Receipt lookup after an uncertain result is read-only; it does not retry the role mutation.
5. Before revocation or any demotion, deletion, or suspension, locks the control and owner/account rows and checks the active-owner invariant. It refuses an action that would revoke, demote, delete, suspend, or otherwise make unavailable the sole active owner; the operator must first complete the separate ACC-09 owner-transfer flow and verify another eligible active owner. It also refuses any transition that would leave no active owner. For an allowed deliberate seed revocation, it atomically changes the account role to `member` (or applies the separately authorized account-status change), marks the binding revoked, retains its tombstone and audit event, and refuses any later activation for that seed/subject. Rebinding a different subject to the same seed slot requires a separate reviewed controlled-resolution operation; it never happens as an automatic sign-in or redeployment side effect. All role decisions pass through the same invariant and append-only audit boundary; no alternate writer may bypass it.

An owner/admin role alone does not authorize a privileged read. Every admin route remains denied until the account has a verified factor and a current session-bound factor attestation; sensitive actions additionally require the Section 11.22(D) five-minute step-up. Bootstrap must not change factor state, bypass enrollment, or expose the admin dashboard while enrollment is missing or pending.

## Recovery-control boundary

The separate recovery-control database cannot participate in the same PostgreSQL transaction as the application database. Do not claim cross-database atomicity or treat an app-side boolean as proof that a `bootstrap_revoked` event was safely retained.

For a production design, a role-revocation transaction may need a durable app-side outbox event committed with the tombstone and audit, followed by an idempotent writer to the separately keyed recovery ledger. Restore must remain quarantined until every required event is confirmed applied. A new bootstrap activation must fail closed if it cannot establish that relevant revocation history has been replayed/current. Exact outbox, reconciliation, key-custody, retention, and privacy-purge contracts are still unresolved; they require a dedicated recovery-control design and must be reviewed before production role writes. The synthetic tests can exercise a failing injected readiness port, but cannot claim a live cross-database guarantee.

The existing `recovery_control.events` schema only shows a storage shape. It does not presently prove an operational mirror, an app-visible deny check, complete account-deletion handling, or restored-snapshot protection. If the ledger, key, or replay evidence is absent, block restore reopening and any operation whose safety depends on those controls.

## Synthetic acceptance before any live proposal

Use only synthetic `@example.test` fixture aliases and provider subjects on the pinned local/preview branches. Do not read production identities, create privilege fixtures from the existing ordinary user, grant a role, provision a principal, or run provider calls as part of this design task.

Required later synthetic checks:

- Each synthetic seed alias maps to exactly one expected role and one pre-existing active member account with the same trusted issuer/subject. A typed profile email, unverified email, wrong issuer, unknown seed, missing account, mismatched subject, suspended account, and duplicate mapping refuse without mutation.
- All three test seed slots can activate independently once using fresh session ID/subject/issuer/expiry and provider-sourced verified email bound to the same session; stale, mismatched, expired, or unverified contexts refuse. Concurrent attempts for one slot yield one grant and one original receipt. Repeated operation ID with same input returns that receipt; changed binding/payload refuses. Re-running policy initialization or redeploying cannot grant again.
- The only initial owner is the designated owner slot. A second-owner attempt, an admin-to-admin appointment through bootstrap, and revocation/demotion/deletion/suspension of the sole active owner refuse. After a completed ACC-09 transfer leaves another eligible active owner, later separately authorized changes must preserve the final-owner invariant and audit history.
- Revoking a binding retains its tombstone. The same subject and a new subject under the old seed alias both refuse automatic regrant. Deletion/recreation and a simulated stale restore replay the revocation controls before any service reopen.
- Owner/admin role without a verified factor cannot open privileged content; no bootstrap result or receipt claims MFA. Factor and sensitive-action freshness boundaries continue to be enforced independently.
- Recovery-ledger unavailable, stale, missing-key, and unconfirmed outbox cases remain closed; no test labels an in-memory fake or separate-database double as proof of cross-database atomicity.
- Static guards pin exact local/preview environment, synthetic aliases only, private function/table ACLs, one-owner constraints, immutable history, no account creation, no role grant to ordinary app roles, and rollback refusal after bootstrap history exists. Tests and static checks do not prove the live provider identity, SQL behavior, production grant, or restore completion.

## Separate live authorization gate

Do not apply a production bootstrap migration or write a real seed role under this packet. A later live request must identify the exact reviewed source/migration hash, target production environment/database, exact trusted issuer and operation/function, role-grant effects, durable audit/revocation controls, expected account precondition, and read-back plan. The owner must give fresh action-time authorization for that exact operation. Production identities and provider subjects are obtained only through the trusted live sign-in context; they are not copied into local/preview fixtures, task files, screenshots, logs, or test data.

Before the first role write, independently verify the production migration baseline and ACLs, the exact account is already active and mapped to the trusted verified subject, the recovery-control mirror/key/retention path is operational, and no prior binding or revocation exists. Execute only the explicitly authorized single seed activation. Read back the account role, immutable binding, exact receipt, one-owner count, and audit event without printing identity values. Then separately verify that the owner cannot read privileged content until genuine MFA enrollment/challenge succeeds. The remaining seed activations, normal admin appointment, owner transfer, break-glass recovery, deletion, and restore tests each retain their own authorization and acceptance gates.

## Open decisions and limits

1. Define the exact meaning and one-time transition for “bootstrap completion” while preserving independent first activation of the three frozen seed identities.
2. Identify the production account-provisioning path that creates a normal member account without making seed activation create a duplicate account; migration 0002 cannot be reused unchanged for production.
3. Design and prove the recovery-control outbox/replay/currentness contract, including HMAC key availability and privacy retention. Until then, bootstrap revocation durability across old restores is unproven and production activation is blocked.
4. Specify controlled resolution for a changed verified subject at an existing seed email without enabling automatic regrant.
5. Keep the direct-DB break-glass command/operator identity evidence and append-only audit in its own runbook and action gate; this packet does not implement it.

No SQL, account mutation, role assignment, provider call, synthetic privilege fixture, login, factor enrollment, MFA challenge, external recovery-ledger write, or requirement-status change was performed for this design.
