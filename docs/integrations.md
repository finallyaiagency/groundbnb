# Groundbnb integration register

Checked: 2026-10-02. No Groundbnb product integration is verified live.

| Provider | Identity/source | State | Next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Product repository retained with frozen specification, ledger, and history. Control Center code moved to `finallyaiagency/project-control-center`. | Check CI on every M0 checkpoint. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | Clean product holding page deployed from `91f24f3`. The old preview Git branch, four Control Center variables, and 25 old deployments were removed; only the clean production deployment remains. | M0 defines isolated product preview and release controls. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204` | Production branch `br-small-meadow-b8lh69jr` has a newly created empty `groundbnb` database (0 public tables), plus default `neondb`; Auth disabled. Old Control Center data was confined to preview branch `br-plain-grass-b8xotge6`, pending deletion. | Remove the old preview branch, then create fresh isolated product branches in M0; never clone customer identities into preview. |
| Codex/Work allowance | Platform usage | Task-level credits unavailable. | Record only platform-reported measurements or labeled estimates. |
| Google Maps, Gemini | Official terms and credentials | Not configured for Groundbnb. | Verify current official API terms, permitted data uses, pricing, and preview restrictions before dependent design or live calls. |

Project Control Center provider settings and verification evidence are maintained in its separate repository. Production, preview, local, and recovery credentials must be distinct.
