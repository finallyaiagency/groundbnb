# M1-01AH current-key provider candidate

Date: 2026-10-11
Usage: precise Codex usage accounting was unavailable.

## Scope

Added a pure current-key-only provider candidate for an explicitly supplied `local` or `preview` environment and an exact trusted object containing `GROUND_FACTOR_ENVELOPE_KEY` and `GROUND_FACTOR_KEY_ID`. The provider reads no process environment, files, URLs, or secret store. Future composition must select those two values explicitly rather than passing all of `process.env`.

The provider accepts only a canonical 32-byte base64url key and bounded immutable key ID, only the `factor-enrollment` purpose, and only the captured current key ID. It fails closed for browser runtime, old/unknown key IDs, mismatched environment or purpose, extra/accessor fields, and malformed encoding. Each request receives a fresh key buffer on a frozen record with the key property non-enumerable. Both factor service call paths now request that purpose and snapshot the key record's own data properties (including the non-enumerable key), copying the 32-byte value before continuing. Generic state/request `exactKeys` behavior was not changed.

## Checks

- `node --test tests/factor-storage.test.mjs tests/factor-service.test.mjs`: 22/22 passed.
- `node --test tests/factor-service-protocol.test.mjs`: 15/15 passed.
- `pnpm test`: 407/407 passed on the final provider/test snapshot.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm state:check`: passed, 249 IDs.
- `pnpm secrets:check`: passed, 399 source files.
- Targeted ESLint for the provider, affected services, and three test files: passed.
- Published checkpoint `97ea884646bf56835b64ca79f3c70fa2ca36c6e1`: exact Verify runs `38190295703` and `38190292601` both succeeded.

SHA-256 for implementation files in the checked working tree:

- `lib/factor-key-provider.mjs`: `BB78F962479676CDC847F6A7F1A04C46FC6CBA42B0C12D4CA903B3D446E1BC1E`
- `lib/factor-service.mjs`: `324A6633C16E695A7449809AEBD774EF2A446CDB2660E40E0BFC0D961A74506A`
- `lib/factor-service-protocol.mjs`: `5A19D1E7993CFA9355ADC0E7AB17F7940619B1EEDA1CFDFFF3FA822A7D5AF3A4`
- `tests/factor-storage.test.mjs`: `7A5F887FDEE227935AFD60B755BC7CC07174963DD0157B1ADC04A99A9A35DF5C`
- `tests/factor-service.test.mjs`: `61AF6A6C5A557FC83263EFDE8A4D60AA96ADD4C63C0F9F3F40BC612E0D2C8230`
- `tests/factor-service-protocol.test.mjs`: `924FE33A92005112F7E256F42D43AB09A524DC36D34558A78FC820BDAA4793BE`

Correction recorded 2026-10-12: the initial candidate record used protocol-service hash `E85DEAA5F84F3C65BDD9B04333FEF85D87FB7F8FA72EB60696279CF4CF8F460C`. Before checkpoint `97ea884646bf56835b64ca79f3c70fa2ca36c6e1`, indentation in the newly added key-snapshot block was corrected; the published file hash is `5A19D1E7993CFA9355ADC0E7AB17F7940619B1EEDA1CFDFFF3FA822A7D5AF3A4`. This edit changed formatting only.

The first sandboxed full test run and build were denied writes to temporary workspace paths (`.tmp` and `.next`). The same checks passed when rerun with approved workspace access; no application failure was observed.

## Limits

This is an offline injected provider candidate only. No key was generated, read from a real binding, bound to local or Preview, backed up, rotated, or deployed. No factor database credential, enrollment, recovery, route, or MFA runtime was enabled. No evidence was collected for build/bundle exclusion or whole-server process isolation. The existing backup destination and recovery owner remain unconfirmed, so the AH custody gate and ACC-08 remain open; the factor principal remains `NOLOGIN`.
