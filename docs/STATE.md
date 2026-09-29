# Groundbnb execution state

Updated: 2026-09-29

## Authority and repository

- Frozen product authority: `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md`; SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`.
- Control Center authority: `docs/source/Agency_Project_Control_Center_Spec_v1.1.md`.
- GitHub: `finallyaiagency/groundbnb`, default branch `main`; last verified code checkpoint `4966335` was published on `main` and `preview/control-center`.
- Derived views and 249-row ledger generated mechanically from the frozen source. All requirement statuses initially Not started.

## Current milestone

Project Control Center read-only foundation deployed and browser checked. PCC-02 event-store foundation is published at `4966335`; durable client workflows remain. Groundbnb M0 follows the Control Center gate. M0 exit gate is not met. No Groundbnb product release is claimed.

## Environment identity

Client confirmed human project name **Groundbnb** and database name **groundbnb**. Console shows the `groundbnb` project. Its `production` branch contains only default `neondb` with 0 public tables. A schema-only `preview` branch (`br-plain-grass-b8xotge6`) and named `groundbnb` database exist, with no copied data and no auto-delete. A pre-migration snapshot was saved. The preview `groundbnb` database has PCC event-store migration `0001`. After specific client approval, `neon_service` received `CREATE` on the preview `groundbnb` database and Neon Auth was enabled there; `neon_auth` contains nine tables. No runtime role or app connection secret is configured. Production Auth still shows disabled.

## Verification and defects

- Source hash and requirement extraction: 249 unique requirement IDs; no duplicates.
- Local source, unit, static, and build checks passed. GitHub Verify runs passed on `main` and `preview/control-center` at `38a31c9` (runs `36531719539` and `36531738218`). The latest Vercel Next.js preview is Ready at `https://groundbnb-iimjro6wu-finally-ais-projects.vercel.app` for `38a31c9`; its overview and QA page loaded with no browser console errors.
- Browser checked overview, search submission, no console errors, and responsive geometry at 390, 768, and 1440 pixels. Exact evidence: `docs/qa/2026-09-29-control-center.md`.
- Earlier Vercel deployment attempts failed during initial package-policy and framework setup; both were corrected. A full accessibility audit remains unverified.
- No Groundbnb product requirement was marked Verified by these Control Center checks.
- PCC event-store migration and rollback smoke check passed on isolated Neon preview; the synthetic fixture left zero rows. Checkpoint `482e411` passed hosted CI on both branches and its Vercel preview was Ready and browser checked. See `docs/qa/2026-09-29-pcc-store.md`.
- An initial Neon Auth activation failed with a database permission error (QA-011). The client then approved the exact preview-only grant. Neon reported the grant succeeded, a SQL privilege check returned true, Auth activated, and a SQL query found nine `neon_auth` tables on `groundbnb` (QA-012). Production Auth remains disabled. See `docs/qa/2026-09-29-pcc-auth.md`.

## Blockers and decisions

- Neon Auth is active only on isolated preview. Its defaults currently show open email signup, email verification off, Google shared-key OAuth, shared email sender, and localhost allowed. No auth connection is published in the app; no sponsor subject, runtime role, or live submission route is configured. Require synthetic preview identities and a server-side sponsor allowlist before opening any client workflow. Production still has no `groundbnb` database or Auth.
- The Control Center's Q&A, decision, and change-request screens are read-only projections. PCC-02 must add authenticated, durable submissions and audit history before those workflows can be accepted.
- Client collaboration persistence and access control need a verified server-side store before accepting live client submissions.
- See `docs/OPEN-DECISIONS.md` and `docs/integrations.md`.

## Next dependency-ordered tasks

1. PCC-02A: establish the isolated server-side store, client identity, and write authorization contract for Control Center submissions.
2. PCC-02B: implement durable Q&A and append-only decision workflows against that contract.
3. PCC-02C: implement change-request submission, triage, and impact history; then continue Groundbnb M0.

## Usage

No platform-reported task-level credit measurement is available yet; see `implementation-usage.csv`. Do not forecast a completion date from missing data.
