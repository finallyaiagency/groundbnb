# PCC-01 — Evidence portal foundation

Milestone: Project Control Center foundation. Tier: agency delivery product.

Goal: Deliver a responsive read-only client portal that projects repository evidence, including distinct implementation and verification progress, release gates, requirement drill-down, tests, risks, usage, forecast, and source links.

Binding sources: `docs/source/Agency_Project_Control_Center_Spec_v1.1.md`; Groundbnb Section 0, Section 12, and Section 11.22 in `docs/spec/00-overview.md`, `docs/spec/14-fixtures.md`, `docs/spec/15-shared-safeguards.md`.

Dependencies satisfied: frozen spec hash and 249-row ledger generated; GitHub initial commits pushed; Vercel project and checked read-only preview exist. See `docs/qa/2026-09-29-control-center.md`.

Likely files: `app/**`, `lib/**`, `docs/ledger.csv`, `docs/STATE.md`, `docs/qa/**`.

Non-goals: Groundbnb product feature implementation; live client submission or a fabricated ETA.

Exit: portal renders from checked-in evidence; filters link metrics to underlying IDs; forecast says Insufficient observed data until measured inputs exist; desktop/tablet/mobile navigation works; build and browser smoke pass; preview revision is recorded.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, plus browser verification at 1440×900, 768×1024, and 390×844.

Record evidence in `docs/qa/`; update `docs/STATE.md` and `implementation-usage.csv` only with measured values. Keep requirement statuses unchanged unless the product requirement itself was verified.

Recommended next execution configuration: GPT-5.6 Sol High for the first architecture implementation, then evaluate GPT-5.6 Luna High for bounded widgets/forms against established contracts. No subagents. Medium-to-large task; split persistence into PCC-02. Live-provider cost: none.
