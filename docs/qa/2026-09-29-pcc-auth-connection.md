# PCC preview Auth connection — 2026-09-29

Scope: PCC-02A, isolated Neon `preview` branch `br-plain-grass-b8xotge6`, database `groundbnb`, and Vercel branch `preview/control-center`. This record belongs to the Git checkpoint containing it. No Groundbnb product requirement is promoted in `docs/ledger.csv`.

The client designated one test-only preview inbox and a different future live sponsor inbox in chat. Only the preview inbox was entered in the Neon Auth Users console, with a synthetic display name. The console showed one user, role `user`, email verification `false`, and no ban. The console creation form did not request a password. Neither inbox nor the Auth subject is recorded in Git. The future sponsor was not enrolled in preview. No sign-in, email delivery, or user session has been demonstrated.

The app now has a server-only Neon Auth proxy and session adapter. Configuration rejects production, non-Control Center preview branches, missing/short cookie secrets, unexpected Auth hosts, and unexpected database paths. The proxy returns 404 for app-proxied sign-up and outside the named preview deployment. This is an app-route control, not a claim that Neon's public Auth endpoint prevents direct signup. The separate server-side sponsor allowlist remains empty, and there is no client write route.

The three Auth settings (provider URL, expected host, generated cookie secret) were added through Vercel CLI to **Preview (`preview/control-center`) only**. `vercel env ls preview` displayed each at that exact Git branch scope with encrypted values. The secret was generated locally and not committed. No production or other preview environment variable was added.

Local checks on the checkpoint contents: `pnpm typecheck`, `pnpm lint`, `pnpm test` (7/7), `pnpm state:check` (249 IDs), and `pnpm build` passed with the policy-controlled dependency install. Exact live sign-in, session verification, trusted domain, and email configuration remain open. No database migration was run in this step.

## Hosted verification of `131c9cc`

- GitHub Verify [run `36567662429`](https://github.com/finallyaiagency/groundbnb/actions/runs/36567662429) passed on `preview/control-center`, including frozen install, source-state check, tests, typecheck, lint, and build.
- Vercel preview deployment `dpl_EFH2eHe5BdYsZxMp9dV5sukg1dN8` for that exact revision reached Ready at `https://groundbnb-6akeizkic-finally-ais-projects.vercel.app`.
- An authenticated Vercel CLI request to `/api/auth/get-session` on that deployment returned `null` for an anonymous requester. This confirms the hosted proxy responds and does not fabricate a session. It does not prove login, verified identity, or sponsor authorization.

## Preview sign-in screen, pending hosted test

An explicit `/preview-sign-in` route was added after `852d833`. It returns 404 outside the named Control Center preview deployment. On preview it offers Google sign-in through the first-party Neon Auth proxy and reports only whether the provider email is verified. No identifier or credential is rendered or committed. The screen has no submission controls or write permission. Local typecheck and build passed; the route has not yet been deployed or exercised with a real user session. Neon currently has no trusted redirect domain; adding the exact stable preview alias requires client approval under the computer-use policy. Google account selection and credential entry must be performed by the inbox owner.
