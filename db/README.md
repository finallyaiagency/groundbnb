# Project Control Center write foundation

The read-only dashboard uses checked-in repository evidence. Incoming client submissions will use the isolated Neon `preview` branch (`br-plain-grass-b8xotge6`), database `groundbnb`. PCC migration `0001` was applied to that preview database on 2026-09-29; its objects are separate from Groundbnb product tables. See `docs/qa/2026-09-29-pcc-store.md`.

## Proposed access path

1. Neon Auth on the same preview branch verifies a browser session server-side. A server-only allowlist of immutable Auth subject IDs determines sponsor write access. An empty allowlist denies every write.
2. The Next.js server validates request content, authorizes the actor, checks the target database/host, and calls the Postgres functions with the verified subject. Client-supplied actor fields are ignored. A server-only Neon driver adapter exists in `lib/pcc-store.ts`; it has no public route or configured secret yet.
3. `pcc.streams` holds the current revision. `pcc.events` holds every submitted action with an immutable event ID, stream ID, revision, actor, idempotency key, JSON payload, and server timestamp. The event table rejects updates and deletes. Each append requires the caller's expected revision so concurrent edits conflict instead of overwriting history.
4. Repository decisions, amendments, and requirement evidence remain authoritative after review. A later reconciler should write approved events into versioned files with a link to the originating event; the database remains the inbox/audit source for submissions.

The Auth service and database connection are unconfigured. Do not expose submission routes or mark PCC-02 complete until authentication, least-privilege runtime access, schema migration, and live preview smoke tests pass. This design follows [Neon's branch-scoped Auth description](https://neon.com/blog/neon-auth-branchable-identity-in-your-database) and its [serverless driver guidance](https://neon.com/blog/serverless-driver-ga); exact SDK wiring must be checked against current official documentation when implemented.

## Migration and recovery

- Confirm project `groundbnb`, branch `preview`, branch ID `br-plain-grass-b8xotge6`, and database `groundbnb` in the console before execution.
- A manual preview snapshot was captured before migration on 2026-09-29 at 06:48:57 UTC; Neon shows it never expires. The first migration is additive and was not run on the production branch.
- Migration and rollback smoke results are recorded in `docs/qa/2026-09-29-pcc-store.md`. Check the schema before any replay; the migration is not idempotent.
- A dedicated runtime role must have only needed schema/function privileges. Do not use a database owner connection in the deployed app.
- Never put connection URLs, Auth tokens, sponsor subject IDs, or session data in Git or logs.

## Pending decision

`Q-002` is open. Neon Auth is the proposed identity provider because it is branch-scoped with this Neon database. Enabling it and enrolling the sponsor require explicit authorization and verification. Until then, all writes remain disabled.
