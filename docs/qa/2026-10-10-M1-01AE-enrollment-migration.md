# M1-01AE factor enrollment migration candidate

Status: offline candidate with one failed, rolled-back local apply attempt. The corrected `0014_factor_enrollment` remains unapplied. The local transaction reached the final guard, failed with SQLSTATE `42601` (mismatched parentheses near `)`), and was explicitly rolled back. Preview was not attempted. No committed schema change, grant, runtime activation, enrollment, key access, or credential action occurred.

## Scope and source

This candidate implements the private six-call lifecycle contract in `docs/tasks/M1-01AE-factor-enrollment-writer-design.md` for the pinned synthetic local and preview branches. It expects the exact 0013 role/function boundary, retains the current factor-service role and its five existing functions, and adds no grants. New lifecycle receipts are bound to account, provider subject, managed session, operation, factor, epoch, and a 32-byte opaque request fingerprint. Failed enrollment attempts use the logical `verify` operation kind and a durable `rejected` receipt; replay reads that same receipt without counting another attempt.

The forward migration is `db/migrations/0014_factor_enrollment.sql`; rollback is `db/migrations/0014_factor_enrollment_down.sql`; the pinned rollback-only catalog and unmapped-identity probe is `db/operations/verify-m1-factor-enrollment.sql`. The operator probe uses a read-write transaction only because the existing identity helper takes a row lock; it checks the fixed unmapped synthetic identity and rolls the transaction back. It does not manufacture an owner/session or test successful enrollment.

## Candidate source hashes

- Corrected forward migration SHA-256: `B0F550D351D33D41A6FB1728692F61845DB56566935410DE56AFBB908AB8E1EE`
- Failed local candidate forward SHA-256: `BE1082F8313D4395280D3A46BBA3E3DA647A294CD88876A59AFAE5A1FEEE4A5F`
- Rollback migration SHA-256: `FA018C7D2DACD3DADFFC0E558436D23527C73128ABD5B22B623904B928673293`
- Operator verifier SHA-256: `357D5F71091E89272E2D1EED04EBD400B572635E4EE7565F73EC0384E185D2AA`

The prior `BE1082...` candidate was the exact local attempt that failed and rolled back; it is retained here for chronology and must not be retried. The corrected `B0F550...` hash removes one surplus closing parenthesis from the final private-function ACL guard and adds a matching static assertion. It is a working-tree candidate, not an applied or published migration revision. The operator verifier's success marker remains `ROLLBACK_PENDING` until the exact reviewed revision is applied and tested under its separate authorization.

After the explicit rollback, the metadata-only SELECT was run on both pinned branches. Local and preview each returned the expected database/branch pin, 13 migration receipts, no 0014 receipt, no enrollment table, and zero enrollment functions. This confirms only that both remain at the pre-0014 catalog; no corrected migration was attempted. The sanitized confirmation screenshot is outside the repository at `C:/Users/17044/Documents/Codex/groundbnb-0014-rollback-confirmed-2026-10-10.png`.

## Checks

Before the failed local attempt, candidate `BE1082...` passed the combined offline gate: 407/407 tests, ESLint, TypeScript, project-state validation (249 IDs), secret scan (373 source files), and Next build. The local guarded transaction then failed at the final DO block and rolled back. For corrected candidate `B0F550...`, the focused existing migration suite passes 8/8; the full offline gate passes 407/407 tests, ESLint, TypeScript, project-state validation (249 IDs), secret scan (376 source files), and Next build. Exact-hash CI has not yet run. The read-only aggregate query at `.tmp/verify-m1-0014-postrollback.sql` was executed after rollback on local and confirmed the 13-receipt baseline and absence of 0014 table/functions/receipt. Static assertions cover exact 13-receipt precondition, six private entrypoints, immutable receipt table/helper, owner-only ACL, composite factor/account/epoch reference, rollback refusal on lifecycle history, unmapped denial probes, explicit rollback, and the corrected closing-parenthesis shape.

## Limits and remaining gates

The failed guarded transaction does not establish SQL runtime correctness; the corrected candidate has not been run in PostgreSQL. No locking or concurrency behavior, durability, successful begin/verify, TOTP correctness against a real session, post-commit identity freshness, or MFA authorization is established. No trusted synthetic owner/admin fixture or successful runtime enrollment exists. The service and SQL remain dormant; the factor principal still has only its existing five functions and cannot call these six new functions. Keep ACC-08 Not started until full live and security acceptance is complete.
