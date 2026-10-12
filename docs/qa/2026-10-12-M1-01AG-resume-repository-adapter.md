# M1-01AG repository adapter candidate — review draft

Date: 2026-10-12
Status: offline adapter candidate prepared; not wired or activated.

## Change

`lib/factor-enrollment-postgres-repository.mjs` now exports `createFactorEnrollmentResumePostgresRepository(environment, runQuery)`, a separate five-method adapter for the approved resume flow. It uses fixed parameterized calls for the existing context, begin receipt, pending-factor reads and the two 0015 resume functions. Inputs and returned JSON are validated as bounded own-data snapshots; accessors, symbols, custom prototypes/serialization, undefined values and non-finite numbers are refused before serialization or query dispatch. Both adapter constructors reject non-string environment values without coercion.

The adapter validates the exact resume writer acknowledgment and material receipt shapes, canonical UUIDs and the 32-byte request fingerprint. A malformed/throwing writer produces a bound `unknown` result; it does not retry. The test interop path exercises one uncertain write followed by status-only lookup and confirms it does not retrieve a key, decrypt, or return setup material.

## Checks

- Focused `pnpm test -- tests/factor-postgres-repository.test.mjs`: 9/9 passed.
- Full `pnpm test`: 407/407 passed on the narrow elevated rerun after the sandbox's disposable `.tmp` directory produced two `EPERM` failures.
- `pnpm lint`, `pnpm typecheck`, and elevated `pnpm build`: passed.
- `pnpm state:check`: passed, 249 IDs and frozen source hash `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`.
- `pnpm secrets:check`: passed on 399 source files before this QA document is added.

Current working-file SHA-256:

- `lib/factor-enrollment-postgres-repository.mjs`: `7DB85F2C7213B07420F5F8C8392B620A1B3C20C77E7FFAACFF8B5472FD1F07A9`
- `tests/factor-postgres-repository.test.mjs`: `7BE365BAA56D77EC02E4D8701837CF5BD523B9A7CF6D1BC8159801D5407B012D`

## Limits

No database query, SQL execution, grant, route, key, credential, provider action, or enrollment occurred. Migration 0015 remains unapplied. The injected query port does not prove that its caller pins the environment/branch, that HTTP result resolution follows a database commit, or that PostgreSQL enforces the candidate SQL's locking and transaction behavior. No runtime enrollment, material delivery, or MFA acceptance is claimed. ACC-08 status is unchanged.