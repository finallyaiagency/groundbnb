# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-10-02 | Neon identity at the supplied console URL | Project `groundbnb` verified. The old preview branch was removed; M0 product branches and baseline schema now exist. |
| Q-002 | Open, console checked 2026-10-02 | Required recovery history is at least seven days; Neon Free plan currently shows six hours. | Choose a plan/setting or supported independent backup approach that provides the required recoverability, then verify actual retention and a timed quarantined restore. Any paid upgrade needs client authorization. |
| Q-003 | Open, approval review 2026-10-02 | Destructive down-migration check on disposable `groundbnb-m0-rollback-test`. | Explicitly authorize `DROP SCHEMA groundbnb CASCADE` on a newly created disposable synthetic branch if rollback evidence is required now. The attempted run was rejected by automatic approval review and no schema was dropped. |

Project Control Center decisions are tracked in its [separate repository](https://github.com/finallyaiagency/project-control-center). Critical product decisions remain subject to the frozen specification and explicit client authority.
