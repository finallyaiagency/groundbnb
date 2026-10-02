# Groundbnb clean-start checkpoint — 2026-10-02

Scope: separate Project Control Center assets from the Groundbnb product repository, Vercel project, and Neon project. This is infrastructure cleanup, not verification of a Groundbnb product requirement.

## Transfer inventory

- Standalone Control Center repository: `finallyaiagency/project-control-center`, main checkpoint `7cb5cd9`. It contains the Control Center Next.js app, auth adapter, event-store migrations, unit tests, generic HTML prototype, and current evidence. Its preview branch and dedicated Vercel/Neon projects remain separate.
- Groundbnb Git history retains prior Control Center checkpoints. Current-tree Control Center app routes, components, libraries, migrations, tests, task packets, historical QA, and source prototype were removed after transfer.
- Frozen Groundbnb source, generated views, requirement ledger, and M0 task packet were retained. No source amendment or ledger status change was made.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Source/ledger consistency | Passed | `node scripts/check-project-state.mjs`: 249 IDs; SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`. |
| Node test runner | Passed, 0 tests | `node --test`: 0 tests, 0 failures. This does not verify product behavior. |
| Groundbnb Vercel env inventory | Passed | Only four branch-scoped Control Center variables were present; `PCC_SPONSOR_SUBJECTS`, `NEON_AUTH_COOKIE_SECRET`, `PCC_AUTH_HOST`, and `NEON_AUTH_BASE_URL` were removed from `Preview (preview/control-center)`. No values were read into Git. |
| Groundbnb Neon branch inventory | Observed | Project `divine-resonance-05443204` had exactly two branches: default `production` and schema-only `preview` (`br-plain-grass-b8xotge6`). The latter contained the old Control Center `groundbnb` database and Auth configuration. |
| Hosted CI | Passed | [Verify run `37022077981`](https://github.com/finallyaiagency/groundbnb/actions/runs/37022077981) on cleanup revision `91f24f3`; includes state check, test command (0 tests), typecheck, lint, and build. |
| Production deployment | Passed | `dpl_PKycyLSPnFsVWKmPuyxGL4Hz7okS` Ready at [groundbnb-ten.vercel.app](https://groundbnb-ten.vercel.app). Browser showed the Groundbnb holding page and 404 at `/preview-sign-in`. |
| Old Vercel project cleanup | Passed | 25 old deployments removed by exact deployment ID, retaining only the clean production deployment. Vercel env inventory now reports no variables; GitHub remote has only `main` branch. Former preview tip retained in tag `archive/pcc-before-separation`. |
| Empty product database | Passed | Neon production database list showed new `groundbnb` database; Tables view selected it and reported 0 tables in `public`. Production Auth remained disabled. |

## Open cleanup

- Delete the old Neon preview branch after the required browser-action confirmation; retain the production branch and its new empty Groundbnb product database.
- Local dependency reinstall stalled while recreating `node_modules` and was stopped. Lockfile-only resolution passed offline. Hosted CI passed exact state, test, typecheck, lint, and build commands. Task-level Codex credits are unavailable.
