# M1-01AD offline enrollment request/acknowledgment validator

Date: 2026-10-10
Status: offline candidate only; no M1 requirement status change.

## Scope and source

This slice prepares a pure validator for the closed request and minimal acknowledgment shapes used by future enrollment begin/verify operations. It is limited to ACC-08's second-factor boundary and the existing M1-01AD lifecycle plan. The frozen requirements still require verified second factor before owner/admin access, recent step-up for sensitive actions, audited factor reset, and closed behavior on failure. This candidate does not implement those operations or prove them.

Implementation files: `lib/factor-enrollment-contract.mjs` and the existing `tests/factor-service-protocol.test.mjs` case extended with enrollment-contract assertions. The candidate accepts only a canonical 36-character UUID operation ID; verify additionally requires exactly six ASCII digits. It rejects unknown keys, symbols, accessors, and malformed objects without invoking getters. Verification code is non-enumerable in the returned object, so ordinary JSON serialization does not include it. Acknowledgments must bind the exact requested operation ID and one of the operation's bounded outcomes. An `unknown` outcome explicitly disables mutation retry and requires status lookup.

## Checks

- `node --test tests/factor-service-protocol.test.mjs`: 15/15 passing (the existing test count is unchanged; its closed-input case now includes validator assertions).
- Full suite: 407/407 passing.
- ESLint for both changed JavaScript files and repository `pnpm lint`: pass.
- `pnpm typecheck`, `pnpm state:check`, and `pnpm secrets:check`: pass; source hash validation was unchanged and the scan covered 363 source files.
- `pnpm build`: pass (Next.js production build and TypeScript phase completed).

The candidate was reviewed against ACC-08 and frozen Sections 11.15 and 11.22(D). It adds no product requirements and does not promote ACC-08, which remains `Not started`.

## Limits

No SQL, function grant, principal, credential, key, route, provider call, login, enrollment, OTP verification, recovery issuance, MFA challenge, or privileged read was performed. The validator is not a trusted identity/session resolver, persistence receipt check, or authorization decision. No ACC-08 implementation or verification is claimed. Trusted bootstrap, external key custody, factor lifecycle persistence, same-principal LOGIN activation, rate/concurrency behavior, step-up enforcement, and end-to-end live acceptance remain open.
