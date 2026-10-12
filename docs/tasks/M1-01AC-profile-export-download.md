# M1-01AC — Reviewed profile export download

Status: Implemented locally; partial authenticated local browser evidence. A 464-byte native JSON profile file was downloaded and passed offline envelope validation; a later browser session imported one selected field, received a Saved acknowledgment, and matched canonical reload. A revision-16 PDF artifact was also found and validated at metadata level after the browser download event timed out. These limited results do not complete file-transfer or PDF acceptance. M1 remains open.

Read `AGENTS.md`, `docs/STATE.md`, `docs/tasks/M1-01AB-profile-records-transfer-browser.md`, `docs/tasks/M1-01AA-factor-runtime-boundary.md`, `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, `docs/spec/09-admin-usage.md`, and `docs/spec/15-shared-safeguards.md` before changing this slice. Frozen source scope remains unchanged.

## Scope

The transfer panel starts a download only from the currently reviewed, canonical profile export. The action requires a current account and session generation, matching revision and profile/options source binding, no disabled/busy/pending/conflict state, and sensitive-data confirmation when the selected preview requires it. Stale preview/copy content is hidden and cleared when its account, revision, session, profile source, or export options change.

The UI chooses one canonical ISO timestamp and supplies it to `buildProfileExport`; `startProfileExportDownload` receives that same timestamp with the builder returned byte array and MIME type. It copies the byte view, derives a date-matched filename, creates and clicks a temporary anchor, removes the anchor in cleanup, and revokes the object URL on a bounded delay (with immediate cleanup if scheduling fails). It reports that the download was started, not that a file was saved.

## Acceptance checks

- Unit coverage proves exact byte-view contents, MIME type and dated filename, temporary-anchor cleanup, idempotent URL revocation, failure cleanup, invalid input rejection, current-preview/session/action guards, and stale preview/copy invalidation.
- Focused Node tests, scoped ESLint, and TypeScript typecheck pass.
- Partial browser evidence is recorded in `docs/qa/2026-10-10-M1-01AB-browser-partial.md`. In run `104eb164d5ef4f659e29d9478e68fe5f` (source `17974e4`), the browser returned a downloaded JSON file; the retained 464-byte artifact's SHA-256 is `5E0F2A9E43AA8BAA0F49C659678D2D149761D84617A4007C7F3CD5EBA40392E5`. Offline validation accepted the v1 envelope with nine allowlisted fields and zero warnings; `profileNotes` was empty and there was no `homePoint` or top-level quotes.
- In run `672e29ab2f8e44bf850a933c60033480` (source `fd099080ae061a93b2908c3b286140cdf945492c`), the native file chooser selected that previously downloaded artifact. Only the traveler-count field was selected. The UI displayed Saved for operation `f5015494-3d22-449d-8347-1d71293ab2f7`; canonical reload showed the imported count and preserved the unselected Couple preference and existing vehicle/note records. Because the artifact had empty `profileNotes`, this run does not establish note import.
- In run `277642a328994b189309587b8aef1599` (source `52e0368`), the revision-16 PDF download click produced a timed-out browser event, but a matching 9,358-byte file appeared in Downloads. Its SHA-256 is `7F4B5364F29E72995185646C8A602906964E8E615DAF9A21F56DF9264952FB4E`; the copied artifact validated as a two-page PDF with revision metadata only. The event timeout is not treated as a successful download event, and PDF text/layout were not inspected.
- These runs are limited to the synthetic local account. They do not establish note import in the latest run, PDF text/layout or selected-quote/calendar correctness, cross-account or preview isolation, upstream session revocation, trip-file transfer, or complete release acceptance. ACC-02 and related requirement statuses remain unchanged.
