# M1-01L — Maintained TOTP verifier adapter

Read STATE, M1-01I, views 00/07/12/15 and frozen privileged lifecycle in Section 11.22. Keep managed Neon identity; its installed SDK supplies no factor freshness attestation. Prepare a server-only maintained otplib adapter with pinned version and Node crypto plugin, not a new OTP algorithm or provider migration.

Use six-digit SHA-1 TOTP, 30-second periods, at most 30-second drift and explicit trusted server time. Validate input format and bounded Base32 secret before the library call. Expose only validity and matched time step; never echo a secret, code, URI, recovery code or underlying error. Durable challenge acceptance must atomically consume a newer matched time step, enforce current security epoch/session/role and rate limits, and audit outcome before creating a factor attestation. The adapter alone cannot grant privileged access or claim replay protection.

No live factor enrollment/reset, provider call, key/secret generation, authentication activation or database write. Test real maintained-library behavior using public synthetic RFC fixtures and local time only; incorrect/stale/replayed time-step candidates and malformed input fail without disclosure. A standalone helper is not an enrolled-factor or live MFA acceptance pass.

Later storage encrypts secrets with an external environment-specific key, hashes one-use recovery codes, and records enrollment/challenge/reset/revocation atomically. Real bootstrap, sensitive routes, owner transfer and break-glass lifecycle remain separate acceptance gates. No second-factor claim can be supplied through profile/import/client metadata.
