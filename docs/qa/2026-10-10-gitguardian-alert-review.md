# GitGuardian alert review — October 10, 2026

## Result

All ten Groundbnb alerts in the supplied inventory were reviewed against their exact reported source locations and classified in GitGuardian as ignored. Six were marked **Test credential** and four **Not a secret (false positive)**. No alert was treated as evidence that a live credential was present. No credential was rotated, no Git history was rewritten, and no detection rule was changed.

## Occurrence review

| Incident | Reported source | Classification | Sanitized context |
| --- | --- | --- | --- |
| `38064253` | `tests/profile-records-request.test.mjs`, `8792ccd`, lines 9–10 | Test credential | Explicit test-only database fixture. |
| `38064254` | `tests/profile-persistence.test.mjs`, `4f7a141`, lines 8–9 and 49 | Test credential | Test fixture; repeated environment-field use is in test code. |
| `38064255` | `.env.example`, `11a1299` and `84e2805`, line 3 | Not a secret | Example `GROUND_DATABASE_URL` uses a labeled placeholder; not a provisioned connection. |
| `38064256` | `tests/profile-operation-request.test.mjs`, `6b24f81`, lines 7–8 | Test credential | Explicit test-only database fixture. |
| `38064257` | `tests/factor-verifier.test.mjs`, `8792ccd`, line 6 | Test credential | Public RFC 6238 TOTP test vector. |
| `38064258` | `docs/qa/2026-10-07-M1-01D-credential-bindings.json`, `2585b8b`, line 4 | Not a secret | The flagged value is the deterministic working-tree hash; it equals the reviewed source hash for `scripts/verify-m1-profile-credential.mjs`. |
| `38064259` | `tests/browser-auth.test.mjs`, `3516804`, line 27 | Not a secret | Browser-auth run-ID template with a generated counter, not an authentication credential. |
| `38064260` | `tests/browser-auth-transport.test.mjs`, `80be863`, line 18 | Test credential | Pinned database connection appears as a test fixture. A later source revision split the fixture string; that edit was not treated as remediation. |
| `38064261` | `tests/membership-service.test.mjs`, `a86bc61`, lines 14–15 | Test credential | Synthetic unit-test identity and password fixture. |
| `38064262` | `scripts/verify-m1-expanded-app-boundary.mjs`, `a8c2a7d`, lines 20, 23–24 | Not a secret | Numeric length bound and variables sourced from the pinned test-role configuration; no embedded credential literal. |

The dashboard showed all ten incidents in the ignored state after review. Incident `38064258` was individually confirmed as **Not a secret (false positive)**; the other nine were classified according to the sanitized source contexts above. The dashboard inventory and dispositions were recorded in the outside-repository triage note at `C:\Users\17044\Documents\Codex\Groundbnb-security-triage-2026-10-09.md`; the aggregate dashboard capture is `C:\Users\17044\Documents\Codex\groundbnb-gitguardian-all-ten-classified.png`.

## Limits

This review is limited to the ten supplied Groundbnb alerts and their reported source occurrences. It does not assert that no credentials exist elsewhere, and it does not resolve alerts in other repositories. No live credential validation, provider check, or database connection was performed for this review. The reported current-app-password comparison covered the previously documented 151-file snapshot only; it is not a repository-wide or all-history scan.
