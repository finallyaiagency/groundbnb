# M1-01U — Owner-scoped membership snapshot reader

## Purpose and scope

Prepare one dormant database reader for the next membership-evaluator/service slice. This task does not seed account assignments, grant access, evaluate feature eligibility, write audit events, alter plan policy, or enable application access. It does not execute SQL or add an application grant.

## Authority

- Frozen source Sections 11.14–11.15 and requirement IDs MEM-01, MEM-02, MEM-05, and MEM-06 define stable plan/version identity, pinned assignments, lifetime grants as overlays, policy modes, and server-evaluated feature definitions. This packet traces those requirements; it does not amend the source.
- Read `docs/STATE.md`, `docs/spec/12-membership.md`, and `docs/spec/15-shared-safeguards.md` before implementation. Migration 0007 provides the dormant plan, published-version, policy, base-assignment, and lifetime-grant records. Migration 0008 illustrates the existing owner-scoped membership selection. `groundbnb._profile_account(text,text)` is the trusted binding boundary.

## Reader contract

Add only `groundbnb.read_membership(identity_issuer text, identity_subject text) RETURNS jsonb` in guarded dormant migration 0011. It is `SECURITY DEFINER` with fixed `search_path=pg_catalog,pg_temp`; it derives the account through `_profile_account`, and accepts no account ID or other caller-supplied authority. The helper and reader remain private: revoke PUBLIC execution, grant neither function to app roles, and do not expose table access.

Acquire the owner through `_profile_account` first. After that helper returns, capture one database `clock_timestamp()` in a materialized CTE, then read policy, assignment, grant, and pinned version data in the same materialized CTE statement snapshot. This keeps raw/valid counts and returned membership data on one MVCC snapshot; it is not runtime concurrency proof. Return a narrow snapshot containing that timestamp, configured policy, one effective base assignment with stable plan/version IDs and pinned published feature/limit definitions, all currently effective lifetime overlays in deterministic precedence order, and the selected effective lifetime overlay. A version is usable only when its `published_at` is non-null and no later than the evaluation timestamp. Base and grant validity intervals are half-open: start is inclusive and end is exclusive. Exclude ended, scheduled, revoked, future, and expired records from effective results. Among v1 lifetime overlays, newest start wins; ties use ascending stable grant UUID order, matching 0008's ordering. Preserve existing access tied to an issued published version even if its plan is later archived; do not use current plan status as an eligibility filter.

No effective base assignment, more than one effective base assignment, missing policy, unpublished/missing/archived assigned plan data, or invalid grant/version linkage must return a closed membership-unavailable result. Never invent a Free default or silently select an arbitrary base assignment. An absent lifetime overlay is valid and returns an empty list/null selection. Never return authority, role, payment, or provider-dispatch claims.

The migration guard requires database `groundbnb`, the exact pinned local or preview branch, exactly the complete 0001–0010 receipt set, the sole verified synthetic Auth fixture, and the existing restricted function-only app-role baseline. The down migration requires the exact 0001–0011 receipt set, refuses unexpected grants, and drops only the reader and its receipt; it preserves every plan, version, assignment, grant, policy, and audit row.

## Checks and limits

Static tests check migration/down guards, no app/PUBLIC execution, owner-derived lookup, pinned versions and policy, half-open windows, deterministic overlay ordering, fail-closed ambiguity/missing assignment, and history-preserving rollback. They do not execute PostgreSQL and cannot prove runtime ACLs, transaction behavior, or evaluator correctness. A later service task must apply this snapshot to an explicit entitlement evaluator and write/retain audit events. MEM-01/02/05/06 remain open until their complete acceptance gates pass.
