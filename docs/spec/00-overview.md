<!-- Generated from docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md; SHA-256 E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F; 2026-09-29. Do not edit directly. -->

## 0. v2.5 scope, resolved decisions, and build rules

The following decisions are resolved for this specification and are not open questions for the building agent:

- Create a **new Neon project** named `groundbnb`, with database `groundbnb`, independent authentication, production, sanitized preview, and local-development branches. Do not share, mutate, or automatically migrate the legacy database. Existing users register in the new application and may use the same Google identity, but receive a new application account. Existing service/data remain untouched by this rebuild. Offer the explicit file-transfer workflow in Section 11.22; never promise automatic account, password, role, or trip migration.
- Retain the conservative **0.25 USD/day Free hard ceiling**, including 0.20 base, 0.03 ordinary grace, and 0.02 emergency reserve; application-wide ceilings are **5.00 USD/day and 100.00 USD/calendar month**. These replace earlier proposed operating budgets. Commercial feature/trip gates are report-only at launch; financial, abuse, and security controls remain enforced. In v1 the emergency reserve is held unavailable: ordinary AI can spend at most 0.23 USD/day. Economy becomes available in v1.1, within the same hard totals.
- Keep **one owner and two admins**, with a direct-database break-glass owner recovery command. Do not add a second owner automatically.
- **Profile PDF is available on all plans.** Standard file exports, including the dedicated Marine Waypoints format, are implemented in v1; their seeded membership restrictions are tested in enforced cohorts. MCP, watches, video, editable plan publishing, and Economy remain v1.1.
- A saved demo consumes a normal saved-trip slot and all normal operating allowances; conversion changes its label in place and never creates another trip. A static sample preview consumes no saved-trip slot and invokes no provider.
- Client-side schematic video remains available during Economy or Paused when its content is already present and the export entitlement allows it. It makes no metered provider calls.
- The first integrated build gate proves profile-based planning, a three-stop route, exact-point adjustment, AI edit, undo, and reload before broad feature expansion.
- Administrator access requires a second factor and sensitive actions require recent step-up authentication. Production recovery must not resurrect deleted accounts or revoked credentials.
- Default implementation stack: **Next.js App Router + TypeScript, Neon Postgres, Drizzle + SQL migrations, Zod, Vitest, Playwright, pnpm, Vercel**.
- Do not begin v1.1 implementation until the v1 public-launch gate passes. v2 remains deferred until its external dependencies exist.
- No supplier agreements exist for booking/rebooking. **v1 and v1.1 perform no booking, cancellation, payment, or automatic rebooking.** v1.1 monitoring is alert-only or manual-watch behavior with source links. Transactional rebooking remains a v2 design requirement and is Blocked until a supplier agreement and payment processor exist.
- Legal pages are implementation drafts for owner/counsel review; they are not legal advice.

### 0.1 Scope tiers

Every numbered requirement carries a tier tag. A tier identifies the release portion whose gate includes it; mixed tags retain separate baseline and extension evidence. Fixtures state extensions explicitly and are run only for their applicable implemented tier.

| Tier | Meaning |
| --- | --- |
| **v1** | Public-launch gate. Every v1 requirement must be Verified and none may be Blocked. |
| **v1.1** | Post-launch feature release. Blocked live integrations may remain listed with the precise missing dependency; a mock never converts Blocked to Verified. |
| **v2** | Deferred capability requiring a provider, supplier, legal, or scale dependency that is not part of v1/v1.1. |
| **v1→v1.1** | A v1 baseline is required, with an explicitly stated v1.1 extension. |
| **v1→v2** | A v1 baseline is required, with an explicitly deferred v2 growth/transaction extension. |

Requirement rows carry explicit tier tags. Detailed prose inherits the tier of its governing requirement; mixed-tier paragraphs must identify each extension. Untagged baseline prose is v1, but cannot promote an explicitly deferred feature. Recognized tiers include v1, v1.1, v2, v1→v1.1, v1→v2, and v1.1→v2. The coverage ledger records evidence; it cannot redefine scope. Required fields are `id,title,tier,milestone,depends_on,status,evidence,notes`. Section 0 resolves release/policy precedence; Section 11 resolves detailed behavior; milestones and fixtures must agree with both.

### 0.2 Provider and legal verification rule

Provider, API, pricing, plan-limit, browser-support, and terms claims are implementation hypotheses until verified from current official documentation. Before a dependent architecture decision, record the official URL, check date, limitation, permitted data use, and implementation decision in `docs/integrations.md`. Never implement a prohibited use. Apply the fallback explicitly specified here; if none satisfies a required outcome, record the capability as Blocked and present the concrete alternatives to the owner. Recording a deviation alone cannot waive a required product outcome. RULE-12 and Section 11.22 govern map storage/export and must be resolved before durable map-data design, not postponed until export implementation.

---

## 1. Product contract and reading guide

Groundbnb helps a traveler form an account-wide travel profile, plan one or many trips with an AI travel agent, manage nested annual-to-daily itineraries, and inspect a route on an interactive three-dimensional map. A trip combines chat, stops, travel legs, timing, costs, proposals, reservations, map geometry, and a camera tour. The account-wide profile stores durable preferences and an annual master calendar; trips remain separate.

Each requirement has an ID. Its **Pass** clause or final acceptance column is an acceptance scenario. All IDs are mandatory for a complete clone. Text in quotation marks is user-facing copy to reproduce; other prose defines behavior. The clone may organize its internal code freely, but must deliver the stated interface and outcomes. Section 0 governs release and policy decisions. Section 11 supplies binding defaults, field contracts, and edge-case rules for the earlier feature descriptions. It takes precedence over a general description on the same subject. Section 11.14 governs membership eligibility when enforcement is enabled; verify each feature with an eligible account and its denial with an ineligible account. It does not remove any feature from implementation scope.

The owner-selected scope is the full tiered functionality in this document, with **v1 as the public-launch gate**, v1.1 as the first post-launch feature set, and v2 deferred. Exact layout measurements, timing limits, completion formula, portable data format, undo depth, trash retention, and sample fixtures are specification decisions made to remove guesswork. They are target defaults, not claims about historical behavior. Build the membership data and entitlement foundation in Section 11.14 during v1; paid checkout, prices, invoicing, payment collection, supplier booking, cancellation, and automatic rebooking remain outside v1 and v1.1.

### 1.1 Required services and operating model

| ID | Requirement and pass condition |
| --- | --- |
| SYS-01 **[v1]** | Host the web application and server functions on Vercel. **Pass:** deep links, authentication callbacks, and server endpoints work after direct navigation and refresh on a Vercel preview deployment. |
| SYS-02 **[v1]** | Store durable account, profile, trip, chat, itinerary, tour, and monitoring data in Neon PostgreSQL. **Pass:** another browser session for the same account restores the saved state; a different account sees none of it. |
| SYS-03 **[v1]** | Support Google OAuth and email/password sign-in for the same account. **Pass:** linking Google from an existing email account preserves one profile and its trips; duplicate-provider conflicts show a safe recovery message. |
| SYS-04 **[v1]** | Use Google Maps for geocoding, road directions, place lookup, photorealistic 3D rendering, and flat 2D road/satellite maps. “3D” means the Google Earth-like visual experience; no separate Google Earth application is required. **Pass:** all three map presentations show the same saved trip, and precise GPS remains separate from its road access point. |
| SYS-05 **[v1]** | Use a server-side Google Gemini service for AI conversation and structured planning actions. Never expose an AI key to the browser. **Pass:** browser requests contain no private key; only authorized, validated requests reach the AI service. |
| SYS-06 **[v1]** | Treat external route, price, accommodation, marine, and weather information according to its provenance. **Pass:** unavailable or unverified values appear as unknown or provisional, never as confirmed facts. |
| SYS-07 **[v1]** | All persistent mutations have account authorization, input validation, revision control, and a durable success acknowledgment. **Pass:** a stale or cross-account write cannot replace a newer or foreign record. |
| SYS-08 **[v1]** | Desktop, tablet, and mobile are first-class. Keyboard access, visible focus, descriptive labels, and legible contrast apply throughout. **Pass:** all primary flows work at 390 × 844, 844 × 390, 768 × 1024, and 1440 × 900 without clipped controls. |
| SYS-09 **[v1]** | Keep the rebuild in GitHub with protected review and a reproducible Vercel preview for each proposed release. Database migrations are versioned and reversible where possible. **Pass:** a preview identifies its revision, migrates test data successfully, and can be rolled back without altering production data. |
| SYS-10 **[v1]** | Automated checks cover account/trip isolation, profile and chat updates, precise GPS routing, multimodal totals, calendar filters, time anchors, imports/exports, tour playback, and mobile flows. Critical historical defects have dedicated regressions. **Pass:** the release gate fails on any required regression, type/build error, or end-to-end acceptance failure. |

### 1.2 Shared product language

Use “stay,” never “dwell,” for time at a stop. A **stop** is a destination or access point; a **leg** joins two stops in one mode; a **connector** joins road access to a precise off-road point; a **segment** is a dated child of a larger itinerary; a **proposal** is a suggestion that has not altered the confirmed calendar or reservation; a **tour view** is a saved 3D camera pose. A trip may have no dates. Money is expressed with an explicit currency and known/provisional/unknown status.

### 1.3 Global visual system

| ID | Requirement and pass condition |
| --- | --- |
| UI-01 **[v1]** | Use a dark travel aesthetic: near-black page backgrounds; charcoal and deep navy cards; warm amber/yellow emphasis for primary calls to action and selected itinerary items; teal/green for active map controls; white primary text and muted gray secondary text. Use rounded cards, subtle borders, and restrained translucent surfaces. **Pass:** intake, profile, trips, and planner look like one product while retaining their distinct layouts. |
| UI-02 **[v1]** | Use Fraunces for display headings, Manrope for controls/body copy, and Inconsolata for coordinates and diagnostics. Supply local font assets with appropriate licenses and serif/sans-serif/monospace fallbacks. Small uppercase letter-spaced eyebrow labels identify sections. **Pass:** the main heading, card titles, controls, and supporting copy have a clear hierarchy at all viewports and remain usable if font loading fails. |
| UI-03 **[v1]** | The intake hero uses a full-bleed photographic mountain-and-campsite scene with warm dusk grading and a dark overlay so foreground text stays legible. If the exact image is unavailable, recreate a similar original image: layered mountains, trees/campsite foreground, warm brown sky, no embedded words or logos. The planner map uses photorealistic satellite/terrain imagery. **Pass:** neither area is replaced by a flat color placeholder. |
| UI-04 **[v1]** | Show Groundbnb branding with a compact travel/campsite mark; global navigation exposes Planner and Profile, with My Trips through account/trip controls. The account avatar opens a menu for profile, trips, sign-in methods, and sign out. **Pass:** these destinations are reachable without a dead or duplicate navigation control. |
| UI-05 **[v1]** | Every mutation shows saving, saved, failed, or retry state. A success message appears only after storage and visible UI agree. **Pass:** simulated network failure leaves the old state intact and gives a retry path. |
| UI-06 **[v1]** | Use a consistent spacing scale of 4, 8, 12, 16, 24, and 32 CSS pixels. Cards use 12–24 pixel radii, thin low-contrast borders, and at least 16 pixel internal padding. Body copy is at least 14 pixels on mobile; primary buttons are at least 44 pixels tall. The palette anchors are near-black #0b0b0b, charcoal #19191b, cream #f5f0e8, amber #ffd45b, teal #167f72, and muted slate #9da5ac; variation is allowed for map leg colors. **Pass:** UI hierarchy and contrast remain recognizable across screens. |
| UI-07 **[v1]** | At desktop width 1280 pixels, the planner opens with approximately 28% chat, 40% map, and 32% right panel; each sidebar has a usable minimum width of 280 pixels and resizes by a visible divider. At 768–1023 pixels, use compact panels with a dominant map. Below 768 pixels, use the mobile drawers in MOB-01. **Pass:** no panel overlaps another or leaves the map narrower than its controls. |
| UI-08 **[v1]** | Buttons show hover, pressed, disabled, busy, and focus states. Selected tabs use a filled teal/green or amber-accent pill; destructive actions use a subdued red label until confirmation. Inputs have dark filled backgrounds and visible light text/caret; password dots remain legible. **Pass:** all states can be distinguished without relying only on color. |
