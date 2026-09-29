# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-09-29 | Neon identity at the supplied console URL | Project `groundbnb` verified; named database created on schema-only `preview` branch with no copied data. Production remains unchanged. |
| Q-002 | Open, security-sensitive | Portal submission store and client authentication | PCC event store is live on isolated preview; Neon Auth plus a server-only sponsor subject allowlist is proposed. Automatic approval review rejected the first Auth activation attempt; specific client approval is pending. No live submission is enabled. |

Critical security, money, credentials, legal, destructive data, and irreversible architecture decisions require explicit client authority; they never auto-resolve.
