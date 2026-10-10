# M1 expanded app boundary check

Status: **direct restricted-role ACL/catalog verified on both pinned branches**. Initial failures below are retained history and superseded by the final read-only PASS result; browser/MFA acceptance remains open.

The restricted check was prepared against the two pinned synthetic targets and invoked using the existing user-scoped DPAPI bindings. The verifier requests a read-only transaction with a 10-second statement/request timeout and checks only catalog metadata. It does not query application rows or authentication-user counts.

At 2026-10-08 23:16 America/New_York, both worker invocations stopped in the connection phase with the sanitized result `connection/unknown`:

| Target | Pinned app role | Result |
| --- | --- | --- |
| Local synthetic branch `br-rough-flower-b8lerkcf` | `groundbnb_local_app` | Not verified: connection/unknown |
| Preview synthetic branch `br-bitter-hall-b8ibnrfy` | `groundbnb_preview_app` | Not verified: connection/unknown |

No ACL/catalog conclusion can be drawn. The wrapper emitted no URLs, passwords, database row values, or raw error text. No database writes, grants, binding changes, alternate connection paths, or Git operations were performed. The check should be rerun only after the connection failure is understood within the same approved pinned path.

## Superseding authorized direct read-only result

Parent reran the same pinned worker with network permission: initial failure became connection/query, fixed SQLSTATE diagnostic 42809. The privilege query needed CASE guards so table/sequence checks cannot be evaluated against a different relation type. Receipt counts support PostgreSQL's exact bigint text representation. App role memberships check member direction, matching original guarded migrations; the database owner is an incoming app-role member. Ordinary function checks exclude trigger-only routines, which cannot be directly invoked and require table TRIGGER rights (denied).

Corrected result: local PASS; preview PASS. Both actual existing DPAPI credentials were used privately; no connection/password/raw error was displayed or rewritten. Each pinned role can SELECT only its two metadata tables, has exactly nine expected receipts and five approved ordinary profile functions, no private tables/sequences/helpers/create powers, and no membership of another role. This is direct ACL/catalog proof, not browser application acceptance or MFA.
