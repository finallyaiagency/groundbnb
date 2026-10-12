# M1-01Y — Server-owned membership read service

Status: Implemented locally; internal service checks pass, connected acceptance remains open.

## Purpose and authority

Prepare an internal server-only service that obtains fresh managed-session identity and reads the owner-scoped membership snapshot using the existing private `read_membership` reader. This task adds no route, API/UI exposure, environment switch, SQL, grant, or login activation. It assumes the separately approved Q-011 membership-reader-only grant has been completed; the grant and its evidence are parent-owned.

Authority: frozen specification Sections 11.14–11.15 (MEM-01/02/05/06), `docs/spec/12-membership.md`, `docs/spec/15-shared-safeguards.md`, and M1-01U/M1-01X. This is preparation only and does not amend the frozen source.

## Contract

- Accept a server request and existing environment object only. Read the session cookie and call `resolveManagedSessionIdentity`; normalize only its exact success/failure result. The successful issuer must equal the configuration-pinned issuer, and subject/session identity values must be bounded and well formed. Never accept an identity, account ID, plan, role, grant, or membership assertion from the caller.
- Compare the managed session's exact expiry nanoseconds against the server clock after identity resolution and again after the database await. Expiration or malformed clock returns closed auth/unavailable; expiry metadata is never sent to the membership reader or returned.
- Capture an immutable environment snapshot before awaits. Require both the existing managed-session configuration and existing `profileConfiguration` to validate; `GROUND_PROFILE_MODE` must already be enabled. Use only the profile persistence connection pinned to the exact local/preview target.
- When `GROUND_BROWSER_AUTH_MODE=synthetic`, require `browserAuthConfiguration` before managed-session resolution, after that async identity read, and after the database batch. The existing bounded run ID/window remains authoritative; do not extend it or create a new activation switch.
- Perform one fixed parameterized batch: `SET TRANSACTION READ WRITE`, followed by exactly one read of `groundbnb.read_membership($1,$2)` using the trusted issuer/subject. The SECURITY DEFINER reader uses `SELECT FOR UPDATE` in the trusted account resolver, so a read-only transaction is rejected by PostgreSQL; the batch itself performs no application-data DML and makes no persistent role/default change. Use a bounded timeout/no-store fetch and no retry. The service must never return connection data, cookie/token, session ID, email/profile, or diagnostics.
- Reuse M1-01X validation and evaluation inputs. Return only its closed `auth`/`membership_unavailable` result or a deeply frozen validated membership snapshot. Missing/ambiguous base membership and unknown catalog versions remain unavailable; do not default to Free.
- Keep the module server-only and unreferenced by routes or client bundles. Dependency injection exists only for deterministic tests and must still pass exact identity/configuration validation.

## Checks and limits

Use synthetic request/session fixtures, a fake read port, focused Node tests, ESLint, and any repository-required type/build checks. No real Neon query or provider call is part of this task. These checks cannot prove Q-011 grant state, live SQL privileges, session revocation freshness beyond the managed resolver contract, or end-to-end application authorization. No service consumer is enabled by this slice.
