# M1 profile continuation — preparation and exact checks

Base revision: `42fe26c`; the code, tests and evidence are checkpointed together. Full M1 exit is not passed.

## Implemented locally

The editor selects its smoke/full-v1 contract from the authenticated GET response. Full-v1 fields, serialized 600 ms text autosave/blur flush, strict acknowledgments, dirty-edit retention, explicit conflict review, tracked cancellation and immediate account-data clearing are implemented behind inactive modes. Rejected text saves stay blocked until a user edit; uncertain writes retain the exact UUID/revision/payload and require status-before-explicit-retry. A status response proves its original operation, not the latest profile: all three mutation flows subsequently read the current owner profile and preserve newer known state when refresh fails.

Manual vehicle/vessel and note controls use the prepared records endpoint and migration 0005. Unknown fuel/dimensions remain null, client provenance/owner fields are forbidden, existing AI note origin is retained, and removal is a tombstone. Vehicles with stored locations remain read-only until a safe location update path exists. New quote references are refused until an owner-bound quote source exists. Fuel-unit normalization and location resolution remain open.

Native and strict readable-text profile transfer show reviewed selections, sensitive home/note opt-ins, warnings and before/after values. Unsupported authority/trip/future-tier fields never become account authority. Non-null home points remain visible only as unverified preview data and cannot be committed or exported through a client provenance assertion. The reviewed transfer endpoint and migration 0006 commit selected answer fields and fresh-ID manual notes together in one profile revision and original acknowledgment. Existing notes/tombstones are retained. Fields, records and transfer each remain explicitly gated; no private configuration was activated.

## Actual observations

Existing D-010 approval was used for non-mutating queries through the pinned encrypted local app connection, privately over child stdin. No connection string/password was displayed or saved as plaintext. PostgreSQL JSONB returned `2026-10-08T08:28:01.176146-04:00`; this differs from JavaScript's normalized ISO string. Stored-answer validation now accepts strict valid ISO dates with offsets and up to six fractional digits, retaining exact source precision. Mutation clocks remain server-owned.

A second read-only scalar query checked four synthetic JSONB size fixtures, including UTF-8, escaping, nested structures and exponent-expanded numbers. All four database sizes matched the new estimator. Both adapters enforce the PostgreSQL-formatted 16 KiB size before dispatch; 0006 also enforces the combined bound. Invalid UTF-8, NUL and unpaired UTF-16 are refused rather than silently replaced or sent to JSONB.

Chrome read-only operator queries observed both pinned databases at migrations 0001–0002, with one verified synthetic fixture each. 0003–0004 are staged, not run. The browser tool requires action-time approval for the new owner-scoped operation-reader grant; the concrete two-branch request is pending. No 0003–0006 runtime, ACL or rollback pass is inferred from static SQL tests.

Local connectivity diagnosis: the sandboxed server was Ready but Chrome timed out; a sandboxed CLI read returned EACCES and an elevated read timed out. After the confirmed stop, an elevated loopback server rendered the holding page in Chrome at both 127.0.0.1 and localhost. That server was then stopped. This establishes the current process/network-boundary difference, not the cause of every historical failure. No new profile/auth window, OTP, provider logout, profile write or metered provider run occurred.

## Checks and defects

Intermediate profile suite passed 181/181; final combined F/G/H/I/J/L suite passes 216/216 deterministic tests. Whole-project lint and production build including TypeScript pass. State check passes with 249 IDs and frozen SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`. Dependency audit reports no known vulnerabilities after the pinned factor verifier additions. Final secret scan passes 244 source files. Whitespace check passes.

Retained failed attempts: the first records fixture used an undersized synthetic signing secret and failed four tests; the fixture was corrected. A transfer regression exposed acceptance of malformed account IDs/answer maps; strict canonical snapshot validation fixes it. The build during the status-refresh edit failed because an optional candidate was not narrowed; explicit guards fixed it before the final build. Earlier BlobPart/type and autosave acknowledgment/repeated-rejection defects were also corrected with focused regressions. No failed live observation was relabeled as passing.

React review: private state is component/session scoped; handlers authenticate before storage, and status must precede retry and current-profile refresh. These dependent reads are sequential. Controllers/debounce work are canceled on invalidation. Accessible labels/status messages and explicit review controls are retained. Browser layout/interaction acceptance for the expanded editor is still pending.

## Remaining gates and usage

M1-01E genuine replay/upstream-revoking logout, preview browser acceptance and two-account isolation remain open. Expanded migration execution/rollback/privilege checks, full profile/intake integration, location provenance, readable resolved summaries/PDF, account methods/recovery/MFA/bootstrap, durable membership records/grants and atomic financial reservations remain open. All affected whole-requirement ledger statuses remain Not started; mocks prove only local contracts. M2 waits for actual M1 exit.

Three existing Luna High agents resumed disjoint coding/review slices, then reached a usage limit in follow-on tasks. Parent continued directly with the prepared records-request suite and maintained verifier. The new records test initially miscounted persistence invocations (four extra authority-field bodies are rejected before persistence); correcting that test expectation yielded the passing final suite. No substitute agent model or paid purchase was used. Exact task credits, charges and total duration are unavailable. Unrelated routing edits already present in the shared worktree are preserved and excluded from this checkpoint.
