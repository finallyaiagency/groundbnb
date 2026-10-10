# M1-01A profile write contract

Date: 2026-10-07. Scope: local domain-contract implementation only.

`lib/profile-contract.mjs` prepares a candidate profile revision from a validated patch. It rejects missing expected revisions, malformed answers, authority fields, unknown field names and invalid unset values. It retains only account identity, creation time and profile answers in the candidate, and reports current/proposed values for affected fields on stale writes. It does not write to Neon, authenticate a user, or claim a saved acknowledgment. Allowed fields follow the account-scoped portion of Section 11.3; trip-only fields are excluded.

Checks after moving the chat into the Groundbnb project: full `pnpm test` — 20 passed, 0 failed; `pnpm typecheck`, `pnpm lint`, `pnpm state:check` (249 IDs and frozen source hash), `pnpm secrets:check` (116 files), `git diff --check`, and `pnpm build` passed. `pnpm audit --audit-level high` passed with no known vulnerabilities after an approved network escalation. Earlier EPERM fixture/build failures were resolved by the project workspace permissions; the earlier npm EACCES attempt was stopped and superseded by the successful audit. These local results do not prove live auth or persistence.

Requirements DATA-02, OP-02, ACC-02, and ACC-07 remain Not started in `docs/ledger.csv`: this slice does not satisfy their full acceptance criteria. M1 is in progress. Neon auth/session integration, ownership isolation, atomic durable saves, live preview verification, MFA, membership, and financial reservations are open.

Live integration is blocked until a client-approved isolated local/preview auth and database configuration is available in this checkout; `.env.example` is placeholder-only and no `.env.local`/profile tables/auth routes exist. No provider credentials were read or transmitted. Usage: task-level Codex credit data unavailable; no cost inferred.
