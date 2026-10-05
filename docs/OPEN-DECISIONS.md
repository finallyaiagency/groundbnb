# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-10-02 | Neon identity at the supplied console URL | Project `groundbnb` verified. The old preview branch was removed; M0 product branches and baseline schema now exist. |
| Q-002 | Closed, client approved amendment 2026-10-03 | Six-hour production recovery-history minimum at launch, keeping Neon Free. | D-004 supersedes D-002's interim interpretation; A-001 overlays Section 11.16/LEG-10 while preserving the frozen source. Verify actual horizon, privacy disclosure, four-hour recovery target, and LEG-12 replay before launch. |
| Q-003 | Closed, client approved and checked 2026-10-03 | Destructive down-migration check on a disposable branch. | D-003 approved the test. `docs/qa/2026-10-03-M0-01-rollback.md` records the successful rollback and production isolation check. |
| Q-004 | Closed, client approved and executed 2026-10-04 | Managed Neon Auth initialization on synthetic branches lacks database CREATE permission. | D-005 records exact approval. Guarded CREATE grants committed on preview/local only; both managed Auth services are initialized and empty. See `docs/qa/2026-10-04-M0-auth-grant.md`. |
| Q-005 | Preview LOGIN enabled; three client activations pending 2026-10-04 | Distinct, restricted database access for M0 connectivity and recovery. | D-006: four restricted roles created on separate branches. Client replied done to preview handoff; operator catalog checks confirm preview LOGIN=true and local/production/recovery LOGIN=false. Complete those three client SQL/password steps. Direct authentication and app binding remain unverified. See `docs/runbooks/M0-credential-handoff.md` and `docs/qa/2026-10-04-M0-preview-activation.md`. |

Project Control Center decisions are tracked in its [separate repository](https://github.com/finallyaiagency/project-control-center). Critical product decisions remain subject to the frozen specification and explicit client authority.
