# M1 bootstrap and privileged policy — offline evidence

Base revision 42fe26c; bootstrap tests pass 8/8 and privileged decision tests 7/7. Trusted verified production seed identity must bind to an existing active member account and immutable issuer/subject. Exact seed roles, prior bindings, replacement-subject refusal and revocation history prevent deployment replay. Duplicate subject/account/seed-role histories fail closed. Durable activation must serialize sign-ins and enforce the current single-owner invariant; candidates create no account or role.

Privileged decisions require active admin/owner, matching account/issuer/subject/session, enrolled verified factor, current security epoch and explicit non-revoked/non-suspended/non-rate-limited state. Deny at 30 minutes inactivity, beyond 12 hours since challenge or beyond five minutes for sensitive actions. Malformed/unknown/future chronology denies. Email/Google identity alone grants no factor claim. Pure trusted attestation fixtures prove policy only.

No production identity read, enrollment/reset, durable role grant, owner transfer or route activation occurred. ACC-08/ACC-09/ADM-01/ADM-06/ADM-07 remain open. Luna agents hit their usage limit in follow-on tasks; parent completed records-request tests and the verifier directly. No substitute agent model or credit purchase.
