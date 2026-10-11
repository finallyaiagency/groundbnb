# M1-01AE factor enrollment migration candidate

Status: corrected migration SHA-256 `B0F550D351D33D41A6FB1728692F61845DB56566935410DE56AFBB908AB8E1EE` applied and committed on both pinned synthetic branches. An earlier local attempt with SHA-256 `BE1082F8313D4395280D3A46BBA3E3DA647A294CD88876A59AFAE5A1FEEE4A5F` failed at the final guard with SQLSTATE `42601` and was explicitly rolled back; that exact failed candidate was not retried. No factor-function grant, LOGIN, credential, key, enrollment, route, or MFA runtime was activated.

## Scope and source

This candidate implements the private six-call lifecycle contract in `docs/tasks/M1-01AE-factor-enrollment-writer-design.md` for the pinned synthetic local and preview branches. It expects the exact 0013 role/function boundary, retains the current factor-service role and its five existing functions, and adds no grants. New lifecycle receipts are bound to account, provider subject, managed session, operation, factor, epoch, and a 32-byte opaque request fingerprint. Failed enrollment attempts use the logical `verify` operation kind and a durable `rejected` receipt; replay reads that same receipt without counting another attempt.

The forward migration is `db/migrations/0014_factor_enrollment.sql`; rollback is `db/migrations/0014_factor_enrollment_down.sql`; the pinned rollback-only catalog and unmapped-identity probe is `db/operations/verify-m1-factor-enrollment.sql`. The operator probe uses a read-write transaction only because the existing identity helper takes a row lock; it checks the fixed unmapped synthetic identity and rolls the transaction back. It does not manufacture an owner/session or test successful enrollment.

## Candidate source hashes

- Corrected forward migration SHA-256: `B0F550D351D33D41A6FB1728692F61845DB56566935410DE56AFBB908AB8E1EE`
- Failed local candidate forward SHA-256: `BE1082F8313D4395280D3A46BBA3E3DA647A294CD88876A59AFAE5A1FEEE4A5F`
- Rollback migration SHA-256: `FA018C7D2DACD3DADFFC0E558436D23527C73128ABD5B22B623904B928673293`
- Operator verifier SHA-256: `357D5F71091E89272E2D1EED04EBD400B572635E4EE7565F73EC0384E185D2AA`

The prior `BE1082...` candidate was the exact local attempt that failed and rolled back; it is retained here for chronology and must not be retried. The corrected `B0F550...` hash removes one surplus closing parenthesis from the final private-function ACL guard and adds a matching static assertion. It is the exact corrected source applied below.

After the explicit rollback and before the corrected apply, a metadata-only SELECT confirmed both pinned branches at 13 receipts with no 0014 receipt/table/functions. The sanitized rollback screenshot is outside the repository at `C:/Users/17044/Documents/Codex/groundbnb-0014-rollback-confirmed-2026-10-10.png`.

## Corrected application and bounded database checks

The exact corrected `B0F550...` migration completed its guarded transaction on local and preview: the migration checks and final guard passed, one receipt was inserted, and the transaction committed. The rollback-only verifier `357D5F71091E89272E2D1EED04EBD400B572635E4EE7565F73EC0384E185D2AA` also completed its DO block and explicit `ROLLBACK` on each branch. No operator completion notice marker was observed, so none is claimed. Screenshots: `C:/Users/17044/Documents/Codex/groundbnb-0014-local-commit-2026-10-10.png`, `C:/Users/17044/Documents/Codex/groundbnb-0014-preview-commit-2026-10-10.png`, and corresponding `...-verifier-2026-10-10.png` files.

A separate read-only aggregate on both branches returned the exact database/branch pins, 14 receipts including one 0014 receipt, all six expected enrollment functions, the enrollment table present with zero operation rows, factor principal still NOLOGIN, one synthetic Auth user, and no rows in the factor history tables. This establishes installed dormant schema/catalog state only. The baseline-14 restricted-app checker then passed locally and on preview using the existing encrypted bindings; its first sandbox-restricted invocation failed at connection on both branches and was superseded by the authorized network-enabled rerun. No values were displayed. The checker QA records its candidate hashes and boundaries.

## Checks

Before the failed local attempt, candidate `BE1082...` passed the combined offline gate. Corrected candidate `B0F550...` passed 407/407 tests, ESLint, TypeScript, project-state validation (249 IDs), secret scan (376 source files), and Next build; its focused migration suite passed 8/8. Exact-source CI passed (PR run `38105633900`, push run `38105631275`) for revision `7e4d47468fa5b054eca4b19078d10e1d92b796ea`. Baseline-14 checker tests pass 5/5 with focused ESLint and diff checks passing. Static checks and bounded operator probes do not establish successful owner enrollment, TOTP verification, recovery, or MFA access.

## Limits and remaining gates

The failed first transaction remains a historical failure. The corrected migration's guarded apply and rollback-only verifier establish schema/catalog execution on the pinned branches, not lifecycle correctness under concurrency or a real owner/admin session. No successful begin/verify, TOTP correctness, post-commit identity freshness, recovery flow, protected resource gate, or MFA authorization is established. No trusted synthetic owner/admin fixture or successful runtime enrollment exists. The service remains disconnected; the factor principal still has only its five existing executable functions and cannot call the six new enrollment functions. Keep ACC-08 Not started until full live and security acceptance is complete.
