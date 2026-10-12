# M1-01K — Versioned membership storage preparation

Read STATE, M1-01G, named views 00/07/12/15 and frozen Sections 11.14–11.15. Prepare dormant synthetic-only migration 0007 after 0001–0006, with no live execution or new application privileges.

Persist the required Plan, immutable published PlanVersion, MembershipAssignment, AccessGrant and append-only PolicyAudit logical records. Match the existing catalog's stable IDs/keys and explicit feature/limit definitions. A rename must preserve assignments. Account status/role remains independent of membership. Seed only catalog definitions; do not create accounts or synthetic/production authority grants. Assignment/grant writers need later authenticated second-factor and audit integration.

Prevent overlapping effective base assignments per account, preserve pinned versions, forbid a lifetime expiry, permit an optional reason, and preserve revoked grant history. Enforce owner references and known statuses, timestamps and closed supported-v1 grant types. No checkout, paid subscription, supplier transaction, campaign, v1.1 plan-manager UI or new capability activation. Published seed contents are immutable except separate Plan display labels; no trigger may overwrite prior history.

Pin database groundbnb and exact local/preview branch identity, prior migrations, sole verified synthetic fixture and restricted existing app-role baseline. Revoke PUBLIC and app direct table/schema/helper access; enable RLS for account data. Application login/modes remain disabled. The rollback refuses any assignment/grant/audit records and removes only untouched catalog scaffolding, never user data.

Check static schema/seed/immutability/overlap/ACL/rollback contracts. This is preparation only; live migration, concurrent assignments, authenticated grant/revocation/read/evaluator and durable audit tests remain required. Whole ledger rows remain open.
