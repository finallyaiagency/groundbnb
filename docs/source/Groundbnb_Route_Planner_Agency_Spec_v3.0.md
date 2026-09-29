# Groundbnb Route Planner
## Software Requirements Specification, Delivery Contract, and AI Engineering Execution Plan

**Document version:** 3.0 (Agency Issue)  
**Baseline product specification:** Groundbnb Route Planner v2.5, dated 2026-09-28  
**Issue date:** 2026-09-28  
**Status:** Issued for implementation planning and execution  
**Intended audience:** Client sponsor/product owner, software engineering agency, AI engineering team, QA, security, and operations  

> **Contractual baseline.** The product requirements and requirement IDs in Part II are carried forward from specification v2.5 without relaxation. Part I governs delivery and engagement management. Part III governs AI-assisted execution, context management, evidence, and client reporting. Where a delivery-process rule conflicts with a product requirement, the product requirement remains binding unless an approved change request explicitly amends the requirement by ID.

---

## Document control

| Field | Value |
| --- | --- |
| Product | Groundbnb Route Planner |
| Engagement | Greenfield recreation of an existing reference application |
| Delivery model | AI-assisted software engineering with human/client governance |
| Technical baseline | Next.js App Router + TypeScript, Neon Postgres, Drizzle + SQL migrations, Zod, Vitest, Playwright, pnpm, Vercel |
| Binding requirements source | Part II / frozen v2.5 baseline |
| Requirement status authority | `docs/ledger.csv` |
| Current execution state authority | `docs/STATE.md` |
| Decisions and deviations | `docs/OPEN-DECISIONS.md` and approved change records |
| Integration verification | `docs/integrations.md` |
| Release evidence | CI, deterministic fixtures, bounded live checks, deployment revision, and acceptance evidence |

## Table of contents

### Part I — Engagement and delivery contract
1. Executive summary  
2. Engagement objectives and success criteria  
3. Statement of work and scope boundaries  
4. Delivery principles and source-of-truth hierarchy  
5. Roles and responsibilities  
6. Contract deliverables  
7. Milestone, acceptance, and release governance  
8. Change control and decision management  
9. Client reporting and project-control website  
10. AI engineering and cost-efficiency objectives  

### Part II — Binding product requirements
0. Scope, resolved decisions, and build rules  
1. Product contract and reading guide  
2. Navigation and screen specifications  
3. Planner interface and interaction  
4. Stops, routing, and travel modes  
5. Calendar, scheduling, and calculations  
6. Map tour, interoperability, and files  
7. Recommendations and Pro Planner  
8. Standalone data and operation contracts  
9. Exact choice catalog and review surfaces  
10. End-to-end acceptance journeys  
11. Detailed build contracts  
12. Build sequence and verification  
13. Completion definition  

### Part III — AI-assisted delivery operating model
14. Codex execution architecture  
15. Conversation and context lifecycle  
16. Model and reasoning selection policy  
17. Subagent/delegation policy  
18. Task packet standard  
19. Usage and credit accounting for implementation  
20. Handoff, continuity, and client auditability  

---

# Part I — Engagement and delivery contract

## 1. Executive summary

The engagement is a greenfield rebuild of Groundbnb Route Planner using the existing application only as a behavioral and visual reference. The reference application is not assumed to be correct, complete, secure, maintainable, or production-ready. The agency shall implement the target behavior defined by the binding specification, not blindly reproduce defects or undocumented legacy implementation choices.

The engagement is deliberately evidence-driven. A feature is not complete because code exists or a screen renders; it is complete only when its applicable requirement IDs have implementation evidence and the specified acceptance conditions pass. The client-facing project-control website is a projection of that evidence and must not become a second, manually maintained source of truth.

## 2. Engagement objectives and success criteria

The primary objective is to deliver a production-ready, independently deployable application that satisfies the v1 public-launch requirements, followed by the explicitly scoped v1.1 release. v2 capabilities remain deferred until their external dependencies are approved.

Success is measured by: (a) requirement coverage and acceptance evidence, (b) correctness of persisted state and account isolation, (c) deterministic and live integration test results, (d) release-gate completion, (e) reproducible deployment and recovery, (f) transparent unresolved dependencies and deviations, and (g) an auditable delivery record suitable for client review.

## 3. Statement of work and scope boundaries

### 3.1 In scope

- Architecture, implementation, verification, deployment, and handoff of all v1 requirements.
- v1.1 implementation only after the v1 launch gate passes.
- Creation and maintenance of the requirement coverage ledger, execution state, decision log, integration register, test evidence, release records, and client-facing progress dashboard.
- Investigation of the reference application when useful for observable behavior, while treating the written specification as authoritative when the legacy implementation is incomplete or defective.
- Production-hardening work explicitly required by the specification, including security, privacy, cost controls, recovery, accessibility, browser/device verification, and operational documentation.

### 3.2 Out of scope unless approved through change control

- Automatic migration from the legacy production database or identity system.
- Supplier booking, cancellation, payment, or automatic rebooking before the v2 dependencies are approved.
- Unspecified legacy behavior that contradicts or exceeds the written product contract.
- New commercial features, integrations, or design changes not represented by an approved requirement or change request.

## 4. Delivery principles and source-of-truth hierarchy

The agency shall use the following hierarchy when resolving ambiguity:

1. Approved change requests that explicitly amend stable requirement IDs.
2. Part II Section 0 release and policy decisions.
3. Part II Section 11 detailed build contracts.
4. The remaining numbered product requirements and acceptance journeys.
5. Generated task views and implementation notes.
6. The legacy/reference application.

Generated task files, summaries, dashboards, and agent conversations are derived artifacts. They may clarify implementation but may not weaken, silently reinterpret, or delete a binding requirement.

## 5. Roles and responsibilities

| Role | Primary responsibility | Approval authority |
| --- | --- | --- |
| Client sponsor / product owner | Product decisions, priority, credentials, legal/business decisions, acceptance of approved deviations | Scope amendments, launch approval, deferred dependency approval |
| Agency delivery lead / orchestrator | Work decomposition, dependency sequencing, context control, progress reporting, risk escalation | Task sequencing and implementation approach within the contract |
| Engineering agents / engineers | Implement bounded task packets, tests, migrations, documentation, and evidence | No unilateral scope changes |
| QA / verification role | Independent review of acceptance evidence, regressions, visual/accessibility gates, and release readiness | Verification status when evidence satisfies the requirement |
| Security / operations reviewer | Authentication, authorization, secrets, recovery, monitoring, data lifecycle, and deployment controls | Security/operations gate evidence |

A coding agent shall not approve its own unexplained visual regression, waive a failed acceptance criterion, or modify acceptance criteria solely to make its implementation pass.

## 6. Contract deliverables

The minimum delivery package includes:

- Version-controlled application source and migrations.
- Frozen baseline specification and traceable derived task views.
- `AGENTS.md`, `docs/ledger.csv`, `docs/STATE.md`, `docs/OPEN-DECISIONS.md`, and `docs/integrations.md`.
- Milestone task packets and exact verification commands.
- CI configuration and automated unit/integration/end-to-end/accessibility checks.
- Deterministic fixture evidence and bounded live-integration evidence.
- Client-facing project-control dashboard.
- Deployment, environment, recovery, security, and operational runbooks.
- Release notes, known limitations, unresolved dependencies, approved deviations, and final requirement-by-requirement handoff.

## 7. Milestone, acceptance, and release governance

The milestone order in Part II Section 12 is binding unless an approved change record reorders work without violating dependencies. Work may be implemented ahead of a milestone only when it does not obscure the milestone exit gate or create a false completion claim.

Statuses are limited to **Not started, Implemented, Verified, Failed, Blocked**. “Implemented” means code exists but acceptance evidence is incomplete. “Verified” requires the evidence specified by the requirement. “Blocked” must name the concrete missing dependency. A mock may verify internal behavior but may not establish a required live integration.

Client reporting must distinguish implementation progress from verification progress. Percent complete shall never count an Implemented item as Verified.

## 8. Change control and decision management

Every scope change shall identify: change ID, requestor, date, affected requirement IDs, business reason, impact on architecture/security/data/provider terms, milestone impact, test changes, estimated implementation effort/usage, disposition, approver, and effective specification version.

Routine implementation decisions that do not change externally observable requirements belong in the decision log and do not require a specification revision. Any decision that relaxes, adds, removes, or materially changes a requirement requires explicit change control.

## 9. Client reporting and project-control website

The project-control website is a reusable agency deliverable for this project and future client engagements. It shall present a read-only client view by default and derive status from repository evidence rather than requiring duplicate manual updates.

Required views are: Executive Overview; Milestones; Requirements; Task Queue; Tests and Release Gates; Defects/Risks/Blockers; Decisions and Change Requests; Integrations; Usage/Cost; Activity/Deployments; and Deliverables/Handoff.

The dashboard shall show separate **implementation** and **verification** percentages, milestone exit-gate status, requirement counts by tier/status, current task, last passing checks, blocked dependencies, open decisions, recent commits/deployments, deterministic/live test evidence, and known release risks. It shall preserve direct links or references back to the underlying evidence.

Usage reporting shall distinguish:

- **Application operating usage** governed by Part II Section 11.11.
- **Agency implementation usage** consumed by Codex/Work/API during development.

Those are separate accounting domains and must never be combined into one authoritative total.

## 10. AI engineering and cost-efficiency objectives

Implementation shall optimize for **verified progress per unit of model usage**, not for maximum autonomous runtime. The workflow should minimize repeated ingestion of the full specification, repeated codebase rediscovery, redundant agent work, speculative implementation, and repeated expensive live tests.

The preferred unit of execution is a self-contained task packet that can be completed and verified in one focused session. Persistent repository artifacts carry project memory between sessions; chat history is not the system of record.

---

# Part II — Binding product requirements

**Instructions to the building agent:** build the application described here. Read the complete document before choosing an architecture. Preserve every requirement ID in a coverage checklist. Implement and verify the milestones in Section 12 in order, including real persistence and failure handling in each milestone. Do not substitute screenshots, canned AI replies, static mockups, or disabled future-feature buttons for functioning features. Use deterministic test doubles for automated tests and live services for the separate integration checks. Record missing credentials or unavailable provider capabilities precisely; complete independent work and never label a simulated integration live.

**Navigation:** [Product and visuals](#1-product-contract-and-reading-guide) · [Screens](#2-navigation-and-screen-specifications) · [Planner](#3-planner-interface-and-interaction) · [Routing](#4-stops-routing-and-travel-modes) · [Calendar and costs](#5-calendar-scheduling-and-calculations) · [Tours and files](#6-map-tour-interoperability-and-files) · [Pro Planner](#7-recommendations-and-pro-planner) · [Data and operations](#8-standalone-data-and-operation-contracts) · [Option catalog](#9-exact-choice-catalog-and-review-surfaces) · [Journeys](#10-end-to-end-acceptance-journeys) · [Detailed contracts](#11-detailed-build-contracts) · [Build and verification](#12-build-sequence-and-verification) · [Completion](#13-completion-definition).

**Added capabilities:** [Administration](#1110-administration-and-improvement-diagnostics-adm) · [Usage dashboard](#1111-token-and-provider-usage-accounting-usg) · [MCP access](#1112-headless-agent-access-through-mcp-mcp) · [2D maps and point dragging](#1113-map-modes-and-repositioning-stops-map-route) · [Membership and limits](#1114-individual-membership-and-future-monetization-foundation-mem).

**Operational handoff:** [Grants and cost protection](#1115-special-grants-administrator-bootstrap-and-cost-protection) · [Fresh database](#1116-fresh-database) · [Reliable planning](#1117-low-friction-planning-and-reliable-outcomes-rel) · [Scale targets](#1118-capacity-responsiveness-and-release-acceptance-scl) · [Route video](#1119-route-tour-video-export-file) · [Public launch](#1120-public-launch-obligations-leg) · [Units](#1121-units-and-locale) · [Release and operational safeguards](#1122-release-integrity-portable-data-and-operational-safeguards).

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

## 2. Navigation and screen specifications

### 2.1 Public and account routes

| ID | Screen | Target layout and interaction | Pass |
| --- | --- | --- | --- |
| NAV-01 **[v1]** | Home/intake | The root opens intake for a guest or account without a selected trip; otherwise it opens the selected accessible trip. Intake always has its own direct URL. A prominent “Plan my trip” action uses the saved profile to generate a starter proposal as specified in Section 11.17. Passive navigation/reload never generates another route or overwrites one. | A new user starts a useful profile-based route in one explicit action; returning sessions restore saved work without duplicate generation. |
| NAV-02 **[v1]** | Sign in/sign up | Center a narrow rounded dark card on a near-black page. Show brand, “Welcome back” or “Save your profile,” Google action, email and password fields, submit action, and mode switch. Show callback progress, cancellation, expiration, conflict, and retry messages inline. | Both methods authenticate; bad credentials do not erase entered email or navigate away. |
| NAV-03 **[v1]** | Password recovery | Provide email verification, reset request, expired-link retry, secure new-password entry, and success return to sign-in. A password must meet a clearly shown minimum of eight characters. | An expired link cannot change the password; successful reset revokes existing application sessions. |
| NAV-04 **[v1]** | Profile | A black desktop page has a top brand/navigation bar, a narrow left identity/completion rail, and a wide right content column. The right column contains Sign-in methods, Traveler, Vehicle, Preferences, annual calendar, saved trips, notes, and profile actions. An amber “Ask Travel Agent” launcher stays accessible. | Profile values and completion update immediately after an edit and after reload. |
| NAV-05 **[v1]** | My Trips | Show “TRIP LIBRARY,” “My Trips,” a New trip button, a current-trip name field and Save trip button, then recent trip cards with name, dates, stop count or “No route yet,” updated date, Current marker, Resume/Open, and Rename. Include archived trip access and “Load more trips.” | A traveler can save, rename, open, archive, reopen, and page through trips without mixing content. |
| NAV-06 **[v1]** | Planner | The desktop layout is three resizable vertical areas: Travel Agent left, switchable 3D/2D map center, Itinerary/Summary/Tour right. Both sidebars have matching collapse/expand controls that remain visible when collapsed. | Resizing, changing map mode, or collapsing panels does not hide the map or strand a control. |
| NAV-07 **[v1.1]** | Trails/explore | Present a searchable discovery surface for route-relevant places and trails, with cards that identify location, activity, accessibility, and whether the result is verified. “Add to trip” opens a proposed stop placement before saving. | A result can be inspected without altering the active trip; explicit Add places it in the chosen segment. |
| NAV-08 **[v1]** | Missing/invalid page | Show a branded not-found state with links to Planner, Profile, and My Trips. Forbidden trip URLs show a neutral unavailable message without confirming another account’s data exists. | Direct unknown URLs do not show a blank page or leak private data. |

### 2.2 Concierge intake

The intake page has a warm photographic background, a small top brand/navigation row, saved-state indicator, an oversized two-tone headline “Plan the trip without the form fatigue,” supporting copy, a horizontal step selector for “Trip Basics,” “Preferences,” and “Advanced” in v1 (renamed “Advanced + Pro” when v1.1 configuration is implemented), and a translucent rounded form panel. The Travel Agent launcher remains in a lower corner. The form autosaves and can be resumed.

| ID | Requirement and pass condition |
| --- | --- |
| IN-01 **[v1]** | Trip Basics collects optional home address, explicit “Always begin and end routes here” switch, start location, destination, trip length (3, 7, 10, 14, 30 days or a typed positive integer), travel modes, season, timing, party composition/count/age groups, and trip notes. Home is never inferred from a current map center or IP address. **Pass:** entering home resolves “home” and local destination names around that address; an explicit route endpoint overrides the home default. |
| IN-02 **[v1]** | Travel mode cards initially highlight RV, Van/Class B, Car/SUV, On Foot/Transit, Hike/Backpack, Plane/Flight, Train/Rail, and Rental Car. Expand to Bicycle, Truck Camper, Travel Trailer, Fifth Wheel, Class A, Class C, and Boat/Yacht. A traveler may select more than one. **Pass:** selected modes remain visible and persisted when sections change. |
| IN-03 **[v1]** | Preferences initially shows budget level (Free/Minimal Cost, Budget, Moderate, Comfort, Luxury), core overnight choices (Campgrounds, RV Parks, BLM/Public Land), and driving pace (Fastest, Balanced, Scenic). Progressive reveals expose amount/timeframe/per-person basis, splurge allowance and frequency, all overnight types, activities, pets, dietary/access notes, and freeform notes. **Pass:** optional fields can be skipped without invented values; revealing them does not reset earlier selections. |
| IN-04 **[v1]** | Extended overnight options include national/state parks, private land, marinas, hostels, community shelters, urban camping, tent/RV/van/boondocking/glamping/cabins/ultralight/boating styles, and Airbnb, budget/boutique hotels, luxury resorts, and cruises. **Pass:** each choice appears in the saved profile and filters later recommendations. |
| IN-05 **[v1]** | Advanced filters include accessibility/mobility, hookups, climate, terrain, toll/highway/mountain avoidance, preferred transport, domestic/international scope, date flexibility, sustainability, planning style, budget sensitivity, risk tolerance, physical capacity, planning horizon, legal/permit needs, emotional goals, income offsets, and support needs. Core choices are visible; “Show more filters” reveals the rest. **Pass:** a later AI route uses chosen constraints without silently overriding them. |
| IN-06 **[v1]** | Support questions include same-day overnight, food access, facilities, walkable/transit access, and community support. Ask respectfully and only when relevant; an urgent shelter request must provide practical, clearly labeled options without treating the traveler as a leisure booking lead. **Pass:** urgent support can be entered and retained without forcing destination or budget answers. |
| IN-07 **[v1.1]** | Advanced + Pro exposes Pro Planner settings described in Sections 7 and 9. A separate “Fund the Fun” subsection collects income/volunteer interests, skills, daily income need, and stay duration. Render the working configuration UI even before providers are connected, and label unavailable live capabilities according to Section 11.9. **Pass:** all settings save, display in the profile review, and affect authorized monitoring or recommendations when the required provider is connected. |
| IN-08 **[v1]** | A Review Profile action shows readable prose and category cards, identifies missing optional information, and offers Edit, Save, Open Planner, Download PDF, and Ask Travel Agent. A built-in fictional example can populate a demo profile but must be clearly labeled and never replace a real profile without confirmation. **Pass:** review and PDF reflect an immediately preceding edit. |

### 2.3 Profile, account, and trip library

| ID | Requirement and pass condition |
| --- | --- |
| ACC-01 **[v1]** | The profile’s identity rail shows avatar, display name, email, completion percentage, and category progress for traveler, vehicle, and preferences. Completion counts answered applicable fields, not optional unanswered fields as defects. **Pass:** percentage and category markers change after saving an applicable answer. |
| ACC-02 **[v1]** | The account-wide profile contains travel party, regions, pets, comfort, styles, stays, activities, accessibility, food needs, home anchor, travel vehicles with type/fuel economy, support needs, and a narrative summary. Present empty values as “Not specified.” **Pass:** another trip in the same account receives these preferences without inheriting the old trip’s stops or chat. |
| ACC-03 **[v1]** | Include an Edit profile action back to intake, Sign-in methods cards for email/password and Google, and safe link/unlink controls. The profile agent sidebar offers Chat and Profile only. **Pass:** adding Google links to the current account; the same email cannot silently create a second account with access to the first account’s data. |
| ACC-04 **[v1]** | Profile notes are a concise resolved summary with selected meaningful user quotes attached to the relevant notes. Show a clear summary, “Clear AI notes” action, and distinct “New chat topic” action that retains notes. **Pass:** a correction replaces contradictory information, and clearing notes does not delete structured profile fields. |
| ACC-05 **[v1]** | Download a detailed profile PDF with headings, readable prose, selected quotes, annual calendar summary, and correct page breaks. **Pass:** no heading or note is clipped, and the latest saved edit is present without a hard reload. |
| ACC-06 **[v1]** | Account switching clears visible and cached profile, trips, itineraries, chat, map markers, tours, and provider query caches before loading the new account’s active trip. **Pass:** rapid A→B→A switching never shows another account’s content, even briefly. |
| ACC-07 **[v1]** | Intake, Profile, Planner, and AI edits share one account-profile truth. Profile completion, overnight choices, home default, vehicle MPG, and note summary update in all views after a confirmed edit. The agent presents profile context as readable prose, never a raw data dump. **Pass:** a change made through chat appears in profile review and PDF without a reload. |
| TRP-01 **[v1]** | New trip creates a blank trip-specific route, dates, destinations, chat, tour, and map state while retaining account preferences and vehicles. Save trip and Rename accept a 1–160 character title; blank titles are rejected. **Pass:** two trips can be alternated and each restores its exact contents. |
| TRP-02 **[v1]** | Autosave trip changes with a visible sync indicator. Preserve route geometry, cards, calendar segment, modes, costs, tour, and chat on reload. Use revision conflict handling so a stale tab cannot silently overwrite a newer save. **Pass:** edit, reload, resume, and cross-device reopen agree. |
| TRP-03 **[v1]** | Order My Trips by recent activity. Show active/draft/archived status, current marker, dates, stop count, and updated date. Archived trips can be reopened; pagination reaches old trips. A destructive reset or delete requires a named confirmation and is recoverable for 30 days. **Pass:** a 50-trip account can reach its oldest trip and restore an archived one. |
| TRP-04 **[v1]** | “Clean Sweep” archives the current trip’s chat and route snapshot, creates a new trip conversation, and retains only account-wide preferences and an explicit concise summary if the user chooses it. Undo/redo applies to trip edits, with a bounded persisted history of the latest 20 changes. **Pass:** the new trip contains no prior trip route or raw chat, while the archived trip can be reopened. |
| TRP-05 **[v1]** | One individual account owns multiple independent trips, including trips with identical or overlapping dates. Multiple trips may have active status; only the currently selected editing context is singular. Date overlap alone never blocks creating, saving, activating, or resuming a trip. **Pass:** one individual saves two active trips for June 1–10, switches between them, and reloads both without merging or overwriting either. |

## 3. Planner interface and interaction

### 3.1 Travel Agent panel

| ID | Requirement and pass condition |
| --- | --- |
| CHAT-01 **[v1]** | The left panel header reads “Travel Agent,” links to Planner/Profile, and has Clean Sweep, Undo, and Redo controls. Below is a scrollable conversation; a multiline “Where to?” box and Send button stay at the bottom. The input can be resized, sends on Enter, and inserts a newline on Shift+Enter. **Pass:** a long chat leaves the input reachable and keyboard usable. |
| CHAT-02 **[v1]** | Show visible progress stages such as “Preparing your reply…,” “Planning your trip…,” and “Updating your route…,” plus a timeout/retry state and request reference. Do not hold the input disabled after an error; allow cancellation of a long planning job. **Pass:** a failed AI or route request leaves the saved itinerary intact and permits another message. |
| CHAT-03 **[v1]** | A single trip-scoped conversation spans intake and planner, with retrievable history. The agent sees the active profile, trip, selected calendar segment, stop and leg IDs, renamed card labels, constraints, and current map context. Summarize older history while retaining decisions and recent turns. **Pass:** “the mall near it” and a renamed stop resolve against the active itinerary after reload. |
| CHAT-04 **[v1]** | Classify intent as information/proposal, profile edit, trip edit, or explicit plot/save command. Polite imperatives such as “Can you add this stop?” are edit requests; hypothetical/exploratory questions are proposals. A request to edit the existing itinerary edits it in place and preserves unaffected segments. **Pass:** “Could we visit a mall near the second stop?” gives a proposal; “Add it after the second stop” saves exactly one insertion. |
| CHAT-05 **[v1]** | Parse multiple preferences in one message, including vehicle, MPG, pets, activities, dietary needs, budget, route style, and constraints. Apply corrections, deduplicate notes, and remove preferences when asked. **Pass:** “I have a dog, avoid tolls, and drive an RV” changes all three fields; “Actually no dog” removes the pet constraint. |
| CHAT-06 **[v1]** | Chat can create a trip; insert, remove, rename, or reorder stops; change stay length, time anchors, modes, and dates; and refine one calendar segment. Before a high-impact calendar or reservation change, show a proposed diff and require explicit confirmation. **Pass:** editing a spring week leaves summer and other trip content untouched. |
| CHAT-07 **[v1]** | A success reply identifies what actually changed, the affected stop/segment, and saved state. Never claim a route or profile was updated before the mutation is visible and acknowledged. If input is ambiguous, ask one focused question and preserve the draft. **Pass:** a failed save is reported as failed, with the unchanged itinerary still visible. |
| CHAT-08 **[v1]** | Intake instructions gather a profile without demanding a destination; planner instructions produce grounded trip actions. The agent remembers open-ended needs such as dog-friendly stops and avoids claiming it cannot remember data that is stored in profile/trip memory. **Pass:** a later new trip still applies account-wide needs but not previous trip-specific decisions. |
| CHAT-09 **[v1]** | “New chat topic” starts a fresh conversational thread inside the active trip while retaining resolved profile notes and the saved itinerary. “Clear AI notes” removes account-wide AI note summary and attached quotes after a confirmation, without clearing trip chat. “Clean Sweep” has the separate trip behavior in TRP-04. **Pass:** the three actions have visibly different results after reload. |

### 3.2 Center map and right panel

| ID | Requirement and pass condition |
| --- | --- |
| MAP-01 **[v1]** | The center uses an interactive photorealistic 3D map with stop-number markers, leg geometry, walking connectors, selectable items, pan/zoom/tilt, and a “View Route” fit action. Keep current framing through recalculation unless the user requests a new view. **Pass:** selecting a card focuses the exact stop or both ends of its connector; View Route fits the active trip's complete route, and a separate View selected range action fits a filtered segment. |
| MAP-02 **[v1]** | A map-center “Add This Place” action captures exact GPS latitude/longitude. The insertion dialog offers before/after stop position and independent travel modes for the incoming and outgoing leg. With no itinerary, it creates a standalone first stop. **Pass:** the precise point survives route recalculation, save, export, and tour generation. |
| MAP-03 **[v1]** | Map labels toggle full stop names versus number-only markers; Dim Map reduces visual brightness without changing route colors. Distinct overlapping legs use transparency/layering; hover or keyboard focus highlights the corresponding leg. **Pass:** two overlapping legs remain distinguishable and route colors stay stable under dimming. |
| MAP-04 **[v1]** | Route animation repeatedly traverses all legs and modes, with a labeled speed slider. Hovering a leg pauses the animation and leaving resumes it. Reduced-motion preference disables automatic animation. **Pass:** the animation reaches the last leg and resumes from the paused position. |
| PLAN-01 **[v1]** | The right panel has three tabs: Itinerary, Summary, Tour. The empty Itinerary tab says “Plan a route with multiple stops to see a trip itinerary here” and offers “Add This Place” and “Import an Itinerary.” Tabs retain their state during panel collapse and resize. **Pass:** an empty trip shows no stale cards, and creating a stop changes the empty state. |
| PLAN-02 **[v1]** | Populated Itinerary displays a route-animation speed row; annual/segment focus; custom From/To range, View range, Full year, and Activity days only; then toggles for Map labels, Dim Map, Round Trip, Land/Sea, and Leg modes. A scrollable Route Details region shows every stop and leg in order. **Pass:** filtering hides detail without deleting data or changing saved stop count. |
| PLAN-03 **[v1]** | Stop cards show ordinal role (origin, intermediate, destination), editable name, geographic address or precise coordinate, arrival/departure, stay, lodging/activity, mode-related details, remove action, and schedule anchor control. Leg cards show origin→destination, mode, credible distance/time, cost/fare, and a midpoint waypoint action. Clicking either card focuses its map geometry. **Pass:** rename, reorder, or remove updates cards, map, totals, and saved trip together without re-geocoding a renamed coordinate. |
| PLAN-04 **[v1]** | A persistent action group offers Add Place, View Route, Optimize, Import, Export, and Clear route. Disabled actions explain why. Clear route names what will be removed and supports undo. **Pass:** clearing a route removes all trip route artifacts but preserves account profile and unrelated trips. |
| PLAN-05 **[v1]** | Summary offers annual/season/month/week/day grouping and drill-down cards with hidden-child counts; time range and active-day controls; totals for distance, travel time, start/end, duration, walking, fuel, lodging, fares, and known/unknown cost; MPG and fuel-price fields; and a list of schedule anchors and warnings. **Pass:** a filtered week’s totals reflect that week, while Full year restores the total. |
| PLAN-06 **[v1]** | Tour offers Add View, Import, Export, Clear, Add from Itinerary (Stops/Legs), camera elevation/angle/direction and presets, Play/Next/Stop, Loop, Flyover seconds, Pause seconds, and a reorderable/renamable view list. Controls remain scrollable on small screens. **Pass:** changing playback timing during a running tour affects the next transition without losing the current view. |
| PLAN-07 **[v1]** | The route card stack uses dark rounded cards with a narrow colored route accent. A stop card’s header holds its role and editable name; time action and remove sit opposite the name. Leg cards separate mode, distance, time, cost, and waypoint controls. Long cards expand for address, access, lodging, and schedule detail; collapsed cards retain name, mode, and key totals. **Pass:** a 40-stop plan can be scanned, expanded, and operated without hidden essential actions. |

### 3.3 Mobile layout

| ID | Requirement and pass condition |
| --- | --- |
| MOB-01 **[v1]** | On narrow screens, the map is the primary canvas; chat and planner are accessible through labeled tabs/drawers. A visible itinerary handle allows pulling the card sheet up/down. Both collapsed-panel controls remain reachable. **Pass:** at 390 × 844, a user can open chat, type, open route cards, and return to the map without horizontal scrolling. |
| MOB-02 **[v1]** | At short landscape heights, keep the chat field, Send, panel tabs, and itinerary handle above the browser’s obstructed region; allow internal panel scrolling. Touch targets are at least 44 × 44 CSS pixels. **Pass:** at 844 × 390, keyboard opening does not permanently hide chat input or route cards. |
| MOB-03 **[v1]** | Popups, imports, and Add Place dialogs restore chat focus when closed; ordinary typing, including spaces, works in notes and home address fields. **Pass:** dismissing an insertion dialog leaves the prior unsent chat draft intact. |

## 4. Stops, routing, and travel modes

### 4.1 Stop and route rules

| ID | Requirement and pass condition |
| --- | --- |
| ROUTE-01 **[v1]** | Accept ordered natural-language places, named points of interest, street addresses, latitude/longitude, and plus codes. Resolve local names near the explicit home area or active route context. If a place is ambiguous, show candidates with region and ask the traveler to choose. **Pass:** an unrecognized place is named in a useful error and never erases a valid itinerary. |
| ROUTE-02 **[v1]** | Keep a stable identity for each stop and leg. A display-name edit changes only the label, not its coordinates or place identity. Drag reorder moves the existing stop object. Removing a stop reconnects neighbors only after the replacement leg is calculated successfully. **Pass:** a renamed North Carolina stop never jumps to a same-named city in another state after reorder. |
| ROUTE-03 **[v1]** | Store a precise GPS destination and any nearby road-access point separately. The precise point remains the destination for hiking, boondocking, marina slips, and other remote places; the road point is only a vehicle access aid. Only an explicit coordinate edit or stop reposition changes the destination; routing, snapping an access point, optimization, and renaming cannot move it. **Pass:** every export and tour view retains the latest user-authorized precise coordinate even when a road route uses a nearby address. |
| ROUTE-04 **[v1]** | For a remote GPS stop, create a visibly separate walking access leg between road and precise point, in the correct card order. Show both endpoints and a thick bright dashed connector; where adjacent driving legs have different colors, alternate their colors in the dashes. **Pass:** the same connector is present after reload and after adding more driving legs. |
| ROUTE-05 **[v1]** | If road and precise points are within 20 meters, retain the access metadata but omit the negligible connector/card. For longer connectors, use routed walking geometry when available; otherwise label straight-line distance as provisional. Use yards below one mile and miles above it; never display fictitious one-foot or one-minute values. **Pass:** 15-meter and 200-meter test points differ only in connector presentation, not coordinate retention. |
| ROUTE-06 **[v1]** | Allow a route composed wholly of off-road walking/trail points. Do not insert a road access stop or driving leg unless explicitly requested. Trail-following data is preferred; otherwise show an approximate straight segment with an “unverified trail” label. **Pass:** three off-road GPS points produce two walking legs and no road route. |
| ROUTE-07 **[v1]** | Each leg’s mode is independent. Changing one mode recalculates only that leg and dependent schedule/totals, preserves the other legs, and can be undone. Show modes: Driving, Ferry crossing, Cruising, Flight, Sailing, Paddling/Kayaking, Walking, Bicycling, Public transit, Train, Bus, Hiking, Snowshoeing, Cable car/Gondola, Straight line/Off-road, and Vehicle shipping. **Pass:** switching leg 2 from ferry to driving does not change legs 1 or 3 or retain the ferry fare. |
| ROUTE-08 **[v1]** | Return and round trips explicitly include the return leg and its time/cost. A route with a home default starts and ends at home unless explicit endpoints override it. **Pass:** an explicit one-way route is not silently closed merely because home is configured. |
| ROUTE-09 **[v1]** | Optimize a route using fixed start, fixed end, and the traveler’s selected priority: fastest or shortest. Show a comparison when the shorter option adds little time; respect must-visit order, time anchors, bookings, leg modes, and vehicle constraints. Show progress and Stop for more than ten stops. **Pass:** a 20-stop optimization can be canceled without changing the original order; confirmed output includes every stop. |
| ROUTE-10 **[v1.1]** | Find route-relevant campgrounds, RV parks, public-land stays, hotels, Airbnb alternatives, activities, and support services using budget, pets, accessibility, daily driving, season, and dates. Show source, price/availability freshness, and reservation status. **Pass:** a pet-restricted property is excluded or clearly flagged for a traveler with a dog. |
| ROUTE-11 **[v1]** | Support more than 24 stops, multi-week and full-year planning, and phased/chunked calculation with progress. Never truncate saved stops or report an incorrect count. Group long route cards by phase or region, offer stop search, and bound expanded cards for smooth scrolling. **Pass:** a 40-stop itinerary saves, reloads, searches, and shows all 40 through grouping. |
| ROUTE-12 **[v1]** | Keep a valid saved route visible while a new geocoding/directions request runs. Commit a new route atomically only when required legs and stop identities are resolved; otherwise show retry or partial proposal without replacing the saved state. **Pass:** a provider outage leaves the previous route, geometry, cards, and totals unchanged. |

### 4.2 Marine and multimodal planning

| ID | Requirement and pass condition |
| --- | --- |
| MODE-01 **[v1]** | One trip may combine driving to a marina, boating, kayaking, returning to a parked vehicle, and resuming by road. Track traveler and each vehicle/vessel location separately, including parking, boarding, unloading, and transfer time. **Pass:** a car cannot appear at a different port after a boat leg unless a ferry, vehicle shipping, or explicit relocation leg moves it. |
| MODE-02 **[v1]** | Support port-to-port cruising, marina-to-marina routing, inland waterways, lake kayaking loops, and paddle stops. A verified navigable marine route must use a suitable marine source; otherwise draw an explicitly approximate unverified water connector, never a road route through land. **Pass:** an unsupported water segment carries an unverified label and no claim of safe navigation. |
| MODE-03 **[v1]** | Keep proposed water geometry on water where shoreline and island data permit. Offer editable waypoints, route dragging, optional smooth curves, and manual vessel/paddling speed and break inputs. Invalidate derived times when geometry or speed changes. **Pass:** dragging a waypoint updates distance and provisional duration without inventing fuel for a kayak. |
| MODE-04 **[v1]** | A vehicle ferry has its own duration, fare, boarding/unloading, and vehicle movement. Switching it back to driving removes the ferry fare and recalculates road distance/fuel. **Pass:** no ferry cost remains in either leg or trip total after the switch. |
| MODE-05 **[v1]** | Flight, train, bus, transit, cable car, hiking, snowshoeing, biking, and vehicle shipping have distinct modes, inputs, labels, costs, and duration provenance. A manually entered mode remains provisional until a verified schedule is supplied. **Pass:** an unknown train fare remains “Unknown,” not $0, and is excluded from known total. |
| MODE-06 **[v1.1]** | Suggest coastal ports, marinas, anchorages, fallback ports, weather/tide checks, and current-condition checks as separate categories. Do not represent a suggestion as a confirmed reservation, safe harbor, or live condition. **Pass:** a user sees what still requires navigation/weather verification before departure. |

## 5. Calendar, scheduling, and calculations

### 5.1 Itinerary hierarchy

| ID | Requirement and pass condition |
| --- | --- |
| CAL-01 **[v1]** | The profile owns an annual master calendar. It can contain seasons, months, weeks, days, trips, and custom dated segments, each with a stable ID, parent ID, revision, status, dates, vehicle/mode, region, activities, and child IDs. **Pass:** a broad year outline can be refined into a spring week without replacing the annual plan. |
| CAL-02 **[v1]** | Support mixed seasonal plans, such as winter RV stays, spring/fall van travel, summer boating, and day trips under a season. The active segment is selectable from Profile, Chat, or Itinerary; its name and date window appear in the chat header. **Pass:** switching to Summer changes the agent’s edit scope and visible cards but retains Winter data. |
| CAL-03 **[v1]** | Provide Full year, Season, Month, Week, Day, Trip, and Custom range views. Broad views display summary cards and hidden-child counts; closer views reveal child cards. Date filtering changes visible totals and map focus, not stored data. **Pass:** filtering one week and returning to Full year restores all cards and totals. |
| CAL-04 **[v1]** | Search stops; collapse/expand phases and regions; show a bounded number of detailed cards at once with accessible “show more.” Retain all stop identities and segment edit history. **Pass:** a full-year plan remains scrollable without silently dropping later stops. |
| CAL-05 **[v1]** | Candidate lodging, route options, and dates are proposals. Templates and unbooked plans are separate from confirmed reservations. Show a before/after diff and request explicit user confirmation before changing the master calendar or a confirmed booking. **Pass:** asking “What if I stayed a week longer?” does not change saved dates. |
| CAL-06 **[v1]** | Detect conflicting confirmed commitments, incompatible time anchors, unavailable vehicle locations, and profile constraints. Overlapping trip windows or alternative proposals are allowed and are not themselves execution conflicts. Show affected confirmed activities and suggested resolutions when the same traveler or vehicle is committed incompatibly; preserve both trip drafts. **Pass:** overlapping draft trips save normally; confirming simultaneous use of one RV in distant segments raises a conflict before the conflicting calendar confirmation. |

### 5.2 Time, stays, and totals

| ID | Requirement and pass condition |
| --- | --- |
| TIME-01 **[v1]** | Routes may remain undated. Where a date is required for a calculation, offer tomorrow in the traveler’s time zone as an editable default; do not convert a flexible date window into a booking date. **Pass:** an undated route can be saved and reopened without acquiring a fabricated fixed date. |
| TIME-02 **[v1]** | Allow arrival or departure anchors at multiple stops. Recalculate earlier and later flexible times around them; keep all cards visible; detect impossible anchors and explain the conflict without discarding the last valid schedule. **Pass:** adding a second incompatible anchor shows a warning and preserves both entered constraints for editing. |
| TIME-03 **[v1]** | Display each stop in its destination’s local time zone, including daylight-saving changes, overnight legs, and cross-zone travel. Store instants plus IANA zone IDs. **Pass:** a route crossing Eastern to Central time shows different local clocks while elapsed travel time remains correct. |
| TIME-04 **[v1]** | A stop’s stay accepts minutes, hours, or days. Durations beyond 24 hours display in days and hours; multi-day stays derive nights from date boundaries where lodging is billed nightly. **Pass:** four nights at $120/night produce $480 lodging, not $120 or five nights. |
| TIME-05 **[v1]** | Total distance/time is the sum of included legs; trip elapsed duration includes stops, transfers, and waits. Fuel uses driving miles ÷ vehicle MPG × fuel price per gallon. Ferry/transit fares remain separate from fuel. Round trips include return legs once. **Pass:** switching one driving leg to walking removes only that leg’s fuel. |
| TIME-06 **[v1]** | Distinguish known, provisional, and unknown components. Show a known subtotal and list excluded unknowns; retain original currency per fare and never silently convert or double count it. **Pass:** an unknown lodging rate prevents a false “complete total,” while known fuel and USD fares still sum. |
| TIME-07 **[v1]** | Travelers can enter vehicle-specific MPG and fuel price. If requested, the agent may look up a vehicle MPG or current regional fuel-price estimate and show source/date; an RV or camping rig never inherits a generic small-car value without disclosure. **Pass:** changing MPG updates fuel only, not fare or lodging. |
| TIME-08 **[v1]** | Show realistic daily driving limits and overnight recommendations. A time anchor, stay edit, route recalculation, or date filter invalidates dependent provisional recommendations and recomputes them or marks them stale. **Pass:** a late arrival that breaks a campground opening window raises a warning. |

## 6. Map tour, interoperability, and files

### 6.1 3D map tour

| ID | Requirement and pass condition |
| --- | --- |
| TOUR-01 **[v1]** | A tour is an ordered list of saved views, each tied to a stop, leg, or custom camera position with a readable name and stable reference. “Add from Itinerary” can include stops, legs, or both and must not duplicate the first stop. **Pass:** rebuilding a tour from a four-stop route yields each selected item once. |
| TOUR-02 **[v1]** | Stop-camera settings include elevation above terrain in feet (default 1,000), vertical angle 0–90 degrees (default 45), and compass heading 0–359 degrees (default north/0). Keep the stop centered as these values change; use ground elevation where available. Presets: Overview, Scenic, Close-up, Top-down. **Pass:** Top-down affects leg views too when chosen globally. |
| TOUR-03 **[v1]** | Playback moves between views with editable flyover and pause seconds, Next, Stop, and Loop. Reordering, renaming, previewing, adding a current map view, importing, exporting, and clearing are available. Disable unavailable actions with an explanation. **Pass:** exported views remain playable and retain stop/leg references after import. |
| TOUR-04 **[v1]** | A tour can be generated from an itinerary without replacing the route. It retains precise GPS destinations and readable stop/leg labels. **Pass:** a remote GPS stop’s camera target is its precise coordinate, not its road-access address. |

### 6.2 Import and export

| ID | Requirement and pass condition |
| --- | --- |
| FILE-01 **[v1]** | Native JSON preserves trip metadata, stable references, authored coordinates, modes, user timing/cost inputs, calendar hierarchy, decision summary, and tour. Include provider-derived geometry/measures only when the applicable policy permits their retention/export. Identify omitted/expired data explicitly. **Pass:** with providers disabled, permitted content round-trips after ID remapping; unavailable provider fields remain labeled unresolved without rerouting, fabricated geometry, or loss of authored data. |
| FILE-02 **[v1]** | “Export…” opens a Save As flow with a descriptive default filename. Also support GeoJSON import/export, GPX, KML, and CSV where their formats can represent the data; warn visibly about fields a simpler format cannot preserve. **Pass:** exporting GPX does not claim to preserve chat or bookings. |
| FILE-03 **[v1]** | Preserve exact GPS waypoints when opening a driving route in Google Maps. Explain that off-road walking or marine parts may not be represented there; retain those points in an accompanying export or printable summary. **Pass:** the Google Maps handoff does not silently replace a precise stop with a nearby road address. |
| FILE-04 **[v1]** | Export dated calendar events to iCal. Export marine waypoints in a format compatible with marine navigation apps, with each marine point manually selectable or recognized by location. Label any unverified marine leg. **Pass:** opening the exported calendar in a calendar reader retains the specified instant/time zone, and marine export distinguishes waypoint from road stop. |
| FILE-05 **[v1]** | Accept pasted text, Markdown, JSON, CSV, and uploaded files for profile or itinerary intake. Show a parsed preview with proposed additions/changes, duplicate detection, and ambiguous fields requiring confirmation. A calendar segment can be imported/exported alone while preserving its parent relationship. **Pass:** importing an uncertain reservation never marks it confirmed without approval. |
| FILE-06 **[v1]** | Reject malformed, oversized, or unsafe files with a clear reason; preserve existing data; never execute embedded content. **Pass:** a failed file parse leaves the current trip and profile unchanged. |

## 7. Recommendations and Pro Planner

| ID | Requirement and pass condition |
| --- | --- |
| REC-01 **[v1.1]** | Suggest cheaper flights, lodging, newly available campsites, and better-fitting activities over time, with source, checked time, constraints, and a difference from the current choice. Do not imply real-time availability from stale data. When no permitted automated provider exists, use a Manual watch or source link instead of pretending to monitor. **Pass:** an alert or manual-watch result shows why it is better, when it was checked/logged, and whether it was automated or manual. |
| REC-02 **[v1.1]** | “Fund the Fun” offers relevant income or volunteer leads near a trip segment. Let travelers choose income sources, volunteer types, skills, needed income per day, and suitable stay duration. Treat third-party listings as link-only, unverified leads unless a permitted provider is documented. **Pass:** recommendations match selected skills/dates, identify the source and application requirements, and do not claim guaranteed work, pay, or availability. |
| PRO-01 **[v1.1]** | Pro Planner uses **watch items** for flights, short-term stays, campgrounds, hotels, and rental cars. Every watch has a source link. Automated price checks exist only for a category with a named provider whose current terms permit the use; otherwise the watch is **Manual**, with user-entered prices and reminders. Show only plan-supported cadences (Free monthly, Plus weekly, Pro daily); faster cadences display “Requires a custom plan.” Savings thresholds are $25, $50, $100, or custom. Stop rules are first confirmed booking recorded by the user, 14 days before trip, departure, or manual stop. **Pass:** automated versus manual is explicit, a watch can be paused/resumed/stopped, and no check/reminder occurs after its stop rule. |
| PRO-02 **[v1.1]** | Watch flexibility rules include airports within 0/25/50 miles, dates within 0/±1/±2 days, stays within 0/5/10 miles, same-quality requirement, and refundable-only/preferred/any. v1.1 alert channels are **email and in-app only**. SMS and push are v2. **Pass:** a result outside the selected radius/date window is excluded, and an unavailable channel is never reported delivered. |
| PRO-03 **[v2]** | **v2 transactional requirement.** Rebooking mode may eventually add Ask Before Rebooking or Auto-Rebook Within My Rules, but **no transaction controls are implemented until a supplier agreement and payment processor exist**. Any future automatic mode requires separate explicit enrollment, processor-backed payment authorization, finite maximum extra spend, maximum automatic changes, cancellation rule, and final-approval threshold. **Pass:** before those dependencies exist, there is no booking/cancellation endpoint or UI control that can transact; after implementation, merely selecting Pro interest still cannot authorize a transaction. |
| PRO-04 **[v2]** | **v2 transactional requirement.** Before any future authorized automatic change, recheck price, availability, quality, refund terms, total fees, and cancellation consequences; reconcile uncertain supplier outcomes before retry. Keep receipts and an append-only audit trail. **Pass:** implementation remains Blocked until an authorized supplier and processor exist; once implemented, a failed replacement booking cannot cause cancellation of the old reservation. |
| PRO-05 **[v1.1]** | Show watch history, automated/manual status, source links, alert delivery status, suppressed results and reasons, user-entered price history, and provider uncertainty. A traveler can stop a watch immediately. Do not show rebooking attempts or actual transaction controls in v1.1. **Pass:** stopping a watch prevents its next undispatched automated check/reminder; prior results remain readable. |

## 8. Standalone data and operation contracts

The following are logical contracts. They define behavior and durable information, not a required internal framework, endpoint name, or database column spelling.

### 8.1 Ownership and entities

| ID | Entity | Required information and invariant | Pass |
| --- | --- | --- | --- |
| DATA-01 **[v1]** | Account | Stable account ID, verified email(s), linked sign-in providers, display name, account creation/update times, settings, server-assigned role, and active/suspended status. All private records carry an owner account ID. Cross-account administrative access is confined to the authorized audited operations in Section 11.10. | Ordinary UI/MCP queries for foreign IDs return unavailable with no foreign fields; administrative privileges do not bypass ownership checks on ordinary trip operations. |
| DATA-02 **[v1]** | Profile | One durable account-wide profile with structured intake answers, explicit home address/default, vehicles and MPG, selected preferences, readable resolved summary, AI notes with selected quote references, optional annual calendar, update time, and revision. | Editing the profile in one trip updates the account profile and does not copy another trip’s chat into it. |
| DATA-03 **[v1]** | Trip | Stable ID; owner; title; draft/active/archived status; timestamps; revision; trip brief; selected calendar segment; itinerary; conversation; summary; archive; tour; and save state. The account has zero or one selected-trip pointer; this selection is separate from lifecycle status. | Refresh and account switch restore only the selected accessible trip; selecting a trip does not overwrite another trip's lifecycle status. |
| DATA-04 **[v1]** | Stop | Stable ID, order, display name, place identity, formatted address, precise coordinate, optional road-access coordinate and distance, arrival/departure instants and zone, stay, lodging/activity/reservation status, source, and revision. | Rename/reorder/export never alters its coordinate or identity. |
| DATA-05 **[v1]** | Leg | Stable ID, from/to stop IDs, mode, geometry, distance/time with source and verification status, mode-specific details, fare/fuel, transfer and break time, color, and revision. | An edit to one leg does not replace unrelated legs. |
| DATA-06 **[v1]** | Calendar segment | Stable ID, parent ID, level (annual/season/month/week/day/trip/custom), title, date window, status, mode/vehicle, related stop and activity IDs, child IDs, revision, and conflict state. | Child editing retains parent and sibling links. |
| DATA-07 **[v1]** | Chat record | Trip ID, ordered messages, timestamps, role, action classification, associated saved mutation IDs, compacted summary, and archived history. Account-wide profile notes are stored separately. | New trip starts without old raw messages but still reads account preferences. |
| DATA-08 **[v1]** | Tour view | Trip ID, stable view ID, order, name, kind (stop/leg/custom), referenced item ID, precise camera target, elevation, angle, heading, flyover/pause, and revision. | A renamed stop remains associated with its tour view. |
| DATA-09 **[v1]** | Proposal/reservation | Stable ID, trip/segment association, proposed versus confirmed status, provider/source, price/currency, availability checked time, constraints, confirmation or booking evidence, cancellation terms, and audit history. | A generated lodging suggestion cannot be mistaken for a confirmed booking. |
| DATA-10 **[v1.1]** | Pro watch | Owner, target/provider or manual-source identifiers, automated/manual mode, schedule, flexibility/threshold rules, notification channels, current status, last check/logged price, result history, and audit records. Transaction authorization is not present in v1.1. | One account cannot read or operate another account’s watch. |

### 8.2 Shared operation semantics

| ID | Operation | Input → durable output | Failure and pass condition |
| --- | --- | --- | --- |
| OP-01 **[v1]** | Register/sign in/link provider | Verified identity → one account and session; linking adds a provider to the signed-in account. | Invalid credentials, unverified email, expired callback, or provider conflict produce actionable messages without exposing whether an unrelated account exists. |
| OP-02 **[v1]** | Read/update profile | Authenticated account, required expected revision for updates, and validated field patch → new profile revision and saved timestamp. | On revision conflict, return current revision and field-level comparison; do not overwrite silently. |
| OP-03 **[v1]** | Create/list/activate/update/archive trip | Owner and validated title/status/changes → owner-scoped trip plus revision. Listing is newest-first with cursor pagination. | Foreign or missing trip is unavailable; stale write returns a conflict and leaves stored trip intact. |
| OP-04 **[v1]** | Apply itinerary action | Active trip, expected revision, action (create/insert/remove/rename/reorder/change mode/stay/anchor/segment), affected stable IDs → new coherent itinerary and mutation record. | Validate affected IDs and constraints; calculate the necessary replacement geometry first; commit atomically or preserve the old itinerary. |
| OP-05 **[v1]** | Send AI message | Authenticated owner, trip/segment, message, expected revision, idempotency token → reply, classified actions/proposal, and mutation acknowledgment if saved. | Reject empty/oversized text, rate-limit overload, cancel safely, and return a request reference for server/provider failures. Replayed token cannot apply an edit twice. |
| OP-06 **[v1]** | Import/preview/commit | Authenticated owner and supported file/text → parsed proposal with warnings and field diffs; confirmation → one versioned update. | Parse or validation failure makes no mutation. Ambiguous profile/calendar/reservation fields require selection before commit. |
| OP-07 **[v1]** | Export | Owner and requested format/segment → downloadable file or external handoff with explicit loss warnings. | Unsupported fields are declared; private content is never sent to a third party merely by opening an export menu. |
| OP-08 **[v1.1]** | Start/stop watch | Owner and watch rules → persisted schedule/status. Automated checks dispatch only for categories with a permitted provider; manual watches schedule reminders without scraping. Rebooking authorization is deferred to PRO-03/PRO-04 v2 and is not part of this operation. | Stopping the watch prevents the next undispatched check/reminder; no v1.1 path can book, cancel, or charge. |

### 8.3 Validation, state, and failure rules

| ID | Requirement and pass condition |
| --- | --- |
| RULE-01 **[v1]** | Store latitude in −90…90 and longitude in −180…180; reject non-finite values. Distances and durations cannot be negative. Currency values use decimal money precision and ISO currency codes. **Pass:** an invalid import reports its exact field and leaves data unchanged. |
| RULE-02 **[v1]** | Dates use an unambiguous calendar date; scheduled instants retain time zone. A flexible window is stored separately from a fixed start. A stay may be zero minutes; a lodging charge requires an explicit pricing basis and amount, plus a night count when priced per night. **Pass:** a cross-zone overnight stays on the correct local dates and a flat stay price is never multiplied by its night count. |
| RULE-03 **[v1]** | A route may have zero or one stop. A complete leg needs two valid endpoints. Removing a stop from a two-stop route leaves a one-stop draft with no leg; removing its final stop restores the empty state. All removals are undoable. **Pass:** a one-stop draft saves without fabricated travel values, and every stop can be removed individually. |
| RULE-04 **[v1]** | Never collapse unknown into zero. All derived route and cost values carry known, provisional, stale, or unknown status and a source/check time where external. **Pass:** a stale marine duration is visibly marked after a waypoint edit. |
| RULE-05 **[v1]** | Separate account-wide data from trip-wide data and selected-segment state. Clear in-memory and browser-cached private data on sign-out/account switch. Encrypt transport; restrict secrets and tokens to server-side handling. **Pass:** another account sees neither cached UI nor endpoint data from the prior user. |
| RULE-06 **[v1]** | Retryable errors preserve forms, unsent chat drafts, uploaded previews, and the last confirmed itinerary. Show a human-readable explanation, Retry, and a request ID for server failures. **Pass:** after timeout, the traveler can retry without re-entering the entire message. |
| RULE-07 **[v1]** | Confirmed calendar changes require an explicit, reviewable action. v1/v1.1 expose **no supplier transaction endpoint**: proposals, alerts, imports, AI replies, MCP calls, and source links cannot book, cancel, or charge. If a v2 transaction path is later implemented, it requires the separate PRO-03/PRO-04 authorization and recheck rules. Unverified sources are labeled. **Pass:** a proposal or answer alone never books, cancels, charges, or rewrites a confirmed segment. |
| RULE-08 **[v1]** | Authentication includes email verification, password reset, explicit logout/session revocation, secure password hashing, and account linking. Auth redirects accept only same-app paths. **Pass:** a crafted external return URL cannot redirect a completed sign-in away from the app. |
| RULE-09 **[v1]** | AI and geocoding inputs are bounded and validated. User text and imported content are treated as data; they cannot override system permissions, reveal keys, or invoke unauthorized operations. **Pass:** a malicious imported instruction cannot cause a booking, data export, or cross-account read. |
| RULE-10 **[v1]** | Autosave is debounced for text edits but gives immediate pending state; navigation and account switch await or safely cancel pending writes. Draft state is isolated per account and trip. **Pass:** fast editing followed by account switch neither leaks nor loses a confirmed change. |
| RULE-11 **[v1]** | In low-signal mode, previously loaded profile/trip views, PDF generation, copy actions, and unsent drafts remain usable in an already authenticated session from an owner-scoped local cache. Clear that cache on logout/account change; do not advertise browser storage as encrypted unless encryption and key handling are actually implemented. Queue only profile text, trip titles, and notes; provider-dependent edits remain unsent drafts. Reconcile using the base revision on reconnect. **Pass:** disconnection still allows a profile PDF and never marks a queued edit “Saved.” |
| RULE-12 **[v1]** | Enforce the provenance and permitted-use contract in Section 11.22 for every stored/exported coordinate, address, route component, and measurement, including native JSON, CSV, account export, local caches, undo, diagnostics, and video. User positioning policy is independent of data origin. Record official API-specific terms, permitted purposes/retention/export, and a dated decision before durable provider-data design. Refreshing data never itself grants export rights. **Pass:** expiry removes restricted values from active/history/cache copies without deleting authored destinations, while native export remains valid and clearly identifies unavailable provider fields; no disallowed geometry enters any export. |

## 9. Exact choice catalog and review surfaces

These labels and choices are part of the clone’s functional UI. Other languages may be added later, but English is the required baseline.

| ID | Field group | Choices, reveal, and rule | Pass |
| --- | --- | --- | --- |
| OPT-01 **[v1]** | Travel season and party | Spring, Summer, Fall, Winter, Year-round; Solo, Couple, Friends, Family, Grandparents + Grandkids, Large Group, Custom Group Size; age groups Children 0–12, Teens 13–17, Adults 18–64, Seniors 65+. Count is a positive integer when supplied. | Changing party size does not delete selected age groups. |
| OPT-02 **[v1]** | Budget and comfort | Free/Minimal Cost, Budget, Moderate, Comfort, Luxury; amount as nonnegative money; per-person or total; daily, weekly, monthly, or full-trip basis. Comfort slider labels: Rugged/Survival, Minimalist, Balanced, Comfortable, Luxury, Ultra-Luxury. Splurge amount uses per-person/total and per-day/per-week/per-month/per-event, frequencies Once per Trip/Month/Week, Every Few Days, Whenever Available, and types Accommodation, Experience, Comfort, Transportation upgrade. | Summary states the amount and basis; $100 per person is not treated as $100 for a group. |
| OPT-03 **[v1]** | Activities and pets | Activities are grouped as Adventurous (hiking/backpacking, camping, climbing, scuba/snorkeling, skiing/snowboarding, extreme sports, sailing/boating, fishing, kayaking, biking, off-roading), Relaxing (nature walks, spa/hot springs, beach leisure, scenic cruises, wellness, swimming, stargazing), Culture (guided tours, historical sites, local food, festivals, bowling, volunteer travel, photography, wildlife watching), and Supportive (community meals, local resources). Pets: Dog, Small Dog, Large Dog, Cat, Other. | A selected pet filters stays and appears in readable profile prose. |
| OPT-04 **[v1]** | Advanced route and comfort | Accessibility: Mobility-Friendly Only, Low-Impact Activities, No Restrictions. Hookups: Yes, Nice to Have, No. Climate: Warm, Cold, Seasonal, No Preference. Terrain: Coastal, Mountains, Forest, Urban, Mixed. Sustainability: Budget First, Balanced, Eco-Priority. Planning: Fully Structured, Flexible Framework, Highly Spontaneous. Budget sensitivity: Strict, Flexible, Optimized. | A strict budget is never silently exceeded by a recommendation. |
| OPT-05 **[v1]** | Advanced travel constraints | Preferred transport: Flight, Train, Bus, Car Rental, RV, Boat. Scope: Domestic Only or International Allowed. Window: Fixed or Flexible Dates. Risk: Low Risk, Moderate Adventure, High Adrenaline. Capacity: Sedentary, Moderately Active, High Endurance, Elite/Extreme. Horizon: under 30 days, 1–3 months, 3–12 months, Long-Term/Open-Ended. Legal/safety: Legal Camping Only, Permit Alerts Required, Insurance Recommendations, No Special Requirements. Emotional goals: Recharge/Rest, Family Bonding, Achievement/Challenge, Escape/Reset, Status/Premium, Simplicity/Minimalism. | Route and activity suggestions respect the selected safety and physical constraints. |
| OPT-06 **[v1.1]** | Income and volunteering | Paths: Earn Income, Volunteer. Possible sources: TaskRabbit, Rover, Fiverr, Wonolo, Nextdoor, Hyper-Local Gig Boards. Volunteer categories: Conservation, Community Food Banks, Shelter Assistance, Park Maintenance. Skills: Pet Care, Handyman/Repairs, Cleaning/Turnover, Writing/Marketing, Design/Creative, Admin/Virtual Assistant, Food Service, Outdoor Labor, Community Support. Stay fit: Same Day, 1–3 Days, 4–7 Days, 1–2 Weeks, Flexible/Longer. | A recommendation labels provider, eligibility, location, and the fact that pay or availability is unverified until checked. |
| OPT-07 **[v1.1]** | Pro watches | Targets Flights/Airbnb or Short-Term Stays/Campgrounds/Hotels/Rental Cars; cadence is Monthly on Free, Weekly on Plus, Daily on Pro; faster choices display Requires a custom plan. Alert threshold $25/$50/$100/Custom; stop rule After First Booking Recorded/Until 14 Days Before Trip/Until Departure/Manual Stop. Flexibility: nearby airports No/25/50 miles; dates No/±1/±2 days; nearby stays No/5/10 miles; same-or-better quality Yes/No; refundable/flexible only Yes/Prefer Yes/No. Channels in v1.1: Email and In-app. Rebooking/payment/cancellation controls are absent. | Profile review and an active watch show every chosen guardrail and whether the watch is automated or manual. |
| OPT-08 **[v1→v1.1]** | Profile review and transfer | **v1 sections:** Trip Basics, Preferences & Overnight Setup, Annual Master Calendar, Advanced Filters, Travel Agent Summary. **v1.1 additions:** Pro Planner and Fund the Fun. Actions: Edit, Open Route Planner with Profile, Clear Travel Agent Summary, Copy Route Planner Link, Copy Profile Text, Download Detailed PDF. Unsaved/ambiguous intake uses a transfer preview. | PDF/copy work from available permitted local data; future sections do not appear as dead controls. Explicit transfer resolves unsaved fields before opening Planner. |
| OPT-09 **[v1]** | Map context menu | Right-click or Shift+click on the map opens a small menu with coordinates, formatted location when available, plus code/GeoJSON representation where available, Copy actions, and Add as stop. A normal click outside closes it. | Copy yields the displayed value and Add as stop opens placement without moving the map target. |
| OPT-10 **[v1]** | Export menu | Show Open in Google Maps, JSON, GPX, KML, GeoJSON, CSV, Marine Waypoints, Google Calendar, and iCal. The menu uses plain format descriptions and the loss warning described in FILE-02. | Every menu entry either produces its format or clearly explains what is unavailable. |

## 10. End-to-end acceptance journeys

The Pass clauses above are the fine-grained acceptance criteria. The following journeys must also pass as connected workflows using fictional data and two test accounts.

| ID | Journey | Required observable result |
| --- | --- | --- |
| FLOW-01 **[v1]** | Create an email account, verify it, fill home/vehicle/pet preferences, review profile, download PDF, link Google, sign out, and return through Google. | One account, one durable profile, latest PDF content, no duplicate identity. |
| FLOW-02 **[v1]** | Start Trip A, create a route, rename/reorder a precise GPS stop, add a walking connector and ferry leg, set two time anchors, save, then start Trip B. | Trip B is blank but knows account preferences; Trip A reloads exact stop identities, geometry, anchors, chat, costs, and tour. |
| FLOW-03 **[v1]** | Switch from account A to B while A’s planner is open; open B’s active trip; switch back. | No flash, cache, endpoint response, or file export exposes the other account’s private data. |
| FLOW-04 **[v1]** | Ask the agent for options, then explicitly add one option, correct a preference, and ask a follow-up using a renamed stop. | Proposal does not mutate; explicit add makes one saved edit; correction removes contradiction; follow-up targets the existing stop. |
| FLOW-05 **[v1]** | Build a 40-stop annual plan with winter RV, spring van, summer boating, and a daily kayak loop; filter a week and refine one segment. | Full stop count and parent-child structure remain; filtered totals are scoped; other segments do not change. |
| FLOW-06 **[v1]** | Import a synthetic export-permitted native trip, edit a leg, export supported formats, and reimport native JSON. Repeat with an expired provider-only field. | Authored/permitted data round-trips after ID remapping; restricted fields have explicit omissions and unresolved status. GPS, hierarchy and marine uncertainty survive where supported, with no disallowed content or silent reroute. |
| FLOW-07 **[v1]** | Simulate failed geocoding, AI timeout, route-provider outage, stale revision, and invalid import. | The last confirmed route remains; each error is actionable and retryable; no false success message appears. |
| FLOW-08 **[v1.1]** | Configure one automated watch where a permitted test provider exists and one Manual watch from a source link; inspect a cheaper lodging result and stop both watches. | Automated/manual labeling is correct, alert constraints are respected, manual prices are user-entered, stopping prevents later checks/reminders, and no booking/cancellation/payment control exists. |
| FLOW-09 **[v1]** | Complete intake, planner chat, itinerary editing, map tour, and trip resume at desktop, portrait mobile, and short landscape mobile. | All controls are readable, keyboard/touch reachable, and maintain state across panel changes. |
| FLOW-10 **[v1]** | Owner appoints an admin; admin finds a failed prompt and an AI edit later undone, reviews the cases, and exports the selected records. | Role enforcement, origin correlation, redaction, review history, and export auditing work together; an ordinary user cannot access them. |
| FLOW-11 **[v1]** | Generate chat, mapping, retry, failed-call, and synthetic future-task usage events for two users; inspect every time scale and filter by user/task. | Dashboard, user detail, event drill-down, and exports agree; non-token API requests, synthetic monitor/video categories, and unknown token reports remain distinct without requiring v1.1 workers. |
| FLOW-12 **[v1.1]** | Use a scoped external MCP client to create, read, edit, export, and undo a trip with no planner UI open; then open the UI and revoke the credential. | Canonical saved data agrees across both interfaces; subsequent MCP access fails; ownership and confirmation rules hold throughout. |
| FLOW-13 **[v1]** | Switch 3D → 2D Map → 2D Satellite, drag a road stop, drag an exact land point and water point, undo, reload, and return to 3D. | Road snapping follows the threshold; exact points remain at their drops; identities, modes, connectors, totals, and tour targets stay coherent. |

## 11. Detailed build contracts

The defaults in this section resolve choices that would otherwise produce incompatible clones. They elaborate the existing requirement IDs; they do not depend on legacy code or additional documents.

### 11.1 Navigation, guests, and authentication (NAV, ACC, TRP)

| URL | Access and deterministic result |
| --- | --- |
| / | Guest: intake. Authenticated with selected nontrashed trip: redirect to that trip. Otherwise: intake. Do not create a trip merely to redirect. |
| /onboarding | Public editable intake. Guest answers stay on this device; account answers use autosave. An explicit Open Planner creates a trip only if none is selected. |
| /profile | Authentication required. Preserve the destination through sign-in. Show account-wide profile and links to review/edit. |
| /profile/review | Guest or account profile review, PDF, copy, and transfer preview. A guest sees “Saved on this device” and “Sign in to sync.” |
| /trips | Authentication required; library defaults to nonarchived trips, with Archived and Trash views. |
| /planner | Redirect to the selected trip; if none, show “Start a new trip” with a New trip button. |
| /planner/{tripId} | Authentication and ownership required. Load the saved snapshot once; restore view state without creating stops or sending AI prompts. |
| /trails | Public discovery search. Adding a result requires an owned trip, or sign-in and explicit New trip. /explore redirects here. |
| /auth | Sign-in by default, switchable to sign-up. Allow only a validated same-app next destination. |
| /auth/verify, /auth/forgot-password, /auth/reset-password, /auth/set-password | Email verification, reset request, token reset, and adding a password to an authenticated Google account. /profile/auth redirects to /auth. |
| Any unmatched path | Branded not-found state. Preserve a browser Back option and show navigation home. |

Use Neon Auth for Google and email/password identity. Provider subjects, not email strings, identify accounts. Link a new method only from an authenticated session with recent reauthentication; matching email alone never merges accounts. Prevent unlinking the last usable method. On password reset, revoke existing application sessions. Do not log reset tokens or embed profile content in links.

Guest intake never triggers live chat or writes to an account. At sign-in, compare the guest draft with the account profile and show selected field changes; default to preserving the account. “Use guest answers” applies only the explicitly selected fields. A copied Planner link contains an opaque trip identifier and requires ownership authentication; it is not a public share link and grants no access.

Trip library pages contain 20 entries, ordered by updated time descending and stable ID as the tie-breaker. Rename trims outer whitespace and rejects an empty or over-160-character value. New trip uses “New trip”; name collisions are allowed. Selecting an archived trip offers Reopen; it becomes active without changing unrelated trips. Reset library moves all trips to Trash and clears the selection only after an explicit confirmation. Trash retains records for 30 days and supports Restore; restored titles/contents are retained. Permanent deletion is a separate, clearly labeled action. The clone never performs a bulk reset from chat without a review dialog.

### 11.2 Visual construction and control details (UI, IN, PLAN, MOB, OPT)

**Typography and dimensions.** Body text uses Manrope 14/22 pixels, form inputs 16/24 pixels, small metadata 12/18 pixels. Fraunces page titles use 36/43 pixels desktop and 28/34 pixels mobile; intake hero uses 60/66 and 36/42 pixels respectively. Display weights are 600–700. Use 1-pixel white-at-12%-opacity borders, a 2-pixel amber focus ring with 2-pixel offset, 12-pixel control radii, 20-pixel card radii, and 24-pixel main-panel padding. Error red is #fca5a5, success teal is #5eead4. Bright accents are paired with near-black text when filled.

The global nonplanner header is 72 pixels tall, 56 on mobile. Profile content is centered at a maximum width of 1152 pixels with a 256-pixel identity rail and 24-pixel gutter; below 768 pixels the rail becomes a compact top card. My Trips uses the same maximum width with a title block beside the library at desktop and above it on mobile. Intake uses an 896-pixel maximum form width, a 32-pixel top margin below the step strip, and 20-pixel side gutters on phones. Selected selection cards have an amber border, tinted fill, and a check indicator; multiple selection is indicated in the label.

The planner fills the usable viewport; its top title/version strip is 32 pixels tall. At widths of at least 1024 pixels, chat and right panel initially use 28% and 32% of the remaining width, each clamped to at least 280 pixels while retaining at least 360 pixels for the map. Shrink sidebars first if those constraints compete. At 768–1023 pixels, show the map plus one 320-pixel panel chosen by Chat/Itinerary/Summary/Tour tabs; chat and itinerary do not simultaneously obscure the map. Below 768 pixels, use one bottom sheet with those four tabs; snap it to 64 pixels, 45% height, or 90% height. The visible handle is 44 pixels wide and also works as a keyboard button that cycles snap positions. Opening chat with the software keyboard expands the sheet within the visual viewport; closing it restores the prior position. Desktop panel widths and mobile snap position are local presentation preferences, not trip content.

Inputs, dropdowns, and dialogs use visible labels. Standard dialogs are 560 pixels wide maximum, fit within 16-pixel phone margins, and scroll internally. Escape cancels a dialog and preserves the unsaved draft unless the dialog explicitly discards it. Focus returns to the invoker, or to chat if the invoker no longer exists. Tabs use arrow keys; Enter/Space activates controls. Drag reorder has keyboard Move up/Move down equivalents. Hover-only content is also available by keyboard focus or tap.

**Defaults and field rules.** An unanswered field is unset, including boolean answers. A displayed suggestion is not saved until selected. Start/destination/home default blank; the home endpoint switch defaults off; a route is undated; no vehicle, currency estimate, MPG, or fuel price is inferred. Budget detail may suggest 50 USD per person per day and Balanced comfort, but these remain suggestions until accepted. Travel constraints are soft preferences unless labeled Must/Strict or explicitly stated as a requirement. Selecting No pets is an explicit answer. “Other” fields allow a 200-character description; notes allow 10,000 characters. Trip length accepts 1–3660 days and is optional; party count accepts 1–999.

Profile completion uses three equally weighted categories: Traveler (party composition plus explicit pets yes/no), Vehicle (at least one selected mode, including On Foot/Transit), and Preferences (at least one overnight type, activity, or budget level). Display 0%, 33%, 67%, or 100% by rounding completed categories divided by three; advanced answers never reduce completion or prevent planning. A 100% label means “Core profile complete,” not that every optional question was answered.

**Modal and secondary controls.**

| Surface | Exact behavior |
| --- | --- |
| Add Place | Show captured coordinate/name, “Before stop” or “After stop” position selector, incoming/outgoing mode selectors, Add, and Cancel. Disable the irrelevant mode selector at the first/last position. Captured coordinates do not move if the map moves behind the dialog. |
| Stop rename | Enter commits the trimmed name; Escape restores it. A blank name is rejected. Do not change coordinates or trigger geocoding. |
| Schedule drawer | Arrival/Departure radio choice, date, local time, explicit zone, Stay amount/unit, Apply, Remove anchor, and Cancel. Show conflicts before replacing a valid schedule. |
| Optimize | Select fixed first/last stop, Fastest/Shortest, and retained order locks. Show current versus proposed distance/time and changed stop order, then Apply or Cancel. Computation exposes Stop. |
| Import preview | Show file/format, target New trip/Replace trip/Add to segment, stop count, date range, duplicates, changed fields, omissions, and ambiguous items. Confirm stays disabled while required ambiguity is unresolved. |
| Clear route | State that stops, legs, anchors, and route-generated tour views will be cleared; preserve chat and account profile. Offer Clear and Cancel. Custom map views stay unless separately cleared. |
| Map context | Show decimal degrees, degrees/minutes/seconds, and a GeoJSON point with longitude first. Each has Copy. Include plus code if available and Add as stop. Long-press exposes the same menu on touch. |
| Notifications | Success toasts dismiss after 4 seconds; failures persist until dismissed or resolved. Autosave state remains next to the relevant form. Notifications never cover mobile Send or the drawer handle. |

Use the exact copy “Saved,” “Saving…,” “Saved on this device,” “Offline — changes pending,” and “Could not save. Retry.” For a missing or foreign trip use “This trip is unavailable” with My Trips. Provider errors name the unavailable capability and preserve the current content. Do not display stack traces, database details, or raw AI action payloads.

The “Land/Sea” display switch reveals Land and Sea buttons on stop cards; it never switches a leg's mode by itself. Selecting a stop designation persists its marine flag and affects marine-waypoint export eligibility. Unknown designation is shown as “Not classified” until explicitly set or resolved from verified location data. “Leg modes” shows/hides the inline per-leg selectors without altering their values; expanded leg details always retain mode editing. Both display switches default off. Map labels default to full names; Dim Map defaults off. **Acceptance for PLAN-02/MODE-01/FILE-05:** toggle visibility twice without any itinerary revision or mode change; then designate one stop Sea and verify that only its classification and export eligibility change.

The profile Travel Agent is a 360-pixel side panel that reduces the remaining content width on desktop, with Chat/Profile tabs and a close button; it does not dim or block the underlying page. Below 768 pixels it uses the same accessible sheet pattern as planner chat, with only those two tabs. Profile PDF uses US Letter portrait, 36-point margins, 11-point dark body text on white, 16-point section headings, and page numbers. Repeat table headings across pages, keep headings with at least two content lines, wrap long quotes/URLs, and split long notes cleanly. Include the saved revision time and all review sections in OPT-08, omit secrets, and exclude raw chat beyond selected supporting quotes. If an edit is still saving, wait for acknowledgment or explicitly export the labeled local draft; never quietly export an older revision. **Acceptance for ACC-03/ACC-05/OPT-08:** inspect a PDF containing a three-page note, long quote, and latest pet edit; all content is readable and the saved revision matches the screen.

### 11.3 Canonical state and ownership (DATA, CAL, RULE)

Use one normalized durable model and derive screen summaries from it. A selected segment or filtered view is never a second independently editable copy of an itinerary.

| Record | Cardinality, minimum fields, and allowed state |
| --- | --- |
| Profile | One per account. Revision is a nonnegative integer. Each intake answer retains value, answered/unset state, scope, and updated time. Profile notes retain note ID, current text, origin (user/AI), selected quote IDs, and whether the user removed the note. |
| Vehicle/vessel | Many per account. Stable ID, name, type, owned/rented, propulsion, MPG or consumption unit, dimensions when supplied, current known location, and location verification time. Missing fuel inputs stay null. |
| Trip | Many per account. Owns ordered stop IDs, leg IDs, trip-level overrides, current topic, tour, mutation history, and selected view. Lifecycle draft/active/archived is independent from the account's selected-trip ID. Trash is a separate deletion timestamp. |
| Stop and leg | A stop belongs to one trip; a leg joins consecutive stops in that trip. Distinct visits to the same coordinates are distinct stop IDs. A leg has primary travel plus zero or more ordered access/transfer components. Each component has its own geometry, timing, mode, and cost. |
| Annual calendar | One per account per year, with an explicit calendar time zone selected initially from the browser's IANA zone. Owns a hierarchy of segments and scheduled activities. Cross-year trips can be referenced by more than one annual view without duplicating the trip. |
| Segment | Has one parent or is a root. Parent/child links form an acyclic tree; IDs do not change when dates or titles change. Annual/season/month/week/day are grouping levels, while trip/custom segments may sit under the relevant group. |
| Activity | Stable ID, kind (stay/travel/storage/handoff/maintenance/provisioning/work/event), title, time window/precision, traveler and vehicle IDs, segment ID, and optional trip/stop/leg reference. Status is idea/provisional/confirmed/complete. A booking confirmation is separate evidence, never implied by activity status alone. |
| Conversation topic | Belongs to an account and either a trip or profile-intake scope. Contains ordered messages, summary, quote links, and archived flag. Intake attaches to the explicitly created trip when the user transfers; it is not copied into every future trip. |
| Proposal | Owns a before/after change set, affected IDs, expected revisions, reason, expiry where applicable, and status pending/applied/rejected/expired. Applied proposals retain their committed operation ID. |
| Booking record | Manual/imported evidence only in v1/v1.1: provider reference when supplied, supplier, traveler/vehicle scope, dates/zone, price components, currency, refund/cancellation terms, confirmed evidence, and lifecycle planned/confirmed/canceled/unknown. Import cannot perform a booking or cancellation. v2 may extend this record for transactional reconciliation. |

The master calendar references the same trip stops/legs; it does not own duplicate coordinates or costs. An edit made through a calendar segment updates the referenced trip after the required confirmation. An edit to a linked trip that would move confirmed master-calendar dates creates a calendar change proposal before commit. The old calendar and trip remain consistent until the combined transaction succeeds.

Values use meters, seconds, decimal degrees, liters or normalized fuel-consumption values, and ISO currency internally. v1 displays miles, yards, feet, US gallons, °F, and US-style local dates for the English baseline. v1.1 adds the profile `units` setting (`imperial` or `metric`) to switch display/input to km, liters, L/100km, °C, and locale-appropriate date formatting without changing stored canonical values. For unknown scalar values use null, never an empty string or zero. A measurement records value, unit, status (known/provisional/stale/unknown), origin (user/provider/calculated), checked time, and dependency revision. “Known” is not a guarantee of real-world safety. AI narrative alone cannot establish verified availability, a reservation, or navigable water.

**Profile and trip field dictionary.** The following field identifiers are the independent interchange vocabulary. Internal storage can differ. Choice values in version 1 are the exact English labels in Section 9 and the intake choices; an adapter can map them to internal enums. Multi-choice values are deduplicated arrays in displayed order. Unset scalar answers use null and unset lists use an empty array, with answered=false distinguishing an unanswered list from an explicitly cleared one.

| Group and scope | Fields and meaning |
| --- | --- |
| Account location | homeAddress (text), homePoint (resolved point or null), alwaysBeginEndAtHome (boolean). Resolving text preserves both the entered text and selected point; no match means point null and a visible resolution warning. |
| Locale/display | `units` is `imperial` or `metric` (v1.1; default `imperial`). Currency stays per Money object; this setting never silently converts stored monetary values. |
| Trip basics | startLocation, destination (text or selected place); tripLengthDays (integer); startDate/endDate (date or null); travelWindow (Fixed Dates/Flexible Dates); notes (text). New trip clears these even if an earlier intake contained them. |
| Account traveler defaults | groupComposition (choice), travelerCount (integer), ageGroups (multi-choice), hasPets (nullable boolean), petTypes (multi-choice), preferredRegions (text array), dietaryRequirements (text), specialRequirements (text). Each can be overridden for one trip explicitly. |
| Account travel defaults | travelModes (multi-choice), travelSeason (choice), overnightPreferences (multi-choice), activities (multi-choice), drivingPace (Fastest/Balanced/Scenic), maxDrivingHoursPerDay (positive number up to 24 or null). A new trip reads these defaults but does not store a duplicate independently edited profile. |
| Budget | budgetLevel, budgetMode (per_person/total), budgetTimeframe (daily/weekly/monthly/full_trip), budgetAmount (decimal string), budgetCurrency (ISO code), comfortLevel (integer 0–5 in catalog order). These are account defaults with explicit trip override support. |
| Splurge | allowSplurge (nullable boolean), splurgeAmount/currency, splurgeMode (per_person/total), splurgeTimeframe (per_day/per_week/per_month/per_event), splurgeFrequency (choice), splurgeTypes (multi-choice). Hidden splurge detail remains stored when disabled but is inactive. |
| Support | needsSameDayOvernight, needsFoodAccess, needsFacilities, needsWalkableTransit, includeSupportServices (nullable booleans). The first is trip-specific; other support preferences can be saved account-wide after the user states that scope. |
| Route constraints | avoidHighways, preferScenic, avoidTolls, avoidMountainRoutes (nullable booleans); accessibility, needHookups, sustainability, planningStyle, budgetSensitivity (choices). Account defaults with explicit trip overrides. |
| Broader travel | departureLocation (trip text), preferredTransport (multi-choice), travelScope, climate, travelWindow, riskTolerance, physicalCapacity, planningHorizon (choices), willingToReposition and comparisonMode (nullable booleans), terrain/incomeOffsets/legalSafety/emotionalGoals (multi-choice). Date/window and departure choices are trip-specific; the rest are account defaults. |
| Pro watch preference template | `proPlannerInterested` (boolean), `recurringChecks` (boolean), `monitoringTargets` (multi-choice), `monitoringFrequency`/`monitoringStopRule`/`refundableOnly` (choices), `alertSavingsThreshold` (money plus currency), `nearbyAirportFlexibility`/`nearbyStayFlexibility` (miles), `dateFlexibility` (integer days), `keepSameQuality` (boolean), and `alertChannels` (multi-choice). v1.1 channels are email/in-app. No payment, automatic-change, cancellation, or stored-payment fields exist before v2. |
| Fund the Fun | fundTheFunEnabled (boolean), fundTheFunPaths/fundTheFunIncomeSources/fundTheFunVolunteerPrograms/fundTheFunSkills (multi-choice), incomeNeededPerDay (money plus currency), fundTheFunSkillNotes (text), fundTheFunStayDuration (choice). Store as account preferences; current opportunity matches belong to the selected trip. |

For a typed money input, use an object with amount (nonnegative decimal string, or null when unknown) and currency (three-letter ISO code). The table's “money plus currency” never means a formatted string to parse heuristically. Where separate named amount/currency fields are listed, they represent the same pair. Comparison Mode presents two or three side-by-side feasible trip proposals showing dates, route/modes, travel hours, known/estimated/unknown costs, and constraint differences; selecting one opens Apply proposal without deleting alternatives until commit. Repositioning permits proposals from nearby regions, never an automatic relocation.

An explicit “for this trip” edit updates only its override. “Always,” “my usual,” or an edit in Profile updates the account default. For an unqualified trip-specific constraint during planning, save a trip override and report that scope; for a stated durable fact such as “I have a dog,” update the profile. If both interpretations would materially change a confirmed plan, ask for scope. Updating an account preference marks dependent existing estimates stale, but never automatically reorders an existing route or changes a reservation.

### 11.4 Mutations, persistence, and AI execution (OP, CHAT, TRP)

Every write carries an operation ID, entity ID, expected revision, and typed changes. The authenticated session supplies ownership; a client-supplied owner cannot override it. Success returns the operation ID, new revision, saved time, affected IDs, and canonical changed records. Failure returns a stable category (validation/auth/unavailable/conflict/provider/rate_limit/canceled), a safe message, retryability, request ID, and field errors if applicable.

Use these states consistently:

1. **Draft:** editable local input, with the last durable revision still available.
2. **Validating/calculating:** show progress; preserve the saved map/cards. A candidate preview may be shown with a Preview label.
3. **Awaiting confirmation:** only when ambiguity, an import, an optimization proposal, or a protected calendar/booking change requires it.
4. **Committing:** one transaction checks expected revisions, writes all affected records and the operation result, and increments each changed entity revision.
5. **Saved:** replace the displayed confirmed snapshot from the acknowledgment and only then announce success.
6. **Failed/canceled:** discard the uncommitted candidate, retain recoverable draft input, and keep the last confirmed snapshot.

Autosave text after 600 milliseconds without input; blur or Save flushes pending changes. Serialize writes per entity. An idempotency replay with identical input returns the original result without incrementing revision; the same operation ID with different input is rejected. If the connection is lost after submit, query operation status before retrying. If the server has committed, report Saved even if cancellation arrived too late. Never falsely report “Canceled, unchanged” after a commit.

A stale revision shows a comparison of My draft and Latest saved. Offer Reload latest, Keep draft for comparison, and Reapply selected changes. Reapply uses a new operation ID and latest expected revision; it is not blind overwrite. An account switch cancels uncommitted work, clears visible/private state immediately, and ignores responses with the prior account generation. Pending unsaved drafts are not sent under the next account.

Undo/redo restores trip snapshots as new forward revisions and is itself persisted. Retain 20 steps per trip, including stops, legs, tour references, timing, and relevant calendar changes. New edits clear redo. Navigation/filtering does not create an undo step. Neither undo nor Clean Sweep reverses a real supplier booking, payment, profile edit, or account action. These use their explicit workflows.

**AI command contract.** Supply only the authenticated profile, active topic, trip snapshot, selected segment, relevant vehicle state, a bounded recent history, resolved summary, and user-provided map context. The result contains readable reply text, intent, target scope, proposed typed actions, and a clarification/proposal flag. Server validation checks referenced IDs, revisions, permission, numeric fields, and action ordering. Generate final “changed/saved” text from the committed action result, not the model's prediction. Multi-field edits in one message apply as one coherent batch.

| Example message | Required interpretation |
| --- | --- |
| “What would a stop near Pine Harbor add?” | Answer/proposal only; no mutation. |
| “Can you add Pine Harbor after the marina?” | Explicit insert request. If exactly one marina matches, execute; otherwise ask which marina. |
| “Actually, remove the dog preference and make driving days under four hours.” | Remove the resolved pet preference and apply the daily driving constraint in one profile/trip-scoped batch, reporting the scope. |
| “Change Tuesday's leg to walking.” | Identify Tuesday in the selected segment; update that leg only. Ask if several legs match. |
| “Move my confirmed stay to Friday.” | Present changed dates, conflicts, and booking implications; await explicit review before altering the calendar; do not contact the supplier merely from this request. |
| “That looks good” | Apply only if exactly one pending proposal was just presented and its revisions still match; otherwise ask which proposal. |

Use explicit message scope, then selected segment, then active trip. Explicit trip overrides take precedence over account preferences; hard constraints remain hard until the user explicitly relaxes them. A future trip does not inherit a previous trip's overrides. Removing a note also prevents it from being regenerated from old summarized history unless the user states it again.

Clean Sweep shows a dialog with the current trip name and an unchecked “Carry forward a short trip summary” option. Confirm archives the old trip/topic, creates a blank selected trip, and optionally copies only a user-reviewable summary into its decisionSummary. It never copies stops, dates, bookings, or raw messages. New chat topic archives only the current topic; it retains route and resolved trip decisions and opens an empty topic. Neither action signs the user out or clears account profile notes.

Allow editing the next chat draft while a request runs; disable Send only while that trip has an uncommitted edit job, and expose Cancel. Start visible progress immediately, show a delayed status after 10 seconds, and enforce a default two-minute interactive deadline. Large route generation runs as a persistent cancellable job with progress and can be resumed by job ID after reload. No late reply may mutate a different selected trip or overwrite newer revisions. Keep the most recent 20 turns verbatim in the active model context and summarize older turns; retain archived turns for user-visible retrieval, respecting the model's configured input limit rather than silently dropping constraints.

### 11.5 Routing and vehicle rules (ROUTE, MODE, MAP)

For N stops, the primary route has max(N−1, 0) ordered legs. A round trip adds a return visit with a distinct stop ID tied to the origin. Turning round trip on twice is idempotent; turning it off removes only the generated return visit/leg. Explicit repeated visits are never deleted by that toggle.

For a driving visit to an off-road stop P with road access R, render: inbound road leg to R → walking connector R→P → stop P/stay → walking connector P→R → outbound road leg. Add only the arrival connector for a final destination, only departure for an origin, and both for a visit followed by a return to the vehicle. Connectors are children of adjacent route legs, not extra numbered destinations. Count each actually traversed connector once in time/distance, including both directions when walked twice. Nearby road access within 20 meters suppresses the visible walking components, preserves the precise point and access metadata, and creates no invented one-minute charge.

If access cannot be verified, retain precise GPS, label road access unresolved, and present a provisional connector only with explicit user acceptance. A driving provider failure never silently changes Driving to Straight line. Off-road, marine, and manual travel modes may legitimately save provisional geometry without a road provider. Each card and total must display its status.

| Mode | Geometry and inputs | Time and cost behavior |
| --- | --- | --- |
| Driving | Google road route; selected vehicle and avoidances; precise road access if relevant. | Provider duration plus explicit breaks. Fuel only with known MPG and fuel price; otherwise fuel unknown. |
| Walking/Bicycling | Google route when supported; offer explicitly provisional direct geometry if unavailable. | Provider duration or user speed estimate. No road fuel or fare. |
| Hiking/Snowshoeing/Off-road | Ordered exact points; verified trail geometry only from an appropriate source. | User-entered duration or speed and breaks; absent values remain unknown. |
| Cruising/Sailing/Kayaking | User waypoints or a verified marine provider; use water-aware geometry only where supported. | User speed/duration and breaks; optional powered-vessel consumption; kayaks have no fuel. |
| Ferry/Transit/Train/Bus/Cable car | Verified service geometry/schedule when available, otherwise a labeled manual connector. | Separate fare, currency, boarding/wait/unloading; never road fuel by default. A vehicle ferry moves only selected vehicles. |
| Flight | Airport endpoints with transfer activities; airport-to-airport connector marked illustrative. | Verified or user flight duration/fare plus explicit check-in/transfer time. No road fuel. |
| Vehicle shipping | Vehicle-only movement between explicit locations; traveler does not automatically move. | User/provider time and fee; create a separate traveler movement if needed. |

Manual controls expose duration in hours/minutes, speed with mph/knots/km/h choice, break minutes, fare/currency, and relevant vessel fuel consumption. Explicit duration overrides speed-derived duration and is labeled User duration. Clear dependent estimates when route geometry changes; preserve the entered speed. Costs tied to an old mode are archived with the undo snapshot and excluded from the new mode.

When a vehicle is parked/stored, its location remains there until an explicit activity moves it. Transfer activities identify vehicle IDs and traveler IDs separately. An attempted driving departure from another location raises “Your vehicle is still at [place]” with Add transfer and Change mode; never invent a relocation.

Optimization changes only an explicitly selected road-compatible block. Lock time anchors, bookings, marine/transit sequences, and vehicle handoffs. If a whole-trip request spans such boundaries, propose separate optimizable blocks. Offer the shorter option as a near-time alternative only when its extra time is at most both 10% and 15 minutes. No heuristic result is called mathematically optimal. Stop cancels calculation; Apply is a separate single revision-checked mutation.

For large itineraries, keep up to 50 detailed stop/leg cards mounted per group/page, always show total saved stop count, and provide search plus Show more. Support at least 1,000 stops per trip and a complete calendar year; reject inputs above the documented 5,000-stop import limit before mutation rather than truncating. Provider waypoint limits are handled in chunks sharing exact boundary IDs; they do not become application stop limits.

### 11.6 Scheduling, filtering, and money (CAL, TIME)

**Time arithmetic.** Store scheduled instants as UTC timestamps plus the destination IANA zone and retain user-entered local date/time. A nonexistent daylight-saving local time is a validation error; for a repeated time show both offsets and require a choice. Never silently use the machine's zone for every stop.

For each stop, departure = arrival + stay + explicit waiting. For each following stop, arrival = previous departure + all leg component durations. Boarding, walking access, breaks, and unloading are components and must not be counted again in the stop stay. With no anchors or start, retain relative elapsed times and an Undated label. A suggested tomorrow date becomes persistent only when accepted. An explicit timestamp can anchor either arrival or departure; both at one stop must agree with its minimum stay.

Between two anchors, calculate the minimum elapsed duration. If it exceeds the available interval, show the amount of conflict and preserve the saved schedule; keep the proposed anchors in an editable conflict draft. If there is spare time, place explicit waiting immediately before the later anchor, visible in its stop card. Do not silently stretch lodging stays or invent activities to consume the gap. An unknown component duration leaves dependent arrival times unknown until another explicit anchor establishes a new starting point. Zero minutes is a valid explicit value, never a replacement for unknown.

Elapsed “days” in a duration are 24-hour periods; calendar nights are local check-in/check-out date differences. Label these separately. Lodging requires rate basis (per night/per stay), amount, currency, and either explicit night count or local check-in/check-out dates. Four nights × 120.00 USD = 480.00 USD. An explicit per-stay total is charged once and is not also multiplied by nights.

**Range behavior.** Display date inputs as inclusive From/To dates; internally the interval ends at the next local midnight after To in the calendar zone. ISO weeks begin Monday. Use Jan–Dec calendar months; season grouping defaults Winter Jan–Feb and Dec, Spring Mar–May, Summer Jun–Aug, Fall Sep–Nov within the selected year. These are presentation bins; user-named seasonal segments retain their explicit dates and can differ.

Show activities that overlap the range, plus dimmed boundary stops for orientation. Whole-leg distance, fare, fuel, and travel duration are assigned once to the leg's departure date; label filtered totals “Travel departing in this range.” A crossing leg that departed earlier appears as context and is excluded from those totals. Nightly lodging is assigned by each property's local night date; per-stay charges use check-in date. Never charge every night merely because its stop overlaps one selected day. Undated items appear in a separate Undated group and are not assigned to a date by filtering.

“Activity days only” means days with at least one non-travel activity (stay, event, work, maintenance, provisioning, storage, or handoff). Hide travel-only days from that view; retain their data and show an excluded-day count. Filters for vehicle, mode, and activity status use the same derived view. Back restores prior scale, range, selected card, and scroll position. Filtering itself never saves new schedule or itinerary content.

**Money.** Use decimal amounts and ISO currency codes; avoid binary rounding in displayed totals. USD is only the default unit for a new money input, not evidence that every external price is USD. Preserve original currency and display separate currency subtotals. Do not add unlike currencies. Rounding occurs per displayed charge to the currency's minor unit; total the rounded charges. Fuel for a road leg is miles ÷ positive MPG × nonnegative USD-per-US-gallon price. If a fuel price uses another currency, its result remains in that currency. Zero price is accepted only if entered explicitly.

Show three groups: Known subtotal, Estimated additional costs, and Unknown costs. Estimated values never silently enter the known subtotal. A separate “Known + estimates” total is allowed when labeled and separated by currency. Ferry fare already covering its vehicle does not also become road fuel. User-entered marine fuel is distinct from road fuel. Display transit fares as per-person or party-total with a traveler count; multiply only the per-person basis. Explicit budget timeframes are normalized using the selected trip duration, never a guessed month length.

### 11.7 Tours, geometry display, and retained views (MAP, TOUR)

“View Route” fits the complete selected trip with 48-pixel map padding plus the actual overlay-panel rectangles. “View selected range” fits only that view. Stop focus uses its precise GPS coordinate, while connector focus includes both endpoints. On route edits preserve the camera unless the previously focused item was removed; then fit the affected new leg. A map loading or API error does not hide editable itinerary cards.

Use a stable six-color leg palette (#22c55e, #38bdf8, #f59e0b, #c084fc, #fb7185, #2dd4bf), assigned at leg creation and retained by ID through reorder. Draw primary geometry at about 6 pixels, a darker outline where necessary, and reduced opacity for overlap. Walking connectors use bright 6-pixel dashes; for different incoming/outgoing colors alternate dashes rather than a single indistinguishable color. Hover/focus raises opacity and width without changing the stored color. Dim Map changes the basemap layer only. Number-only labels retain accessible full names.

Route animation defaults to enabled unless reduced motion is requested. Speed slider 1–100 defaults 75; speed 1 traverses the complete route in 120 seconds and speed 100 in 10 seconds, interpolated linearly. Allocate traversal time by displayed geometric distance with a minimum one second per nonempty component. Pause route animation during a camera tour, map interaction, or leg hover/focus, then resume after that interaction ends. Store the user's explicit animation setting, not a transient hover state.

Tour preset values are Overview 3,000 feet/60°/0°, Scenic 1,000 feet/45°/0°, Close-up 250 feet/30°/0°, and Top-down 1,000 feet/90°/0°. Default is Scenic. Height is vertical elevation above local terrain, not slant camera-to-target distance. Converting to provider camera coordinates must retain that meaning. If terrain elevation cannot be obtained, show “Height approximate” and retain the requested value; do not falsely label absolute altitude AGL.

Play starts at the selected view, or the first view if none; Next selects the following view; Stop holds the current camera and resets playback position to the selected view. Loop defaults off. Flyover defaults 5 seconds (0.5–120 allowed); Pause defaults 5 seconds (0–300 allowed). Changes during playback apply at the next transition. Space outside a text input toggles playback, Escape stops it. User panning stops playback and retains the new camera view for Add View.

Repeated Add from Itinerary updates generated views by source item ID and kind; it does not duplicate them. Renames propagate to generated view names unless the user supplied a custom name. Deleting a referenced stop/leg removes its generated views with the same undoable mutation. Custom views persist. Reordering stops reorders generated views, preserving custom views' relative order. Tour import defaults to Replace tour, with an explicit Append alternative that deduplicates identical IDs only within that import. View references unresolved in a tour-only file are retained as custom frozen camera views labeled “Original itinerary item unavailable.”

### 11.8 Portable files and complete input/output definitions (FILE, DATA)

These field names define the native interchange format; they are not references to any application implementation. Native files use UTF-8 JSON, envelope format “groundbnb”, integer formatVersion 1, kind “trip”, “segment”, or “tour”, and exportedAt as a UTC timestamp. They contain no auth cookies, API secrets, payment tokens, or account ownership grants. A profile-transfer envelope additionally supports kind "profile" with profileFields and profileNotes as defined in Section 11.22.

| Field | Type and required content |
| --- | --- |
| trip | Object for kind trip or segment: id (opaque string), title, status (draft/active/archived), revision (nonnegative integer), start (null or timestamp), calendarZone (IANA string), orderedStopIds, stops, legs, settings, decisionSummary, tour, and calendar. Optional vehicles/travelers arrays store trip-specific portable snapshots; empty arrays are their default. |
| stops | Array with id, name, point, address (string or null), placeId (string or null), access (null or access object), staySeconds (nonnegative number or null), schedule, lodging array, notes, marine (true/false/null), segmentIds, and optional locationReference/unavailableReason. Optional positioning records policy (road_snap/exact_gps), lastRequestedPoint, lastResolvedPoint. Missing positioning defaults exact_gps; this never grants user-authored provenance. Add provenance as defined in Section 11.22; restricted values in requested/resolved history follow the same retention rules. |
| point | Object latitude/longitude as finite decimal numbers; optional altitudeMeters is null or finite. Stop point and linked frozen-view target may be null only for an explicitly unresolved location with a retained locationReference or original user label and an unavailableReason. Geometry arrays contain only real point objects, never null placeholders. GeoJSON reverses order to longitude, latitude. Preserve supplied precision. |
| access | Object roadPoint, separationMeters (number or null), source (string), and status (known/provisional/stale/unknown). Actual walking traversals belong to the adjacent leg components. |
| schedule | Object zone (IANA string or null), arrival and departure (UTC timestamp or null), arrivalAnchor and departureAnchor (timestamp or null), and waitingSeconds (nonnegative number). All timestamp values must agree with explicit anchors when known. |
| legs | Array with id, fromStopId, toStopId, mode, color, vehicleIds, travelerIds, components, manual, and notes. Order agrees with orderedStopIds. Canonical mode values: driving, ferry, cruising, flight, sailing, kayaking, walking, bicycling, transit, train, bus, hiking, snowshoeing, cable_car, off_road, vehicle_shipping. |
| manual | Null or object with durationSeconds, speedMetersPerSecond, breakSeconds, fuelGallonsPerMile, and fuelPrice (money plus currency); each scalar is nullable. Preserve user inputs separately from the derived measurements so future edits remain possible. |
| vehicles/travelers | Snapshot arrays with id, displayName, and user-supplied relevant trip details. Vehicle additionally has type, mpg, fuelPrice, and presence events (location/time/status). Traveler has only a display label and trip role; no account login identifiers are exported. References in legs/activities resolve to these snapshots. |
| components | Ordered array with id, kind (primary/access/transfer/wait/break), mode, points (point array), distance/duration measurements, charges array, and direction (from/to points or null for unresolved endpoints). Optional provenance and unavailableReason explain missing geometry. Empty points never imply a verified route. No duration/charge appears in multiple components. |
| measurement | Object value (number or null), unit (m or s as appropriate), status (known/provisional/stale/unknown), origin (user/provider/calculated), source (string or null), checkedAt (timestamp or null), dependencyRevision (integer), and optional permitted-use provenance. Null requires unknown or stale status. Retention expiry removes restricted values rather than keeping their number beneath a Stale badge. |
| charge | Object id, category (road_fuel/marine_fuel/lodging/fare/fee), amount (decimal string or null), currency (ISO code), status, basis (total/per_person/per_night), quantity (nonnegative decimal string), and source. A derived line total is amount × quantity; total basis has quantity 1. |
| lodging | Array of charge-compatible objects with additional id, name, localCheckIn/localCheckOut (date or null), reservationStatus (proposed/recorded_confirmed), and verification (user_reported/provider_verified/unverified_import). Imported status never grants permission to transact. |
| settings | Object tripOverrides (field/value map using the field dictionary in Section 11.3), roundTripOriginId (stop ID or null), units (“imperial” baseline), and currency (“USD” initial input preference). Optional viewState stores selected segment/range, selected panel, and camera; importing it never changes route data. |
| tour | Object views (array), flyoverSeconds, pauseSeconds, loop. A view contains id, name, kind (stop/leg/custom), sourceId (string or null), target (point), elevationFeet, angleDegrees, headingDegrees, and customName (boolean). |
| calendar | Object segments and activities arrays. Segment: id, parentId (null or ID), level, title, startDate/endDate (date or null), precision (exact/day/month/season/open), status, and childIds. Activity: id, segmentId, kind, title, start/end (timestamp or date or null), precision, zone, tripId, stopId/legId (nullable), vehicleIds, travelerIds, and status. Status values for both are idea/provisional/confirmed/complete. |
| decisionSummary | String containing the trip's resolved decisions; empty is allowed. Raw chat and account profile are excluded by default. Optional explicitly selected profile answers/quotes may be included under extensions and reviewed on import. |
| extensions | Optional object for additional versioned fields. Preserve it through native round-trip; never execute it or use it to override validated core ownership, authorization, or dates. |

Native stop, leg, component, view, and segment IDs must be unique within their entity type. Every structural referenced ID must exist inside the file, apart from external-parent provenance in a segment file and the tour-only frozen-view exception. External provider place/booking references are provenance, not structural IDs. Reject cyclic parent links, inconsistent stop/leg order, invalid coordinates, negative durations, mismatched units, and incompatible major format versions with field-specific errors. Missing optional fields take the documented empty/null default; missing required fields cause a preview error. Imported vehicle snapshots attach to existing account vehicles only after explicit matching; otherwise create new named vehicle records in the import transaction.

A valid empty-trip file is:

    {
      "format": "groundbnb",
      "formatVersion": 1,
      "kind": "trip",
      "exportedAt": "2027-01-01T00:00:00Z",
      "trip": {
        "id": "demo-trip",
        "title": "New trip",
        "status": "draft",
        "revision": 0,
        "start": null,
        "calendarZone": "America/New_York",
        "orderedStopIds": [],
        "stops": [],
        "legs": [],
        "settings": {
          "tripOverrides": {},
          "roundTripOriginId": null,
          "units": "imperial",
          "currency": "USD"
        },
        "decisionSummary": "",
        "tour": { "views": [], "flyoverSeconds": 5, "pauseSeconds": 5, "loop": false },
        "calendar": { "segments": [], "activities": [] }
      }
    }

For kind tour, replace trip with the tour object above; views are self-contained through stored camera targets. For kind segment, include a trip object limited to selected segment content, plus rootSegmentId and parentDescriptor (original parent ID/title/level/date window, or null for an original root). Set the exported root's parentId to null and preserve its external parent only in parentDescriptor. Retain boundary stops needed for complete legs and mark their IDs in contextStopIds. Import either attaches to a user-selected compatible parent or creates a new parent from that descriptor; it never guesses a match solely from a similar title.

New-trip import creates new owner-scoped IDs and remaps all internal references; exported original IDs may be retained as provenance. “Replace trip” uses the current expected revision and preserves the old snapshot for undo. Native round-trip equality means equal authored content and permitted included coordinates, measures, geometry, hierarchy, and references after ID remapping, excluding new save timestamps/revisions. Export-declared unavailable fields stay unavailable. F-11 uses synthetic export-permitted geometry; it does not assert indefinite portability of proprietary provider results. Imported export-permitted geometry is retained without live rerouting while its applicable retention policy allows; expired/restricted fields remain absent with warnings. Imported confirmed reservations become recorded confirmations with unverified-import provenance until independently checked; no provider call books anything.

| Format | Defined behavior and loss disclosure |
| --- | --- |
| GeoJSON | FeatureCollection with numbered Point stop features and LineString component/leg features. properties carry entity ID, role, name, mode, verification, and references. Import Point order from an explicit order field, otherwise file order; never guess road routing from a LineString. |
| GPX | Waypoints represent exact destinations; tracks represent available component geometry in order. Preserve names and mode in descriptions/extensions. No claim of lossless chat, calendar hierarchy, or bookings. |
| KML | Placemark for each destination and leg, with stable names and colored lines. Coordinates retain precision. Tour camera settings may be included as extended data, but generic KML viewers are not promised full playback equivalence. |
| CSV | UTF-8 with header and RFC-style quoting. Required stop columns: order,name,latitude,longitude. Optional: address,modeToNext,arrival,departure,timeZone,stayMinutes,notes. Import latitude/longitude as numbers and preview unresolved dates; do not execute spreadsheet formulas. |
| iCal | One event per dated stay/activity; stable UID from entity ID; preserve IANA zones or explicit UTC. All-day DTEND is the exclusive following date. Undated items are listed as omitted in the export preview. |
| Google Calendar | Open an event creation handoff for a selected dated event. For multiple events offer iCal. Never claim a handoff has saved an event in the user's calendar. |
| Google Maps | Handoff supported road-mode chunks with named/exact-coordinate endpoints. Split when destination limits are reached and number the links. List unsupported walking-access/marine/manual segments and offer precise-point download. |
| Marine Waypoints | Export selected marine-classified points as GPX with names, coordinate precision, order, and an unverified-route description. Treat Savvy Navvy as a compatibility target to verify with an actual import; a successful file download alone does not prove external compatibility. |

Maximum file size is 10 MiB for native JSON/GeoJSON/GPX/KML and 2 MiB for text/Markdown/CSV. Maximum pasted text is 100,000 characters; imports support at most 5,000 stops and 100,000 geometry vertices per file. Show the size/count limit before parsing and never truncate silently. Native export uses a sanitized trip-title plus date filename. Use a native Save As picker when supported; otherwise initiate a browser download with that filename and let the browser control its destination. Canceling the picker is not an error.

### 11.9 External dependencies and operational honesty (SYS, PRO, REC)

Required settings are the Neon project/database and auth configuration; Google Maps browser/server credentials with appropriate restrictions; Gemini server credentials and model IDs from environment configuration; transactional email; and Vercel/GitHub deployment configuration. Never hardcode an old “latest” model or dependency version. Record resolved versions and official verification evidence in `docs/integrations.md`. Secrets do not appear in native files, chat context, logs, diagnostics, exports, or browser bundles.

| Capability | Default choice | Operational rule |
| --- | --- | --- |
| Hosting | Vercel paid production plan appropriate for a public/commercial app | Verify current plan and scheduler/function limits before deployment; previews must remain reproducible. |
| Database | Neon Postgres, new project/database `groundbnb` | See Section 11.16. Use production, preview, and local-development branches. |
| Authentication | Neon Auth with Google and email/password | Verify current SDK/callback/session-revocation behavior. Linking providers preserves one account. |
| Transactional email | Resend by default; Postmark acceptable substitute | Verification, password reset, and v1.1 alert email. Configure and verify domain authentication before launch mail is trusted. |
| Maps | Google Maps JavaScript API (2D and supported 3D), Geocoding, Routes API, Places API (New), Time Zone API, Elevation API | TIME-03 depends on Time Zone; TOUR-02 depends on Elevation. Restrict keys by API/origin. RULE-12 governs stored/exported provider-derived data. |
| AI | Gemini through server-side calls; model IDs from environment configuration | Use a paid/user-content-compatible tier whose current data-handling terms match `/privacy`. Economy mode (v1.1) uses a separately verified cheaper compatible model, not an undisclosed free-data tier. |
| Camps/trails (v1.1) | Recreation.gov RIDB, NPS API, OpenStreetMap-derived data where current terms permit | Show source and fetched time. Never claim verified trail access/safety without a suitable source. |
| Weather/tides (v1.1) | NWS `api.weather.gov`, NOAA CO-OPS, subject to current terms/coverage | Values remain source-labeled and provisional for travel decisions. |
| Flights (v1.1 candidate) | Duffel or another provider only after current terms explicitly permit this alert-only use | Otherwise use a Manual watch with source link. |
| Lodging/gig/volunteer leads | Link-only unless a permitted provider is later verified | Do not scrape or imply live availability from Airbnb, TaskRabbit, Rover, Fiverr, Nextdoor, Wonolo, or another source without documented permission. |
| SMS/push | v2 | Not part of v1.1. SMS requires current carrier/registration/opt-in compliance before implementation. |
| Jobs/scheduling | Durable job records and a verified execution/dispatch mechanism from v1 | SYS-12 defines crash recovery for interactive long jobs in v1. In v1.1 dispatch due watches/reminders at least every 15 minutes, or use equivalent durable delayed scheduling, to honor local 09:00 across time zones; quotas remain monthly/weekly/daily. Record vendor/runtime limits and bound each worker step. |
| Rate limiting/bots | Platform/WAF rate limiting plus sign-up bot challenge such as Turnstile | See Section 11.20 and launch cost/abuse controls. |

**Operational honesty.** A provider adapter that passes deterministic fixture tests but lacks current credentials, terms permission, or a live verification is **Implemented, live verification Blocked**, not Verified. Unsupported capabilities display a source link/manual path or an explicit unavailable state. A missing supplier does not block v1 because supplier transactions are not in v1; it does not block v1.1 when the specified Manual-watch fallback is used.

**v1.1 watch behavior.** Every watch has a source link. Automated checks are allowed only for categories whose named provider and current terms are documented in `docs/integrations.md`. Other categories are Manual watches: the user saves a link, logs prices manually, and receives in-app/email reminders. Never represent a Manual watch as live monitoring. Compare like-for-like party, dates/flexibility, mandatory fees, refund terms, and quality when the data exists. Unknown mandatory fees or policy terms prevent a “better deal” claim; show the result as incomplete instead.

The scheduler supports only the cadence the account is entitled to: Monthly on Free, Weekly on Plus, Daily on Pro. Faster engine schedules are not exposed as ordinary options; they display “Requires a custom plan.” Undated watches require dates before activation. A watch may stop after the user records a first confirmed booking, 14 days before departure, at departure, or manually. In-app alerts are always available; email requires a verified address. SMS and push are v2.

**No transactions in v1/v1.1.** There is no supplier purchase, booking, cancellation, stored-payment, or auto-rebooking endpoint, job, MCP tool, or UI control. Booking records can store user/imported evidence, but they do not transact. PRO-03 and PRO-04 preserve the v2 contract and remain Blocked until an authorized supplier agreement and a payment processor exist.

### 11.10 Administration and improvement diagnostics (ADM)

Provide an Administrative panel in the account menu only for authorized administrators. Routes are /admin (Overview), /admin/users (Users), /admin/usage (Usage), /admin/diagnostics (Prompt diagnostics), and /admin/audit (Audit). Use the shared dark visual system, a 224-pixel desktop navigation rail, 24-pixel content gutters, compact summary cards, and sortable tables with 50 rows per page. On mobile, replace the rail with a section selector; rows open full-width detail drawers. Tables have keyboard-operable sort controls and accessible text alternatives to charts. Loading preserves active filters; empty states say “No results for these filters”; failures retain filters and provide Retry plus request ID.

| ID | Requirement and pass condition |
| --- | --- |
| ADM-01 **[v1]** | Server-enforced roles are user, admin, and owner. Admin can view diagnostics/usage, manage ordinary users, grant/revoke the access-grant types implemented in the current tier (lifetime grant in v1), and audit those actions. Owner additionally appoints/removes admins. Bootstrap the specified initial identities through the trusted procedure in Section 11.15, never first public sign-up. Protect the last active owner from demotion/suspension. **Pass:** editing a browser role field or requesting an admin URL as a user grants no access; only an owner can appoint further admins after the initial seed. |
| ADM-02 **[v1]** | Users lists account ID, display name, verified email, role, status, creation/last-active time, period usage, and estimated provider cost. Search by ID/name/email and filter by role/status. Detail offers Suspend, Reactivate, Revoke sessions and agent credentials, and owner-only role assignment, each with a named confirmation and audit reason. **Pass:** suspension prevents new sessions, MCP calls, and provider-changing background jobs, preserves user data, and reactivation restores ordinary access without restoring revoked credentials. |
| ADM-03 **[v1]** | Log every submitted prompt that results in a system/provider/validation failure or whose committed action is later undone by the user. The originating prompt, action, error, and undo must be correlated by stable IDs. Include partial failures, canceled requests as a separate outcome, and requests with no prompt. **Pass:** a timed-out chat appears under Errors; undoing its later successful retry produces an Undo-linked entry for the successful attempt without marking the failed attempt successful. |
| ADM-04 **[v1]** | Diagnostics filters include date range, user, task type, interface channel, outcome, error category, provider/model, application version, and review status. Rows show timestamp, redacted prompt preview, outcome, latency, usage, and request ID. Detail shows the redacted prompt/reply, selected-context snapshot, typed action diff, affected IDs, revisions, error stage, undo/redo timeline, and provider attempt IDs. **Pass:** an admin can identify exactly which prompt/action changed a stop and was undone without opening the user's entire conversation. |
| ADM-05 **[v1]** | Review workflow supports New/In review/Resolved/Ignored, assignee, severity, tags, and internal notes. Export selected redacted cases as JSON or CSV with their filters and identifiers for improvement work. Undo is a behavioral signal, not automatic proof of a model defect; an optional user reason can explain changed intent. **Pass:** resolving a case preserves the original event, reviewer/time, and all undo/redo history; CSV cells cannot execute formulas. |
| ADM-06 **[v1]** | Audit role changes, suspension/reactivation, session/credential revocation, diagnostic detail access, exports, and review changes with actor, target, time, action, reason, and outcome. Audit is append-only for admins. Do not permit unlogged impersonation, raw database browsing, or background replay of a user's prompt. **Pass:** an admin exporting cases leaves an audit entry; a replay requires an explicit isolated test action and cannot alter the original trip. |

An admin's powers apply only through these administrative operations. Ordinary trip APIs, MCP tools, and chat remain owner-scoped even for an admin. Administrative appointment does not grant authority to make bookings, send user messages, or impersonate the account. Existing authorization is checked on every request and before each provider-changing job step; an already dispatched provider operation is reconciled and reported.

Diagnostic records contain diagnosticId, accountId, tripId/segmentId when relevant, promptId, logicalRequestId, operationIds, attemptIds, parentRequestId, channel, taskType, timestamp, redacted prompt/response, context snapshot, outcome, error category/stage/code, safe message, latency, affected entity IDs, before/after revisions, application release, model/configuration identifiers, and review fields. The context snapshot contains only the fields needed to explain that action, not every profile answer or the entire chat. Undo events contain undoEventId, originalOperationId, resultingRevision, timestamp, actor, source (UI/MCP), optional reason, and redo references. A batched action undone once creates one undo event with all affected IDs; repeated response delivery never duplicates it. Undo does not erase incurred usage. Manual edits may also be undone but are labeled “No originating prompt.” Automatic compensation is separately labeled and never counted as a user undo.

Show users a concise disclosure that failed and undone requests are retained for service improvement and accessible to authorized administrators. Remove credentials, session tokens, payment details, and detected secrets from diagnostic content before persistence/export. Retain redacted prompt/context content for 90 days, then purge it; retain minimal usage and administrative audit metadata for 13 months. Administrative review notes must not reintroduce removed secrets. Account deletion removes diagnostic content and direct personal identifiers; retained aggregate usage is deidentified. No automatic training submission, external case sharing, or bulk prompt replay is implied. Deleting diagnostics does not delete the user's saved trips or chat.

**Acceptance for ADM-03–06:** create an error, a successful action, its undo and redo, and a manual undo. Verify their distinct origin links and counts, export only selected redacted cases, expire the 90-day content under a controlled clock, and ensure no API key or raw payment value survives in the export or audit.

### 11.11 Token and provider-usage accounting (USG)

The dashboard measures application operating usage for later pricing decisions. It does not add subscription billing or charge users automatically. Application Gemini calls, including AI calls made through MCP, are included. Tokens consumed by a user's separate external agent, or by agents building the clone, are outside the application unless explicitly supplied as unverified external metadata; they never enter authoritative totals.

| ID | Requirement and pass condition |
| --- | --- |
| USG-01 **[v1]** | Capture server-side usage for every provider attempt, including successful, failed, canceled, retried, streamed, and background calls. Associate it with accountable user, logical request, task, provider/model, and channel. **Pass:** two genuinely billed retry attempts both count; replaying an already committed idempotent operation creates no additional provider call or usage row. |
| USG-02 **[v1]** | Usage offers Hourly, Daily, Weekly, Monthly buckets, custom From/To range, reporting time zone, and filters for user, task, provider/model, channel, outcome, and trip. Defaults: UTC, Daily, last 30 calendar days including today. **Pass:** the same filtered data agrees between chart, table, user detail, and CSV/JSON export for every bucket size. |
| USG-03 **[v1]** | Show input, output, cached input, reasoning tokens where reported, provider-reported total, requests, errors, user-undone requests, unique active users, estimated provider cost, and usage-reporting coverage. Missing usage is Unknown, not zero. **Pass:** a provider timeout with no token report increments unknown attempts and request/error counts without inventing a zero-token success. |
| USG-04 **[v1]** | Task types are ai_chat, profile_assistance, itinerary_planning, mapping, recommendations, imports, monitoring, rebooking, video_export, and system_other. One primary type per attempt prevents double counting; optional subtags describe work. **Pass:** mapping-related AI tokens appear under Mapping, video rendering costs under Video export, and one chat request invoking multiple services still has one logical request with distinct metered attempts. |
| USG-05 **[v1]** | Record non-token services in their own units: map loads, geocoding/directions/place requests, notification sends, and other provider-metered units. Show provider usage and estimated cost beside token usage. **Pass:** 100 map API requests and 1,500 Gemini tokens appear as distinct quantities; the dashboard never calls a map load an AI token. |
| USG-06 **[v1]** | Cost estimates use versioned provider/model/SKU rate records, currency, effective interval, and provenance. Unknown rates show “Cost unavailable.” Display costs by currency; clearly label estimates rather than invoices or customer prices. **Pass:** a rate change affects calls in its applicable interval without silently rewriting historical estimates, and no unlike currencies are summed. |

The Overview screen presents total tokens, estimated provider cost by currency, error rate, and user-undo rate, followed by usage trend, top users, task breakdown, and recent diagnostic cases. Usage has a stacked Input/Output chart, provider-total indicator, table toggle, group-by User/Task/Provider, and Export. Cached/reasoning subsets are a drill-down, not additional stacks if already included in input/output. Definitions and Unknown coverage are visible beside totals. Select a user to open their usage detail with the same range/bucket/zone filters; select a task or diagnostic count to drill into its attempts/cases.

Provider operating costs retain at least eight decimal places for storage and aggregation, independently of the trip-expense display rounding in Section 11.6. Aggregate before rounding dashboard currency totals; drill-down and exports expose the precise estimate and rate basis. A sub-cent cost can display “< $0.01” rather than falsely indicating free usage.

Persist usageEventId, providerRequestId, attemptId, logicalRequestId, operationId, parentRequestId, accountableAccountId (or explicit system/unallocated), actor/client ID, tripId, taskType, channel (UI/MCP/background), provider, model/SKU, start/end UTC, status, token measures, token-count semantics, non-token quantity/unit, reporting source, reconciliation status, rate version, estimated cost/currency, and recorded time. Attribute background monitoring to its enrolled owner. Attribute admin test replay to the admin/test account, never the original customer. Never trust client-supplied token totals as provider-verified.

Use the provider's documented token semantics: cached tokens may be a subset of input and reasoning may be a subset of output; do not add them twice. If only disjoint categories are available, derive total with a recorded derivation; otherwise leave total unknown and show reported categories. Deduplicate delivery of the same provider attempt by its stable event/provider identifiers. A later final usage report reconciles the original attempt instead of appending a second charge. Streaming interruptions retain reported partial usage with a Partial label until reconciled. Usage recording failure enters a durable retry path and displays delayed coverage; it must not resubmit the user action or provider request.

Attribute usage to attempt start time for time buckets. Store instants in UTC and group in the selected IANA zone; hours across a DST change include offset labels so repeated hours remain distinct. Weeks begin Monday; months are calendar months. From/To are inclusive local dates. Request count deduplicates logicalRequestId; attempt count counts actual provider invocations. Error rate = logical requests with at least one recorded error / logical requests in range. User-undo rate = successfully committed AI mutation operations from the selected range that have at least one explicit user undo / successfully committed AI mutation operations from that range. A later undo updates its originating operation's cohort; separately show undo events occurring within the displayed range. Redo does not erase the historical signal or increase the denominator.

**Acceptance for USG-01–06:** verify additive provider costs and nonoverlapping token totals, null/partial/reconciled usage, delayed recording, retry/idempotency behavior, user attribution, DST grouping, and matching exports. Every dashboard number must be traceable to persisted events; no client-side guessed token count is authoritative.

### 11.12 Headless agent access through MCP (MCP)

Expose an authenticated MCP service at /mcp so a compatible external agent can operate the product without opening the planner interface. Publish tool schemas, descriptions, input limits, required scopes, and safe example requests through protocol discovery. Use a supported MCP protocol revision and transport validated against a real compatible client; record the negotiated revision in integration evidence. The MCP service is an adapter to the same application operations and persistence rules, not a second planner or a bypass around confirmation.

| ID | Requirement and pass condition |
| --- | --- |
| MCP-01 **[v1.1]** | Support authenticated tool discovery and calls without a browser UI session. Account settings has Agent access to issue/revoke an expiring, scoped personal credential shown only once; store only its verifier. A client can use a securely provisioned credential headlessly. **Pass:** discovery and a trip read work from an external client with no planner page open; absent, expired, revoked, or suspended credentials fail. |
| MCP-02 **[v1.1]** | Expose profile get/update, trip list/get/create/update/archive, itinerary edit/reposition, calendar read/propose/apply, AI chat, import preview/commit, export, tour read/update, job status/cancel, operation status, and undo/redo. **Pass:** an agent creates a trip, inserts/repositions a GPS stop, saves, exports, and undoes it; the UI later shows the same canonical state. |
| MCP-03 **[v1.1]** | Scopes are profile:read/write, trips:read/write, calendar:read/write, chat:invoke, files:read/write, and monitors:read/write. Issue read-only credentials by default, require explicit selected write scopes, and permit restriction to named trip IDs. No admin scope is provided in the first version. **Pass:** a trip-limited credential cannot enumerate other trips, read their exports, elevate roles, or access admin diagnostics. |
| MCP-04 **[v1.1]** | Every write uses explicit entity IDs, operation ID, expected revisions, and typed validated changes. Return canonical records/revision on success and structured errors on failure. Require proposal ID plus an explicit confirmation call for protected changes. **Pass:** a stale MCP edit conflicts exactly as a UI edit does, and repeated operation delivery makes only one mutation. |
| MCP-05 **[v1.1]** | Structured calls to deterministic operations do not invoke AI unnecessarily. AI chat explicitly invokes the app's Google AI service and is metered. Return provider limits, useful errors, progress/job IDs, cancellation, and usage availability. **Pass:** a simple trip read creates no AI usage; a chat tool invocation is attributed to the credential owner and MCP channel. |
| MCP-06 **[v2]** | MCP cannot grant payment authority or active auto-rebooking enrollment. It may read monitors, change nonfinancial monitoring preferences within scope, stop automation, or submit proposals; irreversible supplier actions require previously granted, still-valid dedicated authorization. **Pass:** imported text or an MCP argument claiming “user approved” cannot grant booking permissions, and stopping a monitor takes effect before its next undispatched provider call. |

Tool input includes only the operation's needed fields; ownership comes from the authenticated credential. Results include requestId, operationId where applicable, status, revisions, canonical data or proposal/diff, warnings, and usage summary (possibly unknown/pending). Errors include category, field errors, retryability, and current revision on authorized conflicts. Large lists use cursors; export returns content or a short-lived owner-scoped resource, never an unrestricted public file. Job polling avoids starting a duplicate job.

Headless confirmation is explicit and reviewable: propose returns affected entities, before/after diff, required permission, current revisions, and an expiry of 15 minutes; confirm names the proposal ID and exact allowed changes. Expired or superseded proposals must be regenerated. Routine unambiguous trip edits follow the same immediate-save rules as chat/UI. Credentials authorize only their selected scopes, not every operation the agent can describe. Prompt diagnostics and undo correlations include MCP traffic using the same event model. Account settings lists credential label, scopes, trip restriction, created/expiry/last-used times, and Revoke; default expiry is 30 days.

### 11.13 Map modes and repositioning stops (MAP, ROUTE)

| ID | Requirement and pass condition |
| --- | --- |
| MAP-05 **[v1]** | Provide a persistent map-mode control labeled 3D, 2D Map, and 2D Satellite. 2D Map uses a flat road map; 2D Satellite uses flat satellite imagery with a separate place/road Labels switch. Support familiar pan, zoom, numbered markers, route selection, and fit controls in all modes. **Pass:** switch between all modes without changing any stop, mode, route geometry, total, or trip revision. |
| MAP-06 **[v1]** | Preserve geographic center, approximate visible extent, selected stop, filters, and route colors when switching. Save each mode's last camera separately. Default to 3D on supported devices and 2D Map otherwise; persist the user's choice. **Pass:** selecting a remote stop in 3D then switching to 2D keeps that stop in view and retains its exact coordinate. |
| MAP-07 **[v1]** | Stop dragging must work in 2D Map and 2D Satellite. The baseline 3D control is “Adjust point in 2D,” which switches to 2D Map and focuses the selected marker. Do not require unreliable 3D dragging. **Pass:** a user starting in 3D can reposition a point through the offered 2D path with no lost route state. |
| MAP-08 **[v1]** | Retain itinerary, chat, summary, connectors, dimming, stop labels, mode controls, and route animation in 2D. Tour data remains editable; Play offers “Switch to 3D and play,” preserving the 2D view. Unsupported 3D shows a clear playback limitation. **Pass:** switching map presentation never deletes tour views or hides ordinary route editing. |
| ROUTE-13 **[v1]** | Give every stop an explicit positioning policy: Snap to road (road_snap) or Exact GPS (exact_gps). Land/Sea classification alone does not grant snapping. **Pass:** an exact hiking point or marina slip remains at the dropped GPS coordinate even when an address is nearby. |
| ROUTE-14 **[v1]** | Drag a road_snap stop to a qualifying drivable road/address access point within 50 meters of the dropped coordinate and snap to that point. If none qualifies, retain the exact dropped point and change policy to exact_gps. **Pass:** a fixture with a valid road access 25 meters away snaps; at 75 meters the destination stays at the drop and no distant address replaces it. |
| ROUTE-15 **[v1]** | Repositioning changes the existing stop's coordinates, not its identity or route order. Recalculate only adjacent legs/access connectors and dependent schedules/totals, update linked tour targets, and commit once with undo support. **Pass:** dragging stop B in A–B–C retains B's ID/name and unrelated route segments; undo restores its coordinate, policy, access points, geometry, and totals. |
| ROUTE-16 **[v1]** | Provide desktop mouse drag, touch move mode, and a keyboard-accessible Edit coordinates alternative. Show candidate movement/snapping and pending recalculation; preserve saved state on failure, cancellation, or conflict. **Pass:** Escape during movement commits nothing, a directions failure retains the previous saved route, and keyboard coordinate entry follows the same snapping/persistence rules. |

Map-mode controls are visible above the map at desktop and in a labeled Layers button on mobile. Satellite Labels is distinct from the existing Map labels control for trip stop names. In 2D, disable tilt/heading inputs for the live map without clearing saved 3D camera/tour settings. Switching requires no AI invocation or directions recalculation; only the map provider's rendering requests may incur service usage.

Determine initial positioning policy from the user's intent: a selected routable address/road place used for driving defaults road_snap; explicit GPS, plus-code, imported points, marked off-road points, and water destinations default exact_gps. In ambiguous cases use exact_gps. A visible policy selector allows an explicit switch; switching an exact point to road_snap shows the proposed displacement before Apply. An exact point never changes policy merely because its marker approaches a road. Setting Sea forces exact_gps; changing back to Land retains exact_gps until the user chooses snapping.

For dragging, capture stop ID, base revision, original point, policy, map mode, and neighbor IDs at pointer-down. Render a ghost marker/adjacent preview while moving; do not save or call directions on each pointer event. On pointer-up, perform one candidate resolution and needed recalculation. Use ground distance in meters, not screen pixels, for the 50-meter threshold. A candidate must be a provider-confirmed routable access for the relevant driving mode (ordinary car routing must not be presented as verification of RV height/weight or private-access permission), not a building centroid, arbitrary address label, opposite shoreline, or inaccessible road. Choose the closest qualifying access; equally plausible disconnected roads require a choice. A successful search with no candidate differs from a provider failure: failure leaves a retryable draft and cannot silently claim “no nearby road.”

Before completing M2A/M3, verify the selected live API combination can distinguish a usable road-access candidate from a building centroid or nearest address; API proximity alone is not proof of legal/vehicle access. Include private access, divided roads, opposite shoreline, no candidate, and provider error in synthetic tests, plus permitted live examples. When the provider cannot establish a qualifying candidate, preserve the dropped draft and offer Exact GPS or manual road-access selection rather than claiming verified snapping. A transport/API limitation must not weaken the exact-point invariant.

For exact_gps, copy the dropped latitude/longitude without rounding or geocoding substitution. Optional reverse geocoding may update display metadata only. Independently recalculate road access for an adjacent driving leg using the separate access model; that access point never replaces the destination. Existing non-driving land/water modes stay unchanged, and provisional geometry retains its unverified label. Do not invent a walking connection across water; incompatible vehicle/shore access becomes a visible proposal/conflict.

After a road snap, persist both requested drop and resolved destination plus snap distance/source. After an exact move, persist the new exact destination and previous coordinate in undo history. Invalidate stale placeId/address associations, preserve custom names, and label unresolved display addresses as unavailable. A pinned access point that becomes invalid requires a reviewed replacement. Movement affecting a confirmed reservation or anchored master-calendar commitment produces a proposed change rather than silently moving it.

Successful ordinary movement autosaves as one operation and shows “Stop moved” with Undo after acknowledgment. Until then, saved cards and route remain identifiable beneath the preview. Disable a second drag on that stop while committing; preserve a recoverable coordinate draft on failure. Touch users choose Move stop from the marker/card before dragging so map panning remains predictable. Coordinate editing supplies latitude, longitude, positioning policy, Apply, and Cancel. Moving the road-access marker instead of the destination is a separate clearly labeled Edit road access action with the same draft/revision rules.

Native exports preserve positioning policy and requested/resolved points; import/export, map switching, optimization, and tour generation retain the current authorized precise destination. Administrative logs distinguish a manual drag from an AI-requested reposition, and an undo links to a prompt only when that original operation actually originated from one.

### 11.14 Individual membership and future monetization foundation (MEM)

An account represents one individual. That individual may plan for multiple travelers and own many trips, including overlapping alternatives. Traveler records do not create shared account ownership, seats, organization membership, or access for other people. Membership eligibility and usage allowances belong to the individual's account and aggregate across its trips, UI sessions, MCP credentials, and background jobs.

| ID | Requirement and pass condition |
| --- | --- |
| MEM-01 **[v1]** | Seed configurable plan records for Free, Plus, and Pro with stable IDs and versioned entitlement/limit definitions. Prepare Free to carry limits when commercial policy is enabled. Do not hard-code access using display names, a single isPro flag, or a numeric tier rank. **Pass:** renaming Plus leaves its identity and existing assignments intact, and access decisions use explicit feature/limit definitions. |
| MEM-02 **[v1]** | Support “Complimentary lifetime access” as an audited non-expiring grant to a specified plan version, defaulting to Pro, with no payment obligation. Store grant type, grantedBy, grantedAt, optional reason, null expiry, and any explicitly revoked state separately from the underlying plan. **Pass:** an admin can grant lifetime access with no reason or expiry; the account displays its underlying Pro benefits, gains no admin role, and does not expire with time. |
| MEM-03 **[v1.1]** | Authorized plan managers can create draft plans or versions, adjust limits and included existing capabilities, preview affected accounts, publish, and archive plans through /admin/plans without a software release. The owner has this permission; an owner may explicitly delegate plans:manage to an admin, with audit. New capability implementation still requires software work. **Pass:** a delegated manager publishes a new bundle of existing features without changing application code; an ordinary admin without permission cannot publish it. |
| MEM-04 **[v1.1]** | Plan versions are immutable once published. Existing assignments remain pinned until an explicit audited migration with impact preview; archiving prevents new assignments and does not delete existing access. Keep role, account status, plan assignment, grants, and provider transaction consent independent. **Pass:** publishing a restrictive new Pro version does not silently downgrade existing lifetime grants or authorize bookings. |
| MEM-05 **[v1]** | Implement central server-side entitlement evaluation and configurable quota records shared by UI, MCP, and workers. Support report-only and enforced modes for commercial restrictions; the development/preview default is report-only, with enforceable test cohorts for acceptance. Operational authorization and provider-spend safety limits stay enforced in both modes. **Pass:** a synthetic commercial quota breach is logged in report-only mode and denied in enforced mode, without collecting payment. |
| MEM-06 **[v1→v1.1]** | Implement the membership matrix using stable server-evaluated feature keys. **Pass v1:** native JSON, profile PDF, Google Maps handoff, GeoJSON, GPX, KML, CSV, iCal, Google Calendar handoff, and Marine Waypoints work for eligible accounts; enforced CI cohorts verify grants/denials while public commercial gates remain report-only. Future keys never expose unimplemented operations. **Pass v1.1:** MCP, watches, and local schematic video obey the same matrix. No v1/v1.1 plan receives supplier transaction authority. |
| MEM-07 **[v1]** | Count saved trips per account atomically: Free 1, Plus 10, Pro no product-level numerical limit. Draft/active/archived trips count; Trash does not. Respect the cap across UI, AI, MCP, imports, restores, and concurrent requests. **Pass:** two simultaneous creations competing for the final slot yield only one new trip; archiving does not bypass the cap. |
| MEM-08 **[v1→v1.1]** | Monitoring allowance is one completed account-wide check per calendar month on Free, per ISO week on Plus, and per day on Pro. **v1** implements/tests the shared quota evaluator synthetically. **v1.1** applies it across all trips, watches, email/in-app channels, and manual/scheduled starts. **Pass:** using the allowance on Trip A prevents another automated check on Trip B until reset, while saved results remain readable. |
| MEM-09 **[v1→v1.1]** | AI exists on every plan. Free has a configurable daily request limit plus cost budget. Plus/Pro have no ordinary prompt-count quota but have finite cost allowances and operational ceilings. Allowances are individual and cannot transfer or pool between accounts. **Pass v1:** UI operations and direct service-level tests use one account allowance, and creating another trip cannot reset it. **Pass v1.1:** MCP and background watch work consume that same allowance; creating another credential does not reset it. |
| MEM-10 **[v1]** | Warn before exhaustion, allow the bounded grace below, then pause new cost-incurring operations. Preserve saved content, deterministic manual work, and exports already included in the user's plan. **Pass:** an exhausted Free account can edit a saved name and download JSON, cannot start additional AI beyond grace, and still cannot access a Plus-only export. |
| MEM-11 **[v1.1]** | /admin/plans exposes feature switches, trip caps, monitoring quotas, AI budgets/request limits, reset rules, grace, warning thresholds, operational ceilings, and report-only/enforced controls. Include impact preview, effective date, version history, and audit. **Pass:** a permitted administrator changes a budget through configuration, targets the intended assignments explicitly, and the UI/MCP/worker evaluators agree without a software deployment. |

Required logical records: Plan (id, stable key, display name, draft/active/archived status); PlanVersion (id, planId, version, feature-key permissions, limit definitions, createdBy/time, publishedAt); MembershipAssignment (accountId, planVersionId, effectiveFrom/effectiveUntil, status, grantType); AccessGrant (id, accountId, planVersionId when applicable, type, startsAt, nullable expiresAt, optional reason, grantedBy, revokedAt, optional revocation note); and PolicyAudit (actor, action, before/after versions, affected account IDs, optional grant reason, timestamp). At most one base-plan assignment is effective at a time. Grant overlays are evaluated explicitly as described in Section 11.15 and never overwrite that base assignment.

Limits identify metric, amount, unit, reset policy, and enforcement mode. Distinguish not-yet-configured from an explicit unlimited value. Stable feature keys identify implemented capabilities; configuration cannot execute arbitrary code or turn an unimplemented feature into a working one. Usage events retain the effective membership/plan version at request start for later pricing analysis. Do not copy membership authority into trip exports or accept it from profile chat/imports.

The selected structure is an explicit architectural default: administrators configure bundles of existing features, and complimentary lifetime is an access grant rather than a separate implementation of Pro. Lifetime waives payment and expiration; it does not imply unlimited provider spending, exempt abuse controls, override suspension, or grant automatic rebooking consent. Its included capabilities and limits come from the pinned plan version. All administrators can grant or revoke the access-grant types implemented in the current tier with recorded before/after access; v1 includes lifetime grants and v1.1 expands the grant catalog. A reason and expiration are optional where the grant type permits them; audit history is mandatory.

For public v1 launch, seed the following versioned catalog, record new accounts against the Free baseline, and keep **commercial feature/trip gates report-only** because no checkout/upgrade path exists. Explicitly enable enforced commercial test cohorts in CI. Ownership, abuse protection, provider-spend ceilings, and security authorization remain enforced in all modes. Assignment to Plus/Pro is administrative until billing exists. Customer checkout, subscription renewals, invoices, taxes, automatic overage charging, payment-provider integration, and supplier transactions are not implemented.

**Feature matrix (MEM-06).** The owner specified the trip/monitoring quantities and major feature allocation. The advanced-map definition and the operational numbers below are adjustable specification defaults, not measured market standards or a claim of profitable pricing.

| Capability | Free | Plus | Pro / default complimentary lifetime |
| --- | --- | --- | --- |
| AI chat, profile assistance, and trip planning | Included, daily request/cost limits | Included, generous cost allowance | Included, larger cost allowance |
| Saved trips, including drafts and archives | 1 | 10 | Unlimited product-level count |
| Monitoring check allowance | 1 per calendar month | 1 per ISO week | 1 per day |
| Automatic rebooking | Deferred v2 | Deferred v2 | Deferred v2; future Pro entitlement still requires separate supplier/processor authorization |
| MCP agent access | Unavailable | Included | Included |
| Basic 2D road/satellite and 3D maps; point adjustment | Included | Included | Included |
| Map-tour creation/playback and native JSON tour files | Included | Included | Included |
| Native JSON trip/segment export; Google Maps handoff | Included | Included | Included |
| Profile PDF | Included | Included | Included |
| GeoJSON, ordinary GPX, KML, CSV, iCal, Google Calendar handoff | Unavailable | Included | Included |
| Downloadable route-tour video | Unavailable | Included | Included |
| Dedicated Marine Waypoints export | Unavailable | Unavailable | Included |
| Advanced verified marine/weather/tide map overlays | Deferred v2 | Deferred v2 | Deferred v2; future Pro entitlement only when a suitable licensed/live provider is connected |
| View saved content; manual text/schedule work; copy profile text | Included | Included | Included |

“Advanced maps” means optional information layers for marine navigation context and current weather/tides where supported by an authorized source. Layer controls show source, checked time, units, legend, and provisional/unavailable status. Enabling a layer never certifies a route as safe. Keep all basic map modes, 3D tour playback, accurate GPS editing, and existing approximate/manual marine geometry available on every plan; do not put required editing behind an advanced-map entitlement. The Marine Waypoints entitlement controls the curated marine export, not ownership of coordinates: universal native JSON retains marine points and Plus generic geospatial exports retain available geometry with their normal limitations.

**Saved-trip capacity (MEM-07).** Archived trips remain saved and count toward the cap. Trash retains its existing 30-day recovery behavior, but restoring requires a free slot. New trip, Clean Sweep, and import-as-new show Manage trips / Export JSON / Cancel when full. Offer an explicitly confirmed replacement that moves a named existing trip to Trash and creates the new trip atomically; never silently discard or auto-trash a trip. Replacing the contents of the current trip does not add a slot and retains undo. On downgrade preserve all trips and their native exports; let the user designate up to the current plan's cap as editable while the rest are read/export-only until a slot is available. Do not delete excess trips or silently move their data into another trip. Alternative trips and overlapping dates are allowed within the current cap; there is no one-active-trip database constraint.

**AI cost controls and resets (MEM-09–11).** Meter estimated provider expense in USD using effective model rates, including input, output, billable cached tokens, reasoning, and other billed AI units without double counting. Tokens remain visible for diagnostics; dollar budgets avoid fixing a permanent token count as model prices change. These starting values are tunable operating budgets, not subscription prices or a promised number of prompts:

| Setting | Free | Plus | Pro / default complimentary lifetime |
| --- | --- | --- | --- |
| Ordinary user AI requests | 10 per day | No ordinary prompt-count quota | No ordinary prompt-count quota |
| Base AI provider-cost allowance | 0.20 USD per day | 10.00 USD per month | 30.00 USD per month |
| Additional ordinary grace allowance | Up to 2 extra requests, with combined grace cost at most 0.03 USD | 1.90 USD per month | 5.75 USD per month |
| Reserved emergency economy allowance | 0.02 USD per day | 0.10 USD per month | 0.25 USD per month |
| Total hard AI budget including ordinary grace and emergency reserve | 0.25 USD per day | 12.00 USD per month | 36.00 USD per month |
| Daily total variable-provider spending ceiling, including all reserves | 0.25 USD | 5.00 USD | 15.00 USD |
| Concurrent AI jobs per individual | 1 | 2 | 3 |

Warn at 80% of either the applicable request or base cost allowance, and at 95% of operational ceilings. Free enters ordinary grace when either its base request count or base cost budget is exhausted; the next at most two accepted requests must fit within 0.03 USD combined grace cost and remaining account/application ceilings. A costly request may exhaust grace before both prompts are used. Paid plans enter cost grace after their base monthly budget; there is no ordinary prompt-count gate. Reserve the emergency amount before admitting normal or grace work, so ordinary work cannot spend it. All modes share the hard total; emergency assistance is not extra uncapped credit. The daily total variable-provider ceiling also counts separately metered Maps, notification, monitoring, and rendering costs, so these can reduce the headroom available to AI. Public copy says “Generous AI planning, subject to fair-use limits.”

For now, days reset at 00:00 UTC, weeks Monday 00:00 UTC, and months on the first at 00:00 UTC. Show the reset instant in the user's local zone with a countdown. Unused AI/monitoring allowances do not roll over. A future billing integration may explicitly migrate paid monthly resets to the subscription anniversary; no current billing dependency is introduced. A reporting time-zone change never changes quota windows. Daily Free limits encourage regular access; monthly paid allowances allow occasional longer planning sessions while daily ceilings bound sudden cost.

No allowance is shared across individuals or teams. An individual's UI, MCP, and background AI all consume that same individual's AI cost budget across their own trips, so changing channels cannot multiply allowances. Provider-cost monitoring is separate from the count of monitoring checks. A monitor with remaining check quota but no AI cost allowance waits if it requires AI; a deterministic check may proceed only within its separate non-AI provider safeguards.

**Admission, settlement, and preservation (MEM-09–10).** Before each paid provider call, atomically reserve a conservative maximum cost using bounded input/output, allowed model, tool-call budget, current rates, and concurrent reservations. Bound each retry and tool step; recheck remaining allowance rather than granting an unbounded agent loop. Associate reservations with the logical request, attempt, account, and quota period. Reconcile actual reported cost on completion and release unused capacity. Idempotent replay does not reserve or count again; a genuine billed retry counts provider cost but not a second user prompt. Invalid input rejected before provider dispatch consumes no AI request; a request that dispatches and then errors/cancels consumes its incurred cost. Undo does not refund provider expense.

Unknown cost or missing rate cannot authorize unbounded spending: retain the reservation pending reconciliation and show usage pending; pause additional expensive work if its maximum cannot fit. Do not release uncertain reservations solely on timeout. Never reset a budget by changing a plan, trip, credential, or selected model: carry the applicable period's already-incurred spend/reservations into the new policy without counting it twice. Updating model rate records affects new attempts and preserves historical rate provenance. Raising a plan allowance uses a new version and an explicit bulk-migration preview; an owner emergency operational ceiling can take effect immediately with audit and a visible explanation, independently of pinned commercial benefits.

At grace start show "You're using your grace allowance" with remaining capacity and reset time. In v1, ordinary grace exhaustion pauses new AI; show "AI planning is paused until [local reset time]" with View usage and Continue manually. Do not show an Economy button or imply the protected reserve is spendable. In v1.1, offer the bounded finish session only when a compatible configured model and account/global reserves are available; otherwise show the same pause state. Compare plans is read-only and explains administrative access while billing is absent. Saved content, local tour playback, manual names/notes, calculations from saved inputs, and entitled deterministic exports remain usable. Edits needing fresh paid geocoding/directions remain unsent drafts when operational limits deny them. JSON/Google Maps handoff use available permitted saved coordinates without an AI/geocoding call; unresolved endpoints receive the portable-data warnings in Section 11.22. Exports obey commercial policy mode independently of AI exhaustion. Future v2 supplier outcomes require reconciliation without initiating a purchase to fix metering.

**Monitoring cadence foundation (MEM-08).** One completed automated check is a bounded run for one selected trip and at most five saved target items; the account quota is shared across its watches, not multiplied per target/trip. v1 builds and tests this evaluator synthetically; v1.1 exposes it. Offer Monthly on Free, Weekly on Plus, and Daily on Pro. Monthly runs on the first eligible day of the UTC month and weekly on the first eligible Monday, at 09:00 in the trip zone; eligibility is checked against UTC quota windows at dispatch. A newly enabled watch can use its current unused allowance immediately. Faster schedules require a custom published allowance and are not shown as ordinary choices.

Reserve the monitoring slot before provider calls. A completed run or partially successful run consumes one check; an entirely failed run releases the check allowance but retains actual provider cost and has at most two automatic retries per window. No overlapping runs can claim the same slot. Manual Run now uses the same quota; cached-result viewing is free. Each provider call has a bounded attempt count and metered units. Notifications are deduplicated and retain their normal verified-channel/provider limits. Exhausting monitoring quota has no grace by default; preserve results and show next eligibility. Daily Pro monitoring does not authorize any transaction. v1/v1.1 have no supplier transaction path.

**Configuration and data (MEM-11).** Persist BudgetPolicy version, metric/unit, period/reset anchor, base/grace/hard amount, daily ceiling, free-request/grace count, warning threshold, maximum concurrency, effective time, enforcement mode, and administrative reason. Persist UsageReservation with account, policy/period, request/attempt, reserved amount, settled amount, and pending/settled/released status. Keep plan feature eligibility, AI-cost budgets, monitoring run counts, trip storage caps, and non-token provider safety limits as distinct controls. Provide a plan/user usage simulator in /admin/plans to preview a request against current usage. Administrative edits never accept negative budgets, hard totals below base, or unlimited supplier spending disguised as an unlimited request count.

**Acceptance for MEM-06–11:** v1 tests the v1 matrix cells, trip caps, synthetic watch-quota evaluator, AI quota boundaries/resets, Free grace by prompt count and cost, paid grace/daily ceilings, concurrent reservations, fail/cancel/retry/idempotency, over-cap downgrade preservation, and deterministic work/export after hard stop. v1.1 adds MCP/watch parity and `/admin/plans` version-management tests. Verify report-only and enforced commercial modes separately; provider-spend ceilings hold in both.

### 11.15 Special grants, administrator bootstrap, and cost protection

| ID | Requirement and pass condition |
| --- | --- |
| MEM-12 **[v1.1]** | Every administrator can grant trials, promotional access, additional usage, grandfathered plan versions, and permanent complimentary access. Reason and expiry are optional; actor, target, grant type, amount/plan, effective time, and before/after access are always audited. **Pass:** granting with empty reason and no expiry succeeds, is visible in history, and does not change the user's administrative role. |
| MEM-13 **[v2]** | Promotional access can be redeemed from a campaign code/link distributed through advertisements. Store campaign ID, allowed benefit, optional redemption/end limits, and an idempotent account redemption record. **Pass:** a valid offer creates its audited grant once; editing a URL to request Pro or replaying a redemption does not create extra access. |
| MEM-14 **[v1.1]** | Keep base account-plan assignments intact beneath grants. Show effective plan, all grants, usage adjustments, and their precedence in account/admin views. **Pass:** expiring or revoking a trial restores the underlying plan and retained data without resetting incurred usage or deleting the assignment history. |
| ADM-07 **[v1]** | Seed weldayenterprises@gmail.com, welday007@gmail.com, and finallyaiagency@gmail.com as administrative identities after trusted verification. All use the same administrative dashboard and data, with separately attributed sessions/actions. **Pass:** each verified identity opens the shared panel; one admin's case review is visible to the others and its audit names the actual actor. |
| ADM-08 **[v1→v1.1]** | **v1:** downloadable redacted diagnostic bundles contain request/action IDs, necessary state/diff, model/policy versions, result and invariant, with home data tokenized. **v1.1:** add the detailed interactive timeline, timings, retry/fallback navigation, provider attempt and reservation drill-down. **Pass v1:** reproduce an error/undo from its self-contained bundle without secrets or unrelated history. **Pass v1.1:** trace each stage to its metered attempt and recovery action. |
| ADM-09 **[v1→v1.1]** | `/admin/operations` offers per-user and application-wide spending caps and warning thresholds. **v1:** owner-editable global/free-pool caps plus Normal/Paused control for new metered provider dispatches. **v1.1:** add model routing and Economy; Economy pauses new automated watch checks and expensive/speculative provider work. Client-side video export is not a server job and is not controlled as provider spend. Changes are audited. **Pass v1:** Paused blocks new metered dispatches while saved/manual work remains. **Pass v1.1:** Economy routes only eligible interactive AI to the configured cheaper model and pauses watch dispatches. |

**Grant mechanics.** Trial creation suggests 14 days but the administrator may remove the expiration; non-expiring trial/promo access is visibly labeled. Lifetime always has no automatic expiry. Additional usage specifies an explicit amount and unit, optionally an expiry or period; it does not silently grant an unlimited allowance. An administrator can revoke any grant; a reason remains optional. Do not require a free-text reason merely because a grant is large. The audit records the exact requested change automatically.

For plan-replacing grants, select one effective overlay with deterministic precedence: permanent complimentary, grandfathered, promotion, then trial; among equal types use the newest startsAt followed by stable grant ID. Preview the resulting access before applying a lower-benefit override. A manager can end or supersede a grant explicitly. Usage-only grants add their remaining unconsumed allowance after the base allowance, consumed earliest-expiring first; null expiry sorts last. Consumed additions never replenish merely because a plan changes. Existing operational ceilings still apply unless separately changed by an authorized operator. Retain the complete grant history and base assignment when the effective overlay changes.

Promo campaign creation and redemption are required; buying ads, integrating an advertising network, or monetizing ad impressions is not. A campaign defines the supported grant type, plan version or usage amount, per-account redemption limit (default one), optional campaign-wide limit, and optional valid-until time. Server-validated unguessable/signed codes select these stored values; a browser-supplied plan or “ad watched” assertion cannot grant access. Campaign edits never silently rewrite already-issued grants.

**Administrative identities.** As an explicit bootstrap default, weldayenterprises@gmail.com receives owner authority (which includes admin), and the other two receive admin. Resolve verified email through the existing trusted identity provider and bind roles to immutable account subjects. A typed profile email, unverified claim, similar spelling, or another authentication issuer cannot acquire a role. A seed activates only on the first sign-in whose trusted verified email matches; it creates no account, password, or duplicate. Legacy accounts are not migrated. Record the bootstrap completion once. Later deployment does not regrant a deliberately revoked role. These privileges are independent of paid membership and do not automatically create Pro or booking consent.

All three can grant special access and operate the shared diagnostic panel; only the owner can appoint further admins, delegate plan publishing, or change the global financial safety ceiling. Ordinary admins may choose Economy/Paused and review usage; restoring Normal follows the existing operator policy, while raising spending ceilings requires owner or explicit operations:manage permission. There is no shared admin password and no separate copy of the dashboard per login.

**Break-glass owner recovery.** Provide `pnpm admin:restore-owner --email <verified email>`, runnable only with direct database access. It can restore owner authority only to a trusted verified account, writes an append-only audit entry, never creates a password, and is documented in `docs/runbooks/owner-recovery.md`. The application still prevents ordinary UI/API demotion of the last active owner.

**Public-sign-up abuse protection.** Require verified email before any AI, geocoding, Places, or Routes call; require a sign-up bot challenge; apply per-IP and per-device sign-up throttles; provide an owner kill switch for new registrations; and enforce per-account limits on AI, geocoding, routing, import, and export endpoints. These controls are operational/security controls, not commercial gates, and remain enforced at public launch. Add `docs/runbooks/cost-spike.md` covering pause-AI, pause-signups, and key rotation.


**Cost envelope.** The resolved Free daily variable-provider ceiling is 0.25 USD. Initial Plus and Pro ceilings are 5.00 and 15.00 USD per day respectively, still subject to their monthly AI budgets; these are editable specification defaults. Include attributable AI, Maps, notifications, external monitoring, and rendering consumption in the daily operational total. Trip expenses and customer booking prices are not application operating costs. Unallocated provider usage belongs to an explicit system bucket and still counts globally.

For this small launch, default the application-wide variable-provider ceiling to **5.00 USD/day and 100.00 USD/calendar month**, editable by the owner. All Free accounts together may consume at most 50% of the global daily variable-provider ceiling (2.50 USD/day at the default), so Free usage cannot consume the entire launch-day pool. Hold back 0.50 USD/day and 5.00 USD/month inside those totals for emergency assistance; normal/grace work cannot consume those reserves. Admission must fit every applicable user/provider/application window, including reservations. Warn operators at 80% and 95%, with in-app alerts always and configured verified email delivery. Show user and global ceilings, observed cost, pending reservations, emergency remaining, unpriced units, and estimated fixed hosting/database costs separately.

These ceilings control new metered work; they cannot guarantee profitability before prices, fixed costs, acquisition costs, and actual usage are known. Some provider/browser-map charges arrive after dispatch or are only estimated: reserve conservatively, reconcile late reports, show any overrun, and stop new paid dispatches when a hard ceiling is reached rather than promising an exact vendor-invoice cap. Browser-accessible provider keys require the applicable API/origin restrictions and provider-side quotas; application controls alone cannot make them a per-user billing boundary. The dashboard includes a cost projection using current active users and per-user averages, plus a maximum-allowance scenario. At 100 Free accounts each spending the 0.25 USD/day hard maximum, the uncapped 30-day scenario is 750 USD; show that the Free-pool cap and global 100 USD/month launch ceiling intervene. The projected-cost panel must show `min(number_of_free_accounts × 0.25 USD, free_pool_daily_cap)` beside the monthly ceiling. Do not advertise that every account's maximum can be simultaneously funded by a smaller global budget.

**v1.1 - Emergency economy mode.** Normal uses the configured primary Gemini model. Economy uses an explicitly configured lower-cost paid compatible Gemini model with data handling consistent with the privacy policy. An alternative free tier requires explicit owner approval and accurate disclosure of any different data handling. Verify current availability, terms, rates, and validation compatibility; no model name is permanently assumed cheapest. V1 reserves funds but implements no economy dispatch, session, or fallback offer.

After ordinary allowance exhaustion, or when the operator selects Economy, offer “Finish this trip in economy mode” for the currently selected trip. Allow one finish session per account per UTC day, ending after 15 minutes or three submitted prompts, whichever comes first, and only while the reserved user/global cost is sufficient. This bounded session may exceed the ordinary Free prompt count, but it cannot exceed hard financial ceilings. It cannot start new trips, monitoring, bulk imports, or rebooking; allow clarifications, completion of the current proposal, and small edits with the same validation/confirmation rules. Show the reduced-capability banner, model label, remaining session time/prompts, and clear manual alternatives.

Economy pauses proactive monitoring and speculative metered searches. It does not block deterministic manual edits, permitted downloads, or client-side schematic video using already available permitted data. No cheaper model may change ownership checks, snap an exact point to a road, invent unknown costs, or bypass confirmation. In v1.1 allow at most one primary retry and one compatible fallback attempt per interactive request, each budget-admitted. In v1 permit at most one primary retry and no economy fallback. If no permitted model or remaining budget can serve a request, preserve the draft and show manual recovery. There is no transaction reconciliation path to implement before v2.

For normal-mode requests, record safe metadata for every stage, including successful requests; retain detailed redacted content for error/undo cases under the existing retention rules. Reproduction bundles contain schema/version, synthetic or redacted inputs, necessary state/diff, action IDs, timings, observed result, expected invariant, model/policy version, and request/attempt links. Redaction is required even when the export is intended for another AI coding agent. Never include authentication secrets or an entire unrelated customer history. Bundles are data, not commands to execute.

### 11.16 Fresh database

The application owns the complete `groundbnb` schema in a new Neon project/database. Production branch is `main`; preview/local branches follow SYS-11 and Section 11.22. No direct legacy-table reads, writes, backfills, or coexistence are required or allowed. Existing users register afresh and explicitly transfer permitted files through the new application. This is a new application identity even when the same Google account is used; passwords, sessions, roles, grants, and provider consents never transfer from a file.

Use versioned SQL migrations checked into the repository. The fixture seed script must refuse to run against production. Keep normalized records from Section 11.3 rather than carrying forward legacy `groundbnb_profiles` or `groundbnb_trips` document shapes; native import/export may still preserve its specified `extensions` object.

Enable Neon point-in-time recovery or its current supported equivalent. Set a production recovery window of at least seven days and an operational recovery-time target of four hours for this launch. Document the available recovery-point granularity and last recoverable time without promising zero data loss. Run the non-production restore drill before launch, including LEG-12 deletion/revocation replay, using synthetic accounts. A direct legacy database importer is outside scope; user-controlled portable transfer is required by FILE-10.

### 11.17 Low-friction planning and reliable outcomes (REL)

The primary success criterion is useful travel planning with few interruptions: use the profile, preserve exact off-road/water points, ask a focused clarification when needed, and make failures actionable. A meaningful best effort is a valid saved result, a clear proposal, a focused question, or a preserved draft with a recovery action; it is never a fabricated successful route.

| ID | Requirement and pass condition |
| --- | --- |
| REL-01 **[v1]** | Offer “Plan my trip” in intake review and the empty planner, prefilled from explicit start/destination or the profile home default. Use profile modes, pets, pace, budget, accessibility, driving limits, and trip overrides. **Pass:** a profile with home, destination, dog, RV, and short driving days produces a relevant starter proposal in one action without asking for the same information again. |
| REL-02 **[v1]** | If endpoints are missing or ambiguous, ask one focused question or offer labeled choices. Offer an explicit “Try a sample trip” path that creates a clearly marked demo draft with no reservations. **Pass:** an unknown home is never invented; a demo never overwrites a real trip or counts as verified booking/availability. |
| REL-03 **[v1]** | Validate and recover from AI errors: correct a malformed action once where safe, clarify genuinely ambiguous input, and offer a bounded fallback for provider failure. **Pass:** “Add a stop near it” either resolves to the intended stable stop or asks which stop; a malformed model reply never reaches persistent trip state. |
| REL-04 **[v1]** | User errors show what failed, what remains saved, and a concrete next step plus request ID and expandable safe details. Admin traces contain the deeper diagnostic evidence. **Pass:** timeout, unknown place, conflicting anchor, cost exhaustion, and failed save each yield distinct recovery controls and leave the input usable. |
| REL-05 **[v1→v1.1]** | **v1:** profile PDF is a first-class output on every plan and reflects the latest saved profile/notes. **v1.1 extension:** route-tour video follows the selected saved tour and route using the schematic client-side renderer in Section 11.19. Mobile flows remain readable and touch-operable. **Pass v1:** edit the profile and export the new PDF without stale data. **Pass v1.1:** move an exact point, generate the tour, and export a video showing that updated point. |

When the user presses Plan my trip, save/resolve the latest profile and explicit trip overrides, then create a starter proposal using real endpoint coordinates and available provider geometry. Prefer startLocation over home; use home only when supplied and applicable. The home round-trip preference applies only without a conflicting explicit one-way request. Keep the suggested route small and comprehensible (up to ten initial stops as a presentation default, not a trip-capacity limit); explain how to extend it. Show a concise “Based on your profile” explanation and Apply/Edit controls. Applying is one revisioned save. If the user directly commands “plot/save a route from X to Y,” follow existing immediate-save intent rules rather than adding redundant confirmation.

Profile-based starter proposals do not erase an existing route: offer a diff or a separate trip subject to the saved-trip cap. Passive opening is read-only. Try a sample trip first shows a deterministic fictional three-stop preview with no provider calls and no saved record. Save sample creates a normal isDemo trip subject to the same atomic saved-trip cap and provider budgets; report-only mode logs the usual would-deny result. A demo saved in enforced mode consumes one slot. Convert to my trip reviews fictional assumptions and changes the existing trip in place without another slot. Never overwrite a real profile or route. Missing dates stay Undated; unavailable provider geometry is a labeled diagram, never verified road/water navigation.

A lower-cost model or recovery path has the same typed-action validator, identity, precise-coordinate, schedule, and confirmation constraints as the primary path. Remove repeated questions whose answers exist in the active profile. Show unresolved constraints explicitly rather than silently relaxing them. Errors in one leg should identify that leg and retain the other saved legs. Provide Retry affected step, Edit request, Choose place, or Continue manually as relevant, not one generic failure message.

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

### 11.19 Route-tour video export (FILE)

| ID | Requirement and pass condition |
| --- | --- |
| FILE-07 **[v1.1]** | Add Export video to Tour and the export menu for Plus/Pro. The **only v1.1 renderer is a schematic route animation generated on the user's device**, targeting MP4 H.264 at 1280×720/30 fps/no audio with a WebM fallback where H.264 encoding is unavailable. Use saved tour order/timing, stop/leg captions, route colors, a title card, and end card. Verify current WebCodecs/encoding and muxer browser support before implementation. **Pass:** a three-view tour produces a playable file with correct order, coordinates, labels, and generated timeline; unsupported encoding falls back honestly. |
| FILE-08 **[v1.1]** | Rendering snapshots the selected trip/tour revision at start. Later edits do not alter an in-progress render. Cancel stops the local render and never changes/corrupts the trip. No server render queue, resumable job ID, private download URL, or server retention is used. **Pass:** edit a stop after rendering starts; the running render retains its declared snapshot and the next export uses the new revision. |
| FILE-09 **[v1.1]** | Render only authored or independently export-permitted points/vectors/original assets. Do not record or redistribute proprietary basemap imagery. Provider route geometry is not automatically exportable merely because the renderer is schematic. **Pass:** restricted geometry/imagery is absent; if needed use a clearly labeled straight connector between permitted authored points, and disclose omitted unresolved stops before rendering. Photorealistic export is unsupported. |

The video represents the saved route/tour and is not proof of road/water navigability. Default export is one pass with loop off, current flyover/pause timing, selected captions, title/end cards, and the “Hide precise home location” option enabled. Home masking obscures the home caption and omits the immediate approach within 500 meters from the exported visualization without mutating stored coordinates. Maximum output length is 10 minutes; overlong tours require a selected range or explicit timing compression preview rather than silently dropping stops.

Rendering occurs client-side. `taskType=video_export` may record a usage event for product analytics but its provider cost is zero. The generated file is downloaded directly and is not retained by the application server. Browser memory/device constraints must fail safely with a smaller-range suggestion; they must not mutate trip/tour state.

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

### 11.21 Units and locale

**v1.1.** Add profile field `units` with values `imperial` or `metric`, default `imperial`. Canonical storage remains SI/normalized. Metric display/input uses km, meters, liters, L/100km, and °C; imperial uses miles/yards/feet, US gallons/MPG, and °F. Use locale-aware date formatting while preserving unambiguous stored dates/instants. Money retains its explicit ISO currency; changing units never converts money.

### 11.22 Release integrity, portable data, and operational safeguards

These decisions are part of specification 2.5. They are mandatory for the tagged tier and independent of the original application's code or database. They resolve the implementation risks below without authorizing a builder to silently reduce scope.

| ID | Requirement and pass condition |
| --- | --- |
| SYS-11 **[v1]** | Isolate production, previews, local development, and recovery controls as described below. **Pass:** a fresh preview contains only synthetic users/data, cannot use production sessions or send real customer email, and has no metered dispatch until its bounded integration-test allowance is explicitly enabled. |
| SYS-12 **[v1]** | Make long route/AI jobs durable, cancellable, revision-safe, and crash-recoverable. **Pass:** crash after a provider response and before commit, restart workers, replay delivery, and deploy a new worker version; obtain at most one committed mutation, account for every incurred attempt, and expose uncertain outcomes without blind repeat dispatch. |
| SYS-13 **[v1]** | Pass the M2A core experience gate before expanding optimization, annual scheduling, and secondary feature surfaces. **Pass:** one real authenticated profile drives a three-stop proposal; exact land/water point editing, real AI mutation, undo, and fresh-session reload all preserve the expected canonical state. |
| SYS-14 **[v1]** | Keep one frozen source specification and traceable derived task documents with automated ID/tier/dependency checks. **Pass:** duplicate/missing IDs, future-tier dependencies in v1 gates, and a changed requirement without refreshed task references fail the documentation gate. The ledger never turns Blocked into Verified without evidence. |
| RULE-13 **[v1]** | Data provenance, positioning policy, and display freshness are separate facts. **Pass:** changing a provider-derived stop to exact_gps preserves its provenance and cannot bypass retention/export policy; expiry never relocates an authored coordinate or makes a missing provider value zero. |
| FILE-10 **[v1]** | Provide user-controlled profile/trip file transfer on all plans, subject to applicable trip/import limits and operating budgets. **Pass:** a newly registered account previews and imports a permitted native trip plus selected profile answers without transferring old owner IDs, passwords, roles, entitlements, tokens, or unreviewed confirmations. |
| MEM-15 **[v1→v1.1]** | Distinguish reserved emergency funds from spendable ordinary allowance. **Pass v1:** Free stops ordinary AI at 0.23 USD, with 0.02 held unavailable and no Economy offer; global reserves likewise cannot fund ordinary calls. **Pass v1.1:** only a valid bounded economy session can spend those reserves within every applicable financial window. |
| ACC-08 **[v1]** | Require a verified second factor for owner/admin access and recent step-up for sensitive administrative actions. **Pass:** an otherwise valid password/Google session without the required factor cannot read diagnostics, export cases, grant access, or alter roles/caps. Factor reset revokes privileged sessions and is audited. |
| ACC-09 **[v1]** | Permit controlled owner transfer and prevent last-owner deletion/demotion. **Pass:** transfer requires current-owner step-up plus acceptance by a verified MFA-enrolled admin; the role swap is atomic, audited, and keeps one active owner. An abandoned transfer changes neither role. |
| LEG-12 **[v1]** | Reapply deletion/revocation controls before restoring service from a backup. **Pass:** restore a snapshot from before an account deletion and session revocation; deleted content is purged and old sessions/credentials fail before users or jobs can reach the restored environment. |
| SCL-05 **[v1→v1.1]** | Score AI scenarios against declared expected state changes or justified clarifications, not generic plausibility. **Pass:** unnecessary clarification for an unambiguous edit fails; an invariant violation fails the release even when the average success rate exceeds 95%. Use 40 cases in v1 and at least 100 in v1.1. |
| UI-09 **[v1]** | Establish a fixed visual baseline for the core screens and compare actual browser renders against it. **Pass:** intake, profile/PDF, desktop planner, mobile planner, and admin dashboard use the same synthetic profile/trip and recorded viewports; differences are reviewed, and tests do not automatically bless new screenshots. |

#### A. Portable map content and provenance

Store a provenance descriptor for each independent location value, address, geometry, and provider-derived measurement. Required logical fields are origin (user/provider/import/calculated), provider/API where applicable, sourceReference, fetchedAt, retentionUntil or documented no-expiry permission, allowed purposes, policyVersion, and dependency IDs for calculated values. An import adds its source provenance rather than erasing it. Server-configured policy determines permitted use; client-provided `exportable=true`, policy IDs, or an `exact_gps` flag cannot grant rights.

| Content | Persistence and portable behavior |
| --- | --- |
| Independently supplied GPS, original label, manual speed/duration/fare | Retain until the user deletes it; include in permitted exports and videos. Point movement changes the authored value only through an explicit revisioned action. |
| Google/provider location, address, route, or measurement | Retain and use only for the API-specific permitted purpose/window. The descriptor must distinguish purposes: in-app display, cache, backup/history, offline access, external export, video, and AI context. Permission for one purpose does not imply another. |
| Derived fuel/time/totals or simplified route based on provider content | Retain dependency provenance and evaluate the relevant policy. Simplification, rounding, summarization, or changing the presentation to a schematic does not automatically remove restrictions. |
| Imported third-party content | Preserve known origin and dates. Treat absent rights/provenance as unverified and require a supported permitted-use decision before redistribution; do not silently relabel it authored. A user may provide their own independently authored replacement. |

RULE-12's dated review records field-by-field retention and permitted uses, including use as Gemini context. Recheck current official sources before implementing each integration. Baseline sources checked during this specification review on 2026-09-28 are [Google Maps service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), [Routes policies](https://developers.google.com/maps/documentation/routes/policies), and [Neon branchable authentication](https://neon.com/blog/neon-auth-branchable-identity-in-your-database). These URLs are verification references, not substitutes for behavior defined here; they do not grant unrestricted caching/export permissions.

When a provider field expires, remove restricted payloads from live data, local caches, pending proposals, retained operation results, undo/redo snapshots, and diagnostics. Any backup mechanism retaining such data must satisfy its applicable terms; otherwise keep that provider payload in a non-backed-up expiring cache and persist only permitted references. A stale badge alone is insufficient. Preserve stop IDs, authored coordinates, original user text, order, manual inputs, calendar references, and other permitted content. Show "Location needs refresh" or "Route geometry unavailable" with Refresh and Enter coordinates as applicable. Refresh is an explicit budget-admitted action; a denied refresh leaves the saved authored plan intact.

A provider-only coordinate may become null while its stop remains. A permitted provider reference or original user-entered label identifies that unresolved stop. It has no map marker until resolved and cannot form a verified new route leg. A newly resolved coordinate is a proposal if it would relocate a pinned destination; never silently replace an exact point. An authored point is never nulled merely because adjacent provider geometry expired. Null provider duration/distance remains unknown; manual values and independent authored measurements remain intact.

New native JSON exports contain a `portability` object with `policyVersion`, `exportedAt`, and `omissions` (entityId, field, reason, sourceReference when permitted). Each included value retains its provenance. Missing restricted geometry is represented by an empty component point array and explicit unavailable status, with no invented replacement measurement. Missing provider-only stop coordinates use point=null plus locationReference/unavailableReason. The importer preserves these states. Older input may omit portability; this selects unverified provenance for unknown sources rather than invalidating an otherwise valid empty or authored file. Tour views with unresolved targets remain listed and are skipped with an explicit warning; a wholly unresolved tour cannot play. A permitted independent custom target stays usable.

JSON, CSV, PDF, account exports, GPX, KML, GeoJSON, and video all use the same policy. Formats that cannot represent unresolved points/empty components omit those entries with an explicit pre-download list and exported note where supported; never emit invalid geometry or silently drop a destination. No format is an escape hatch. Export preview lists included authored content and omitted provider fields before download. A route-video fallback draws straight illustrative connectors between permitted available points and labels them schematic/unverified; it never recreates a restricted road polyline. Refreshing from a provider is only allowed when both the API call and the intended subsequent export/use are permitted. Google Maps handoff skips no endpoint silently: unresolved or unsupported portions are listed, with links offered only for the representable chunks.

The lossless guarantee applies to authored content and permitted included data, not to unavailable proprietary content. Deterministic F-11 fixtures supply export-permitted synthetic geometry. Require a second fixture for expiry/omission and a third for a user-authored exact point beside expired road access. Older imported native files lacking portability/provenance are previewed as unverified where their source is unknown; absence of metadata never grants export authority.

#### B. User-controlled transfer and demo accounting

The deployment starts with new application accounts. Reusing a Google login is convenient authentication, not automatic linking of old application records. Do not access an old database or require its code to implement transfer. The legacy service remains outside the new deployment's control.

Account settings offers Import profile and Import trip. Profile transfer accepts UTF-8 native JSON with format=groundbnb, formatVersion=1, kind=profile, exportedAt, profileFields (only the field dictionary in Section 11.3), and profileNotes (plain strings). Account Export profile produces this envelope after a sensitive-field preview. Also accept pasted readable profile text through the existing import preview; uncertain parsing requires selected-field review. Structured native import needs no AI. Assisted free-text interpretation consumes the ordinary AI allowance, and manual field entry remains available when it is exhausted.

Default profile merge preserves existing account values. Show before/after per field and select only the changes the user accepts. Home location and personal quotes are opt-in transfer fields. A combined request never imports authority: reject or ignore with visible warnings any owner, authentication, plan, admin-role, payment, session, or provider-consent fields. Native trip import remaps all IDs and references, checks capacity, and treats recorded bookings as unverified imported evidence. Arbitrary historical file formats are not promised automatic compatibility; supported text/CSV/native formats use their defined preview, and unsupported formats receive an actionable conversion/manual-entry message. No data is fetched or changed in an existing service.

A deterministic sample preview may be inspected without saving. Save sample uses normal trip creation, including atomic enforced capacity checks and report-only would-deny logging. A saved demo counts exactly like a draft and receives no free AI/provider allowance. Convert changes that same trip after review. Test saving, converting, archiving, trashing, restoring, and replacing demos at the cap so sample mode cannot bypass capacity.

#### C. Environments and recoverable execution

Create preview and local environments from an empty/schema-only or synthetic template branch, never an unsanitized production clone. Since auth data can be branched, exclude real auth identities/sessions as well as profile/trip rows. Seed test identities instead of the three real bootstrap emails. Production credentials, cookie domains, callback URLs, storage destinations, and provider restrictions must not be reused by previews. Preview access is restricted to the owner/developers; outbound email is captured or restricted to explicitly verified test recipients. Scheduled work and real provider dispatch are disabled by default.

A live integration run is an explicit owner-enabled exception with approved test accounts/recipients, a maximum 60-minute activation, and a 0.25 USD aggregate provider budget by default. It still obeys vendor/project quotas; record its cost separately from production user allowances. No automatic retry may extend its expiry or budget. Delete obsolete preview resources within seven days of PR closure, after preserving test evidence without personal data. Test environment detection and seed refusal against production; ambiguous configuration fails closed. Never copy production secrets into task documents or AI context.

Long jobs persist jobId, owner, operationId, expected revisions, schema/worker version, status, stage/checkpoint, created/updated times, deadline, cancel request, attempts, provider attempt IDs, and budget reservations. States are queued/running/awaiting_confirmation/succeeded/failed/canceled/needs_reconciliation. A worker claims a time-limited lease and monotonically increasing claim generation; only its current generation may advance state or commit. Choose a 60-second lease with a heartbeat at least every 20 seconds; split work so runtime limits cannot silently terminate an uncheckpointed large step.

Every provider dispatch has a durable attempt ID and reservation before the call. Reuse provider idempotency support where available, but do not assume every API supports it. Persist the result/checkpoint before committing the application operation; respect provider-data retention. If a process crashes after dispatch with an unknown outcome, retain its reservation and mark needs_reconciliation. Do not automatically redispatch the same uncertain call just because a lease expired. Reconcile from provider evidence when possible; otherwise explain pending usage and permit only a separately admitted, explicitly requested retry. A successful checkpoint may resume without another provider call. Database mutation and operation acknowledgment commit together exactly once.

Check cancellation, suspension, ownership, current financial policy, and expected revisions before each step and before commit. Interactive requests retain their two-minute UI deadline; larger route jobs may run for up to 15 minutes with persisted progress and a resumable status view. On deadline preserve the draft/checkpoint and require an explicit resume with fresh admission. No job may commit a stale trip revision. A late successful commit is reported as Saved, even if cancel arrived afterward. Bound automatic primary retry to one per interactive request; v1.1 may add its one budget-admitted fallback. Never retry a transaction by model substitution.

Deployments must either support a stored job's schema version or drain/stop its work into a recoverable state before changing that contract. A terminal failure releases only known-unused reservations, records a diagnostic bundle, and retains actionable status. Give admins a safe status/reconciliation view; do not provide a button that blindly repeats customer prompts. V1.1 scheduled watches reuse these semantics, atomically claim quota slots, and deduplicate notifications. Due-time dispatch is within 15 minutes of the scheduled time when service is healthy; after an outage run at most one eligible catch-up check, never a backlog burst across missed quota windows.

#### D. Administrator and deletion lifecycle

Owner/admin roles are ineffective for privileged reads and writes until a second factor is enrolled and verified. Use verified provider-supported MFA, or a maintained TOTP integration with encrypted server-side factor secrets and one-use hashed recovery codes; do not invent a cryptographic scheme. Merely signing in with Google does not prove a second-factor challenge occurred. Prompt enrollment before showing the admin dashboard. Privileged sessions require a factor at least every 12 hours, with a 30-minute inactivity timeout. Role changes, grants, caps, diagnostic exports, suspension, session revocation, owner transfer, and factor changes additionally require a challenge within the last five minutes. Log challenge outcome, not secrets/codes. Rate-limit factor attempts.

Step-up failure changes no record and exposes no protected content. Factor reset invalidates privileged sessions; normal owner recovery cannot bypass this requirement. Loss of all owner methods uses the direct-database break-glass workflow under controlled operator access, verified identity evidence, and a separate audited factor-reset step if necessary. It never silently removes MFA on a normal deployment or regrants a revoked bootstrap role.

Owner transfer begins with a current-owner challenge and selects an active verified MFA-enrolled admin. The recipient accepts after their own recent challenge within 24 hours. Check both accounts remain eligible and swap owner/admin atomically; the old owner remains admin unless separately demoted. Incomplete/expired transfers leave the current owner unchanged. The sole owner cannot delete or suspend their account until transfer completes. Named confirmation explains this and links to Transfer ownership; never leave an ownerless live application.

Deletion immediately disables sign-in/session/credential use and undispatched work, then purges active application/auth data within 24 hours. Show completion and the backup retention window. A provider deletion failure leaves a retryable deletion job with access already revoked, never a false completion. Fresh registration after completed deletion creates a new account with no recovered trips, grants, roles, or consent. Bootstrap records prevent a deleted/recreated previously revoked administrator from gaining privilege again automatically.

Maintain minimal restricted recovery-control records separately from the production database restore target, for example a dedicated access-restricted Neon recovery-control branch. They contain keyed account/credential identifiers, deletion or revocation timestamps/epochs, and processing state, not profile content or raw credentials. Keep the corresponding HMAC key outside restored snapshots. These are pseudonymous security records, not anonymous usage statistics; disclose their limited purpose and access. Retain them until every backup/snapshot capable of restoring the affected state has expired, plus seven days; longer manually retained backups extend that requirement. Inventory restore points rather than guessing the horizon.

Restore into a quarantined environment with logins, workers, email, and paid dispatch disabled. Replay deletion controls and revocation epochs, purge restored deleted content, invalidate pre-restore sessions/agent credentials, verify effective roles and bootstrap revocations, and only then enable service. Old credentials must never be reactivated by restoration. An unavailable recovery-control ledger blocks reopening the restore. Include one deleted synthetic user, one revoked session/credential, and one revoked seed administrator in the drill. Active audits are append-only for admins, but controlled privacy purge removes identifying content and retains only the minimal deidentified event metadata permitted by the retention policy.

#### E. Verification and specification handoff

Each AI scenario declares its class (explicit mutation, information-only, ambiguous request, or failure recovery), starting records/revisions, allowed provider observations, exact expected state/diff or clarification target, and forbidden effects. The v1 suite contains 24 explicit mutations, eight ambiguous requests, and eight information-only requests; apply injected failures to at least 12 representative cases in addition. The v1.1 healthy suite contains 60 mutations, 20 ambiguous, and 20 information-only cases, plus at least 30 injected failures. A clarification for a resolvable command, repeated request for existing profile facts, generic apology, or unrelated proposal is a failed healthy outcome.

Require at least 95% correct results across the complete healthy suite and at least 95% among explicit mutations, rounded up to whole passing cases. All ambiguous cases must avoid unauthorized mutation and information-only cases must not mutate. Invariants have zero tolerance independent of percentages. Run deterministic suites on every relevant change. Before each release or model/prompt-policy change, run the versioned healthy suite against the configured live model in an isolated synthetic environment with an explicitly approved bounded budget; record model/configuration, seed where supported, attempt count, date, latency and cost. Do not repeatedly rerun failures until they pass and count only the successes. The baseline 0.25 USD integration budget may be raised explicitly for this measured gate; stopping for budget exhaustion leaves the gate incomplete. A small live smoke sample during development does not replace the release outcome suite.

Create visual baselines using synthetic data at 1440x900, 1280x800, 768x1024, 390x844, and 844x390. Cover empty/populated planner, exact-point adjustment, expanded cards, keyboard-open chat, profile/PDF, and admin tables. The owner or delegated reviewing agent approves layouts against the written visual requirements after the initial demonstration; freeze those baselines and review differences before replacing them. A coding task cannot approve its own unexplained visual regression. Ignore changing map imagery for pixel comparison but assert overlay placement, visible attribution, controls, text contrast, and state. Test current stable Chrome and Edge on Windows, Safari on iOS, and Chrome on Android; viewport emulation supplements actual mobile checks and never proves software-keyboard or encoding behavior by itself. Unsupported 3D must preserve the fully usable 2D editing path. Record the tested browser/device versions.

Keep this single specification as the frozen source of truth with version/hash in the new repository. The split spec files are derived views, not independent authorities. Each task includes its feature sections plus shared ownership/revision, provenance, cost, security, and tier rules that apply to it; 'read only task files' must never omit shared invariants. Record any approved amendment against stable requirement IDs and regenerate affected task views. Every new requirement above receives a milestone and concrete test evidence. A documentation consistency check validates IDs, tiers, references, fixture coverage, and source/derived version agreement. No task or model may waive a requirement by editing its own acceptance criteria.

## 12. Build sequence and verification

### 12.0 Repository and Codex workflow

Codex creates these files before product code:

```text
AGENTS.md
docs/spec/00-overview.md
docs/spec/01-ui-nav.md
docs/spec/02-planner.md
docs/spec/03-routing.md
docs/spec/04-calendar-time.md
docs/spec/05-tour-files.md
docs/spec/06-pro-rec.md
docs/spec/07-data-ops.md
docs/spec/08-catalog.md
docs/spec/09-admin-usage.md
docs/spec/10-mcp.md
docs/spec/11-maps-modes.md
docs/spec/12-membership.md
docs/spec/13-launch.md
docs/spec/14-fixtures.md
docs/spec/15-shared-safeguards.md
docs/ledger.csv
docs/STATE.md
docs/OPEN-DECISIONS.md
docs/integrations.md
docs/tasks/M0-*.md ... M9-*.md
```

The split is mechanical and traceable to the frozen specification version/hash: copy relevant sections with requirement IDs, retain Section 0 release/policy precedence and Section 11 detailed contracts, and include Section 11.22 in the shared task context. The ledger records `id,title,tier,milestone,depends_on,status,evidence,notes`; allowed status values are Not started, Implemented, Verified, Failed, Blocked. Evidence names a passing test or reproducible command/result tied to a revision. A ledger cannot redefine tier, waive a requirement, or treat a live mock as Verified.

`AGENTS.md` stays concise (target under 150 lines). Each task reads its named feature files plus the shared ownership, revision, provenance, financial, security, and tier contracts; never omit those invariants for token savings. A task should fit a working session, with resumable checkpoints rather than a forced commit of unfinished work. End each session by updating the ledger and STATE.md; commit a coherent documentation/code checkpoint after its stated checks, clearly recording any incomplete work. Use deterministic doubles for routine tests and explicitly bounded live integration gates. Serialize heavy build/browser suites on the owner-class Windows i7/16 GB machine; independent lightweight tasks may proceed separately. Never mark Verified without evidence or change the frozen specification to make a test pass.

Each `docs/tasks/Mx-*.md` is self-contained: requirement IDs, tier, spec files to read, likely changed files, dependencies, exit gate, and exact test commands. Split tasks until one session can complete them without reloading the entire specification.

### 12.1 Execution order for the building agent

Keep the coverage ledger authoritative for evidence/status, with scope fixed by the specification. “Verified” requires a passing test or reproducible observed result. A Blocked item names its actual missing dependency; deterministic mocks prove implementation behavior but do not establish a live integration.

| Milestone | Deliverable and exit gate |
| --- | --- |
| **M0 — Repo and environment** | Frozen spec/hash, derived task views, ledger and SYS-14 checker; CI typecheck/lint/unit/audit; new isolated Neon/Vercel environments with SYS-11 synthetic previews; env schema, baseline migration, recovery ledger and restore configuration. Verify RULE-12 permitted-data architecture before defining provider persistence. **Exit:** preview revision/health check works, no production data/secrets exist in it, and bounded live-test activation is verified. |
| **M1 — Foundation** | Visual tokens, shell, Neon Auth, account isolation, profile/intake/autosave, guest merge, LEG-01/02/08, abuse controls, membership/report-only evaluation, enforced spend reservations including MEM-15 v1 unavailable reserves, diagnostic plumbing, and ACC-08 MFA foundation. No live AI/map test bypasses these controls. |
| **M2 — Saved manual trip** | Trip library, revisioned writes, zero/one/many stops, independent legs, precise-point/access model, costs, undo/redo, reload, static sample preview, and saved demos that consume an ordinary trip slot. |
| **M2A — Core experience proof** | A narrow integration slice of later map/AI work: live sign-in/profile, three-stop starter proposal, exact land and water fixtures with honest geometry status, 2D drag, one real validated AI edit, undo, and fresh-session reload. Include provider-outage and stale-revision cases, baseline cost metering, SYS-12 job recovery smoke, and initial desktop/mobile visual review. **Exit:** SYS-13 passes with saved-data evidence and measured live cost. Complete this before expanding M3/M4; those milestones finish their remaining scope. |
| **M3 — Maps and modes** | Expand the proven M2A map slice to all Google modes, provider integrations, point/access policies, multimodal/manual geometry, custody, connectors, optimization, large routes, and terms-compliant expiry/portability (RULE-12/13). Finish supported-browser map checks. |
| **M4 — AI actions** | Real Gemini conversation, profile-based starter proposal, typed/validated actions, clarification/recovery, progress/cancel, trip/profile memory, topic reset, Clean Sweep, cost reservations, 0.25 USD/day Free policy, and 40-scenario v1 suite. Economy mode is v1.1. |
| **M5 — Calendar and schedule** | Canonical annual hierarchy, segment edits, date ranges, multiple anchors, time zones, lodging nights, totals, and conflict UI. |
| **M6 — Tour and files** | Tour, all-plan profile PDF, native JSON/profile transfer, GeoJSON, GPX, KML, CSV, iCal, Google Maps/Calendar handoffs, Marine Waypoints, portability warnings/expiry fixtures, LEG-03/04 active deletion/export and FILE-10 transfer. Video remains v1.1. |
| **M7 — Admin and usage (v1)** | Owner/admin/admin bootstrap with MFA, ACC-09 owner transfer and controlled recovery, diagnostics/undo and v1 reproduction bundles, review/usage dashboards, global/free-pool caps, Normal/Paused, lifetime assignments, LEG-05/06/07. Economy, expanded timeline, and plan-publishing UI remain v1.1. |
| **M8 — Launch hardening** | LEG-09/10/11/12, deletion/revocation restore drill, job crash/deployment drills, SCL-01/03/04/05 launch portions, UI-09 cross-browser visual/accessibility baselines, complete bounded live outcome suite, runbooks and owner-reviewed legal drafts. No v1 requirement remains Blocked. **This is the v1 public-launch gate.** |
| **M9 — v1.1** | Alert/manual watches and due-time dispatch, camps/trails, permitted weather/tides, MCP-01–05, client-side schematic video, /admin/plans, expanded grants/timelines, Economy and MEM-15 reserve release, units, and the 100-scenario outcome suite. Start after M8 passes. Local video works in Economy/Paused without provider calls. |
| **v2 (no milestone until dependency approved)** | Supplier transactions/auto-rebooking, MCP-06 transaction boundary extension, promotions/campaign redemption, SMS/push, verified advanced marine/weather/tide overlays, and SCL-02 growth gate. |

Membership and enforceable financial reservations begin in M1; M2 tests capacity; M2A proves the core experience before broad M3/M4 expansion. SYS-12 starts before long work is dispatched and completes its crash/deployment tests by M8. Standard exports and FILE-10 are M6, independent of future billing. Use enforced commercial cohorts for matrix boundaries and report-only cohorts for public-launch behavior. M7 completes administrative controls and M8 audits every v1 gate; no placeholder stands in for missing functionality.

### 12.2 Deterministic acceptance fixtures

The following data is synthetic. Use a controlled routing/price/clock service in tests; values are expected inputs, not real-world travel claims. In live verification use real test credentials and supplier test environments. A fixture test and a live test are separate evidence.

| Fixture | Exact input and expected output |
| --- | --- |
| F-01 Fuel/currency | Road legs of 60 and 40 miles, MPG 20, fuel 4.00 USD/gallon; four lodging nights at 120.00 USD; one 30.00 USD party ferry fare and one 10.00 EUR fare. Road fuel = 20.00 USD; known USD subtotal = 530.00; EUR subtotal = 10.00. No currency conversion. Null ferry fare removes 30.00 from known subtotal and adds one unknown item; explicit zero remains known zero. |
| F-02 Access | Three stops: A road point; P at 35.000000,−80.000000 with road access R 200 meters away in the fixture; B road point. Both adjacent primary legs Driving. Expected order: A, road A→R, walk R→P, P, walk P→R, road R→B, B. Walked distance = 400 meters. Changing separation to 15 meters hides connectors but preserves P and R. |
| F-03 Time zones | Depart 2027-01-15 09:00 America/New_York; a two-hour leg arrives in America/Chicago at 10:00 local, 16:00 UTC. A 30-minute stay leaves at 10:30 local. The elapsed trip time never becomes one hour because of the clock difference. |
| F-04 Anchors | A departure 09:00 UTC; travel 60 minutes; B stay 30 minutes; travel 60 minutes; C arrival anchor 12:00 UTC. Add 30 minutes waiting before C. Change C anchor to 10:00: report 90-minute conflict and keep the previously saved schedule, with the invalid proposal editable. |
| F-05 Nights/range | A lodging stay checks in Jan 10 and out Jan 14, 2027, at 120.00 USD/night. Full stay is four nights/480.00; viewing Jan 11–12 includes two night charges/240.00. A leg departing Jan 10 and arriving Jan 11 is contextual on Jan 11 but not charged twice. |
| F-06 Revision/race | Two clients load revision 7. Client A saves operation X, getting 8. Client B's expected-7 write conflicts and cannot erase A. Retrying X with identical input returns revision 8. Disconnect after X commit and retry: exactly one edit exists. |
| F-07 Identity | Account A owns Trip A and Account B owns Trip B. A requests B's ID and gets unavailable. While A's request is pending, switch to B; a late response for A never paints into B's UI or writes B's state. |
| F-08 Identity-preserving edit | A/B/C have IDs S1/S2/S3. Rename S2 to “Favorite overlook,” reorder to S1/S3/S2, and reload. S2 retains its coordinates; only neighbor legs change. Remove S1, then S3: S2 persists alone with no leg. Undo restores S3/S2 and their leg; a second undo restores S1/S3/S2. |
| F-09 Large plan | Use 40 stops over four named seasonal segments, including road, walking, water, and a stored vehicle. Search for stop 39, edit only Spring, and return to Full year. All 40 IDs remain and other segments' revisions/content are unchanged. Repeat rendering at 1,000 stops without mounting every detailed card. |
| F-10 Mode replacement | A ferry leg has a 30.00 USD fare and no road fuel. Change it to a 40-mile drive at 20 MPG and 4.00 USD/gallon. New contribution is 8.00 USD fuel, zero active ferry fare; undo restores the ferry exactly. |
| F-11 Native round-trip | Save F-02 using synthetic export-permitted geometry with camera views and anchors; export, disable providers, import as new. Permitted content and references match after ID remapping with no geocoding/rerouting. Separately expire a provider-only field: export omits it with unavailable metadata, import retains the authored destinations and exposes unresolved geometry; no prohibited field is regenerated from undo or cache. |
| F-12 Broken file | Native file has latitude 95, a duplicate stop ID, or a parent cycle. Preview names the offending fields; Confirm is unavailable; the existing trip revision is unchanged. |
| F-13 AI intent | “What if we add a museum?” creates no mutation. “Can you add the museum after S2?” creates one insertion when unambiguous. Timeout restores Send/Cancel state and the last durable itinerary. A fake model success without an accepted action cannot generate a Saved toast. |
| F-14 Automation **[v2]** | Future transaction fixture: old avoidable total 300 USD, replacement 240 USD, fees 20 USD: savings 40 USD. A 50 USD threshold suppresses action; a 25 USD threshold permits an alert. No v1/v1.1 code path can execute this fixture. Once a supplier/processor exists, revoking authorization before booking yields zero provider purchase calls; an uncertain supplier response is reconciled without a duplicate purchase. |
| F-15 Tour | Add stops and legs twice: no duplicates. Rename one stop: linked generated name updates. Delete that stop: linked generated views are removed and restored by undo. Custom views persist. Flyover 5/Pause 5/Loop off are the initial settings. |
| F-16 Map presentations | Save a three-stop trip at revision 8 with a selected exact stop and tour. Switch 3D → 2D Map → 2D Satellite, toggle satellite labels, and return to 3D. Revision stays 8; selected stop, route geometry, totals, and tour stay equal; no AI/directions call occurs. On a device without 3D, both 2D modes and point adjustment remain usable. |
| F-17 Road versus exact drag | Given a road_snap stop, drop at point P with a valid road access R 25 meters away: destination becomes R, requested point remains P. Repeat with the nearest access 75 meters away: destination stays P and policy becomes exact_gps. For preexisting exact_gps land and sea points, a road at 5 meters causes no snap; the coordinates stay exactly P. |
| F-18 Move atomicity | Move B in A–B–C at revision 4 with a custom name, linked tour view, and driving access connector. Success creates revision 5 and one undo step; B's ID/name remain, both adjacent legs/access and tour target agree. Undo creates revision 6 with original coordinate/policy/geometry. Repeat with provider error, Escape, and stale base revision: no new saved movement occurs. |
| F-19 Diagnostic lineage | Prompt P produces operation X; user undoes X and then redoes it. One prompt case links X to one user-undo event and one redo; historical undone-operation count stays 1. A manual drag undo has no prompt link. A separate failed prompt appears under Errors. Refresh/replay of event delivery creates no duplicates; redacted secret text is absent from export. |
| F-20 Usage arithmetic | At 2027-01-15 10:05 UTC, user A has an ai_chat attempt with input 1,000 (cached subset 200), output 300 (reasoning subset 100), provider total 1,300. At 10:10 a mapping AI attempt has input 150/output 50/total 200 plus two separate directions requests. At 11:05 user B has input 300/output 200/total 500. All-user total is 2,000 tokens; A is 1,500; Mapping is 200 tokens plus two API requests. Hour 10 total is 1,500 and hour 11 total 500; the day/week/month sum is 2,000 with these as the only events. Cached/reasoning subsets add nothing extra. |
| F-21 Usage reconciliation | For one logical request, a failed provider attempt reports 40 tokens and its successful retry 100: total 140, requests 1, attempts 2. Replayed final reports leave those totals unchanged. A separate interrupted call initially has unknown usage and later reports 60: totals become 200 without a new attempt. At synthetic rates 1 USD/million input tokens and 2 USD/million output tokens, 1,000 uncached input + 300 output costs 0.0016 USD; keep cost precision even if a compact card rounds it. |
| F-22 Admin boundaries | Ordinary users cannot access admin data. Owner with recent MFA promotes A; A reviews cases and suspends ordinary B but cannot promote admins or suspend owner/admin. B's sessions fail immediately; in v1.1 its MCP credential also fails. Last-owner demotion/deletion is blocked pending confirmed transfer. Sensitive actions without recent step-up fail without leaking data; all detail/export/role/status actions are audited. |
| F-23 MCP parity **[v1.1]** | Issue a read-only credential restricted to Trip A: it can read A, cannot write A or enumerate/read Trip B. Issue an explicitly authorized write credential, apply a revision-checked reposition, export, undo, then inspect the UI: state matches. Retry the same operation: no duplicate mutation. Expire a protected-change proposal after 15 minutes: confirmation fails. Revoke the credential: subsequent calls fail; no AI usage was created by deterministic reads/edits. |
| F-24 Overlapping individual trips | Plus account A owns active Trip X and active Trip Y, both June 1–10, 2027. Save, select, edit, and reload each: identities, chat, geometry, and dates remain independent; date overlap causes no rejection. Propose the same RV in distant locations on June 5: drafts remain saved, but confirming incompatible shared-resource calendar commitments requires resolution. |
| F-25 Membership versions **[v1.1]** | Give account A a Pro version 1 lifetime grant. Publish version 2 with a lower synthetic allowance: A retains version 1. Rename Pro: A's identity/access remains intact. Advance the clock five years: the grant stays effective. An admin without plans:manage cannot publish; a permitted manager can bundle existing features. In report-only mode, exceeding a synthetic allowance logs a would-deny result without a charge or commercial block. |
| F-26 Membership matrix | **v1 enforced cohort:** Free permits JSON/profile PDF/Google Maps/basic maps/tour and denies CSV/marine export; Plus permits CSV and denies marine export; Pro permits marine export. **v1.1 extension:** Free denies MCP/video, Plus/Pro permit them within operational limits. Advanced verified overlays and supplier transactions have no enabled v1/v1.1 operation. Repeat public report-only commercial behavior separately; authentication and cost restrictions always apply. |
| F-27 Free grace | On a controlled UTC day Free completes 10 ordinary requests totaling **0.20 USD**. Warn by request 8 and at 0.16 USD base-cost usage. Admit two ordinary grace requests costing 0.015 USD each: total ordinary+grace = **0.23 USD**, grace count 2; reject another normal request and protect the 0.02 USD emergency reserve. A second account completes 10 requests totaling 0.19 USD, then admits one 0.025 USD grace request because the prompt count is exhausted; reject a following 0.006 USD normal request because only 0.005 USD ordinary grace remains. At 00:00 UTC the daily window resets; changing display zone cannot reset it early. |
| F-28 Paid cost ceilings | Plus at 9.90 USD/month and 0.20 today admits a bounded 0.20 request into ordinary grace at 10.10. At 11.90 monthly AI spend, block ordinary work and preserve 0.10 emergency reserve: it is unavailable in v1 and usable only by a valid economy session in v1.1. Separately deny a 0.10 reservation when daily total is 4.95 of 5.00. Hard stop preserves manual rename, cached tour and entitled deterministic exports. |
| F-29 Saved-trip caps | In enforced mode Free has one trip: new-trip/import/restore fail with Manage trips choices. Archive still counts. Explicit replacement moves the named old trip to Trash and creates one new trip atomically. Plus at nine trips sends two simultaneous creations: exactly one succeeds. Downgrade from ten to Free preserves all ten as readable/JSON-exportable and allows selection of one editable trip; no automatic deletion occurs. |
| F-30 Monitoring resets | **v1 synthetic quota foundation; v1.1 dispatcher integration.** Free completes one run for Trip A on Jan 15, 2027: another is denied until Feb 1 UTC. Plus uses its weekly slot Jan 15: next window begins Monday Jan 18 UTC. Pro uses Jan 15: resets Jan 16 UTC. Each run contains at most five selected targets; adding targets/trips/credentials gives no extra slot. Two simultaneous starts reserve only one slot. Entire failure releases the slot but retains provider cost and bounded retry history. |
| F-31 Reservation and rate integrity | Two parallel requests each reserve 0.04 USD with 0.05 USD remaining: only one is admitted. It settles at 0.03 USD, releasing 0.01 USD. Duplicate completion settles nothing again. An uncertain provider timeout retains its pending reservation. Upgrade, model switch, and new MCP credential preserve incurred spend. Halving the effective model rate halves the estimate for an identical new token workload without modifying historical costs. |
| F-32 Grants and promotions **[v1.1→v2]** | **v1.1:** an admin directly grants a trial/promo with blank reason and no expiry; it succeeds with full audit and a Non-expiring label. End a temporary overlay: the original base assignment returns with prior usage. A usage addition is consumed once, never replenished by plan changes; lifetime/grandfathered versions remain pinned. **v2 extension:** redeem one campaign code twice for the same account; exactly one grant is created. |
| F-33 Seeded administrators | In an isolated synthetic identity-provider double, test the three bootstrap email matches and immutable subjects without sending real email or seeding real users into previews. Assign owner/admin/admin, require MFA before dashboard access, and verify separate actors see the shared case. Unverified claims receive no role; revoking and rerunning setup never regrants it. Separately verify real production bootstrap identities through their own trusted sign-ins and enrolled factors. |
| F-34 Economy and global cost **[v1.1]** | Free reaches **0.23 USD** ordinary AI expense with zero other provider cost: only the reserved 0.02 USD can fund its finish session. Three 0.005 USD economy prompts succeed; a fourth is denied by the three-prompt session cap even though 0.005 USD remains. Repeat with insufficient global reserve: no call dispatches. At 15 minutes the session expires; no new trip/watch/bulk import can start. Missing a compatible lower-cost model gives a preserved draft and manual recovery, not a false reply. |
| F-36 Profile-first route | Saved profile specifies home A, destination B, RV, dog, scenic preference, and maximum four driving hours/day. Plan my trip generates a proposal respecting these known constraints without redundant questions. Clear destination: ask one focused question. Reload a saved route: no new AI call or route replacement. A sample trip stays explicitly Demo with no booking. |
| F-37 Video and PDF | **v1:** every plan edits a profile note and exports a PDF containing the latest note. **v1.1:** Plus/Pro move an exact non-home point, save a three-view tour, and generate a 720p/30fps schematic client-side video following saved order/updated point. Change a point after render start: the running render retains its snapshot and the next export changes. Test home masking, cancellation, direct local download, and absence of proprietary map imagery. |
| F-38 Capacity and recovery | **v1:** five synthetic accounts with 200-stop annual plans meet latency/error and no-lost-write gates; the 40-case AI suite meets SCL-05 overall and explicit-mutation thresholds. **v1.1:** the 100-case suite meets the same rubric. **v2:** 25 concurrent accounts with 200/1,000-stop trips run 30 minutes and meet SCL-02/SCL-03. Bounded live model outcomes are recorded separately from synthetic load testing. |

| F-39 Preview isolation | Create a new preview: only synthetic users/records, independent auth endpoints/keys/cookies, no production credentials. Try real email and metered dispatch: denied by default. Enable a 60-minute, 0.25 USD integration allowance; exhaustion/expiry blocks subsequent dispatch and cannot be extended by retry. |
| F-40 Durable job | Queue edit X at revision 7. Worker A checkpoints the provider result then crashes; worker B resumes and commits revision 8 once without another provider call. A stale worker cannot commit. Unknown dispatch outcome keeps its reservation and requires reconciliation. Repeat with cancel, deadline, deploy, and revision 8 already changed by another edit; no stale mutation or duplicate spend is silently admitted. |
| F-41 Privileged lifecycle | Verified bootstrap owner signs in without MFA: no admin content. Enroll/challenge; sensitive action works for five minutes, then requires step-up. Initiate owner transfer to MFA-enrolled admin; no role changes until recipient accepts, then one atomic swap occurs. Last-owner deletion, expired transfer, and forged factor evidence fail. |
| F-42 Restore privacy | Create synthetic A/B/C; delete A, revoke B's session, revoke C's seeded admin role after taking a snapshot. Restore that earlier snapshot in quarantine and replay independent recovery controls. A's content is purged, B's old session fails, C has no admin role. With recovery ledger unavailable, reopening is blocked. |
| F-43 Provenance | Provider-derived stop changes to exact_gps: origin/rights do not change. Expire its restricted coordinate/address/geometry in live, undo, local cache, and diagnostic data. An independently authored adjacent GPS stop remains identical. Export/import preserves IDs/remapped references with explicit null/omitted provider fields and no reroute. Video never captures restricted imagery or route geometry. |
| F-44 Demo and reserve | Enforced Free already has one saved trip: static sample preview is allowed without calls; Save sample is denied until a slot exists. A saved demo counts and conversion retains its ID/count. At 0.23 USD ordinary AI spend, v1 shows no Economy offer and denies another dispatch while retaining its 0.02 reserve. v1.1 alone can admit a valid finish session. |
| F-45 Outcome rubric | A clear request to rename S2 must rename S2 and save the expected revision; a generic clarification is a failure. An ambiguous two-marina request must clarify without mutation. An information-only question changes no records. Inject timeout/conflict and assert preserved state. At least 23 of 24 explicit v1 cases and 38 of 40 healthy cases pass; any critical invariant failure blocks release. |
| F-46 Source integrity | Change an ID/tier in a derived task view, omit a shared security contract, or label a required v1 operation v1.1 without amending the frozen source: the consistency check fails. Unchanged source/hash and correctly generated references pass. |
| F-47 Portable transfer | Register new account B and import a permitted trip/profile envelope from account A's user-supplied file. Preview preserves B's current answers unless selected, remaps trip references, rejects imported privilege fields, and asks before including home. Unsupported historical format receives a conversion/manual path. No old service/database is contacted. |
| F-48 Visual and local video **[v1→v1.1]** | **v1:** inspect fixed synthetic planner/profile/admin fixtures at declared desktop/tablet/mobile sizes, actual mobile keyboard behavior, and 2D fallback with 3D disabled. Baseline differences require review. **v1.1:** export an entitled schematic video in Economy and Paused using already loaded permitted points; no provider call occurs and cancellation preserves the trip. |

Every fixture must assert stored data and rendered outcomes where applicable. Currency/time/routing assertions must use explicit numbers, not only “nonempty” or screenshot existence. Source-code structure or names are not acceptance criteria.

### 12.3 Visual and integration gates

At 1440×900 and 1280×800 verify the three-pane layout, full form labels, overlay-safe route fit, and stable sidebar handles. At 768×1024 verify the tablet layout. At 390×844 and 844×390 verify the mobile drawers/tabs, keyboard-open chat, Add Place, expanded stop, anchor drawer, long Tour list, account menu, and errors. Use the same synthetic trip so colors, labels, and data can be compared. Verify focus order, Escape restoration, visible focus, reduced motion, readable password fields, automated axe checks, and the recorded manual keyboard/screen-reader pass.

**v1 live checks** demonstrate: both sign-in methods reaching one account; Neon persistence; SYS-13 core flow; the full SCL-05 model outcome gate; real Google road geometry and 2D/3D where supported; Time Zone/Elevation behavior; visual inspection of current profile PDF; parsing of every permitted v1 export plus explicit omission cases; RULE-12 terms/provenance review; security/abuse/cost controls; three verified admin identities with MFA; owner-transfer/recovery rehearsal; and the LEG-12 restore drill. Supplier transactions, watches, MCP, video, and growth-load checks are not required for v1. Expensive checks run only within an explicitly bounded test allowance.

Exercise Free, Plus, Pro, and Pro-backed complimentary accounts in **enforced CI cohorts** for membership matrix, budget warnings/grace/reset copy, trip downgrade preservation, PDF availability, and no-cost manual/export paths after AI exhaustion. The public-launch runtime keeps commercial gates report-only while operational spend/security limits remain enforced. Use synthetic costs for quota-boundary tests rather than spending money to hit a cap.

**v1.1 checks** add: at least one permitted automated-watch integration if available, Manual-watch fallback for unsupported categories, email/in-app delivery, camps/trails integration, MCP external-client FLOW-12, client-side schematic video in supported/fallback browsers, Economy mode, units toggle, `/admin/plans`, v1.1 grants, and the 100-case AI suite. A live integration that cannot be legally/technically verified remains Blocked with its dependency; the permitted Manual-watch fallback can still satisfy the watch experience where specified.

**v2 checks** are not part of v1/v1.1 completion. They begin only after their dependencies are explicitly approved and include supplier transaction reconciliation/authorization, SMS/push, advanced verified marine/weather/tide overlays, promotional campaigns, and the SCL-02 growth gate.

If a context window fills during implementation, persist the coverage ledger, current milestone, last passing checks, pending decisions/dependencies, and next concrete step in `docs/STATE.md`. Resume from those records without rebuilding completed slices or reducing scope.

## 13. Completion definition

**v1 is complete** only when every v1 requirement and v1 portion of a mixed-tier requirement is Verified, including all v1 requirements in Section 11.22 and LEG-01–LEG-12. M2A and M8 must pass. No v1 item may be Blocked and no critical isolation, data-loss, false-save, unauthorized-dispatch, privacy-restoration, or exact-point defect remains. v1.1/v2 features are not required. Static views or provider mocks cannot substitute for required live evidence.

**v1.1 is complete** when its implementation requirements pass and every claimed live integration is either Verified or explicitly Blocked with the missing credential/permission/provider dependency. Where this specification explicitly defines a Manual-watch or other non-live fallback as the product behavior, that fallback can be Verified without pretending the unavailable live provider exists. A deterministic mock never converts a required live integration from Blocked to Verified.

**v2 remains deferred** until its dependency is approved. Supplier booking/cancellation/auto-rebooking cannot leave Blocked status without a documented supplier agreement, payment processor, legal/operational review, and live integration evidence. SCL-02 likewise remains a future growth gate, not a v1 release blocker.

For every tier, a static placeholder, screenshot, canned AI reply, disabled future-feature button presented as complete, or unverified provider claim does not satisfy a requirement. The final handoff lists every ID with tier/status/evidence, all live dependencies, deliberate deviations, current provider/documentation verification dates, and the exact deployed revision.

---

# Part III — AI-assisted delivery operating model

## 14. Codex execution architecture

Use three distinct layers:

1. **Project state layer (durable):** the repository, frozen specification, ledger, STATE, decision log, integration register, test artifacts, and git history.
2. **Orchestration layer (short-lived planning context):** selects the next bounded task, resolves dependencies, reviews evidence, and updates project state. It does not carry the entire project by conversation memory.
3. **Execution layer (task-scoped):** one Codex session/chat per bounded task or tightly coupled task set, supplied only the task packet, required shared invariants, relevant code, and current state.

The orchestrator shall prefer dependency-ordered work over parallelism. Parallel execution is appropriate only for tasks that can be merged without competing writes or unresolved shared decisions.

## 15. Conversation and context lifecycle

### 15.1 Start a new execution chat when

- A task packet reaches its exit gate.
- Work moves to a materially different subsystem or requirement cluster.
- A session has accumulated unrelated debugging history that is no longer needed for the next task.
- The agent begins re-reading or re-deriving facts already captured in durable project state.
- Automatic context compaction has occurred and the remaining task can be more cheaply resumed from a smaller task packet.
- A failed approach has created substantial irrelevant context and the durable state clearly records the surviving facts.

Do **not** keep a long conversation alive merely to preserve history. Preserve the useful history in repository state, then start a clean session.

### 15.2 Orchestrator rollover policy

The orchestration conversation may span several tasks, but a new orchestration chat should normally begin at each milestone boundary or earlier when the discussion is dominated by historical material rather than current decisions. Before rollover, write a handoff snapshot containing:

- Current milestone and gate status.
- Requirement status deltas since the prior snapshot.
- Last passing test/build/deployment evidence.
- Current branch/revision and environment.
- Open blockers and decisions.
- Active task and next three dependency-ordered tasks.
- Known defects/regressions.
- Implementation-usage snapshot when available.

The new orchestrator reads this handoff plus the durable source files; it does not need the preceding conversation transcript.

### 15.3 Session close protocol

Every execution session ends by updating `docs/ledger.csv` and `docs/STATE.md`, recording tests actually run, recording unresolved work, and committing a coherent checkpoint when appropriate. The session must leave enough durable state that a different agent can resume without conversational memory.

## 16. Model and reasoning selection policy

Use the least expensive model/reasoning setting that reliably completes the task. Escalation is based on **complexity and failure**, not prestige.

| Work type | Default | Escalate when |
| --- | --- | --- |
| Mechanical edits, formatting, simple tests, repetitive CRUD, documentation sync | Lower-cost Codex-capable model / moderate reasoning | Repeated incorrect edits or cross-file invariants emerge |
| Normal feature implementation and localized debugging | GPT-5.6 Sol, medium/high as needed | The task becomes architecture-heavy, highly coupled, or repeatedly fails |
| Cross-cutting architecture, difficult concurrency/state bugs, security review, migration/recovery design, release-gate audit | GPT-6 Astra | Use Ultra only when the added reasoning/delegation is likely to prevent materially more rework than it costs |
| Independent review of a completed critical slice | Astra or a second strong reviewer | Prefer independent evidence review over repeating implementation from scratch |

Astra Ultra is an escalation mode, not the standing project manager. High-compute orchestration that repeatedly rereads a large project can consume more allowance than short, well-scoped Sol sessions.

## 17. Subagent/delegation policy

Subagents may improve focus and wall-clock time but can increase total token/credit use. Use delegation only when all of the following are true:

- The subtasks are substantially independent.
- Each subtask has a bounded input and explicit output contract.
- Agents will not concurrently modify the same mutable files without a merge plan.
- The parent can synthesize the outputs without replaying each subagent's full context.
- Parallel work is expected to reduce rework, uncertainty, or wall-clock time enough to justify the additional usage.

Preferred fan-out is small (typically two or three focused subagents). Avoid spawning subagents for simple sequential steps, routine file edits, or tasks whose correctness depends on a single ordered chain of state changes.

## 18. Task packet standard

Each `docs/tasks/Mx-*.md` shall contain:

```text
Task ID and title
Milestone / tier
Goal
Binding requirement IDs
Required spec fragments
Shared invariants to load
Dependencies / prerequisites
Files likely to change
Explicit non-goals
Implementation notes / known constraints
Acceptance criteria
Exact automated test commands
Required live/manual checks
Evidence to record
Expected update to ledger/STATE
Stop conditions / escalation triggers
```

A task packet should normally fit one execution session. If it cannot, split it before implementation unless atomicity or a shared migration makes splitting unsafe.

## 19. Usage and credit accounting for implementation

### 19.1 Authority levels

Use three evidence classes:

- **Provider/API exact:** server/API response usage fields, when available.
- **Platform reported:** Codex/Work usage or lifetime chat credits shown by the OpenAI product.
- **Derived estimate:** difference between platform usage snapshots associated with a task, or user-entered metadata.

Derived estimates must never be labeled exact.

### 19.2 Per-task implementation usage record

Maintain `docs/implementation-usage.csv` with:

```text
started_at,ended_at,task_id,milestone,feature,session_id,model,reasoning_mode,
execution_mode,subagent_count,platform_credits_start,platform_credits_end,
platform_credits_delta,api_input_tokens,api_cached_input_tokens,api_output_tokens,
api_cost_usd,measurement_class,notes
```

If platform usage is visible only at chat/session level, attribute that session to a single primary task whenever practical. If a session spans multiple features, mark allocation as approximate rather than inventing precision.

### 19.3 Efficiency metrics

The client dashboard may calculate:

- Credits per Verified requirement.
- Credits per completed task.
- Credits per milestone.
- Rework ratio: usage on superseded/failed implementation divided by total measured usage.
- Verification yield: newly Verified requirements divided by measured credits.
- Model mix by task type.

These metrics are operational planning aids, not billing records unless the underlying billing contract explicitly says otherwise.

## 20. Handoff, continuity, and client auditability

At any point, the project shall be resumable by a new qualified engineer or agent using the repository alone plus required credentials. The final handoff shall include the exact deployed revision, requirement ledger, release evidence, environments, known limitations, open dependencies, approved deviations, usage-accounting limitations, and runbooks. No critical implementation knowledge may exist only inside a historical AI chat.
