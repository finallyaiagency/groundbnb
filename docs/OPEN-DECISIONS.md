# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-10-02 | Neon identity at the supplied console URL | Project `groundbnb` verified. The old preview branch was removed; M0 product branches and baseline schema now exist. |
| Q-002 | Closed, client approved amendment 2026-10-03 | Six-hour production recovery-history minimum at launch, keeping Neon Free. | D-004 supersedes D-002's interim interpretation; A-001 overlays Section 11.16/LEG-10 while preserving the frozen source. Verify actual horizon, privacy disclosure, four-hour recovery target, and LEG-12 replay before launch. |
| Q-003 | Closed, client approved and checked 2026-10-03 | Destructive down-migration check on a disposable branch. | D-003 approved the test. `docs/qa/2026-10-03-M0-01-rollback.md` records the successful rollback and production isolation check. |
| Q-004 | Closed, client approved and executed 2026-10-04 | Managed Neon Auth initialization on synthetic branches lacks database CREATE permission. | D-005 records exact approval. Guarded CREATE grants committed on preview/local only; both managed Auth services are initialized and empty. See `docs/qa/2026-10-04-M0-auth-grant.md`. |
| Q-005 | All four direct role logins pass; remaining bindings open 2026-10-05 | Distinct, restricted database access for M0 connectivity and recovery. | D-006: deployed preview and client local/production/recovery login/identity/baseline/catalog checks pass at e5abf0a. No password was saved/read by Codex; do not repeat prompts. Other destination bindings and full email/session isolation remain open. See `docs/qa/2026-10-05-M0-role-checks-recovery.md`; SMTP credential entry/Save is the next client handoff in `docs/runbooks/M0-email-capture.md`. |

Project Control Center decisions are tracked in its [separate repository](https://github.com/finallyaiagency/project-control-center). Critical product decisions remain subject to the frozen specification and explicit client authority.
