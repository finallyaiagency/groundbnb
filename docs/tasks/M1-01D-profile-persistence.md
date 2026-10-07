# M1-01D — Account mapping and atomic profile persistence

Status: implementing; migration/function grants approved under D-009/Q-008. Migration committed on both pinned branches at b236d01; rolled-back operator invariants/catalog checks pass. Roles remain NOLOGIN; client credential activation and application/browser gates are pending.

Binding: SYS-02, SYS-07, SYS-11, DATA-01, DATA-02, OP-02, RULE-05, RULE-06, RULE-08 and Sections 11.3–11.4/11.22. Read STATE, M1-01, named views 00-overview, 01-ui-nav, 07-data-ops, 12-membership, 15-shared-safeguards and exact source rows before edits. M0 and D-008 carry forward.

First persistence slice covers homeAddress, dietaryRequirements, specialRequirements, hasPets, alwaysBeginEndAtHome, travelerCount and preferredRegions with bounded types and explicit answered/unset state. Other dictionary fields, vehicles, notes, summaries and calendar require their typed adapters before persistence; no full Profile completion is claimed. No resolved provider point is stored before field-specific rights review.

Migration 0002 creates normalized accounts, issuer/subject bindings, profiles, per-field answers and durable operations. It binds only each branch's sole pre-existing verified synthetic email fixture, with member role, no bootstrap admin. Functions serialize with account state/binding revocation; reject unavailable identities before any replay/conflict; lock revision; validate patch in the database; atomically commit changed fields and canonical acknowledgment; identical operation replay returns the retained result and changed payload reuse is rejected. No direct application table/Auth grants. PUBLIC function execution is revoked and security-definer paths are fixed.

Server read/save route remains off unless separate app credentials, profile enabled flag and existing isolated session gate are configured. PATCH requires exact app Origin, JSON and at most 16 KiB streamed body. Owner/entity selection comes from the freshly verified provider session, never request input. Safe no-store errors preserve retry with the same operation ID; the server does not automatically retry uncertain commits.

Checks: deterministic field/configuration/parameter/response tests; type/lint/build/state/secret checks. After approved migration: operator transactional invariants, ACL read-back, then client credential activation and direct restricted-role tests. Actual signed-in browser/deployed persistence and two-account isolation remain required before product verification. SQL/operator tests or mocks do not prove these.
