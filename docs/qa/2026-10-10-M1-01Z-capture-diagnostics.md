# M1-01Z capture diagnostics preparation — October 10, 2026

## Change

The one-use local OTP capture helper now reports only a fixed failure category. Its wrapper writes an exclusive `capture-failed.json` marker with category and timestamp after this invocation has written `capture-started.json`. Once the start marker is written, binding/runtime/provider failures consume the attempt; rejected preflight does not rewrite an earlier attempt.

Categories identify only local stage boundaries: binding unavailable/invalid, runtime start/child protocol failure, timeout, transport unavailable, mailbox unavailable, message lookup/uniqueness, encryption, output write/missing output, or completion marker failure. Child error text is never displayed or stored; unknown child output maps to a generic category. The wrapper checks that a nonempty encrypted output exists before writing `capture-completed.json`. It does not inspect or print the OTP or plaintext message.

## Checks and limits

- `pnpm test -- tests/m1-browser-acceptance-window.test.mjs`: 6/6 passed.
- Node syntax check for `scripts/capture-m1-browser-otp.mjs`: passed.
- PowerShell parser check for `scripts/m1-browser-acceptance-window.ps1`: passed.
- `pnpm secrets:check`: no common credential patterns in 355 source files.
- No new tests were added. No capture attempt, inbox access, provider request, browser action, or environment activation occurred during this preparation. The previously consumed run remains unchanged; these diagnostics have not been exercised against a fresh run and do not establish OTP delivery or browser acceptance.
