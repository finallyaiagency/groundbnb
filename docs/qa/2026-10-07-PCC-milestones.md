# Groundbnb milestone projection correction

Client requested the separate Project Control Center be removed from Groundbnb's milestone sequence and published with M0 complete/M1 next. This is a correction to delivery evidence, not an amendment to product scope.

Audit base: `36ce7e889eb3b0fb561fa31a02ae79a81b8ada61`. `docs/STATE.md`, M0/M1 packets and the October 6 exit audit already agree on that sequence. `docs/milestones.json` still said M0 Not started. It now links the existing passed exit audit and completion date. `docs/qa/runs.json` indexes that single combined gate audit; it does not invent individual test counts or discard the historical failed diagnostics in the linked evidence.

PCC had a September 29 source pin containing its own historical tasks. Its separate repository will refresh the source pin, use only Groundbnb packets, and show the recorded exit evidence. The frozen source, approved amendment, requirement statuses and 249 ledger IDs remain unchanged. M1 has not started. Future snapshots require an explicit refresh; a pinned revision is never presented as live synchronization.

Checks: `pnpm state:check`, `pnpm secrets:check`, and milestone JSON/read-back consistency. No application runtime code changed. Precise task credits unavailable; no metered provider dispatch.
