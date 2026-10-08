# M1-01F operation-status preparation

Base revision: 3ef6393. Prepared only; no migration or live activation in this continuation.

The three requested Luna high agents resumed disjoint tasks, then all three stopped with account usage-limit errors. Partial field-component edits export labels/groups and add a blur-flush callback; they do not wire the full editor or prove autosave. Parent continued directly and added an owner-scoped save-status endpoint, persistence adapter and versioned migration 0004.

GET /api/account/profile/operations/{operationId} accepts a strict UUID and no query/owner selectors. Configuration and the synthetic window gate precede a fresh session check. SQL resolves the same active account/binding as ordinary reads, then looks up only that account's durable operation. A saved result returns its original acknowledgment; not_found is only the current observation. The editor checks status before an explicit same-operation retry. Unknown/error results preserve the exact pending operation and draft, without retrying a write. Account generation checks reject late status results; an unavailable session clears visible values.

Migration 0004 requires the pinned local/preview branch, migrations 0001–0003, sole verified synthetic fixture and existing restricted role attributes/ACLs. It prepares one additional SECURITY DEFINER function with fixed search_path, no product-data write, PUBLIC EXECUTE revoked and only the pinned app role granted access. This new grant has not been executed. Rollback removes only that reader and its migration receipt, retaining profiles/operations. Static SQL tests cannot prove PostgreSQL execution or its live privileges.

Checks: 85 deterministic tests pass; lint, typecheck, build, state/hash (249 IDs/frozen hash unchanged) and whitespace pass. Secret scanner passes across 180 files before the final added migration-test file. An initial rollback-source test falsely matched TRUNCATE inside a denied-privileges string; anchored statement matching corrected the test and final full suite passes. React skill review found no new secret/client storage, cross-request module state, or independent network calls that should run in parallel: authentication must precede owner storage and status must precede retry. Accessibility status messages and explicit buttons retained. No browser behavior claim from these checks.

Open: full-domain adapter/editor binding, serialized 600ms text autosave/blur flush, import/export review/merge, notes/vehicles persistence, home resolution/provenance, application account isolation, migration runtime/rollback checks and genuine browser status/replay/logout. Existing three-field validation remains the live schema contract until forward migration is applied and full-domain binding checked. No production/recovery/OTP/paid work occurred here. Full M1 statuses remain unchanged; no M2 successor chat.

Exact task credits, duration and provider charges unavailable. Three agent continuation attempts failed at the usage limit; no substitute model or credit purchase was used.

Final secret scan passes across 182 source files.
