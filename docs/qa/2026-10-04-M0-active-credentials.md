# M0 role activation and database readiness — 2026-10-04

Base revision: `7ac600e08f5d80e402dc21499b29b90015ee6169`. Client reported **all three done**. Earlier SQLSTATE 42704 was reported with a production-tab context; the recovery role now exists and LOGIN=true is observed on its correct branch. No replacement or broader role was created.

## Live operator observations

Password-free SELECTs as neondb_owner, database groundbnb, returned one pinned environment row per branch:

| Kind | Branch | Role | LOGIN | Metadata SELECT | Metadata UPDATE | neon_superuser membership | Console duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| local | br-rough-flower-b8lerkcf | groundbnb_local_probe | true | true | false | false | 80 ms |
| production | br-small-meadow-b8lh69jr | groundbnb_production_probe | true | true | false | false | 88 ms |
| recovery | br-round-field-b8d4v5o4 | groundbnb_recovery_reader | true | true | false | false | 97 ms |
| preview | br-bitter-hall-b8ibnrfy | groundbnb_preview_probe | true | true | false | false | 81 ms |

Query is reproduced in `docs/qa/2026-10-04-M0-preview-activation.md`. These are catalog observations, not direct password authentication. No password-bearing SQL/history or unmasked credential was accessed. Codex changed no database role, grant, or password.

The new M0_IDENTITY_QUERY also ran as operator on preview with only its pg_roles join changed to the preview role. baseline_present=true and privileges_safe=true, 104 ms. role_name correctly remained neondb_owner. This validates SQL/catalog assertions, not a login as the probe. Ignored snapshot `.tmp/evidence/m0-preview-active-catalog.png` contains no secret.

Masked connection details supplied public pooled hosts: preview `ep-red-night-b8pf2mdl-pooler.c-14.us-east-1.aws.neon.tech`, production `ep-snowy-morning-b8ax7lm3-pooler.c-14.us-east-1.aws.neon.tech`. Show password and Copy snippet were never clicked. Production public pins are identifiers, not credentials.

## Implementation and configuration

- Official npm driver @neondatabase/serverless 1.2.0, exact dependency/lockfile; lazy initialization permits credential-free builds.
- Health validates environment isolation before connecting. One HTTP read-only metadata transaction checks actual database, environment/branch, current restricted role, baseline, and catalog privileges. URL host/role/database/options are checked before transmitting credentials. Unknown results/unsafe privileges fail closed. Eight-second HTTP timeout, five-second role statement timeout, no retry.
- Health preserves revision and no-store. Missing config or failed identity/connectivity returns 503; 200/database_ready requires live database assertions. Auth/email isolation remain explicitly unverified. Raw driver errors, SQL, URLs and passwords are neither returned nor logged.
- Vercel project prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry: 16 public variables created, preview-only, exact branch codex/m0-01-environment-contract. Read-back matched every value/scope; zero Production variables, hiddenProductionEnvCount=0, no GROUND_DATABASE_URL. App login/jobs/metered dispatch are off. Email capture flag does not establish SMTP capture.
- Verified branch alias: `https://groundbnb-git-codex-m0-01-environme-7458d6-finally-ais-projects.vercel.app`. Base preview dpl_HzbELr1FTShq6CkgXJBbVLMDVHjH was Ready at 7ac600e; project SSO all_except_custom_domains is enabled. This does not prove new code deployed.
- Prepared but did not submit GROUND_DATABASE_URL as Secret in Vercel with only the M0 preview branch selected; default Production deselected, Value blank. Ignored screenshot `.tmp/evidence/m0-preview-secret-handoff.png`. Client must paste the approved preview-role URL under browser credential policy. Production/recovery credentials stay outside preview.

## Checks and limitations

Published implementation revision: `84e280515202f20afd650ac9d90e0aa4bd91c92e`. GitHub Verify run [37256943376](https://github.com/finallyaiagency/groundbnb/actions/runs/37256943376) completed successfully. Vercel preview dpl_J5keAqwVJavoyAb4sraB3GVqRBs8 is Ready at that exact revision. Authenticated GET `/api/health` returned HTTP 503, Cache-Control no-store, configuration_required, database not_checked, environment null, and auth/email isolation unverified with the exact revision. The missing Secret therefore prevents a database connection; no live probe-role authentication is claimed. Production was not deployed.

Local passes: pnpm test (16/16), pnpm typecheck, pnpm lint, pnpm build, pnpm audit --audit-level=high (no known vulnerabilities), pnpm state:check (249 IDs; frozen source hash unchanged), pnpm secrets:check (90 source files; no common credential patterns), git diff --check. Tests cover pre-transmission restrictions, wrong branch/missing/unknown evidence, redacted failures, configuration-before-network, revision/auth/email reporting, and actual-driver read-only serialization/parsing with synthetic HTTP. Simulated transport is not live integration proof.

M0/SYS-11 remain incomplete: secret binding/direct role tests, auth/email isolation, recovery-control/key placement, actual capped six-hour availability and timed quarantined restore are open. M1 not started. No paid upgrade, metered product call or subagent. Task credits/provider costs unavailable; none inferred.

Provider documentation checked 2026-10-04: [Neon driver](https://github.com/neondatabase/serverless), [driver configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md), [Vercel variables](https://vercel.com/docs/environment-variables), [sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Existing project/resources reused; no Marketplace provisioning or broader account access added.
