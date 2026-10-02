# M0-01 — Repository and isolated environments

Milestone: M0. Binding requirements: SYS-01, SYS-09, SYS-11, SYS-14, RULE-12, RULE-13, LEG-12 foundation. Read `AGENTS.md`, `docs/STATE.md`, this packet, `docs/spec/00-overview.md`, `docs/spec/13-launch.md`, `docs/spec/15-shared-safeguards.md`, and the exact source rows by `source_line` in `docs/ledger.csv`. Verify branch/revision first.

Source rows SHA-256 (binding IDs in the order above): `3BD7D9734DE02894BFB471B5179340AAB51D286B97C39F0C65765E051DF85D72`. Refresh this packet against the frozen source if those rows change through an approved amendment.

Dependencies: the standalone Project Control Center is available to track work; Neon identity confirmed by client and console verified; the old Control Center preview branch has been removed; no production/customer data may be cloned to previews.

Goal: CI typecheck/lint/unit/audit, environment schema, isolated Neon/Vercel branches and auth, baseline migration, recovery controls, provider-data policy review, and bounded live-test activation.

Non-goals: broad product feature implementation, production data migration, v1.1 work.

Exit: preview health check identifies revision; synthetic preview contains no production identities/secrets; metered dispatch denied until bounded activation; schema/migration and rollback evidence recorded; documentation consistency check catches ID/tier/hash drift. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and documented bounded integration checks. Update ledger only with requirement-level evidence, `docs/qa/`, `docs/STATE.md`, and measured usage. Make a coherent checkpoint and prepare M1's packet.

Recommended model: GPT-5.6 Sol High, due to environment isolation, provider rights, and recovery architecture. No subagents. Large: split after environment contracts if necessary. Live checks use explicit bounded budget.
