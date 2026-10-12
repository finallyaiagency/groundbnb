# Q-012 / migration 0013 application and rollback-only verification

Date: 2026-10-10
Result: corrected dormant migration applied and bounded checks passed on both pinned synthetic branches; lifecycle/runtime remains inactive.

## Approved scope

D-016 records the earlier approval for original SHA-256 `9F4DC52B313B1C34FBB65919D7A9D82991D496F3A0DDC6D7BC80EB015B59B0C1`; that attempt failed its local guard and rolled back, and preview was not attempted. D-017 records the client's separate exact-hash approval for corrected `db/migrations/0013_factor_service_principal.sql`, SHA-256 `85F614B7D5DEBD1792E72B00079FE7798EFF5AE3A4F7DD32EDCC5FB2380B04D5`, on only local `br-rough-flower-b8lerkcf` and preview `br-bitter-hall-b8ibnrfy`.

The approved scope was the branch-specific factor-service principal in `NOLOGIN` mode with CONNECT, `groundbnb` schema USAGE, EXECUTE on the five exact 0012 factor functions, and the caller-helper allowlist extension. The corrected guard accepts only the observed creator/admin edge: the platform owner role is the member, `cloud_admin` is the grantor, ADMIN is true, and INHERIT/SET are false. No additional membership path is permitted. The approval did not cover LOGIN, credentials, keys, enrollment, MFA runtime, bootstrap/admin assignment, production, or recovery.

## Apply and read-only checks

The approved corrected migration completed its guarded transaction on both pinned branches: BEGIN, guard DO, one receipt insert, COMMIT. The exact approved migration hash was unchanged. Direct app-boundary checks at baseline 13 passed on both branches. Read-only aggregate metadata on each branch reported database/branch pins correct; 13 receipts with exactly one 0013 receipt; one matching factor principal; one synthetic Auth user; and the expected ordinary-app creator edge. Each factor principal is NOLOGIN with CONNECT, connection limit 2, no SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS/INHERIT attributes, zero outbound memberships and one exact platform creator/admin edge. The ten factor/lifecycle history counts were all zero. No `pg_authid`, secret values, or identity details were read or included.

The rollback-only principal verifier initially failed locally with SQLSTATE `42601`; an intermediate syntax correction also failed with `42601`. Each failed attempt explicitly rolled back. After repair of the missing closing parenthesis in the second ACL-group expression, the verifier completed metadata-only principal, ACL, helper, and zero-history checks on local and preview, returned the expected `M1_FACTOR_SERVICE_PRINCIPAL_0013_ROLLBACK_PENDING` marker on each, and explicitly rolled back each transaction. The verifier did not execute `0013_factor_service_principal_down.sql` and did not test factor operations. No durable writes resulted from verifier runs.

## Limits and remaining gates

Q-012 is closed only for applying and checking the dormant 0013 principal migration. Both factor principals remain `NOLOGIN`; no runtime credential or key was bound, no factor was enrolled, and no MFA challenge or privileged route was activated. Key custody, same-principal LOGIN/credential activation, lifecycle grants, trusted bootstrap, and end-to-end factor acceptance remain separate gates. Requirement statuses are unchanged and M1 remains open. The role-membership attribute distinction follows [PostgreSQL role attributes](https://www.postgresql.org/docs/current/role-attributes.html).
