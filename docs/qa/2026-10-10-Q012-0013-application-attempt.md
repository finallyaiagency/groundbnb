# Q-012 / migration 0013 application attempt

Date: 2026-10-10
Result: authorized scope; incomplete, with no migration committed.

## Approved scope

The client replied “Approve Q-012” for `db/migrations/0013_factor_service_principal.sql`, SHA-256 `9F4DC52B313B1C34FBB65919D7A9D82991D496F3A0DDC6D7BC80EB015B59B0C1`, on only local `br-rough-flower-b8lerkcf` and preview `br-bitter-hall-b8ibnrfy`. D-016 records the approval. Scope is limited to the exact dormant NOLOGIN principal, CONNECT, `groundbnb` schema USAGE, five named factor-function EXECUTEs, and the migration's caller-helper extension. It does not authorize LOGIN, credentials, keys, enrollment, MFA activation, admin/bootstrap assignment, production, or recovery access.

## Attempt and observed result

Read-only baseline metadata on both pinned branches showed twelve receipts, no 0013 receipt, no factor principals, and one synthetic Auth user per branch. The restricted app boundary check at baseline 12 passed on both branches. These observations did not apply SQL.

On local only, the exact original migration transaction began. Its guarded `DO` block raised SQLSTATE `P0001` with the message `Pinned ordinary app boundary or private factor-helper baseline differs`. The transaction was explicitly rolled back. No COMMIT occurred. The error alone did not identify which predicate differed; the subsequent read-only diagnosis below isolated the mismatch. Preview migration was not attempted.

A follow-up read-only diagnostic evaluated 20 preflight predicates. All passed except `app_role_unmembered_ok`. Catalog metadata on both branches showed one membership row with the matching `groundbnb_{local,preview}_app` role as the granted role and `neondb_owner` as the member, granted by `cloud_admin`; admin option was true, while inherit and set options were false. This is the platform creator/admin membership edge rejected by the original guard; it does not show that the app role can inherit or set another role. The diagnostic made no changes. A narrowly scoped guard repair accepts only this exact edge and preserves rejection of other membership paths; the corrected candidate remains unapplied.

After reviewing a narrowly revised guard that accepts only this exact platform edge while retaining the other membership denials, the read-only expanded app-boundary checker at baseline 12 passed on both targets. This recheck verifies the existing ordinary app boundary and creator-edge shape only; it does not establish a factor principal, its privileges, or any 0013 receipt. The revised migration remains unapplied, and the original-hash approval does not cover it.

The corrected migration candidate is SHA-256 `85F614B7D5DEBD1792E72B00079FE7798EFF5AE3A4F7DD32EDCC5FB2380B04D5`. It preserves the exact creator/admin edge while continuing to reject other memberships. The original approval is bound to the earlier hash `9F4DC52B313B1C34FBB65919D7A9D82991D496F3A0DDC6D7BC80EB015B59B0C1`; the corrected candidate needs separate review and fresh action-time confirmation. Neither branch has applied the corrected candidate.

The corrected guard passed the combined focused worker/migration set (5 app-boundary worker checks plus 8 migration-contract checks, 13/13 total); the migration-contract file itself passed 8/8. The full existing suite passed 407/407. The local working-tree checker passed baseline 12 on both branches. These are offline contract checks and read-only baseline verification; no factor principal metadata, 0013 receipt, or successful migration application has been verified.

## Limits and next step

Q-012 remains open. The approval covers only the original migration hash; any corrected exact hash requires review and new action-time confirmation before use. Do not infer a factor principal, grant, receipt, or helper change from the rolled-back attempt. Preview migration was not attempted. No credential, LOGIN, key, factor enrollment, MFA challenge, or provider action occurred. Requirement statuses remain unchanged. The membership-option distinction follows PostgreSQL's role-membership attributes: [PostgreSQL role attributes](https://www.postgresql.org/docs/current/role-attributes.html).
