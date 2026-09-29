# Integration register

Checked: 2026-09-29. No provider integration is verified live unless marked so below.

| Provider | Identity/source | State | Boundary / next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Published checkpoint `482e411` on `main` and `preview/control-center`; hosted Verify passed on both branches. | Continue checking CI on every checkpoint. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204`; requested database `groundbnb` | `production` (`br-small-meadow-b8lh69jr`) has only default `neondb` and 0 public tables. Schema-only `preview` branch (`br-plain-grass-b8xotge6`) has database `groundbnb`. A manual snapshot preceded PCC migration `0001`, which ran successfully; rollback smoke left zero fixture rows. | Preview contains no copied production data. No Auth, runtime role, or app connection secret is configured; production `groundbnb` database remains absent. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | GitHub connected; Next.js preset saved. Preview from `preview/control-center` at `https://groundbnb-8ep2908ee-finally-ais-projects.vercel.app` is Ready at `482e411` and browser checked. Two earlier production-target builds failed during setup; no Groundbnb product release claimed. | Keep production/preview/local variables isolated; add live integrations only after branch and rights checks. |
| Codex/Work allowance | Platform usage | Unknown | Record only platform-reported measurements or labeled estimates. No fixed plan allowance assumed. |
| Google Maps, Gemini, Neon Auth | Official terms and credentials | Not configured | Check current official API terms, permitted data uses, pricing, and preview restrictions before design/live calls. |
