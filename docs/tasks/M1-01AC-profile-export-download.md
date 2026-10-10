# M1-01AC — Reviewed profile export download

Status: Implemented locally; offline checks only. This slice repairs browser download setup and preview binding. It does not prove that a browser completed a file download or that the resulting artifact can be imported. M1 remains open.

Read `AGENTS.md`, `docs/STATE.md`, `docs/tasks/M1-01AB-profile-records-transfer-browser.md`, `docs/tasks/M1-01AA-factor-runtime-boundary.md`, `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, `docs/spec/09-admin-usage.md`, and `docs/spec/15-shared-safeguards.md` before changing this slice. Frozen source scope remains unchanged.

## Scope

The transfer panel starts a download only from the currently reviewed, canonical profile export. The action requires a current account and session generation, matching revision and profile/options source binding, no disabled/busy/pending/conflict state, and sensitive-data confirmation when the selected preview requires it. Stale preview/copy content is hidden and cleared when its account, revision, session, profile source, or export options change.

The UI chooses one canonical ISO timestamp and supplies it to `buildProfileExport`; `startProfileExportDownload` receives that same timestamp with the builder returned byte array and MIME type. It copies the byte view, derives a date-matched filename, creates and clicks a temporary anchor, removes the anchor in cleanup, and revokes the object URL on a bounded delay (with immediate cleanup if scheduling fails). It reports that the download was started, not that a file was saved.

## Acceptance checks

- Unit coverage proves exact byte-view contents, MIME type and dated filename, temporary-anchor cleanup, idempotent URL revocation, failure cleanup, invalid input rejection, current-preview/session/action guards, and stale preview/copy invalidation.
- Focused Node tests, scoped ESLint, and TypeScript typecheck pass.
- No live browser, filesystem download artifact, import-from-downloaded-file, cross-account isolation, authentication activation, or release acceptance is claimed. ACC-02 and related requirement statuses remain unchanged.
