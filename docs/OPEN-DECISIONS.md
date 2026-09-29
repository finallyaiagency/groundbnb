# Open decisions and questions

| ID | Status | Topic | Next action |
| --- | --- | --- | --- |
| Q-001 | Answered by client, console checked 2026-09-29 | Neon identity at the supplied console URL | Project `groundbnb` verified; named database created on schema-only `preview` branch with no copied data. Production remains unchanged. |
| Q-002 | Partially answered by client; implementation open | Portal submission store and client authentication | Client designated a test-only preview inbox and a separate future live sponsor inbox in chat. The preview account exists with a synthetic display name but no verified email or sign-in credential; neither address is stored in Git. Sign-in method, trusted preview domain, and server-side sponsor enrollment remain open. Production Auth and live write flow remain disabled. |

Critical security, money, credentials, legal, destructive data, and irreversible architecture decisions require explicit client authority; they never auto-resolve.
