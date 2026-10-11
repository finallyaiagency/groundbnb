# M1-01AD enrollment operation UUID canonicalization

Date: 2026-10-10

## Scope

`lib/factor-enrollment-contract.mjs` now normalizes validated request operation UUIDs to lowercase before returning them to the enrollment protocol. Acknowledgment validation compares both expected and returned UUIDs case-insensitively and returns the canonical lowercase value. Trusted issuer, subject, session, factor, account, and epoch fields are unaffected.

The existing `tests/factor-service-protocol.test.mjs` now checks letter-containing uppercase request IDs and mixed-case acknowledgment IDs within its existing test case. This prevents a valid uppercase UUID from differing from PostgreSQL's lowercase UUID JSON representation during operation/receipt matching. No database behavior or authority changed.

## Checks

- `node --test tests/factor-service-protocol.test.mjs` — 15/15 passed.
- `node --test tests/admin-bootstrap.test.mjs` — 8/8 passed after the AF same-operation replay correction.
- `pnpm exec eslint lib/admin-bootstrap-protocol.mjs tests/admin-bootstrap.test.mjs lib/factor-enrollment-contract.mjs tests/factor-service-protocol.test.mjs` — passed.
- Combined repository-wide checks: `pnpm test` — 407/407; `pnpm lint`, `pnpm typecheck`, and `pnpm build` — passed. State and secret checks are recorded in the companion AF protocol QA.
- Scoped `git diff --check` — passed.

No SQL, provider, credential, role, route, or live-enrollment actions were performed. Requirement statuses remain unchanged.
