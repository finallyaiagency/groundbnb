# Production OTP delivery investigation

Based on 8b911a4d961f4f7b617b6377e3478cfdad8d97ff. Client reported **no code arrived**. SYS-11 stays Blocked; production session rejection remains untested. No account/SMTP/permission change or provider upgrade performed.

## Observations

- The previous thirty-minute local helper expired. Restarted it with no request yet recorded, without viewing client inputs.
- Client then made a real request: ignored `.tmp/evidence/m0-production-session.json` records production_otp_attempted at **2026-10-06T02:43:15.511Z**, maxRealEmails 1, ok false. The marker precedes the worker. The old helper did not persist the send result; HTTP acceptance and inbox delivery are **unknown**, not failures inferred from false or a successful send inferred from a marker.
- Read-only Neon production branch inspection returned only metadata: selected production, Auth heading/table present, two visible table rows (header plus one user), Shared email provider. Personal user/email values were never emitted or copied to preview/local. Webhook status was not established by the metadata filter and is not assumed.
- Asked the client whether the local UI showed Check your inbox or Code request failed; this does not request their address/code. Mailbox delivery cannot be proved from provider acceptance alone.

## Correction and bounded retry

Production worker now returns its HTTP status for an accepted OTP request and names the phase production_otp_request_accepted, avoiding a delivered/sent claim. Browser and legacy popup persist only sendAccepted, HTTP status, fixed phase, timestamp/revision and maxRealEmails; deliveryConfirmed stays null. Browser worker failures are recorded without provider payloads. Recipient/code/session/body remain private transient data.

The first attempt must be preserved under an ignored dated attempt filename. Only one new client-controlled diagnostic request is permitted after the original local code deadline/worker cleanup interval; never send automatically, overwrite the first failure, or blindly repeat until success. The client re-enters their own email and chooses Send one code. This is diagnostic preparation, not a repaired delivery claim or production-session pass.

Official [Neon production checklist](https://neon.com/docs/auth/production-checklist) checked 2026-10-06 UTC: shared SMTP supports verification codes, is intended for development/testing and is rate limited; custom SMTP is recommended for production deliverability. [Email customization](https://github.com/neondatabase/website/blob/main/content/docs/auth/guides/customize-emails.md) describes the default shared sender and webhook interception. These are possible constraints; no specific provider-side cause is proven here. Do not replace production delivery with the synthetic Ethereal capture providers.

## Usage and checks

One real client OTP request attempt recorded; actual send/delivery and task-attributable charges unavailable. No real address, code, session or email body read by Codex. No metered product dispatch. Task Codex credits unavailable. Exact checks and retry preparation are recorded below after completion.

### Dependency gate and exact checks

Initial required audit failed on newly reported [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q): Next 16.3.8 → PostCSS 8.5.23 → source-map-js 1.2.1. The maintainer's [1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) patches the high-severity denial-of-service finding. Added a compatible override scoped to this PostCSS version; install changed only that package, retaining the audit threshold and release-age policy. The original failed audit is retained here.

After installation: `pnpm lint`, `pnpm typecheck`, `pnpm test` (16/16), `pnpm build`, and `pnpm audit --audit-level high` all pass. Node syntax checks for both production helper scripts and PowerShell parser check pass; missing private wrapper is rejected before network access with sanitized metadata only. No live production OTP/session pass is inferred from these checks.

First marker rechecked unchanged after the five-minute deadline plus 65-second worker interval; preserved as ignored `.tmp/evidence/m0-production-session-attempt1-20261006T024315Z.json`. Stopped only the owned loopback server. No production request was sent by this preparation. State/hash gate passes with 249 IDs, frozen SHA-256 unchanged; secret scan passes for 106 source files, usage CSV six rows, diff check passes.

### Published diagnostic handoff

Code and required local gates checkpoint: `780d7ed9a2a75df5b1e746af8b33439f020e9ca8`, pushed to the existing draft PR branch. Replacement loopback helper started at 2026-10-06T02:57:49Z: HTTP 200, no-store, expected static title; request without Origin/CSRF gets 403 before any email worker; active attempt file absent. Whitelisted startup evidence: ignored `.tmp/evidence/m0-production-web-diagnostic-restart-20261006.json`. The helper expires after thirty minutes. Client must refresh the existing private page to receive its new nonce and send the one permitted retry; Codex does not inspect the populated page or submit it. No retry or production-session pass recorded at this checkpoint.
GitHub runs 37406688869 and 37406685472 were in progress when observed; no remote CI or deployment pass is claimed for this checkpoint.
