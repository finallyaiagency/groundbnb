# Change records

The source specification is frozen. Client ideas and corrections are triaged here. Approved contractual scope changes receive a dated amendment tied to stable requirement IDs and are reflected in generated task views and the ledger without rewriting the source.

## Approved amendments

- `A-001-recovery-window.json` (2026-10-03, D-004, LEG-10): Section 11.16 launch recovery-history minimum is six hours. Four-hour recovery time, truthful available history, and LEG-12 replay remain required. This accepts less protection against mistakes discovered late while keeping Neon Free.

Approved JSON records name the frozen source hash, client instruction, affected IDs, exact replacement, and generated views. Regenerate with `pnpm state:generate --views-only` to preserve the ledger's evidence and statuses. `pnpm state:check` validates amendment hashes and applied wording. Historical decisions and QA remain unchanged.
