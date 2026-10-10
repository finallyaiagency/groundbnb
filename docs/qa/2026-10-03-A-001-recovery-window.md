# A-001 launch recovery amendment — 2026-10-03

Client instruction: “change 7 day launch requirement to 6 hour, unless there's a good reason not to. how do we move on from here”. D-004 supersedes D-002's interim interpretation. Approved A-001 changes only the Section 11.16 production recovery-history minimum from seven days to six hours, linked to LEG-10. The four-hour operational recovery target and LEG-12 replay drill remain required. The unrelated seven-day retention margin for deletion/revocation controls and preview cleanup deadline remain unchanged.

Reason: keep the client's chosen Neon Free plan. Accepted consequence: an error discovered after the available history expires may be unrecoverable. [Neon's 2026-10-02 announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project) advertises six hours; [official plan documentation](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md) also specifies a 1 GB change-history cap. Actual available history may therefore be shorter and must be checked under representative writes. This amendment does not authorize a paid upgrade or certify live recovery.

## Revision and changes

Base commit: `dda641849cc82b2efa1e0c697a232ff35ff338f5`. The Git checkpoint containing this report holds the tested amendment implementation. Reproducible Git blob revisions:

- `scripts/spec-amendments.mjs`: `113a0a7890072d4afe9276edbcdd909c5ae64d97`.
- `scripts/check-project-state.mjs`: `a6e481dc873b01bfd54fdd61b83256f5f616d06f`.
- `scripts/generate-project-state.mjs`: `e65e58477e1682565ae376074be4d0872e798b1a`.
- `tests/project-state.test.mjs`: `8af9f58bb9b95717789ad25f23e5987ceca65b8c`.
- `docs/changes/A-001-recovery-window.json`: `25ba94dfbcccac99241aba1eab76fda84d68c859`.

The frozen source hash remains `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`. The generated launch view names and fingerprints A-001. The runbook, task packet, decisions, integration register, ledger, and STATE use the effective six-hour requirement. LEG-10 returns from Blocked to Not started; its privacy page, actual horizon, recovery timing, and replay evidence are pending. No integration is marked Verified by this amendment.

## Exact checks

- `pnpm state:generate --views-only`: passed, 16 views regenerated without overwriting the ledger.
- `pnpm state:check`: passed, 249 IDs, original source hash, amendment metadata/fingerprint and applied wording.
- `pnpm test`: passed, 9 tests. The new mutation test checks stale recovery wording, unapproved/stale amendment records, Windows/Linux line endings, and byte-preserved source/ledger regeneration.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm secrets:check`, and `git diff --check`: passed.
- `pnpm audit --audit-level high`: failed, existing high-severity [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), `braces@3.0.3` through the Next ESLint development dependency chain. No dependency or gate changed here; LEG-09 remains Blocked. This checkpoint is not a green-CI or launch claim.

## Next work and usage

Resolve the lint dependency finding, then finish separate auth/credentials and protected synthetic preview bindings. Verify recovery availability and a quarantined baseline restore before M0 exit; proceed to the prepared M1 account/profile packet afterward. Complete full LEG-12 deleted-account and credential replay in M8 before launch. Q-002 is closed; these are implementation checks, not new scope decisions.

No live database mutation, paid upgrade, or metered product dispatch occurred in this amendment task. Task-level Codex credits and dollar-denominated provider usage are unavailable; none was inferred. No subagents were used.
