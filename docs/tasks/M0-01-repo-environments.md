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

Latest handoff 2026-10-05: all four real restricted-role logins/identity/baseline/catalog assertions pass at e5abf0a. Client's three hidden prompts are complete; do not repeat them. Historical baseline fork at 06:40 UTC into separate quarantine br-cool-frost-b8sacwyc passes zero-identity/Auth/control assertions. Separate free SMTP capture accounts are prepared and encrypted locally, one synthetic SMTP submission accepted each. Next client step: run scripts/m0-smtp.ps1 and enter/save branch-specific credentials in Neon preview/local Custom SMTP, per docs/runbooks/M0-email-capture.md. Live Neon email/session isolation, remaining app bindings and recovery-key placement remain open. See docs/qa/2026-10-05-M0-role-checks-recovery.md; historical pending handoff text below is superseded.

1. CI dependency repair completed at `51aa557`; high-severity audit and Linux CI passed with the original gate retained.
2. Distinct production/preview/local managed Auth services exist with empty users. Q-004 is closed; D-006's four restricted direct logins pass. Exact-branch preview Secret/public settings and live database health are verified. Finish client SMTP credential handoff and real Neon-generated capture checks before app auth use; prove real session isolation, bind remaining destinations and place the recovery HMAC key outside restored snapshots. Keep metered dispatch off.
3. Production's live UI showed a six-hour available window, and a historical empty baseline restore passed in quarantine. Verify actual horizon under representative writes and complete deleted-account/revoked-credential/bootstrap replay at the LEG-10/LEG-12/M8 launch gate when account controls exist. Do not treat the primitive restore as a full recovery pass.
4. Once M0 exit checks pass, start the prepared M1-01 account/profile foundation packet. No M9 before M8.

Credential handoff correction: initialize each first password and LOGIN with client-executed SQL from `docs/runbooks/M0-credential-handoff.md`; console Reset password failed for the passwordless preview role. Each role lives on its own branch. Do not infer successful activation from the approval or role catalog checks.

Earlier activation evidence: `docs/qa/2026-10-04-M0-preview-activation.md` recorded preview LOGIN=true and the other three LOGIN=false before client all three done. It is superseded by the checkpoint below. Operator catalog evidence does not prove direct password authentication or complete SYS-11 isolation.

Superseding activation/configuration checkpoint: `docs/qa/2026-10-04-M0-active-credentials.md` observes all four LOGIN=true after client all three done. Public preview variables are bound only to codex/m0-01-environment-contract; the client now needs to save only the preview URL in Vercel's Secret form. Database health has a lazy read-only driver, actual branch/current-role/catalog assertions, timeout and error redaction. After secret binding, verify the new deployment's revision/database_ready response; auth/email checks and recovery remain independent gates. Do not rerun completed first-password steps.
