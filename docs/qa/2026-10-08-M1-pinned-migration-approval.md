# M1 pinned migration approval and current application state

As of 2026-10-08, the user explicitly approved applying migrations 0003–0009 on the pinned synthetic local and preview branches. This authorization does not include production, recovery, or other branches. Migrations 0010–0011 remain outside the approval.

## Confirmed progress

- Migration 0003 initially failed compilation twice on local. Each attempt rolled back; neither left a partial migration state.
- The migration 0003 choice-list parentheses and `IF`/`CASE` parenthesization repairs were committed on both pinned branches. Final 0003 source SHA-256: `C9EEEEFCD3A003C67B65035C32FD0F3A93640CE969550C2225A5B16F807A7DF9`.
- Migration 0004 is committed on both pinned branches. The confirmed database baseline is 0004.
- The focused static migration suites recorded for 0003 and 0008 pass 7/7 and 9/9 respectively. These results are static checks; they do not demonstrate PostgreSQL execution or migration acceptance for later versions.
- A separate 0008 `IF`/`CASE` syntax repair is prepared in source with static regression assertions. It has not been applied live and is not recorded as a new commit here.

## Pending and limits

Migrations 0005–0009 remain pending. The previous attempt to use the browser tool for 0005 was not executed after automatic approval review hit its usage limit. Following a reset, the parent resumed a fresh browser session and is attempting 0005; no result is recorded here.

Application and provider dispatch remain off. No paid provider call, production/recovery mutation, or migration beyond the confirmed 0004 baseline is claimed. The current 0003–0009 approval does not authorize 0010–0011.

## Superseding live continuation — October 8 evening EDT

D-013 records the exact client approval. All migrations 0003–0009 now show BEGIN, guarded operations, receipt INSERT and COMMIT on both pinned databases. Later metadata read-backs show local br-rough-flower-b8lerkcf and preview br-bitter-hall-b8ibnrfy each with nine migrations, dispatch paused, zero configured provider rates, zero factor enrollments and one synthetic Auth user.

0009 first failed on each branch at its encrypted-envelope CHECK: PostgreSQL reported SQLSTATE 42883 because jsonb_object_length(jsonb) does not exist. Explicit ROLLBACK restored each 0008 baseline. The repair requires all five known keys and an empty object after deleting those keys; it preserves exact-key and value validation without a new function or permission. The corrected static factor migration suite passes 6/6, and the corrected SQL committed on both.

The profile acceptance script first failed on both at its failure-rollback fixture (P0003). Earlier foreign-account fixture creation left two active identities; the later STRICT lookup lacked an exact owner predicate. Both transactions rolled back. Selecting the original fixture by its exact environment email repaired only the operator fixture. The corrected script passes all DO blocks and final ROLLBACK on both databases. This is operator proof, not an authenticated full-profile browser pass.

The original factor-storage operator script passes BEGIN, DO, SELECT and ROLLBACK on both. This does not prove live MFA enrollment, reset, recovery challenge, keys, role enforcement or the separately prepared 0010 lifecycle extensions.

The financial operator script first failed on local with SQLSTATE 42703: SQL alias w collided with the PL/pgSQL record w in reserve_provider_attempt's usage-window lock. That transaction rolled back. A standalone guarded maintenance script replaces only that alias and qualified join columns, retaining the same function signature, owner, ACL, security-definer mode and configuration. It asserts exact nine receipts, pinned fixture, paused dispatch and private financial helpers. The repair committed on both under the client's standing similar-request/continuation approval; applied SHA-256 615DE7B57D18D1F3E255309EE900B808C567E4469D9DDFE657EB5C2957DCC0A3. Existing applied 0008 source remains unchanged by this repair.

The local financial rerun then failed its expected Plus lifetime-overlay/reservation assertion (P0001); explicit ROLLBACK completed. Investigation continues. No financial acceptance pass is claimed.

Evidence screenshots are ignored local files .tmp/evidence/m1-local-0009-metadata.png and .tmp/evidence/m1-preview-0009-metadata.png. The previous automatic-review usage block cleared before this resumed execution. No production/recovery SQL, new login/OTP/window, real provider dispatch or principal/grant expansion beyond the approved batch occurred. Exact credits unavailable.

## Financial repairs and superseding results

The Plus assertion was a fixture defect: numeric amounts serialized to text retained decimal scale, so equality to the exact text 0.002/0.001 failed. The operator now compares exact numeric values. This did not change stored amounts or rounding.

The next local attempt exposed SQLSTATE 42702 in settle_provider_attempt: UPDATE actual_units=actual_units was ambiguous between column and parameter. It rolled back. The guarded repair aliases argument four internally and qualifies only that RHS; external signature, owner, ACL and security configuration are unchanged. Repair 87C76A4446EDA57A587FEE91BC3CD4839C56BB80DE5BE5813848C819F1F1DBAE committed on both.

A subsequent local attempt exposed the Free plan's intentionally unlimited account calendar-month window being refused as unconfigured. It rolled back. Repair E736CE2AA43C0F40AE6023A5B81C5D7A940B9D1AAEF0536DB99FF39166AB8350 committed on both. Unlimited is accepted only for the authenticated Free account's calendar-month window with a day-limited plan; unknown/not_configured and all other unlimited windows refuse. Every configured day, app, provider and Free-pool cap remains enforced.

The corrected financial/membership operator script now passes all assertions and final ROLLBACK on preview. Local final rerun is pending observation. No synthetic rates/assignments/grants/attempts/usage/test dispatch survive the transaction. This is single-connection operator evidence, not concurrency, application admission, or live vendor integration proof.

App restricted-boundary worker initially failed in sandbox (connection/unknown); approved network execution identified SQLSTATE 42809 from privilege calls evaluated against wrong relation kinds. CASE guards avoid planner predicate reordering, PostgreSQL count values accept exact numeric 9 or text 9, and membership direction excludes the app inheriting any parent role. The existing database owner being a member of the app role is not an app privilege expansion. The existing PUBLIC production-synthetic refusal trigger cannot be directly called as an ordinary SQL function; ordinary callable functions are exactly the five approved profile functions. Corrected direct restricted-role checks pass on both. No direct private table/sequence/helper access, create powers, memberships of other roles, or extra ordinary function execution are available to either app role.

Prepared M1-01V documents the fixed Neon HTTP batch versus callback transaction mismatch. It proposes two private calls with atomic consumption and closed authorized resource reads; no adapter/function/grant activation is claimed.

Final local financial rerun also passes BEGIN, DO, SELECT and ROLLBACK. Both final result grids show the script’s existing fixed marker M1_FINANCIAL_MEMBERSHIP_ACCEPTANCE_PREPARED after every assertion passed. Its historical marker name does not replace the observed SQL execution evidence. Both restricted app checks pass. Combined final static suite 312/312 passes; lint/state/secret checks follow. Prior intermediate full-suite failure was a transient new repair-test text assertion during agent editing (305/306); later complete reruns pass. Original prior 304/304 run also passed. No failures are silently counted as passes.

Published checkpoint a8c2a7dd2fdd8762e8353e69ef06972132fd80e1 exact PR workflow37879154221 passed. Final full suite312/312, lint, state249/frozenhash and secret302-file scan pass. Dashboard separatePCC71ba404 is READY and actual browser shows this pin and valid evidence links. Later offline adapter preparation remains separate; no M1 exit or M2 start inferred.
