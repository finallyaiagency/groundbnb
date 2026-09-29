# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-09-29 | Neon identity at the supplied console URL | Project `groundbnb` verified; named database created on schema-only `preview` branch with no copied data. Production remains unchanged. |
| Q-002 | Partially answered by client; implementation open | Portal submission store and client authentication | Client approved the preview-only `CREATE` grant to `neon_service`; it succeeded, and Neon Auth is active in preview `groundbnb`. Production Auth remains disabled. Decide the approved synthetic preview sponsor identity, safe email/signup settings, and trusted preview domain before enrolling anyone or wiring app submissions. Server-side sponsor authorization and live write flow remain unverified. |

Critical security, money, credentials, legal, destructive data, and irreversible architecture decisions require explicit client authority; they never auto-resolve.
