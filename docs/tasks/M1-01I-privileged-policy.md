# M1-01I — Bootstrap and privileged-session policy preparation

Status: offline policy foundation, not verified MFA or live administrator access.

Read STATE, M1-01 foundation, named views 00/07/12/15 and frozen ACC-08/ACC-09, ADM-01/ADM-06/ADM-07 and Sections 11.15/shared administrative lifecycle. The current managed-auth SDK supplies no factor-freshness proof used by this application. Email verification or Google sign-in cannot substitute for a second factor.

Prepare pure fail-closed bootstrap and privileged-session policy contracts independently of live factor integration. Bootstrap uses exact trusted verified seed email and immutable issuer/subject, only the intended production context, first-activation control and revocation history. Typed profile email, another issuer, unverified claims, re-deployment and prior revocation cannot grant authority. A candidate is not a durable role grant.

Privileged reads/actions require server-verified factor state, at most 12 hours since challenge and strictly less than 30 minutes of inactivity. Sensitive actions additionally require step-up within five minutes. Reset/revocation/suspension invalidates privileged access immediately. Unknown timestamps/identity/factor state denies. No protected payload or mutation is permitted after a failed decision. A pure fake verifier fixture proves policy only; no factor codes/secrets or production account data are needed here.

Real MFA must use a maintained provider-supported factor or maintained TOTP integration, encrypted server-side secrets, external key separation and hashed one-use recovery codes, rate limits and durable challenge/reset audits. Do not implement a cryptographic algorithm or claim the policy harness verifies an actual factor. Production enrollment, bootstrap and owner transfer remain separate live gates. No live grant, factor reset/enrollment, auth change or provider call in this packet.
