# Groundbnb integration register

Checked: 2026-10-02. No Groundbnb product integration is verified live.

| Provider | Identity/source | State | Next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Product repository retained with frozen specification, ledger, and history. Control Center code moved to `finallyaiagency/project-control-center`. | Check CI on every M0 checkpoint. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | Production remains on the clean holding page at `885f7d2`; draft-PR preview for `290b792` is Ready, protected, and returns revisioned HTTP 503 without configuration. Old Control Center variables and deployments were removed. | Provision branch-scoped product variables and prove preview connectivity/identity before live use. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204` | Production, schema-only template, preview, local, and recovery-control branches exist; IDs and SQL checks are in `docs/qa/2026-10-02-M0-01-environments.md`. Production baseline migration and seed refusal verified. Auth disabled; Free plan history retention 6 hours. Old Control Center preview branch was removed. | Isolate auth/credentials and recovery access; resolve seven-day retention, then drill restore. Never clone customer identities into preview. |
| Codex/Work allowance | Platform usage | Task-level credits unavailable. | Record only platform-reported measurements or labeled estimates. |
| Google Maps, Gemini | Official terms and credentials | Not configured for Groundbnb. Dated map-policy review below; no provider payload is persisted or exported yet. | Complete field-by-field API policy, Gemini-context, pricing, and credential review before dependent design or live calls. |

Project Control Center provider settings and verification evidence are maintained in its separate repository. Production, preview, local, and recovery credentials must be distinct.

## M0 provider-data policy review — 2026-10-02

| Source | Observed limit | M0 decision |
| --- | --- | --- |
| [Google Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) | Routes API latitude/longitude temporary caching is limited to 30 consecutive days; use with a non-Google map is prohibited. A Google ID may be cached only for APIs that return and allow it. | Do not persist provider route coordinates/geometry, claim export rights, or feed such content to Gemini from this baseline. Author-created coordinates remain conceptually separate. |
| [Routes policies and attribution](https://developers.google.com/maps/documentation/routes/policies) | Google Maps attribution is required when displaying Maps content and must stay visible. The page points to service-specific terms for use restrictions. | No map rendering is enabled in M0. A later API-specific, field-by-field review must decide retention, backup, AI context, each export format, and expiry cleanup before storage design. Unknown permission means deny. |
| [Neon branchable auth](https://neon.com/blog/neon-auth-branchable-identity-in-your-database) and [branching primer](https://neon.com/docs/get-started-with-neon/workflow-primer) | A normal branch copies application and `neon_auth` data, including users/sessions; schema-only branching is described as an option. | Never use a normal production clone for preview/local. Provision from empty/schema-only or a verified synthetic template and inspect auth rows before access. |
| [Vercel environment variables](https://vercel.com/docs/environment-variables) and [deployment protection](https://vercel.com/docs/deployment-protection) | Preview variables apply to non-production branches; Vercel Authentication can restrict preview deployments. | Pin separate environment values, enable owner/developer preview protection, and verify effective branch-scoped values in the console. |

These are implementation hypotheses until the exact billing region, APIs, plan, and credentials are confirmed. No live integration, pricing, export permission, or branch setting is asserted by this review.
