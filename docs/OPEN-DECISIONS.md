# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-09-29 | Neon identity at the supplied console URL | Project `groundbnb` verified; named database created on schema-only `preview` branch with no copied data. Production remains unchanged. |
| Q-002 | Partially answered by client; blocked on access change | Portal submission store and client authentication | Client approved enabling Neon Auth on project `groundbnb`, preview branch `br-plain-grass-b8xotge6`, database `groundbnb`. Neon returned `permission denied for database groundbnb`. Read-only SQL showed `neon_service` has `CONNECT` but lacks `CREATE` there. Automatic approval review rejected a separate `CREATE` grant to that role; it was not executed. Auth and live submissions remain disabled. |

Critical security, money, credentials, legal, destructive data, and irreversible architecture decisions require explicit client authority; they never auto-resolve.
