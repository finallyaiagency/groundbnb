# M1-01AB — bounded profile acceptance attempt

Date: 2026-10-10
Result: one code request was accepted, but OTP capture failed before authentication; M1 remains in progress.

## Scope and outcome

- Source revision: `147f85d4ee3c41d5bbe965e138d6b9d61af04a1f`. The parent reports GitHub CI runs `38024217714` and `38024219800` passed at this revision; this attempt did not rerun CI.
- Run `adbb71d4675d45a49d18fbcd1355e94a` was pinned to the local synthetic fixture `local-01@example.test`, `full-v1`, `manual-v1`, and `reviewed-v1`, with one OTP request maximum and a fixed 30-minute expiry. The run was closed before expiry and its environment backup was restored.
- The sign-in form's email is intentionally read-only and pinned to the fixture. A browser automation fill timed out; this was consistent with the form behavior, not evidence of a product input defect.
- The operator submitted the ordinary sign-in form once. The page reported that a code was requested. The helper recorded the single-send admission and one capture start, then returned a sanitized failure without a diagnostic cause. No retry was made.
- No encrypted OTP artifact or capture-completion marker exists. No code was entered; no authenticated session, profile read/save, export/import, PDF, or download was verified. The UI acknowledgment is not proof of SMTP delivery.
- The owned Next server was stopped and its listener was confirmed gone. The exact run was closed; `closed.json` records closure at `2026-10-10T05:09:02.3696201Z`. The send-admission and capture-start markers are preserved for audit.

## Evidence limits

The available output cannot distinguish a wrapper, DPAPI, child-process, IMAP, or message-processing failure. No claim about provider delivery, OTP availability, or product authentication is made. Any next attempt requires the reviewed diagnostic handling and a newly prepared bounded run; this record does not authorize or perform a retry.

No database, provider configuration, account data, or requirement status was changed. No tests or build were run for this evidence-only update. Task credit usage and provider charges are unavailable and not inferred.

## Second bounded attempt

- Source revision: `b9a9972b347fcc48d69ef75f87aae28a521c956e`.
- A separately prepared run, `e273a564cc6346d9bed236ecc91ff1d3`, used the same pinned local synthetic fixture and mode limits. The operator again submitted exactly one ordinary UI request; the page reported that a code was requested.
- The capture helper was invoked exactly once with default sandbox permissions. It returned only the reviewed allowlisted category `transport_unavailable`; no provider error or message content was exposed. No capture retry occurred.
- `capture-failed.json`, `capture-started.json`, and `send-admitted.json` are retained. No encrypted code artifact or capture-completion marker exists. No code was entered and no authenticated profile action or download was verified.
- A separate read-only TCP reachability probe by the parent reported that the synthetic IMAP endpoint was reachable; it performed no authentication or inbox read. This does not identify the capture failure cause or establish message delivery.
- The owned foreground server was stopped; its listener was confirmed absent. Run closure at `2026-10-10T05:19:24.0432397Z` restored the prior environment and removed the consumed environment backup. No run was extended or restarted.

The `transport_unavailable` category under default sandbox execution suggests an execution-path limitation, but does not prove it caused the failure. No SMTP delivery, OTP availability, or authentication pass is claimed. Any further attempt must use a separate fresh bounded run and the reviewed, permission-scoped capture execution path; it must not retry this run.
