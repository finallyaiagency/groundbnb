# October 11 M1 baseline-14 expanded app-boundary check

## Result

The reviewed baseline-14 restricted-app checker completed successfully on both pinned synthetic branches from a working tree based on Groundbnb source revision `2cae4cf5d7a66989e90068d8ac33742e6b670897` (exit 0; 4.99 seconds): local `br-rough-flower-b8lerkcf` and preview `br-bitter-hall-b8ibnrfy`, database `groundbnb`. The working-tree checker/helper hashes are listed below; this successful run predates their checkpoint. The output was `local baseline14: PASS` and `preview baseline14: PASS`. This is an app-boundary verification only. It does not establish factor login, credentials, enrollment, MFA, or M1 completion. Migration 0015 was not applied.

The checked artifacts were:

- `scripts/verify-m1-expanded-app-boundary.mjs` — SHA-256 `B409FD10B38B91CCFED21CD786EC5B7623AB4F1583837F3A3053075BFABF4E90`
- `scripts/verify-m1-expanded-app-boundary.ps1` — SHA-256 `910996273416F2AA04D80941A0C0B780D69C89C24FEA664BCE71FDE672270716`
- `lib/factor-credential-catalog.mjs` — SHA-256 `2A24F21C852DAD4ED32388DB6D007F87AEE9A2DDF8470F04469B0411BE5E2C8F`
- `tests/expanded-app-boundary-worker.test.mjs` — SHA-256 `B438898BFD9D7A457745E03342FCE2A1021B5B83F9750A940B93A963FE9B9C35`

The check exercises the explicit baseline-14 app ACL and private-schema boundary, including the factor principal remaining NOLOGIN. It does not invoke factor functions or inspect auth-session data.

## Earlier attempts and correction

Earlier attempts are retained here for auditability. A first metadata-only catalog query failed with SQLSTATE 42809 because a sequence-privilege check could be evaluated for a non-sequence relation. CASE guards were added around relation-kind-specific privilege calls without changing the checked privilege set. The corrected read-only metadata observation then passed on both branches and captured the four 0014 enrollment CHECK definitions; this observation was not a full boundary verification.

A subsequent checker invocation failed with SQLSTATE 42601 while parsing the generated query. Offline parsing identified a missing closing parenthesis in a baseline-15 predicate. The query was corrected and parsed for baseline modes 12–15. A separate hashguard abort occurred because the reviewed worker hash had changed before invocation; that abort made no database call. The final normal baseline-14 run above used the corrected hashes.

## Offline checks

- `node --test tests/expanded-app-boundary-worker.test.mjs` — 5/5 passed.
- ESLint on the helper, worker, and test — passed.
- `npm run typecheck -- --pretty false` — passed.
- `npm run state:check` — passed (249 requirement IDs; frozen source SHA-256 `E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F`).
- `npm run secrets:check` — passed (392 source files).

No Codex usage measurement was available for this bounded check.
