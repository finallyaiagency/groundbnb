# M1 Q-011 completion and browser continuation preparation

Q-011 is closed under D-015. The approved exact membership-reader grant committed once on each pinned synthetic database. Direct restricted application checks pass on both; their initial failures and narrow repairs remain recorded in `2026-10-09-M1-membership-app-boundary.md`.

The internal M1-01Y service was independently reviewed. Session expiry is checked after both asynchronous boundaries; only trusted issuer/subject reach the owner-scoped reader. It has no route or consumer. The shared managed-session resolver now admits native Node `process.env` while rejecting other exotic configuration objects, and rereads its clock after provider completion. Both resolvers reject expiry during that wait and invalid clocks without leaking diagnostics.

M1-01Z prepares a new GUID-scoped, fixed 30-minute local window for the existing synthetic fixture, full-v1 profile mode and response-loss proxy. Historical attempts remain intact. Capture writes encrypted output directly into its run directory. The synthetic send limit is one per app process; restarting after admission is prohibited. The proxy verifies exact paths and metadata, but does not independently validate the DPAPI hash. No browser activation or OTP occurred before this checkpoint.

## Exact local checks

- `node --test`: 384/384 pass after agents froze.
- Browser auth/transport/window/proxy focus: 28/28 pass; final proxy cleanup safety change rerun 7/7 by its author.
- Session plus membership service: 20/20 pass; independent service review found no defects.
- `pnpm lint`: pass.
- `pnpm build`: pass, including TypeScript.
- `node scripts/check-project-state.mjs`: 249 IDs, unchanged frozen SHA-256.
- `node scripts/check-secrets.mjs`: no common credential patterns in 337 source files before this report was added; final scan follows.
- `git diff --check`: pass. PowerShell helper AST parse passed without execution.

These deterministic checks do not prove actual browser save replay, upstream logout, full profile acceptance, preview/two-account isolation, enrolled MFA, membership writers/audits, or financial concurrency/service integration. Full M1 remains in progress. Requirement statuses are unchanged. Credit, token and charge usage is unavailable; no estimate is supplied.
