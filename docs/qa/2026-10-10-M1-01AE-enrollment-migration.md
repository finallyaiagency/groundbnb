# M1-01AE factor enrollment migration candidate

Status: offline implementation preparation only. Migration `0014_factor_enrollment` remains unapplied. No database connection, SQL execution, role grant, runtime activation, enrollment, key access, or credential action occurred.

## Scope and source

This candidate implements the private six-call lifecycle contract in `docs/tasks/M1-01AE-factor-enrollment-writer-design.md` for the pinned synthetic local and preview branches. It expects the exact 0013 role/function boundary, retains the current factor-service role and its five existing functions, and adds no grants. New lifecycle receipts are bound to account, provider subject, managed session, operation, factor, epoch, and a 32-byte opaque request fingerprint. Failed enrollment attempts use the logical `verify` operation kind and a durable `rejected` receipt; replay reads that same receipt without counting another attempt.

The forward migration is `db/migrations/0014_factor_enrollment.sql`; rollback is `db/migrations/0014_factor_enrollment_down.sql`; the pinned rollback-only catalog and unmapped-identity probe is `db/operations/verify-m1-factor-enrollment.sql`. The operator probe uses a read-write transaction only because the existing identity helper takes a row lock; it checks the fixed unmapped synthetic identity and rolls the transaction back. It does not manufacture an owner/session or test successful enrollment.

## Candidate source hashes

- Forward migration SHA-256: `BE1082F8313D4395280D3A46BBA3E3DA647A294CD88876A59AFAE5A1FEEE4A5F`
- Rollback migration SHA-256: `FA018C7D2DACD3DADFFC0E558436D23527C73128ABD5B22B623904B928673293`
- Operator verifier SHA-256: `357D5F71091E89272E2D1EED04EBD400B572635E4EE7565F73EC0384E185D2AA`

These are working-tree candidate hashes, not an applied or published migration revision. The operator verifier's success marker remains explicitly `ROLLBACK_PENDING` until the exact reviewed revision is applied and tested under its separate authorization.

## Checks

At the shared candidate snapshot, the existing migration static test was extended in place and passes 8/8. Combined checks pass: 407/407 tests, ESLint, TypeScript, project-state validation (249 IDs), secret scan (373 source files), and Next build. The static assertions cover exact 13-receipt precondition, six private entrypoints, immutable receipt table/helper, owner-only ACL, composite factor/account/epoch reference, rollback refusal on lifecycle history, unmapped denial probes, and explicit rollback.

## Limits and remaining gates

No PostgreSQL parser, compilation, transaction, or operator script was run. These checks therefore do not establish SQL runtime syntax, actual catalog shape, locking or concurrency behavior, durability, successful begin/verify, TOTP correctness against a real session, post-commit identity freshness, or MFA authorization. No trusted synthetic owner/admin fixture or successful runtime enrollment exists. The service and SQL remain dormant; the factor principal still has only its existing five functions and cannot call these six new functions. Keep ACC-08 Not started until the full live and security acceptance is complete.
