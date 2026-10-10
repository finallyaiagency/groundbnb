# M1-01H — Provider reservation contract preparation

Status: bounded offline prerequisite under M1-01 foundation; no provider dispatch or live reservation writer.

Read STATE, M1-01 foundation, views 00/07/12/15 and frozen Sections 11.14–11.15 and shared recoverable-execution rules. Selected baseline prerequisites: MEM-09, MEM-10 and v1 MEM-15. Preserve their separate v1.1 extension gates.

Prepare strict exact-money validation and a pure admission candidate against trusted owner/policy/rate/period context. Never interpret unknown cost/spend/reservations as zero. Every applicable account, provider, application daily/monthly and Free-pool window must fit the conservative maximum, including pending reservations and unavailable emergency funds. Paused, unverified identity, unknown rate or invalid context refuses metered work. Commercial report-only never relaxes these limits.

An admitted candidate is not a durable reservation or authorization to dispatch. A later database slice must atomically enforce all windows, deduplicate operation/attempt IDs, preserve historical policy/rate provenance, settle actual cost, retain uncertain reservations, and pass concurrent synthetic live checks. A new plan/trip/model/credential cannot reset existing period spend. No Economy/fallback dispatch in v1, no supplier transaction, no rates guessed from memory, no payment or paid-provider run in this packet.

Checks: deterministic unknown/boundary/reserve/precision/ownership/Paused cases, lint/type/build/state/hash/secrets. Keep all whole requirement statuses open until actual durable service evidence exists. Independent preparation can continue while profile migration approval is pending.
