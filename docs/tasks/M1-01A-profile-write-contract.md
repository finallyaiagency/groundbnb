# M1-01A — Revisioned profile write contract

Status: implemented locally; durable/authenticated integration not started.

## Scope

Implement the domain boundary for a profile patch: require the caller's expected revision, validate account-scoped answers, preserve answered/unset state, produce a next revision, and return a field-level comparison on conflict. This is a preparatory slice of M1-01, not completion of DATA-02, OP-02, ACC-02, or ACC-07.

Binding source requirements: DATA-02, OP-02, ACC-02, ACC-07.

Named derived views: `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, and `docs/spec/15-shared-safeguards.md`. Exact binding source rows are in the frozen source referenced by `docs/spec/SOURCE-HASH.txt`; the frozen source and ledger remain unchanged by this slice.

## Boundaries

- The function prepares a candidate state only. It does not claim a durable save acknowledgment.
- Account identity must come from a verified server session in the future integration; this function does not authenticate callers or accept authority changes in profile patches.
- Writes must later commit atomically with the durable acknowledgment and use isolated preview auth/database identities.
- Full profile field dictionary, ownership enforcement, Neon persistence, sign-in, MFA/step-up, membership and reservation controls remain open.

## Exit evidence

See `docs/qa/2026-10-07-M1-01A-profile-contract.md`. The product requirement ledger remains Not started for these full requirements until the live, revision-tied acceptance evidence exists.
