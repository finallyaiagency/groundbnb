# M1-01AI offline member-provisioning protocol

The new `lib/synthetic-member-provisioning-protocol.mjs` is a pure offline orchestration candidate for creating only ordinary synthetic `member` accounts under the six exact local/preview seed aliases accepted by `resolveSyntheticSeedIdentity`. It does not create Auth fixtures, assign roles, or invoke SQL, providers, or routes.

The request accepts only a UUID operation ID. The protocol pins environment and issuer in constructor configuration and in the stable fingerprint payload; the rolling session expiry is excluded from that fingerprint and checked against the injected clock on each fresh identity resolution. The existing injected keyed-fingerprint shape is reused without adding key material. Repository access is limited to three fixed ports: context read, one account writer call, and read-only receipt lookup. The writer ACK and receipt require exact own-data snapshots, operation/fingerprint/session bindings, closed status values, and nullable account bindings for non-success outcomes. A durable `created` receipt remains true on replay; `already_member` is false. Successful receipts require a strict finite timestamp. A missing receipt after an uncertain write returns `unknown`; the protocol never retries the writer and never exposes account identifiers, email, or role.

The existing admin-bootstrap test case was extended without adding a test case. It covers newly created and pre-existing-member results, uncertain ACK recovery, not-found remaining unknown without another writer call, foreign account binding, post-write session loss/change, malformed receipt binding, accessor rejection, and provider-object mutation from a clock callback. This remains test-double evidence, not proof of durable SQL behavior.

## Checks

- `node --test tests/admin-bootstrap.test.mjs`: 8/8 existing cases passed; test-case count unchanged.
- `node --check lib/synthetic-member-provisioning-protocol.mjs`: passed.
- `pnpm exec eslint lib/synthetic-member-provisioning-protocol.mjs tests/admin-bootstrap.test.mjs`: passed.
- `pnpm test`: 407/407 passed. The first sandboxed attempt had two `EPERM` failures when unrelated tests created their temporary fixtures under repo `.tmp`; the same suite passed after a narrow escalated rerun allowing those fixture-directory writes.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed.
- `pnpm state:check`: passed, 249 IDs and frozen source hash unchanged.
- `pnpm secrets:check`: passed, no common credential patterns in 395 source files.

No live provider/database operation, Auth fixture, route, SQL object, grant, credential, role change, or key action occurred. The adapter, durable transaction/receipt constraints, revocation enforcement, concurrency, and runtime binding remain unimplemented and unverified. No requirement status was promoted; ACC-08 and related ledger entries retain their existing status. Codex usage was unavailable for a reliable credit measurement.
