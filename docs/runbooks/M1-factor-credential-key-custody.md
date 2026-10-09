# M1 factor service credential and key custody

**Status:** Preparation only. This runbook provisions nothing. Q-012 migration confirmation, factor credential activation, key binding, enrollment, and runtime activation are distinct future gates.

## Authority and boundary

ACC-08 and shared safeguards Section 11.22(D) require verified MFA for privileged access, encrypted server-side factor secrets, one-use hashed recovery codes, step-up checks, rate limiting, and no secret/code logging. ADM-07 and frozen Section 11.15 bind bootstrap roles only to a first trusted verified sign-in and immutable subject; typed emails, ordinary synthetic fixtures, or rerun setup cannot grant admin. The frozen source remains authoritative.

M1-01AA prepares 0013 for exact local and preview branches. Each branch has its own role, `groundbnb_local_factor_service` or `groundbnb_preview_factor_service`, initially `NOLOGIN`. A future credential handoff enables `LOGIN` on that **same role**. Do not create a separate `NOLOGIN` group role, add role membership, or let either ordinary app role `SET ROLE` to it. The factor role receives only database CONNECT, `groundbnb` schema USAGE, and five 0012 factor-function EXECUTEs. It has no direct table, sequence, helper, profile, membership, or general write privileges.

Treat the complete trusted server deployment as the factor-secret boundary for the initial local/preview implementation. Vercel project-level server secrets are available to all server code in that deployment; a private module or `server-only` import does not provide per-route isolation. Review the whole deployed server dependency set accordingly. If that boundary is too broad, move factor work to a separately authenticated internal runtime before binding either secret.

The current synthetic browser fixtures are ordinary users. They must not be promoted to owner/admin to exercise factor code. Bootstrap is a separate trusted identity and subject-binding task. Production and recovery are outside this runbook.

## Credential handoff, when separately scheduled

1. After Q-012 is explicitly confirmed and 0013 is applied to a named pinned branch, the human generates a new, unique random database password for that branch's exact factor-service role and saves it in the human password manager.
2. Browser policy requires the human to enter that new password directly in that branch's Neon SQL editor or another approved hidden-input client. Use `ALTER ROLE <exact-local-or-preview-factor-role> WITH LOGIN PASSWORD '<human-entered-value>';` on the matching branch only. Clear the editor after running it. Never send the password or connection string to Codex, a shell argument, source control, a log, or an ordinary app binding.
3. A future dedicated checker may accept the password through a hidden prompt and private child-process stdin, test only its pinned branch, and save a passed connection string in a CurrentUser DPAPI-encrypted ignored file. Keep factor bindings separate from `.env.m1-profile-*.dpapi` and from `GROUND_PROFILE_DATABASE_URL`.
4. For Vercel Preview, a future binding helper may send `GROUND_FACTOR_DATABASE_URL` as a Secret over CLI stdin, restricted to the existing Groundbnb preview project and exact preview Git branch `codex/m0-01-environment-contract`. Verify only secret metadata and scope. Do not select all Preview branches, Development, or Production. The local binding remains in a DPAPI file and is injected into the launched server process memory; do not write the factor URL to `.env.development.local`.
5. Before activation, the operator catalog verifier checks the exact 0013 branch/receipts and NOLOGIN boundary. The NOLOGIN role cannot authenticate and has no metadata-table SELECT grant. After the human enables LOGIN, a dedicated checker proves `current_user` is that role, pins the connection endpoint, and performs fixed non-sensitive catalog/function boundary checks; the operator separately checks environment identity and migration receipts. Suppress values and raw errors and clear transient buffers. Do not grant metadata-table access for the checker, invoke a successful factor challenge, or treat a database login as MFA acceptance.

These steps do not authorize 0013, a login/password change, a Vercel Secret write, or a route/mode change. Each occurs only in its own reviewed action gate.

## Envelope-key custody

- Use the existing `lib/factor-storage.mjs` AES-256-GCM envelope and context-bound associated data. Do not implement cryptography or put plaintext TOTP seeds in SQL. Recovery codes are issued once to the user, represented durably only by salted one-use digests, and never logged.
- Generate distinct 256-bit local and preview envelope keys with a client-side secure helper using the operating system cryptographic random generator. The helper must never print or return key bytes to AI context, write a plaintext file, place the value in a command argument, or expose it in diagnostics. It may keep the local copy only as a CurrentUser DPAPI-encrypted ignored file and pass a Preview value to Vercel CLI over stdin with output suppressed.
- Bind each environment's `GROUND_FACTOR_ENVELOPE_KEY` and stable `GROUND_FACTOR_KEY_ID` only to its own server runtime. Do not use `NEXT_PUBLIC_` variables, shared local/preview values, the app cookie secret, database passwords, or the recovery HMAC key. Local startup decrypts the DPAPI value directly into the server process environment in memory; Preview uses a Secret scoped only to the exact Preview branch. Neither key belongs in an environment file or Neon snapshot.
- Before enrollment, designate a recoverable encrypted backup location under human control. DPAPI CurrentUser files are machine/user-bound, and Vercel saved Secrets are not readable back; neither fact alone is a portable backup. The applicable secret manager/backup and restore path remains an open operational handoff. A recovery restore stays quarantined until the correct key version and separate deletion/revocation controls are available.
- Rotation uses a new `keyId`, retains old keys for decryption while stored envelopes and retained backups still reference them, re-encrypts through a reviewed owner-scoped operation, verifies counts and reads, then retires the old key only after the retained recovery window has expired. Never overwrite key bytes under an existing `keyId`. Document generation time, environment, key ID, custodian, binding scope, and rotation status only; never document key material.

## Ordered gates and present gaps

1. Review/checkpoint 0013, then obtain the exact Q-012 action-time confirmation. Do not apply SQL from this document.
2. Apply 0013 only to the two pinned synthetic branches and verify its receipts, exact app boundary, and NOLOGIN role catalog state.
3. Complete a human-only password handoff for the same exact role on each environment. Bind the checked values through the dedicated DPAPI/Vercel workflow only after those checks pass.
4. Generate and bind environment-specific envelope keys with the secure helper; first close the portable encrypted-key backup/recovery handoff and whole-server dependency review.
5. Only later, after trusted owner bootstrap and factor lifecycle code exist, run synthetic enrollment/challenge, one-use recovery, reset/revocation, step-up, concurrency, redaction, and backup-restore acceptance. No ordinary user or pre-MFA admin content may be exposed.

Still unproven: 0013 live application, factor LOGIN credentials, key-manager/portable-backup choice, key binding and rotation, trusted owner fixture, TOTP enrollment/verification, recovery-code issuance/consumption, live rate/transaction races, protected-resource enforcement, and factor recovery. No live integration result follows from this runbook.

Related review artifacts: [M1-01AA boundary packet](../tasks/M1-01AA-factor-runtime-boundary.md), [Q-012](../OPEN-DECISIONS.md), [0013 preparation QA](../qa/2026-10-09-M1-01AA-factor-principal-preparation.md), and the [0013 catalog verifier](../../db/operations/verify-m1-factor-principal.sql).
