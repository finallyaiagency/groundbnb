# M1-01B — Server session identity boundary

Status: local and bounded live server-reader gates pass; browser login/account mapping remain open. See `docs/qa/2026-10-07-M1-01B-session-boundary.md`.

Read `AGENTS.md`, `docs/STATE.md`, `docs/spec/00-overview.md`, `docs/spec/01-ui-nav.md`, `docs/spec/07-data-ops.md`, `docs/spec/12-membership.md`, and `docs/spec/15-shared-safeguards.md`. Binding frozen source rows: SYS-07, DATA-01, OP-01 and Section 11.22 C/D. Retain D-007 and the completed M0 isolation evidence.

Implement a server-only Neon managed-session reader for the existing isolated local/preview issuers. Configuration and the app cookie namespace must pass before any provider contact. Refresh session authority with the provider on each call, reject unverified/expired/mismatched identities, return only an internal auth subject, and grant no owner/admin authority. Client ownership fields never supply this subject. The subject must later map to an application account with active/deletion/revocation checks before a profile write.

Keep activation off by default. Do not mount a general auth proxy, provision a new provider, alter production, initialize passwords or send real-user emails. This slice does not complete login/callbacks, MFA, membership or durable persistence. Local negative tests cannot verify live session isolation. Record exact checks, dependency audit, evidence and usage; checkpoint the code before the live gate.
