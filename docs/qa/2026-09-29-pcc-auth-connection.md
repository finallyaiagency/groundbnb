# PCC preview Auth connection — 2026-09-29

Scope: PCC-02A, isolated Neon `preview` branch `br-plain-grass-b8xotge6`, database `groundbnb`, and Vercel branch `preview/control-center`. This record belongs to the Git checkpoint containing it. No Groundbnb product requirement is promoted in `docs/ledger.csv`.

The client designated one test-only preview inbox and a different future live sponsor inbox in chat. Only the preview inbox was entered in the Neon Auth Users console, with a synthetic display name. The console showed one user, role `user`, email verification `false`, and no ban. The console creation form did not request a password. Neither inbox nor the Auth subject is recorded in Git. The future sponsor was not enrolled in preview. No sign-in, email delivery, or user session has been demonstrated.

The app now has a server-only Neon Auth proxy and session adapter. Configuration rejects production, non-Control Center preview branches, missing/short cookie secrets, unexpected Auth hosts, and unexpected database paths. The proxy returns 404 for app-proxied sign-up and outside the named preview deployment. This is an app-route control, not a claim that Neon's public Auth endpoint prevents direct signup. The separate server-side sponsor allowlist remains empty, and there is no client write route.

The three Auth settings (provider URL, expected host, generated cookie secret) were added through Vercel CLI to **Preview (`preview/control-center`) only**. `vercel env ls preview` displayed each at that exact Git branch scope with encrypted values. The secret was generated locally and not committed. No production or other preview environment variable was added.

Local checks on the checkpoint contents: `pnpm typecheck`, `pnpm lint`, `pnpm test` (7/7), `pnpm state:check` (249 IDs), and `pnpm build` passed with the policy-controlled dependency install. Exact live sign-in, session verification, trusted domain, email configuration, and hosted endpoint test remain open until recorded separately. No database migration was run in this step.
