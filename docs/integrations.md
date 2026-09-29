# Integration register

Checked: 2026-09-29. No provider integration is verified live unless marked so below.

| Provider | Identity/source | State | Boundary / next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Initial commits `e7d72d9` and `30657f7` pushed to `main`; `preview/control-center` points to `30657f7` | CI workflow added; verify hosted run status before claiming CI pass. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204`; requested database `groundbnb` | Console identity verified. `production` (`br-small-meadow-b8lh69jr`) has only default `neondb` and 0 public tables. Schema-only `preview` branch (`br-plain-grass-b8xotge6`) created with no auto-delete; named `groundbnb` database verified there. | Preview contains no copied data. No schema, connection secret, or auth integration is configured yet; production `groundbnb` database remains absent. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | GitHub connected; Next.js preset saved. Preview from `preview/control-center` at `https://groundbnb-qon2vkcjj-finally-ais-projects.vercel.app` is Ready at `30657f7` and browser checked. Two earlier production-target builds failed during setup; no product release claimed. | Keep production/preview/local variables isolated; add live integrations only after branch and rights checks. |
| Codex/Work allowance | Platform usage | Unknown | Record only platform-reported measurements or labeled estimates. No fixed plan allowance assumed. |
| Google Maps, Gemini, Neon Auth | Official terms and credentials | Not configured | Check current official API terms, permitted data uses, pricing, and preview restrictions before design/live calls. |
