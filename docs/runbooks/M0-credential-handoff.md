# M0 credential setup — client handoff

The four approved database roles exist, but cannot log in. Browser confirmation policy requires **you** to create/reset their passwords and complete activation. Approval alone cannot replace this manual action.

For each row below:

1. Open its Neon Roles page, find the exact role, and use its **Role actions → Reset password**. Do not reset `neondb_owner`.
2. Complete the password reset yourself and save the distinct generated password in your password manager. Do not paste passwords or connection strings into chat, screenshots, Git, or task documents.
3. Open SQL Editor on that same branch, choose database `groundbnb`, and run the activation statement in the last column. It contains no secret. This enables only the limited role whose password you just set.

| Branch and Roles page | Exact role | Activation statement |
| --- | --- | --- |
| [groundbnb-preview](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-bitter-hall-b8ibnrfy/roles) | `groundbnb_preview_probe` | `ALTER ROLE groundbnb_preview_probe LOGIN;` |
| [groundbnb-local](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-rough-flower-b8lerkcf/roles) | `groundbnb_local_probe` | `ALTER ROLE groundbnb_local_probe LOGIN;` |
| [production](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-small-meadow-b8lh69jr/roles) | `groundbnb_production_probe` | `ALTER ROLE groundbnb_production_probe LOGIN;` |
| [groundbnb-recovery-controls](https://console.neon.tech/app/projects/divine-resonance-05443204/branches/br-round-field-b8d4v5o4/roles) | `groundbnb_recovery_reader` | `ALTER ROLE groundbnb_recovery_reader LOGIN;` |

Tell Codex **passwords set and roles activated**, naming any incomplete row. No secret is needed in your reply. This completes credential activation only; it does not deploy or copy credentials. Codex will then prepare the destination-specific binding and direct credential checks. The recovery credential stays outside app previews and production restore snapshots.

If the console cannot reset a NOLOGIN role, stop and report the visible error without including secrets. Do not create a replacement role through **Add role**; Console-created roles receive broad admin membership and would invalidate the approved access scope.
