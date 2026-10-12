# M1-01AF offline bootstrap protocol candidate

Date: 2026-10-10

## Scope

Implemented the offline injected-resolver/repository protocol in `lib/admin-bootstrap-protocol.mjs` and extended the existing `tests/admin-bootstrap.test.mjs`. The candidate accepts only pinned local/preview synthetic seed aliases, validates exact session/request/context/ack/receipt shapes, allows one writer call, and performs no route, SQL, account creation, role write, provider call, or factor operation.

Every non-`not_found` status receipt is matched to the same fresh session and a fresh context with matching account, seed slot, and seed role. An `activated` historical receipt is reported as activated only if the fresh context still reports an active account with the bound role, binding, and exactly one owner. Rejected receipts report only their historical refusal after the binding tuple still matches; a context mismatch or unknown context fails closed. Lost writer acknowledgments use at most one read-only receipt lookup and never repeat the mutation.

The internal `activated` context state is a proposed engineering enum for the post-commit check, not a new frozen product requirement. The public `status()` result is an operation-history outcome, not current authorization. No requirement status is promoted.

## Checks

- `node --test tests/admin-bootstrap.test.mjs` — 8/8 existing test cases passed; protocol assertions were folded into existing cases without adding test declarations.
- `pnpm exec eslint lib/admin-bootstrap-protocol.mjs tests/admin-bootstrap.test.mjs` — passed.
- `git diff --check` on the three changed implementation/test/packet paths — passed.
- Repository-wide checks on the combined AF/AD candidate: `pnpm test` — 407/407; `pnpm lint` — passed; `pnpm typecheck` — passed; `pnpm build` — passed; `pnpm state:check` — valid, 249 IDs, source SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`; `pnpm secrets:check` — no common credential patterns in 384 source files.

The focused assertions cover post-commit state drift, one-write lost-ack receipt recovery, same-operation replay with no second writer, not-found replay with no writer, matching/mismatched rejected receipts, stale activated receipts after role/binding drift, exact request/session handling, uppercase UUID normalization, and context/ACK/receipt snapshots before subsequent resolver awaits. Session and returned-object mutation across awaits cannot change the validated snapshot.

## Limitations

This is an offline protocol candidate over in-memory test doubles. It does not prove SQL behavior, provider identity or revocation, durable receipts, ACLs, recovery-ledger mirroring, owner bootstrap, MFA, or live acceptance. No database or provider calls were made. ACC-08 and related requirements remain at their existing statuses.
