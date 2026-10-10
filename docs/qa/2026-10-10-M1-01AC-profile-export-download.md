# M1-01AC QA — Reviewed profile export download

Date: 2026-10-10
Status: Offline implementation checks pass; no browser artifact verification. Requirement statuses unchanged.

## Changes

- Added `lib/profile-export-download.mjs` to initiate a download using the exact reviewed export bytes, MIME type, and export timestamp; it ensures anchor cleanup and delayed object-URL revocation, including failure paths.
- Updated `app/profile/profile-transfer-controls.tsx` to enforce account/session/revision/source/options and busy/pending/conflict/confirmation checks. Stale preview and copied JSON are cleared or hidden when their bindings change.
- Added `tests/profile-export-download.test.mjs` and expanded `tests/profile-transfer-controls.test.mjs`.

## Checks

- `node --test tests/profile-export-download.test.mjs tests/profile-transfer-controls.test.mjs` — 9/9 pass.
- `pnpm exec eslint app/profile/profile-transfer-controls.tsx lib/profile-export-download.mjs tests/profile-export-download.test.mjs tests/profile-transfer-controls.test.mjs` — pass.
- `pnpm typecheck` — pass after adding explicit timer callback types.

During development, the focused checks first caught a timestamp-fixture mismatch and later a test-fixture lint issue; those were corrected before the final passing runs. The first typecheck found implicit `any` timer callback parameters; explicit types fixed it. No full suite, build, browser, or artifact check was run for this slice.

## Limits

The helper only confirms that the browser download was started. No downloaded file was inspected or imported, so the prior artifact-completion gap remains open. No account-scope raw-request proof, cross-account test, preview test, or full M1 acceptance is claimed. M1 remains open; ledger statuses are unchanged. No publication, credential operation, provider call, or database change occurred.

Source HEAD observed: `fec44a0011a48955b1b91d7d8bcb859a0cd565f4`. Codex credit usage, exact task duration, and provider charges were unavailable and are not inferred.
