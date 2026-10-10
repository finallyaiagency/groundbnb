# M0 production session pass and exit audit

Closure: `docs/qa/2026-10-06-M0-complete.md` supersedes this audit's pending Q-006/M0 text after approved provider removals and read-backs. Earlier observations/defects remain evidence history.

Audit based on `7521ac643c66f5310cdd831286b3c65fcc3bd089`. Frozen source and 249 IDs unchanged. M0 remains open; M1 has not started. Earlier missing-email/session observations are superseded by the actual result below, not erased.

## Production session — PASS

Client private helper result at **2026-10-06T13:56:56.459Z** (09:56 AM EDT), ignored `.tmp/evidence/m0-production-session.json`, revision **ac7f91f53fbda62d332389501bbcc0908b454f17**:

| Check | Result |
| --- | --- |
| Ordinary production session works on its own issuer | true |
| Preview rejects that actual production session cookie | true |
| Local rejects that actual production session cookie | true |
| New production session signed out and fresh get-session is unauthenticated | true |
| Overall result | true |
| Per-handoff real-email budget | 1 |

The client alone requested/entered the new code and ran the check. Codex read only whitelisted result metadata, never the populated page, identity, code, cookie, profile or provider body. The worker SHA-256 is `10EF36596EBFDBA021DCFA9C3A686A5F83C440D7936E1475F47E1C28404AD8FA`; its bytes and the web helper are unchanged between the reported revision and audit base (`git diff ac7f91f HEAD -- scripts/verify-m0-production-session.mjs scripts/m0-production-session-web.mjs` empty). Prior OTP-attempt evidence remains preserved. No repeat production sign-in is required. Combined with 63f759b's genuine preview/local own-session, foreign-session and cleanup results, managed Auth session rejection is now proven in all three directions. This does not prove future application OAuth callbacks, MFA/owner privileges or recovery replay.

## Repository and deployment

- GitHub push/PR CI **37471449509 / 37471441764** both pass at the audit base. They execute frozen install, state/secret gates, 16 tests, typecheck, lint, high-severity audit and build. Existing executable checks stand; this follow-up changes evidence/configuration only.
- Existing draft PR #1 remains open on the M0 branch. Repository is public; `main` was observed unprotected. Applied the required protected-review policy and read it back: strict required `check`, one approving review, stale approval dismissal, conversation resolution, enforcement for admins, force pushes/deletion disabled. No collaborator granted, PR merged, main commit changed or production deployment performed. Future merging needs an eligible approving reviewer; no bypass or waiver has been configured. [GitHub protection API](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection), checked October 6, supports this on public Free repositories.
- Vercel **dpl_HWwEdQKU9pTsn7pPs6Tr8YBPjWZe** is READY at exact audit base on the M0 branch. Project protection remains `all_except_custom_domains`. Metadata-only `decrypt=false` check: all 17 variables target Preview/exact M0 branch, including one sensitive database URL; zero Production variables, hiddenProductionEnvCount 0. Pinned preview issuer/cookie/origin differ from production; login/jobs/metered dispatch off, email capture. No credential value decrypted, emitted or changed.
- The health-fetch connector was rejected by automatic approval review because it could create a temporary protection-bypass link without specific authorization. No bypass was created and no indirect bypass was attempted. The safer read-only browser path redirects to Vercel login because its session expired. Prepared sign-in handoff; client must sign in before the newest protected health response can be read. Prior exact-revision 63f759b database_ready/no-store evidence remains valid historical evidence, not a fresh 7521ac6 health pass. Ignored blank login proof: `.tmp/evidence/m0-vercel-health-signin-20261006.png`.

## Remaining isolation gate and prepared decision

Neon preview `br-bitter-hall-b8ibnrfy` settings show Email signup off, Email sign-in on, localhost off, capture SMTP, Webhooks off, and **Google Shared keys** still configured. Branch Auth UI explicitly says anyone on the web can sign up and restricted signups are not available yet. Disabling email signup alone therefore does not close the Google path. Only synthetic email-code fixtures have been approved on test branches; no real Google identity is approved there.

Prepared **Remove Google OAuth provider?** on the verified preview branch, without submitting. The dialog warns that existing Google logins would cease working. The computer-use confirmation policy requires approval to accept this warning. Proposed operation Q-006: remove only Shared Google from preview and local, retaining the existing synthetic email-code checks and production provider. No user deletion or Disable Auth operation is proposed. Local removal/read-back has not been performed. Ignored review proof: `.tmp/evidence/m0-preview-google-removal-review-20261006.png`. Client approval is pending; this is an operational isolation decision, not a scope/tier amendment to SYS-03.

Concrete M0 remaining work: approved test-branch signup configuration/read-back, then fresh protected preview health with exact revision. Keep SYS-11 Blocked until these are resolved. Application login/callback implementation and revalidation belong to prepared M1 work; production remains an unconfigured holding deployment. Recovery key application binding/portable backup and representative horizon/deletion-revocation replay remain documented launch/M8 prerequisites; the primitive historical restore does not verify LEG-12. Do not repeat completed database-password, SMTP or production-OTP handoffs.

## Usage and evidence gate

Two client real production OTP request attempts total: original response unavailable, one diagnostic handoff now verified through a genuine session. No additional Auth/SMTP email, provider-data call, paid upgrade or metered product dispatch by this audit. Task credits/provider charges unavailable; no exact costs invented. Required executable gates are the passing exact-revision CI above. Documentation state/hash, credential scan and diff checks recorded after this update.

Documentation gate passed: 249 IDs and frozen SHA-256 unchanged; credential scan 107 source files, usage CSV nine records, diff check clean. Executable gates are the passing exact 7521ac6 CI noted above.

## Protected health handoff completed — 10:57 AM EDT October 6

Client supplied the health JSON after ordinary Vercel sign-in. Independent read-only browser observation on the existing health tab confirms database_ready, preview, exact revision `7521ac643c66f5310cdd831286b3c65fcc3bd089` and branch `br-bitter-hall-b8ibnrfy`. No temporary bypass link was created. The health route intentionally reports authIsolation/emailIsolation unverified: it probes database identity/catalog only; separate genuine session/capture evidence is authoritative for those checks. No provider email/session was requested again.

SYS-09 is now Verified by the combined protected-review read-back, exact-revision CI/preview/health and versioned synthetic-baseline/disposable-rollback evidence above and in referenced QA. The remaining SYS-11/M0 gate is Q-006 test-only Google signup removal approval and both branch read-backs. No approval for that operation was inferred from the supplied health JSON. M1 has not started.
