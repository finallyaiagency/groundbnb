# M1-01AE protocol snapshot hardening

Date: 2026-10-10

## Scope and evidence

The offline enrollment protocol now snapshots each closed identity, context, pending-factor, encrypted-envelope, key record, TOTP candidate, writer acknowledgment, and receipt immediately after its async source returns and before another await. Key bytes are copied. Resolver identity data is copied before the clock callback. Repository write arguments are frozen snapshots. Before releasing provisioning material after a committed begin, the fresh factor must also match the exact operation ID and request fingerprint. Existing protocol tests mutate source objects during the following resolver/clock call and verify snapshots, and simulate operation/fingerprint drift to confirm provisioning material stays withheld without a second writer call.

This is an offline protocol-boundary check only. It does not establish SQL runtime behavior, enrollment, MFA, route integration, or key custody. No database, provider, browser, credential, or role operation occurred. ACC-08 remains **Not started**.

## Checks

- `node --test tests/factor-service-protocol.test.mjs` — 15/15 passed; existing test-case count and names were preserved.
- `pnpm exec eslint lib/factor-enrollment-protocol.mjs tests/factor-service-protocol.test.mjs` — passed.
- `pnpm typecheck` — passed.
- No full suite/build or live acceptance is claimed in this slice.
