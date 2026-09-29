<!-- Generated from docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md; SHA-256 E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F; 2026-09-29. Do not edit directly. -->

### 11.16 Fresh database

The application owns the complete `groundbnb` schema in a new Neon project/database. Production branch is `main`; preview/local branches follow SYS-11 and Section 11.22. No direct legacy-table reads, writes, backfills, or coexistence are required or allowed. Existing users register afresh and explicitly transfer permitted files through the new application. This is a new application identity even when the same Google account is used; passwords, sessions, roles, grants, and provider consents never transfer from a file.

Use versioned SQL migrations checked into the repository. The fixture seed script must refuse to run against production. Keep normalized records from Section 11.3 rather than carrying forward legacy `groundbnb_profiles` or `groundbnb_trips` document shapes; native import/export may still preserve its specified `extensions` object.

Enable Neon point-in-time recovery or its current supported equivalent. Set a production recovery window of at least seven days and an operational recovery-time target of four hours for this launch. Document the available recovery-point granularity and last recoverable time without promising zero data loss. Run the non-production restore drill before launch, including LEG-12 deletion/revocation replay, using synthetic accounts. A direct legacy database importer is outside scope; user-controlled portable transfer is required by FILE-10.

---

### 11.18 Capacity, responsiveness, and release acceptance (SCL)

These are owner-selected launch needs plus explicit engineering growth targets, not claimed industry-standard traffic levels. Optimize for a small learning project while preserving a measurable path to growth.

| ID | Requirement and pass condition |
| --- | --- |
| SCL-01 **[v1]** | Launch target: 10–100 registered individuals, 1–3 daily active, up to 5 simultaneous active users, full-year itineraries with 200 stops. Preserve existing support for 1,000-stop trips and larger accepted imports. **Pass:** five distinct accounts concurrently edit/search/save 200-stop fixtures without cross-account state, truncation, duplicate writes, or unbounded card rendering. |
| SCL-02 **[v2]** | **v2 growth gate.** Target 1,000 registered individuals, 100 daily active, and 25 simultaneous active users; include mixed 200- and 1,000-stop trips. Use paginated/indexed owner queries, bounded database connections, bounded/durable expensive work, and stateless request handling where practical. **Pass:** a 30-minute synthetic growth load run meets the measured latency/error gates without requiring a redesign of ownership, membership, or canonical itinerary storage. |
| SCL-03 **[v1→v2]** | On a warm test deployment, non-provider read/write operations have p95 response within **1 second at v1 launch load**. Show local interaction/AI-request acknowledgment within 1 second; a 200-stop saved itinerary becomes usable within 3 seconds after its data arrives. **v2 extension:** p95 within 1.5 seconds at SCL-02 growth load. **Pass:** reports separate cold starts, network, map loading, AI/provider latency, and local rendering instead of averaging them into a misleading claim. |
| SCL-04 **[v1→v1.1]** | Maintain 40 versioned v1 scenarios, expanding to at least 100 in v1.1, covering profile context, ambiguity, exact land/water points, mixed modes, long plans, and failures. Require at least 95% correct healthy-provider outcomes per the rubric in Section 11.22 and 100% preserved state/actionable recovery on injected failures. **Pass:** explicit commands make the expected validated change; clarification passes only cases labeled ambiguous. Zero false-save claims, cross-account leaks, unintended transactions, or automatic road snapping of exact points. Every failure has a redacted bundle. |

Run UI checks on the owner's Windows i7/16 GB class laptop and representative current mobile browsers at the specified portrait/landscape sizes. A laptop test uses one development server and serialized heavy/browser suites. For concurrency gates, use synthetic provider responses to avoid unplanned spend; perform small bounded live samples during development and the complete SCL-05 live outcome gate before release, with reported model/version and cost. At v1 launch load, unexpected application errors must be below 1% of valid synthetic requests; intentional quota/validation responses are counted separately. The same threshold at SCL-02 growth load is a v2 gate. No dropped writes or corrupted coordinates are acceptable at any tested scale.

Keep the existing 50-card visible-detail bound, indexed owner/update ordering, cancelable jobs, and bounded map animation. Log connection saturation, queue age, cold-start time, and render delays so growth bottlenecks can be identified. A known provider outage can pass the recovery gate while failing the live-integration availability gate; report both honestly. “No errors ever” is not a release claim. Completion means the mandatory correctness gates pass, useful AI outcomes meet the target, and remaining external limitations are visible.

---

### 11.20 Public-launch obligations (LEG)

| ID | Requirement and pass condition |
| --- | --- |
| LEG-01 **[v1]** | Provide versioned `/terms` and `/privacy` draft pages. Sign-up records the accepted versions and time; footer links appear throughout the app. **Pass:** sign-up cannot complete without acceptance, and a required version bump prompts re-acceptance. |
| LEG-02 **[v1]** | Minimum user age is 18, attested at sign-up. Do not intentionally collect accounts from users under 18. Traveler age groups such as Children 0–12 describe travelers, not account holders. **Pass:** sign-up without the attestation fails. |
| LEG-03 **[v1]** | Self-service deletion requires recent reauthentication and named confirmation, immediately revokes access, and purges active profile/trip/chat/credential/diagnostic content within 24 hours, bypassing Trash. Remove auth-provider account data through its supported workflow. A minimal restricted deletion-control record survives until all recoverable backups expire under LEG-12. **Pass:** revoked sessions/credentials cannot act, the completed purge has no live owner-scoped content, and a fresh registration cannot recover the deleted identity/data. The last owner must transfer authority first under ACC-09. |
| LEG-04 **[v1]** | Self-service data export produces one JSON file with profile, all native trips, conversation history, and preferences, excluding secrets and other accounts. It is available to every plan. **Pass:** export is complete for the account and contains no credential/secret material. |
| LEG-05 **[v1]** | At first AI use disclose the AI provider, that prompts/context needed for the request are sent to it, that failed/undone requests may be retained for improvement, and the retention windows. **Pass:** disclosure version/time is recorded before first AI dispatch. |
| LEG-06 **[v1]** | `/privacy` lists current third-party processors for hosting, database, authentication, email, maps, and AI from one configuration source. **Pass:** changing the configured processor list updates the rendered page without duplicating policy text. |
| LEG-07 **[v1]** | Home address/coordinates are sensitive wherever copied: stop coordinates, geometry near home, prompt text, diffs, URLs, quotes, and tour targets. Redact/tokenize their occurrences in logs, diagnostics, and reproduction bundles by default; include in AI context only when required by the task. **Pass:** a home-based route bundle cannot reveal home through a duplicate field or adjacent geometry; retain relational tokens or synthetic geometry sufficient to diagnose the invariant. |
| LEG-08 **[v1]** | Verification/reset links expire, are single-use, and are never logged. Rate-limit authentication endpoints and do not reveal whether an email is registered. **Pass:** expired/reused links fail and enumeration tests receive neutral responses. |
| LEG-09 **[v1]** | Security baseline includes strict CSP/security headers, CSRF protection where applicable, dependency audit and secret scanning in CI, and an OWASP ASVS Level 1 checklist in `docs/security-checklist.md`. **Pass:** the v1 release gate fails on an unresolved high-severity audit finding. |
| LEG-10 **[v1]** | `/privacy` states data-retention and backup/recovery behavior. Neon recovery is enabled and the restore drill from Section 11.16 is completed. **Pass:** the runbook contains dated evidence of a successful non-production restore. |
| LEG-11 **[v1]** | Accessibility target is **WCAG 2.2 AA**. Add automated axe checks to Playwright plus a manual keyboard and screen-reader pass before launch. **Pass:** primary v1 journeys have no unresolved critical accessibility violation and the manual checklist is recorded. |

No payment or supplier-transaction feature exists in v1/v1.1, so do not add card data or stored payment references to the schema. Policy text remains a draft for owner/counsel review.

---

### 11.21 Units and locale

**v1.1.** Add profile field `units` with values `imperial` or `metric`, default `imperial`. Canonical storage remains SI/normalized. Metric display/input uses km, meters, liters, L/100km, and °C; imperial uses miles/yards/feet, US gallons/MPG, and °F. Use locale-aware date formatting while preserving unambiguous stored dates/instants. Money retains its explicit ISO currency; changing units never converts money.

---

## 13. Completion definition

**v1 is complete** only when every v1 requirement and v1 portion of a mixed-tier requirement is Verified, including all v1 requirements in Section 11.22 and LEG-01–LEG-12. M2A and M8 must pass. No v1 item may be Blocked and no critical isolation, data-loss, false-save, unauthorized-dispatch, privacy-restoration, or exact-point defect remains. v1.1/v2 features are not required. Static views or provider mocks cannot substitute for required live evidence.

**v1.1 is complete** when its implementation requirements pass and every claimed live integration is either Verified or explicitly Blocked with the missing credential/permission/provider dependency. Where this specification explicitly defines a Manual-watch or other non-live fallback as the product behavior, that fallback can be Verified without pretending the unavailable live provider exists. A deterministic mock never converts a required live integration from Blocked to Verified.

**v2 remains deferred** until its dependency is approved. Supplier booking/cancellation/auto-rebooking cannot leave Blocked status without a documented supplier agreement, payment processor, legal/operational review, and live integration evidence. SCL-02 likewise remains a future growth gate, not a v1 release blocker.

For every tier, a static placeholder, screenshot, canned AI reply, disabled future-feature button presented as complete, or unverified provider claim does not satisfy a requirement. The final handoff lists every ID with tier/status/evidence, all live dependencies, deliberate deviations, current provider/documentation verification dates, and the exact deployed revision.

---
