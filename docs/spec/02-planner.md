<!-- Generated from docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md; SHA-256 E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F; 2026-09-29. Do not edit directly. -->

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

---

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

---

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
