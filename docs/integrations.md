# Groundbnb integration register

Checked: 2026-10-04. No Groundbnb product integration is verified live.

| Provider | Identity/source | State | Next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Product repository retained with frozen specification, ledger, and history. Control Center code moved to `finallyaiagency/project-control-center`. | Check CI on every M0 checkpoint. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | Production remains on the clean holding page at `885f7d2`; last checked draft-PR preview for `51aa557` is Ready, protected, and returns revisioned HTTP 503 without configuration. GitHub CI passed every step for that revision. Old Control Center variables and deployments were removed. | Provision branch-scoped product variables and prove preview connectivity/identity before live use. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204` | Production, schema-only template, preview, local, and recovery-control branches exist. Baseline migration and seed refusal verified; disposable down migration passed 2026-10-03. Q-004/D-005 grants committed on preview/local; both Auth services initialized with zero users/sessions/accounts and issuers distinct from production. Free history UI observed six hours; old nonexpiring manual snapshot discovered, contents unknown. | Q-005 limited role approval and client password handoff; finish email/session isolation, recovery access, actual capped horizon and quarantined restore drill. Never clone customer identities or unknown snapshots into preview. |
| Codex/Work allowance | Platform usage | Task-level credits unavailable. | Record only platform-reported measurements or labeled estimates. |
| Google Maps, Gemini | Official terms and credentials | Not configured for Groundbnb. Dated map-policy review below; no provider payload is persisted or exported yet. | Complete field-by-field API policy, Gemini-context, pricing, and credential review before dependent design or live calls. |

Project Control Center provider settings and verification evidence are maintained in its separate repository. Production, preview, local, and recovery credentials must be distinct.

## Neon Auth/access check — 2026-10-04

The [official role documentation](https://github.com/neondatabase/website/blob/main/content/docs/manage/roles.md) identifies `neon_service` as an internal provider-managed role; do not use its credentials or change its attributes. Live metadata showed LOGIN=true, superuser=false. Approved database CREATE grants on the exact synthetic preview/local branches enabled Auth initialization. Provider provisioning does not prove app session isolation.

Console/API-created roles receive broad neon_superuser membership. D-006/Q-005 approved SQL-created NOLOGIN roles with explicit metadata-only read grants and a separate recovery reader. All four are created; the catalog assertion script passed on each branch, including auth-table and write restrictions. Operator SET ROLE was denied, so direct credential checks still require client password/login activation. New password entry requires client handoff under browser confirmation policy; exact steps are in `docs/runbooks/M0-credential-handoff.md`. No role credential has been bound to an app.

First-password correction, 2026-10-04: the client reported console Reset password rejects the passwordless preview role. Use client-executed SQL to initialize the first password and LOGIN, as documented by Neon/PostgreSQL; the handoff guide is corrected. Initial-password success is still unverified. Roles are branch-scoped; preview's two visible roles do not mean the other three branch roles are missing.

Auth email settings offer Shared delivery or Custom SMTP. No capture configuration exists yet; public email signup is off during setup. The old nonexpiring snapshot observed in Restore is unreviewed and excluded from preview/local cloning. Exact observations and remaining gaps: `docs/qa/2026-10-04-M0-auth-grant.md`.

## Neon Free retention check — 2026-10-03

The project console showed Free plan and a 6-hour history setting. Neon's [Free-plan announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project), published 2026-10-02, also states a 6-hour instant-restore window. Current [official plan documentation](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md) caps Free change history at 1 GB. The available horizon can therefore be shorter; record the actual oldest recoverable time under representative write volume rather than assuming six hours from the setting.

D-004 and approved A-001 now set the effective Section 11.16/LEG-10 launch minimum to six hours, superseding D-002's interim interpretation. The source remains frozen. Errors discovered later may be unrecoverable. The four-hour recovery-time target, truthful privacy disclosure, and non-production LEG-12 replay drill still apply; none is verified by the plan choice. No paid upgrade or independent backup was configured.

## M0 provider-data policy review — 2026-10-02

| Source | Observed limit | M0 decision |
| --- | --- | --- |
| [Google Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) | Routes API latitude/longitude temporary caching is limited to 30 consecutive days; use with a non-Google map is prohibited. A Google ID may be cached only for APIs that return and allow it. | Do not persist provider route coordinates/geometry, claim export rights, or feed such content to Gemini from this baseline. Author-created coordinates remain conceptually separate. |
| [Routes policies and attribution](https://developers.google.com/maps/documentation/routes/policies) | Google Maps attribution is required when displaying Maps content and must stay visible. The page points to service-specific terms for use restrictions. | No map rendering is enabled in M0. A later API-specific, field-by-field review must decide retention, backup, AI context, each export format, and expiry cleanup before storage design. Unknown permission means deny. |
| [Neon branchable auth](https://neon.com/blog/neon-auth-branchable-identity-in-your-database) and [branching primer](https://neon.com/docs/get-started-with-neon/workflow-primer) | A normal branch copies application and `neon_auth` data, including users/sessions; schema-only branching is described as an option. | Never use a normal production clone for preview/local. Provision from empty/schema-only or a verified synthetic template and inspect auth rows before access. |
| [Vercel environment variables](https://vercel.com/docs/environment-variables) and [deployment protection](https://vercel.com/docs/deployment-protection) | Preview variables apply to non-production branches; Vercel Authentication can restrict preview deployments. | Pin separate environment values, enable owner/developer preview protection, and verify effective branch-scoped values in the console. |

These are implementation hypotheses until the exact billing region, APIs, plan, and credentials are confirmed. No live integration, pricing, export permission, or branch setting is asserted by this review.
