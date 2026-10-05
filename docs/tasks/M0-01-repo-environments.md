# M0-01 — Repository and isolated environments

Milestone: M0. Binding requirements: SYS-01, SYS-09, SYS-11, SYS-14, RULE-12, RULE-13, LEG-12 foundation. Read `AGENTS.md`, `docs/STATE.md`, this packet, `docs/spec/00-overview.md`, `docs/spec/13-launch.md`, `docs/spec/15-shared-safeguards.md`, and the exact source rows by `source_line` in `docs/ledger.csv`. Verify branch/revision first.

Source rows SHA-256 (binding IDs in the order above): `3BD7D9734DE02894BFB471B5179340AAB51D286B97C39F0C65765E051DF85D72`. Refresh this packet against the frozen source if those rows change through an approved amendment.

Approved amendment: read `docs/changes/A-001-recovery-window.json` and D-004. The effective Section 11.16 launch recovery-history minimum is six hours; source rows/hash remain frozen. The four-hour recovery-time target and LEG-12 restore replay still apply. A retention setting alone is not restore evidence.

Dependencies: the standalone Project Control Center is available to track work; Neon identity confirmed by client and console verified; the old Control Center preview branch has been removed; no production/customer data may be cloned to previews.

Goal: CI typecheck/lint/unit/audit, environment schema, isolated Neon/Vercel branches and auth, baseline migration, recovery controls, provider-data policy review, and bounded live-test activation.

Non-goals: broad product feature implementation, production data migration, v1.1 work.

Exit: preview health check identifies revision; synthetic preview contains no production identities/secrets; metered dispatch denied until bounded activation; schema/migration and rollback evidence recorded; documentation consistency check catches ID/tier/hash drift. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and documented bounded integration checks. Update ledger only with requirement-level evidence, `docs/qa/`, `docs/STATE.md`, and measured usage. Make a coherent checkpoint and prepare M1's packet.

Recommended model: GPT-5.6 Sol High, due to environment isolation, provider rights, and recovery architecture. No subagents. Large: split after environment contracts if necessary. Live checks use explicit bounded budget.

## Remaining work in order

1. CI dependency repair completed at `51aa557`; high-severity audit and Linux CI passed with the original gate retained.
2. Distinct production/preview/local managed Auth services exist with empty users. Q-004 is closed by D-005. D-006's four limited roles now have LOGIN enabled after client handoff; catalog checks passed. Public preview settings are saved at the exact Git branch. Client must enter the preview URL in Vercel's Secret form, then run direct credential read/denial checks and verify live database health/revision. Finish email capture or verified test-recipient restrictions before app auth use, keep metered dispatch off, and prove real auth isolation.
3. Record actual six-hour recovery availability and a timed quarantined baseline restore. Keep the complete deleted-account/revoked-credential replay drill as the LEG-12/M8 launch gate when account controls exist.
4. Once M0 exit checks pass, start the prepared M1-01 account/profile foundation packet. No M9 before M8.

Credential handoff correction: initialize each first password and LOGIN with client-executed SQL from `docs/runbooks/M0-credential-handoff.md`; console Reset password failed for the passwordless preview role. Each role lives on its own branch. Do not infer successful activation from the approval or role catalog checks.

Earlier activation evidence: `docs/qa/2026-10-04-M0-preview-activation.md` recorded preview LOGIN=true and the other three LOGIN=false before client all three done. It is superseded by the checkpoint below. Operator catalog evidence does not prove direct password authentication or complete SYS-11 isolation.

Superseding activation/configuration checkpoint: `docs/qa/2026-10-04-M0-active-credentials.md` observes all four LOGIN=true after client all three done. Public preview variables are bound only to codex/m0-01-environment-contract; the client now needs to save only the preview URL in Vercel's Secret form. Database health has a lazy read-only driver, actual branch/current-role/catalog assertions, timeout and error redaction. After secret binding, verify the new deployment's revision/database_ready response; auth/email checks and recovery remain independent gates. Do not rerun completed first-password steps.
