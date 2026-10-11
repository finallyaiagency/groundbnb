# M1-01AE baseline-14 restricted-app checker preparation

Status: offline checker extension plus direct baseline-14 restricted-app ACL/catalog PASS on both pinned synthetic branches. This does not establish enrollment, MFA, or privileged application behavior.

## Scope

The existing restricted-app checker now accepts an explicit `14` baseline. It expects exactly the 12 established receipts plus `0013_factor_service_principal` and `0014_factor_enrollment`; the existing default remains baseline `12`, and baseline `13` behavior remains available. The check keeps the same six-function ordinary-app allowlist, denies extra app functions/private tables/sequences, and verifies the factor principal still has only its five existing factor-service functions with no table/helper access. The prepared 0014 enrollment functions remain outside both app and factor EXECUTE allowlists.

No grant, role change, enrollment, or runtime activation was performed for this checker extension. The direct check used the existing encrypted app bindings privately; no connection values or ordinary application rows were displayed.

## Source and candidate hashes

- Base revision: `7e4d47468fa5b054eca4b19078d10e1d92b796ea`
- Worker SHA-256: `FA97862EDBC1B711B8025B3DE56D3360D07B49C90B65599DDFE97FD6466520BF`
- PowerShell wrapper SHA-256: `2B174F8940FEE8026AD9D23EF870A470CCDA5EB55A367154F8E54118405D1520`
- Focused test SHA-256: `D75C7126969851B7C6B9C134787B1A13DD73F2683BCAFD32C43E3E1AC46393FF`
- Candidate checker files were tested against working-tree revision `7e4d47468fa5b054eca4b19078d10e1d92b796ea` plus the three listed file contents; this preparation has not yet been committed.

## Offline checks

- `pnpm exec node --test tests/expanded-app-boundary-worker.test.mjs`: 5/5 passed.
- ESLint for the worker and focused test: passed.
- `git diff --check` for worker, wrapper, and test: passed.

The baseline-14 mode must be used only after the exact 0014 receipt exists on the intended pinned branch. The offline test proves only the worker's fixed catalog-query construction and wrapper input contract; direct catalog results are reported below. Neither form of check establishes enrollment or browser behavior.

## Direct baseline-14 ACL/catalog run

After corrected migration `0014_factor_enrollment` was committed on both pinned branches, the first sandboxed checker invocation failed on both targets at `connection/unknown` because its network execution was restricted. The authorized network-enabled rerun passed on local and preview at baseline `14`; the existing encrypted app bindings were used privately and no values were displayed. This is direct restricted-role ACL/catalog evidence for the exact working-tree checker candidate, not enrollment, MFA, or application/browser acceptance. The final metadata-only aggregate ran on both branches and confirmed 14 receipts, one 0014 receipt, six enrollment functions, the enrollment table with zero operations, the factor principal still NOLOGIN, one Auth user, and empty factor-history tables. This is bounded schema/catalog evidence only.
