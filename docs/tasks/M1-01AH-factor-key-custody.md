# M1-01AH — Factor-key custody, backup, and rotation

Status: offline current-key-only provider candidate implemented; custody and runtime binding remain unverified. This packet generates, binds, backs up, rotates, or tests no operational key; only a synthetic test key exercises the pure candidate. It does not enable the factor principal, enrollment, recovery, or privileged routes. Frozen Sections 11.15 and 11.22(D) remain authoritative; relevant requirements include ACC-08 and ADM-07.

## Current boundary

The prepared service uses the existing AES-256-GCM envelope in `lib/factor-storage.mjs`. Its authenticated context binds environment, account, factor, security epoch, and key ID. The key is supplied by a server-side provider; a pure provider candidate exists, but no runtime configures it or supplies an operational key. The envelope key is distinct from the factor database password, application/session secrets, and recovery-control HMAC key.

`lib/factor-key-provider.mjs` is an offline candidate that accepts only an explicit `local` or `preview` environment and a trusted object containing exactly `GROUND_FACTOR_ENVELOPE_KEY` and `GROUND_FACTOR_KEY_ID`. Future composition must pick those two approved names explicitly; passing all of `process.env` is rejected. It exposes only the current immutable key ID, returns a fresh non-enumerable 32-byte buffer per request, and refuses unknown IDs, purpose/environment mismatches, browser runtime, malformed encoding, and accessor properties. It reads no process state, files, URLs, or secret store. The production and enrollment service callsites now request the fixed `factor-enrollment` purpose and snapshot the hidden key field before continuing. Synthetic offline tests cover this boundary. This does not establish server-only bundling, server-process isolation, safe launcher injection, or access to any configured key.

Migration 0014 is applied on both pinned synthetic branches at source revision `7e4d47468fa5b054eca4b19078d10e1d92b796ea`. It added six owner-private factor-enrollment functions and brought the migration receipt count to 14. The factor principal remains `NOLOGIN`; no factor-role credentials, operational envelope key, enrollment, or privileged runtime are configured. These migration/catalog checks do not establish successful enrollment, concurrency behavior, or MFA acceptance. The existing key-custody runbook remains the operational companion: `docs/runbooks/M1-factor-credential-key-custody.md`.

## Proposed no-new-KMS custody method

Use one independently generated random 256-bit envelope key per environment. No external KMS activation or paid product is assumed for this proposal.

- **Local:** keep the key in a dedicated ignored binding, encrypted with Windows DPAPI `CurrentUser`; the local launcher decrypts it directly into the server process memory. Never put the plaintext key in `.env`, a command argument, shell history, repository, or build output. CurrentUser DPAPI is tied to the same Windows user context; it is not a portable recovery copy.
- **Preview:** store a different key as a project-level Vercel Secret, scoped only to the Groundbnb Preview deployment for the existing review branch `codex/m0-01-environment-contract`. A Secret is write-only after saving and can be branch-specific. Update it through a future hidden/private-input helper, then deploy a fresh revision; changing an environment variable does not alter existing deployments. Do not pull it into a local environment file.
- **Independent backup:** before any enrollment, the client must name an already available, client-controlled encrypted password-manager vault or equivalent offline encrypted secret store as the recovery copy for both keys. Store each key under its environment and immutable key ID, with custody metadata only in repository evidence. Do not create a new paid KMS dependency for this milestone. If no such backup destination and restore owner are confirmed, keep enrollment disabled. A DPAPI file or an unreadable Vercel Secret alone is not a complete portable backup.
- **Trust boundary:** treat all server code in the Groundbnb Vercel project as able to read the Preview Secret. A `server-only` import or route boundary does not isolate project environment variables. The whole server deployment and dependency set must be reviewed before binding. If that boundary is unacceptable, stop and design a separately authenticated factor service; do not imply that the current project provides per-route key isolation.

Vercel documents that Secret values are write-only after saving, may have different values per environment or Preview branch, and apply only to new deployments. Windows DPAPI `CurrentUser` protects data so only the same user context can unprotect it. These properties support the proposed split, but do not prove this project’s plan entitlement, secret scope, backup, process isolation, or restore behavior. See the official sources below.

## Key identifiers and operational records

Use a new immutable, non-secret `keyId` for every key version (for example, a descriptive environment plus sequence, not a hash or key-derived identifier). Never replace key bytes under an existing ID. Keep only nonsecret metadata in evidence: environment, key ID, generation date, binding scope, custodian, backup location class, deployment revision, and lifecycle state. Do not log or record key bytes, encrypted backup payloads, raw environment output, or fingerprints derived from keys.

Generate keys later with an OS cryptographic random generator inside a reviewed secure helper. The helper must route bytes directly into the protected local binding or the hidden Vercel Secret input path and into the separately controlled backup workflow. It must not print, return, clipboard-copy, or persist plaintext to a normal file or AI-visible output. A future metadata checker may verify the key ID and target scope without reading the value.

## Rotation and compromise response

Rotation is not implemented by current code or schema. The current factor-history trigger makes `factor_id`, account, epoch, key ID, ciphertext envelope, and creation time immutable. The current service has no fixed owner-scoped re-encryption operation or rotation audit outcome. Therefore, never update factor rows directly, overwrite a key under its old ID, or describe key rotation as currently available.

A future reviewed rotation must add a narrowly scoped maintenance operation that rechecks the active factor/account/epoch, decrypts using the exact old key ID and AAD, re-encrypts the same seed with the new key ID and same environment/account/factor/epoch context, and atomically replaces only the envelope/key ID with an append-only audit receipt. It must preserve factor identity, verification state, epoch, accepted steps, recovery digests, and session controls. It must use a migration that explicitly amends the immutable-envelope guard for this single operation; direct table rights remain denied. The operation and test plan must cover uncertain commits, retries, concurrent challenges, malformed ciphertext, rollback, and app-principal ACL preservation.

Keep both old and new key versions available until every stored envelope and retained recovery snapshot has been rewrapped and independently read-verified. Retire the old version only after the operator inventories the backup/snapshot horizon and proves no retained copy needs it. A failed decrypt, missing old key, unknown migration result, or missing backup fails closed; it does not trigger factor reset or enrollment automatically. A suspected compromise requires the separately reviewed factor-revocation/reset and session invalidation path under Section 11.22(D), with break-glass handling only through the controlled Section 11.15 process.

## Backup and restore acceptance

Before enrollment, a future operator acceptance must demonstrate, using synthetic data only:

1. The same key ID resolves only in its intended environment and cannot be read from app responses, build artifacts, diagnostics, logs, or client bundles.
2. The encrypted local binding decrypts only under the intended Windows user and the human-controlled backup can restore the same key after a clean-profile or workstation recovery drill. Do not treat DPAPI ciphertext copied to another machine as a successful restore.
3. The Preview Secret metadata is limited to the exact Preview branch; its value is never read back or displayed. A fresh deployment uses it, while existing deployments retain their prior configuration until redeployed.
4. A synthetic encrypted factor envelope decrypts only with the matching key ID and full original AAD context. Wrong environment, account, factor, epoch, or key version is refused.
5. Rotation preserves the same synthetic factor and recovery/attestation history, handles retries without changing factor state twice, and leaves the old key available until all retained snapshots pass the restore drill.
6. Restores remain quarantined with logins and privileged routes disabled until keys, deletion/revocation controls, and epochs are reconciled. If the correct key is unavailable, factor-dependent access remains denied; no replacement key may silently make old envelopes appear valid.

These are proposed acceptance checks, not evidence already obtained. No real keys, owner identity, database writes, deployment settings, or provider state were inspected or changed for this packet.

## Gates and unresolved operational facts

Before any key binding, separately confirm the project’s current Vercel Secret capability and exact Preview branch scope; establish the client’s approved encrypted backup destination and recovery owner; review the whole-server secret boundary; implement the key provider; and prove access/redaction in a synthetic deployment. Before rotation, implement and review the one-purpose database rewrap operation and its rollback/restore tests. Before MFA claims, complete trusted bootstrap, factor lifecycle, session revocation, and end-to-end acceptance. No production or recovery key is in scope.

Still unknown: whether an existing password-manager/offline vault is approved and recoverable; whether the current Vercel project permits the needed Secret scope; whether a server-only deployment boundary is acceptable; whether deployment logs/build behavior keep the key inaccessible; and whether future database migrations can safely execute and roll back the proposed rotation operation. No plan/billing or KMS pricing check was performed.

## Sources

- Frozen source: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md`, Sections 11.15 and 11.22(D); hash recorded in `docs/spec/SOURCE-HASH.txt`.
- Shared requirements: `docs/spec/15-shared-safeguards.md`.
- Existing implementation boundaries: `lib/factor-storage.mjs`, `db/migrations/0009_privileged_factors.sql`, `db/migrations/0012_factor_service.sql`, `docs/tasks/M1-01AA-factor-runtime-boundary.md`, and `docs/tasks/M1-01AD-factor-lifecycle-contract.md`.
- Vercel, [Config and Secret environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables) and [Environment variables](https://vercel.com/docs/environment-variables), checked October 10, 2026. Secrets are write-only after saving, branch-specific Preview values are supported, and changes apply to new deployments.
- Microsoft Learn, [How to use data protection](https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection) and [DataProtectionScope](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope?view=net-11.0-pp), checked October 10, 2026. `CurrentUser` limits unprotection to the same user context; this is not a cross-machine backup mechanism.
