# M1-01AI — Synthetic ordinary-account provisioning prerequisite

Status: durable account provisioning remains design only, with an offline service/protocol candidate prepared in `lib/synthetic-member-provisioning-protocol.mjs`. It consumes the private same-response verified synthetic identity from `lib/session-identity.mjs`; existing-case coverage is in `tests/admin-bootstrap.test.mjs`. No SQL adapter, route, provider request, credential handling, fixture creation, grant, or requirement-status change was implemented. The frozen source remains authoritative.

## Authority and purpose

Read `docs/STATE.md`, `docs/spec/15-shared-safeguards.md`, frozen Section 11.15 and Sections 11.22(C/D), the M1-01AF packet, `lib/session-identity.mjs`, and migrations 0001–0002 before implementation. This work stays within the existing synthetic identity/account boundary and introduces no requirement.

Section 11.15 says seed activation binds a trusted verified identity to an existing account and “creates no account, password, or duplicate.” The ordinary signup/account-provisioning step must therefore be separate and finish first. M1-01AF correctly requires bootstrap to see one existing active `member` account bound to the same immutable issuer and subject. Migration 0002 currently creates only one ordinary synthetic account and identity per branch (`local-01@example.test` or `preview-01@example.test`); no ordinary account-provisioning application path is wired. The seed accounts required to exercise AF cannot be made by changing bootstrap to create them.

This packet designs only a synthetic fixture prerequisite for the three candidate AF aliases below. It is not the general public signup implementation, a production account-provisioning design, an Auth fixture-creation operation, or a role/owner bootstrap operation.

## Exact synthetic scope

Use the issuer pinned by the trusted local or preview environment and only these proposed AF synthetic aliases:

| Environment | Verified email alias | Later AF slot | Later role |
| --- | --- | --- | --- |
| local | `local-seed-owner@example.test` | owner | owner |
| local | `local-seed-admin-a@example.test` | admin-a | admin |
| local | `local-seed-admin-b@example.test` | admin-b | admin |
| preview | `preview-seed-owner@example.test` | owner | owner |
| preview | `preview-seed-admin-a@example.test` | admin-a | admin |
| preview | `preview-seed-admin-b@example.test` | admin-b | admin |

These proposed values are copied from AF’s candidate local/preview alias map and comply with migration 0002’s `@example.test` check. They are design values only; they do not approve creating provider users. Creating synthetic Auth fixtures requires a separately reviewed, action-time-approved setup using the provider’s supported mechanism. Do not insert fake rows into `neon_auth."user"` or `neon_auth.session`, copy production identities, weaken the email constraint, or create fixture passwords in SQL or source files. Until the provider fixtures exist and their setup is separately approved, this prerequisite cannot be exercised.

The existing `local-01` / `preview-01` account remains unchanged. No arbitrary address, caller-supplied email, new issuer, subject selector, account ID, role, or request-supplied environment selector is accepted. The resolver candidate compares the provider email to the exact configured alias spelling; it does not normalize casing.

## Trusted request and closed result

The server initiates provisioning only in an explicit synthetic signup path after a fresh managed-auth session resolves. The current `resolveManagedSessionIdentity` result intentionally contains issuer, immutable subject, session ID, and expiry but not email; it cannot alone authorize this operation. The private `resolveSyntheticSeedIdentity` candidate obtains `email` and `emailVerified === true` from the same fresh provider response, accepts only an exact local/preview candidate alias, and binds those fields to the exact session ID, UUID subject, expiry, and pinned issuer. The existing ordinary resolvers also snapshot their required provider fields before the post-await clock callback; their public result fields are unchanged and do not include email. Both paths preserve the existing no-cookie-cache policy. The synthetic resolver returns only this internal context; no current route calls it. Do not add email to a public identity response or trust a profile field, request body, stale cookie claim, or independently looked-up user value. This resolver does not approve creating any provider fixture or account.

The browser request contains only a validated operation UUID. Account ID, issuer, subject, verified email, seed slot, role, and environment are derived by the server and independently revalidated by the database operation. Do not expose the account UUID or role in the public acknowledgment. A closed public result should disclose only a stable operation ID and coarse outcome such as `provisioned`, `refused`, or `unknown`; it does not reveal whether another account or alias exists.

## Transaction and durable idempotency candidate

The operation creates an account only when all checks pass in one application-database transaction. Use the AF/global lock order: lock the exact live managed provider session first; then lock the singleton bootstrap-control row when present/required for this synthetic seed path; then resolve and lock account/identity rows. Never acquire the bootstrap lock after an account lock. This order coordinates with AF activation/revocation and prevents a concurrent bootstrap decision from racing a new binding. Re-check the session and its expiry against a fresh database clock after lock waits and immediately before commit. Preserve the owner-only recovery readiness gate required by AF for role activation; this ordinary member creation does not itself claim recovery readiness or change bootstrap completion.

Under the locks, the writer independently requires all of the following:

1. Exact local or preview `environment_identity`, branch, app/server caller, and issuer pin; current active session row whose subject matches the fresh trusted resolver; and finite unexpired session at commit.
2. Provider-sourced verified email is true and is exactly one of the environment’s three proposed seed aliases. A typed address, unverified claim, untrusted issuer, changed subject, expired/revoked session, or any other alias refuses without mutation.
3. No prior seed provisioning, bootstrap binding, or retained revocation/tombstone conflicts with the seed slot or `(issuer, subject)`. Revoked or previously bound slots never reactivate through another sign-in or operation. A different subject claiming a used alias requires a separately reviewed controlled-resolution operation; this packet does not define it.
4. There is no conflicting identity/account mapping. If this immutable identity already maps to exactly one active member account, return a non-mutating already-provisioned outcome; never create a duplicate. A revoked identity, suspended/deleting/deleted account, mismatched account/subject, non-member role, duplicate alias, or ambiguous mapping refuses without updating or repairing it.

On a new eligible identity only, create one account with server defaults (`role='member'`, `status='active'`), one immutable `account_identities` binding to the trusted issuer/subject and verified synthetic email, and its empty profile row. Do not create profile answers, linked providers, membership assignments, grants, vehicles, notes, factor state, paid access, booking consent, or owner/admin roles. Do not modify the Auth provider.

Persist a private, immutable success receipt atomically with the account, identity, and profile. The receipt binds the operation UUID to a server-computed request fingerprint, trusted issuer/subject/session, seed slot, account ID, outcome, and database timestamp; it stores no provider token, cookie, password, raw provider error, or redundant email. Add database uniqueness/serialization protection so two sessions for the same subject or seed alias cannot create two accounts. Preserve the immutable provisioning record and AF revocation tombstone as needed to prevent re-provisioning; do not permanently tombstone transient authentication or validation failures. Ordinary account deletion must not erase a deliberate revocation tombstone. Exact retention/privacy-purge treatment must be reviewed before implementation.

An exact same-operation replay may return the original safe acknowledgment only after a fresh same-subject/issuer session check and confirmation that the original binding remains active and unrevoked. Changed fingerprint, different identity/session binding, revoked/expired session, revoked binding, or terminal account status refuses. A status lookup is read-only and proves only the original provisioning outcome, never current authorization. After an uncertain write, do not blindly repeat with a new operation ID. A `not_found` observation alone does not prove an earlier transaction cannot commit; any explicitly reviewed retry must use the same operation UUID and rely on database idempotency. A later sign-in can establish current account status from trusted session plus authoritative identity mapping.

## Authority and safeguards

- This is ordinary member-account creation only. It cannot set `admin` or `owner`, grant roles, or change an existing account. AF remains the separately serialized role-binding operation and continues to require an existing active member account.
- No role is granted to the normal application role by this design. Any future application `EXECUTE` grant, route, or activation needs a separately reviewed exact migration hash and action-time authorization. Until then the proposed database function stays owner-only/private; no route calls it.
- The operation does not set a membership plan. The membership reader fails closed when no base assignment exists; no Free/default plan is fabricated.
- No provider calls, email sends, AI, geocoding, route calls, metered dispatch, factor enrollment, or privileged content are part of account provisioning.
- Session revocation and account suspension/deletion continue to block protected reads. If signout wins the session lock first, provisioning refuses. If the operation commits first, it records only the ordinary member account; a fresh post-commit session check is still required before the response exposes any authenticated UI or protected content.
- Preserve account, identity, receipt, bootstrap, and audit protections. Never overwrite a foreign account, revive a revoked identity, erase a tombstone, or infer successful creation from a transport response without a bound durable acknowledgment.

## Later acceptance gates

Before implementing or activating this synthetic prerequisite, separately review:

1. An exact database function/table migration and rollback policy, security-definer owner/search-path/ACL checks, request fingerprint, unique slot/identity constraints, idempotent status reader, bounded receipt retention, and proof that rollback refuses after account/receipt history exists.
2. A supported provider-fixture workflow for the six proposed synthetic aliases, action-time approval for creating those Auth users, and fresh read-only verification that each user is verified, each subject is unique, the branch contains only the approved synthetic test identities, and dispatch/email remain safely disabled.
3. The exact server route/service binding to the fresh private verified-session context, account ownership, operation acknowledgment/status behavior, signout races, duplicate-session races, revoked-subject replay refusal, and no-information-leak behavior.
4. Exact application-role `EXECUTE` grant approval and readback, if a runtime caller is eventually required. This packet does not request or imply that grant.
5. Separate AF acceptance proving role activation consumes only the previously provisioned active member binding and cannot create/duplicate an account. No role/bootstrap/MFA requirement becomes Verified from this packet.

No account, Auth fixture, role, credential, key, route, database object, or grant was created or changed for this design. No live session, provider, or database action was performed; offline resolver tests are documented in the QA record. ADM-01, ADM-06, ADM-07, ACC-08, SYS-11, and related account requirements retain their existing statuses.
