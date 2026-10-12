# M1-01E — Synthetic browser sign-in and profile save

Status: initial inactive implementation complete; direct new-handler coverage and genuine browser acceptance pending. D-010 restricted credential/binding passes stand. M1 remains in progress. See `docs/qa/2026-10-07-M1-01E-browser-profile.md`.

Read STATE, M1-01, views 00/01/07/12/15 and frozen source Sections 11.3, 11.11, 11.22 before editing. Binding: SYS-02, SYS-07, SYS-11, ACC-02, ACC-07, DATA-01, DATA-02, OP-02, RULE-05, RULE-06, RULE-08. Frozen source and A-001 unchanged.

Bounded first browser slice: existing local/preview ordinary synthetic email-code fixtures only; no registration, password changes, Google changes, admin bootstrap or MFA claim. A short operator-controlled synthetic run window gates the browser auth endpoints. Signup and metered dispatch remain off. Production/recovery are excluded. Do not rerun M1-01B's completed protocol worker or repeat its attempt marker.

Use the pinned official Neon HTTP endpoints documented in installed @neondatabase/auth 0.5.0-beta; permit only send-code, verify-code and sign-out. Exact same-app Origin, JSON/body limits, fixture allowlist, closed input keys and a finite run window precede provider calls. No upstream JSON/token/cookie/diagnostic is returned to JavaScript. Host-only HttpOnly app cookies retain their isolated names. Verify the fresh managed session and active account mapping before issuing the cookie. Logout must revoke upstream before claiming success; unavailable revocation remains retryable.

The initial profile editor changes traveler count, pets and dietary requirements through the existing seven-field adapter. Other profile fields remain visible as readable text. This does not complete the full Profile requirement. Dirty fields alone are sent with revision and stable operation ID. Uncertain outcomes keep the draft and same operation for explicit retry. Conflicts display current/proposed values and require explicit review. Clear visible account data immediately on logout; no credential/profile localStorage cache.

Checks: exact deterministic gates, type/lint/build/state/secret checks, then real synthetic browser login/save/reload/replay/conflict/logout with pinned restricted credentials and captured email. Record every attempted live run and cleanup. Browser operation is not proved by an operator SQL check or mock. A second real account in the same environment, remaining typed fields, MFA/bootstrap, membership/reservations and recovery gates remain open. M2 chat waits for actual M1 exit.
