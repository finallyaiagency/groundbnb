# M1-01AG pending setup resume migration preparation — October 11

## Scope

This is an offline candidate for owner-authorized same-session redisplay of the already encrypted pending TOTP setup seed. It adds no new frozen requirement and does not grant functions, enable the `NOLOGIN` factor principal, wire a route, configure a key, or claim MFA acceptance.

Candidate files:

- `db/migrations/0015_factor_enrollment_resume.sql`
- `db/migrations/0015_factor_enrollment_resume_down.sql`
- `db/operations/verify-m1-factor-enrollment-resume.sql`
- `docs/tasks/M1-01AG-factor-pending-setup-resume.md`

The SQL candidate extends the private 0014 lifecycle receipt and audit linkage. The writer reports `newlyCommitted` only on its first new release path; the application must still confirm transaction commit before material delivery. Status replay never authorizes plaintext delivery. The reader is status-only and never returns envelope material. The rollback refuses if any resume receipt or release audit history exists. The existing application and factor function allowlists remain pinned.

## Offline checks

- `pnpm test -- tests/factor-service-principal-migration.test.mjs`: 8/8 passed.
- `pnpm exec eslint tests/factor-service-principal-migration.test.mjs`: passed.
- `pnpm state:check`: passed; 249 requirement IDs and frozen source hash validated.
- `git diff --check`: passed.

The static migration assertions cover the exact pinned baseline, original/expanded lifecycle constraint guards, private function settings and ACLs, same-operation status-only replay, history-preserving rollback refusal, and unmapped-identity rollback-only checks.

## Read-only catalog confirmation

A metadata-only query through the existing restricted application bindings completed on both pinned branches. It observed identical installed 0014 CHECK definitions for finite timestamps, operation kind, status, and the original begin/verify lifecycle. The 0015 UP guard now matches those captured definitions while preserving PostgreSQL's returned parentheses and casts. The migration remains unapplied, so the definitions created by 0015 itself have not been observed in PostgreSQL; its DOWN and operator predicates for those new checks remain candidate expectations, not live-confirmed catalog output. After a reviewed UP is applied, capture those new definitions through metadata-only reads and align the DOWN/operator guards before rollback verification. No product rows were read or changed by this metadata check.

## Limits and next gate

No migration SQL was executed. Static tests do not establish PostgreSQL parsing, migration behavior, locking, durability, or runtime enrollment. The existing 0014 definitions have now been checked with a metadata-only query, and the 0015 UP preflight guards match them. After reviewed UP application, compare actual 0015-added `pg_get_constraintdef` output with the DOWN/operator predicates before rollback verification. The operator has not run. There is no current resume function, route, key delivery path, factor credential, enrollment, or successful MFA proof.

The source ledger remains unchanged; ACC-08 stays Not started. These checks do not promote any requirement status.
