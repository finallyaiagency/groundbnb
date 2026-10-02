# Groundbnb integration register

Checked: 2026-10-02. No Groundbnb product integration is verified live.

| Provider | Identity/source | State | Next check |
| --- | --- | --- | --- |
| GitHub | `finallyaiagency/groundbnb` | Product repository retained with frozen specification, ledger, and history. Control Center code moved to `finallyaiagency/project-control-center`. | Check CI on every M0 checkpoint. |
| Vercel | Team `finally-ais-projects`, project `groundbnb`, ID `prj_r5Vk1uNMNvS28qWX1UHo63t2S4ry` | Existing product project retained. Old Control Center preview variables removed. | Verify clean holding page on production and no active Control Center preview branch. |
| Neon | Project `groundbnb`, ID `divine-resonance-05443204` | Product production branch `br-small-meadow-b8lh69jr` has only default `neondb`, no public tables, and Auth disabled. Control Center data was confined to separate preview branch `br-plain-grass-b8xotge6`; clean that branch before M0. | Create the named `groundbnb` database and fresh isolated product branches in M0; never clone customer identities into preview. |
| Codex/Work allowance | Platform usage | Task-level credits unavailable. | Record only platform-reported measurements or labeled estimates. |
| Google Maps, Gemini | Official terms and credentials | Not configured for Groundbnb. | Verify current official API terms, permitted data uses, pricing, and preview restrictions before dependent design or live calls. |

Project Control Center provider settings and verification evidence are maintained in its separate repository. Production, preview, local, and recovery credentials must be distinct.
