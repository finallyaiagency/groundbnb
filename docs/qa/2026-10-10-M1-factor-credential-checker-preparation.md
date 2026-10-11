# M1 factor-role credential checker preparation

Status: dormant helper prepared only. No factor password was entered, no network or database request was made, no LOGIN change or key operation occurred, and no private binding was created.

## Fixed boundary

`scripts/verify-m1-factor-credentials.ps1` prompts for the local and preview factor-role passwords with hidden `SecureString` input and sends them to a child worker over stdin. The worker pins only `groundbnb_local_factor_service` at the local host/branch and `groundbnb_preview_factor_service` at the preview host/branch. It uses TLS with required channel binding and a read-only, bounded catalog query.

The query checks the five factor functions’ ACLs separately from the role’s effective callable set. The effective set includes the five expected factor functions plus the one baseline PUBLIC-executable trigger function `groundbnb.refuse_production_synthetic_seed()`. The checker verifies that this is the exact PL/pgSQL, owner-owned, security-invoker function attached to the enabled `synthetic_seed_guard` trigger on `groundbnb.synthetic_identities`; no other trigger-returning function or executable helper is accepted. This trigger is inherited from the baseline and is not an extra factor-function grant. The query also checks the expected creator-only role membership, role attributes, database/schema boundary, and absence of direct table, column, or sequence privileges. It does not query `environment_identity`, `schema_migrations`, Auth user/session tables, enrollment rows, or factor data, and it does not call any factor function. Therefore it cannot prove migration receipts or environment identity; those require the separate owner-side metadata check. It also cannot prove enrollment or MFA.

By default the helper saves no connection binding. `-SavePrivateBinding` additionally requires the explicit `-OwnerMetadataConfirmed` switch, which is only an operator attestation that the separate owner-side environment/receipt check passed; it is not itself proof of that check. Saving also requires both exact targets to pass and distinct passwords, refuses to replace an existing file, and stores only CurrentUser DPAPI ciphertext under ignored `.tmp/.env.m1-factor-{local,preview}.dpapi` paths. Its evidence output is limited to revision, timestamp, target, check name, and pass/fail category. Passwords, URLs, raw SQL/provider errors, and response rows are not printed or written to evidence. Buffers and BSTR storage are cleared where supported, and URL-builder references are blanked during cleanup. This is best-effort cleanup only: immutable managed strings and references retained internally by runtime or SDK code cannot be guaranteed to be zeroized.

Future invocation after those gates:

```powershell
powershell -NoProfile -File scripts/verify-m1-factor-credentials.ps1
powershell -NoProfile -File scripts/verify-m1-factor-credentials.ps1 -SavePrivateBinding -OwnerMetadataConfirmed
```

These commands were not run for this preparation. The helper does not enable LOGIN, change a password, configure an envelope key, alter application runtime, or validate Q-012/0013/0014 receipts.

## Checks and limits

The existing `tests/factor-service-principal-migration.test.mjs` cases assert pinned roles/branches, exact callable-function scope, read-only catalog checks, own-key input validation, hidden input, private stdin, DPAPI-only save, explicit owner-metadata attestation, no-overwrite behavior, save-failure disposal ordering, failure-closed result reporting, and absence of migration/login/key actions. At working-tree HEAD `49f9634` plus these uncommitted checker changes, the focused suite passes 8/8, ESLint passes for the worker/test, Node syntax check passes, and the PowerShell parser passes. No SQL parse, credential check, database call, ACL proof, key binding, or MFA acceptance is claimed.
