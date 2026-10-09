# M1-01Y — Server-owned membership read service

**Status:** Internal server-only service prepared; no route or application consumer is wired.

## Changes

- Added `lib/membership-service.mjs`. It captures an immutable environment snapshot, requires the existing pinned session and profile persistence configurations, validates the configured cookie name, obtains a fresh managed-session identity, narrows it to the configured issuer and verified subject, and then calls the M1-01X private reader adapter.
- The Neon runtime port performs one fixed HTTP batch: `SET TRANSACTION READ WRITE` followed by the parameterized membership reader call, with an 8-second timeout and `no-store`; this is required because `_profile_account` takes a row lock. The batch contains no product-data DML and does not change role defaults. It never retries. Query configuration and authentication/session metadata stay local and are excluded from the return value.
- Added `tests/membership-service.test.mjs` for the environment gate, cookie and resolver outcomes, issuer matching, request-selector rejection, process-environment-shaped capture/accessor refusal, environment mutation during the auth await, exact transaction batch, sanitized failures, missing-base denial, synthetic run-window checks before/after awaits, and exact nanosecond session-expiry checks after auth/database awaits.

## Results

- `node --test tests/membership-service.test.mjs`: 8/8 pass.
- `pnpm exec eslint lib/membership-service.mjs tests/membership-service.test.mjs`: pass.
- `node --test tests/membership-postgres-repository.test.mjs`: 10/10 pass after the independent adapter review fixes.
- Independent M1-01Y review found no defects. The shared resolver now accepts native Node `process.env` through its guarded configuration path and rechecks its clock after the managed-auth await; exact-expiry checks after both auth and database awaits pass. Combined `tests/session-identity.test.mjs` plus `tests/membership-service.test.mjs`: 20/20 pass.

All service tests use synthetic session/query doubles. The real Neon HTTP path was not called. There is no route, UI, exported membership endpoint, SQL change, grant action, or mode activation from this slice. Parent owns Q-011 grant/readback evidence. The reader operation uses a read-write transaction solely because its owner resolver takes a row lock; this is not a claim of product-data writes. Provider revocation freshness beyond the resolver contract, connected application authorization, and membership audit persistence remain open; MEM-01/02/05/06 are not complete.
