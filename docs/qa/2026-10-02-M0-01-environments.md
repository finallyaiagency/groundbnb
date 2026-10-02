# M0-01 environment contract evidence — 2026-10-02

Base revision: `885f7d2928bcb65885886f699350bba1a5d8901c` on `main`, clean at start. Code checkpoint: `11a12997862737fd86c24cc7de6a496109b6b6b9` on `codex/m0-01-environment-contract` ([draft PR #1](https://github.com/finallyaiagency/groundbnb/pull/1)). No Neon data or product credentials were changed by this task.

## Implemented locally

- `lib/environment.mjs` rejects ambiguous/mismatched deployment, database branch/host, auth issuer/cookie, origin, email, job, seed, and recovery settings. Preview dispatch defaults off; a bounded policy rejects expired or over-budget activation. No actual dispatcher exists, so a live allowance cannot be spent through this code.
- `/api/health` reports only configuration validity, environment, and revision, returning 503 for invalid configuration. It does not assert database connectivity.
- Versioned baseline SQL and a separate restricted recovery-control schema are checked in. Neither migration was applied to Neon. The rollback SQL is for disposable synthetic branches only.
- `lib/provenance.mjs` preserves origin on positioning changes and omits expired/unknown-rights provider values. It is a pure foundation, not yet integrated with storage/export surfaces.
- Documentation check now rejects stale M0 source-row references and future-tier v1 dependencies. CI adds a basic source credential scan and high-severity dependency audit gate.

## Exact local checks

| Command | Result |
| --- | --- |
| `pnpm state:check` | Passed: 249 IDs, source SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`. |
| `pnpm test` | Passed: 8 tests; environment isolation, bounded activation, recovery quarantine, provenance, and doc-gate mutation. |
| `pnpm secrets:check` | Passed: common credential patterns and tracked environment files absent from 65 scanned source files. This is a basic scanner, not a comprehensive secret audit. |
| `pnpm lint`; `pnpm typecheck`; `pnpm build` | Passed after installing existing locked dependencies. The initial typecheck encountered stale `.next` files from the former Control Center; clearing ignored build output and rebuilding resolved it. |
| `pnpm audit --audit-level high` | Passed: no known vulnerabilities reported. |
| `pnpm start -p 3100` then `GET /api/health` without environment values | Passed fail-closed smoke: HTTP 503, `configuration_required`, revision `unknown`. |
| Neon migration/rollback, recovery drill, synthetic identity/session inspection | Not run: no Neon API/CLI credential or reachable console in this execution context. |
| [GitHub CI run 37057007239](https://github.com/finallyaiagency/groundbnb/actions/runs/37057007239) | Passed for code checkpoint `11a1299`. |
| Vercel preview deployment `dpl_DYQDWXhfjxm98rYTMWvrfREK85px` | Ready for `11a1299`. Authenticated `/api/health` returned HTTP 503, `configuration_required`, and full revision `11a12997862737fd86c24cc7de6a496109b6b6b9`. Unauthenticated request received a Vercel login HTML page; project SSO protection is `all_except_custom_domains`. |

The Vercel project has no environment variables. The preview has no configured database, auth, mail, or paid provider access, and its route fails closed. The existing production deployment `dpl_GfHTbzHUXydxFjDLsUWAdkcdXEbY` remains at `885f7d2` on `main`. The Vercel project-read connector has an argument-schema mismatch, but the deployment listing and authenticated fetch worked. The in-app browser bridge did not initialize. These observations verify deployment protection and revision reporting, not seeded preview identity/data isolation.

## Defects and open work

1. Provision empty/schema-only preview and local Neon branches, separate auth endpoints and recovery controls, with console evidence of zero production identities/sessions. Never use a normal production clone.
2. Bind separate Vercel variables/callback origins, protect preview access, deploy a branch, and verify `/api/health` revision, deep links, email capture, and dispatch denial.
3. Apply the baseline migration to empty product branches, test production seed refusal and preview/local seed acceptance, then perform a synthetic rollback and quarantined restore drill. Record actual PITR retention, last recoverable time, and recovery duration.
4. Complete API-specific field rights, retention, AI-context, backup, and export policy review before provider data persistence.
5. Repeat CI and health checks after final documentation checkpoint; verify database branch identity and rollback on a protected synthetic preview.

Task-level Codex credits and provider spend were not available/measurable. No provider calls were made, so measured provider spend for this task is zero.
