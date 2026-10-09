# M1-01AA — Factor principal preparation

**Status:** Prepared only. Migration 0013 and its operator verifier have not been executed. No factor login, grant activation, credential, key, route, challenge, or MFA lifecycle was provisioned.

## Changes

- Prepared guarded migration 0013 up/down for the exact pinned local/preview branches. It creates the branch-specific factor principal as NOLOGIN, grants only CONNECT, schema USAGE, and the five factor entry points, and extends only `_factor_lock_identity` to accept that same principal as `session_user`. Any future LOGIN enablement must apply to the same principal in a separate gate; no group-role membership path is supported.
- Added `db/operations/verify-m1-factor-principal.sql`, a rollback-only 0013 catalog verifier. It checks the 13 receipts, ordinary app six-function/read-only baseline, factor principal NOLOGIN/unmembered attributes, exactly five factor function ACLs, and denial of direct data/helper privileges. It does not `SET ROLE` or invoke factor operations.
- Extended `scripts/verify-m1-expanded-app-boundary.ps1` with explicit `-Baseline 13`; default remains `12`. The 13 mode additionally requires the exact 0013 receipt and the expected NOLOGIN/unmembered branch principal with the five function ACLs. The existing app credential remains the only connection used.

## Static checks

- `pnpm test -- tests/expanded-app-boundary-worker.test.mjs tests/factor-service-principal-migration.test.mjs`: 13/13 pass.
- `pnpm exec eslint scripts/verify-m1-expanded-app-boundary.mjs tests/expanded-app-boundary-worker.test.mjs tests/factor-service-principal-migration.test.mjs`: pass.
- PowerShell parser check and `node --check scripts/verify-m1-expanded-app-boundary.mjs`: pass.
- `git diff --check` on the prepared artifacts: pass.

These checks inspect SQL and verifier contracts; they do not establish SQL runtime semantics, parse or execute the SQL against Neon, or prove effective live privileges. The PowerShell verifier was not run because it would connect to the databases.

## Artifact SHA-256

| File | SHA-256 |
| --- | --- |
| `scripts/verify-m1-expanded-app-boundary.ps1` | `3D6A53C2F8A4F3DADD7B5A5C99037D0B19EB151639C5281DA753D6B40E24F41A` |
| `scripts/verify-m1-expanded-app-boundary.mjs` | `F53313187E3B8757C6786C0B7D2A47123A991636143593B0DFE4DB27FB547956` |
| `tests/expanded-app-boundary-worker.test.mjs` | `D2FDD9E3804DD15AD19E8DD9FE67312A365E9CEA3D778A242ABFE4CAE72151DA` |
| `db/migrations/0013_factor_service_principal.sql` | `9F4DC52B313B1C34FBB65919D7A9D82991D496F3A0DDC6D7BC80EB015B59B0C1` |
| `db/migrations/0013_factor_service_principal_down.sql` | `C5942C92D7A67A256B301598289BF8A145E4FFE87F6FB02F98A7D8B84FDEC8F8` |
| `db/operations/verify-m1-factor-principal.sql` | `E0BEE23B36601C168282FCA4E4EC3C494FDE13498F1E4B9AE9E4AD3C94AA8F47` |
| `tests/factor-service-principal-migration.test.mjs` | `B09DAD061843088E3C90200F8D00CC7C04669B3BCE2DFBD245543EB826543F15` |
| `docs/tasks/M1-01AA-factor-runtime-boundary.md` | `790967EBA007BE2DEE73E728B73190AE4086314FF093CDCD3D6626F4608BF8AE` |

Task-level usage was unavailable; credits, token totals, and exact task duration are left blank. No provider calls, database connections, or metered product dispatch occurred.
