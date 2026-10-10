# M1-01AA — Factor principal preparation

**Status:** Prepared only. Migration 0013 and its operator verifier have not been executed. No factor login, grant activation, credential, key, route, challenge, or MFA lifecycle was provisioned.

## Changes

- Prepared guarded migration 0013 up/down for the exact pinned local/preview branches. It creates the branch-specific factor principal as NOLOGIN, grants only CONNECT, schema USAGE, and the five factor entry points, and extends only `_factor_lock_identity` to accept that same principal as `session_user`. Any future LOGIN enablement must apply to the same principal in a separate gate; no group-role membership path is supported.
- Added `db/operations/verify-m1-factor-principal.sql`, a rollback-only 0013 catalog verifier. It checks the 13 receipts, ordinary app six-function/read-only baseline, factor principal NOLOGIN/unmembered attributes, exactly five factor function ACLs, and denial of direct data/helper privileges. It does not `SET ROLE` or invoke factor operations.
- Extended `scripts/verify-m1-expanded-app-boundary.ps1` with explicit `-Baseline 13`; default remains `12`. The 13 mode additionally requires the exact 0013 receipt and the expected NOLOGIN/unmembered branch principal with the five function ACLs. The existing app credential remains the only connection used.
- Parent ran the baseline12 app-boundary worker on both pinned branches; both attempts failed in the connection/query phase with sanitized SQLSTATE `42883`. Audit found the worker passed a text-typed `CASE` value to `acldefault`; it now explicitly casts that value to PostgreSQL's internal `"char"` type. This correction is prepared for a fresh check; the worker has not been rerun live.

## Static checks

- `pnpm test -- tests/expanded-app-boundary-worker.test.mjs tests/factor-service-principal-migration.test.mjs`: 13/13 pass.
- `pnpm exec eslint scripts/verify-m1-expanded-app-boundary.mjs tests/expanded-app-boundary-worker.test.mjs tests/factor-service-principal-migration.test.mjs`: pass.
- PowerShell parser check and `node --check scripts/verify-m1-expanded-app-boundary.mjs`: pass.
- `git diff --check` on the prepared artifacts: pass.
- A static regression asserts the explicit `acldefault((CASE ...)::"char", ...)` argument type.

These checks inspect SQL and verifier contracts; they do not establish SQL runtime semantics, parse or execute migration SQL against Neon, or prove effective live privileges. The two failed baseline12 worker attempts are retained above; the corrected worker awaits a fresh live rerun. No 0013 migration or operator verification was executed.

## Artifact SHA-256

| File | SHA-256 |
| --- | --- |
| `scripts/verify-m1-expanded-app-boundary.ps1` | `3D6A53C2F8A4F3DADD7B5A5C99037D0B19EB151639C5281DA753D6B40E24F41A` |
| `scripts/verify-m1-expanded-app-boundary.mjs` | `3E7F1716581B3863A2B199A6421DD2CF5A365831536DE47F594D1E1AEC13E683` |
| `tests/expanded-app-boundary-worker.test.mjs` | `B0EE4BD510770B1232D13A127FECDF58BBB602A52C02F8163DCD656ABEBD0407` |
| `db/migrations/0013_factor_service_principal.sql` | `9F4DC52B313B1C34FBB65919D7A9D82991D496F3A0DDC6D7BC80EB015B59B0C1` |
| `db/migrations/0013_factor_service_principal_down.sql` | `C5942C92D7A67A256B301598289BF8A145E4FFE87F6FB02F98A7D8B84FDEC8F8` |
| `db/operations/verify-m1-factor-principal.sql` | `E0BEE23B36601C168282FCA4E4EC3C494FDE13498F1E4B9AE9E4AD3C94AA8F47` |
| `tests/factor-service-principal-migration.test.mjs` | `384B9F595057DDFE50E1B66C84D855FDFF6B74F33A31240B6432F30D1A5AB6CC` |
| `docs/tasks/M1-01AA-factor-runtime-boundary.md` | `790967EBA007BE2DEE73E728B73190AE4086314FF093CDCD3D6626F4608BF8AE` |

Task-level usage was unavailable; credits, token totals, and exact task duration are left blank. The two parent-run baseline12 catalog checks are the only database connections in this continuation; no factor migration, role/credential change, provider call, or metered product dispatch occurred.
