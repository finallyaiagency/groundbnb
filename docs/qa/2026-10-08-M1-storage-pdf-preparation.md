# M1 storage, factor primitives and PDF preparation

Base revision: 8792ccd09ba67ac667f3ddfe2532439b1adf959f. Code, tests and this evidence belong to the following checkpoint. Partial M1 preparation only.

## Published checkpoint

D-012 records explicit approval after automatic review initially refused publication. 8792ccd was pushed to the existing finallyaiagency/groundbnb review branch and draft PR #1. Both exact-revision CI runs passed: https://github.com/finallyaiagency/groundbnb/actions/runs/37799530039 and https://github.com/finallyaiagency/groundbnb/actions/runs/37799519604. No newer deployed preview health is inferred.

## Dormant storage

0007 prepares immutable versioned membership catalog, pinned account assignments, lifetime grant history and append-only audit. No assignments/grants are seeded. Rollback refuses used records or changed scaffold. Six static tests pass.

0008 prepares exact numeric financial windows and separate reserve/dispatch/settlement receipts. Dispatch defaults Paused; provider rates remain unconfigured. Replayed dispatch refuses new authorization. Unknown billed outcomes retain reservations; known incurred overspend remains recorded. Suspended/revoked-owner privileged reconciliation is an unimplemented service gate. Independent review found close/reopen, pause/rate races, numeric NaN, original replay acknowledgment and nullable provenance gaps; corrections precede checkpoint.

0009 prepares owner/epoch-bound encrypted enrollment, recovery hashes, accepted steps, session attestations, throttling and append-only audit. Independent review corrected same-session re-challenge uniqueness, deferred epoch/event/revocation coupling, overlapping rate windows and timestamp ordering. Eleven static tests pass. Future writers must still enforce approved window boundaries, nonfuture timestamps, atomic challenge consumption, rate/session/role eligibility and outcome auditing.

No migration was applied. Static tests cannot prove PostgreSQL execution, concurrency, ACLs or rollback. Local/preview still have only 0001–0002. Q-009 remains pending for staged 0003–0004 sensitive access expansion; later migrations are outside that scope. No principal, app writer, factor or grant was activated.

## Factor primitives

Node standard AES-256-GCM uses supplied external 256-bit keys, random 96-bit nonces, 128-bit tags and authenticated environment/account/factor/epoch/key-ID context. Closed envelopes omit plaintext. Recovery candidates require canonical 32-byte base64url codes, salted domain-separated SHA-256 and timingSafeEqual. Five tests pass for round trip, tampering, isolation and malformed/recovery inputs. Synthetic fixtures only; no real key/secret/code provisioning, enrollment/reset, persisted factor, recovery bypass or live MFA. Durable one-use consumption remains required.

## PDF bytes/layout

Local pdf-lib/fontkit binds a frozen preview to exact confirmed owner/revision/server timestamp and privacy choices. Home/notes require opt-in. Unverified map points, removed notes, unavailable quote text and calendar data are omitted with explanations. False/zero/unset stay distinct; unsupported glyphs fail visibly without changing saved text. Seven generator tests pass, including real font embedding, PostgreSQL microsecond/offset timestamps, stale-preview refusal and wrapped section/note heading placement.

A synthetic four-page Letter PDF includes a note spanning three pages, quoted phrase, long URL, latest pets=true and final-note sentinel. pdfplumber checks all character bounds, 612×792 page size, pet value and final sentinel. Poppler rendered page 2; parent inspected readable headings, URL/note wrapping, footer and no clipping. Footer baseline was raised three points after font descenders initially exceeded the margin. Ignored .tmp/evidence artifacts contain synthetic data only. This proves generator layout, not genuine authenticated browser export.

Annual calendar, selected owner-bound quote sources, intake/AI convergence, real download/cancellation/offline and device acceptance remain open. ACC-05/OPT-08/REL-05/RULE-11 and whole security/membership/financial requirements remain Not started.

## Combined checkpoint checks

253/253 Node tests pass, including nine financial migration checks and four static PDF adapter checks. Full lint and Next build/TypeScript pass. State/source validation reports all 249 IDs and unchanged frozen SHA-256. Secret scan passes (267 files before final evidence/usage edits); dependency audit after pinned PDF dependencies reports no known vulnerabilities. Whitespace check passes. Final state/secret scan runs again after recording evidence.

PDF adapter review follows the React skill: heavy rendering code loads on demand; exact server timestamp is required; dirty/pending/conflicted/record edits disable export; profile owner/revision/time remounts private review; generation checks and registered abort controllers suppress stale downloads; font fetch has a 25-second timeout; Blob URLs are revoked; readable preview wraps long text. Browser clicks report download started, without claiming completed file delivery. Source-level adapter checks cannot prove browser lifecycle timing or authenticated download.

Financial review corrections: controls/policy/rate/limit rows lock in consistent order through first dispatch; historical reserve replay precedes current admission; monetary NaN/Infinity values are rejected; active rates/limits require explicit dated provenance; closing released operations is terminal. All functions/helpers remain effectively ungranted. These are prepared code changes only; no SQL runtime observation is inferred.

No login window, OTP, profile mutation, metered call, production/recovery change or supplier transaction occurred. M1 remains in progress; no M2 successor chat before real exit. Three existing Luna High agents resumed after the observed usage reset; precise credits/tokens/charges/duration are unavailable.
