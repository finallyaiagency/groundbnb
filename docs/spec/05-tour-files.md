<!-- Generated from docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md; SHA-256 E1EA8F9B85E294F81960646DF3DE73F0CD7C4C5A8105781909984DE6D19F775F; 2026-09-29. Do not edit directly. -->

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

---

### 11.7 Tours, geometry display, and retained views (MAP, TOUR)

“View Route” fits the complete selected trip with 48-pixel map padding plus the actual overlay-panel rectangles. “View selected range” fits only that view. Stop focus uses its precise GPS coordinate, while connector focus includes both endpoints. On route edits preserve the camera unless the previously focused item was removed; then fit the affected new leg. A map loading or API error does not hide editable itinerary cards.

Use a stable six-color leg palette (#22c55e, #38bdf8, #f59e0b, #c084fc, #fb7185, #2dd4bf), assigned at leg creation and retained by ID through reorder. Draw primary geometry at about 6 pixels, a darker outline where necessary, and reduced opacity for overlap. Walking connectors use bright 6-pixel dashes; for different incoming/outgoing colors alternate dashes rather than a single indistinguishable color. Hover/focus raises opacity and width without changing the stored color. Dim Map changes the basemap layer only. Number-only labels retain accessible full names.

Route animation defaults to enabled unless reduced motion is requested. Speed slider 1–100 defaults 75; speed 1 traverses the complete route in 120 seconds and speed 100 in 10 seconds, interpolated linearly. Allocate traversal time by displayed geometric distance with a minimum one second per nonempty component. Pause route animation during a camera tour, map interaction, or leg hover/focus, then resume after that interaction ends. Store the user's explicit animation setting, not a transient hover state.

Tour preset values are Overview 3,000 feet/60°/0°, Scenic 1,000 feet/45°/0°, Close-up 250 feet/30°/0°, and Top-down 1,000 feet/90°/0°. Default is Scenic. Height is vertical elevation above local terrain, not slant camera-to-target distance. Converting to provider camera coordinates must retain that meaning. If terrain elevation cannot be obtained, show “Height approximate” and retain the requested value; do not falsely label absolute altitude AGL.

Play starts at the selected view, or the first view if none; Next selects the following view; Stop holds the current camera and resets playback position to the selected view. Loop defaults off. Flyover defaults 5 seconds (0.5–120 allowed); Pause defaults 5 seconds (0–300 allowed). Changes during playback apply at the next transition. Space outside a text input toggles playback, Escape stops it. User panning stops playback and retains the new camera view for Add View.

Repeated Add from Itinerary updates generated views by source item ID and kind; it does not duplicate them. Renames propagate to generated view names unless the user supplied a custom name. Deleting a referenced stop/leg removes its generated views with the same undoable mutation. Custom views persist. Reordering stops reorders generated views, preserving custom views' relative order. Tour import defaults to Replace tour, with an explicit Append alternative that deduplicates identical IDs only within that import. View references unresolved in a tour-only file are retained as custom frozen camera views labeled “Original itinerary item unavailable.”

---

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

---

### 11.19 Route-tour video export (FILE)

| ID | Requirement and pass condition |
| --- | --- |
| FILE-07 **[v1.1]** | Add Export video to Tour and the export menu for Plus/Pro. The **only v1.1 renderer is a schematic route animation generated on the user's device**, targeting MP4 H.264 at 1280×720/30 fps/no audio with a WebM fallback where H.264 encoding is unavailable. Use saved tour order/timing, stop/leg captions, route colors, a title card, and end card. Verify current WebCodecs/encoding and muxer browser support before implementation. **Pass:** a three-view tour produces a playable file with correct order, coordinates, labels, and generated timeline; unsupported encoding falls back honestly. |
| FILE-08 **[v1.1]** | Rendering snapshots the selected trip/tour revision at start. Later edits do not alter an in-progress render. Cancel stops the local render and never changes/corrupts the trip. No server render queue, resumable job ID, private download URL, or server retention is used. **Pass:** edit a stop after rendering starts; the running render retains its declared snapshot and the next export uses the new revision. |
| FILE-09 **[v1.1]** | Render only authored or independently export-permitted points/vectors/original assets. Do not record or redistribute proprietary basemap imagery. Provider route geometry is not automatically exportable merely because the renderer is schematic. **Pass:** restricted geometry/imagery is absent; if needed use a clearly labeled straight connector between permitted authored points, and disclose omitted unresolved stops before rendering. Photorealistic export is unsupported. |

The video represents the saved route/tour and is not proof of road/water navigability. Default export is one pass with loop off, current flyover/pause timing, selected captions, title/end cards, and the “Hide precise home location” option enabled. Home masking obscures the home caption and omits the immediate approach within 500 meters from the exported visualization without mutating stored coordinates. Maximum output length is 10 minutes; overlong tours require a selected range or explicit timing compression preview rather than silently dropping stops.

Rendering occurs client-side. `taskType=video_export` may record a usage event for product analytics but its provider cost is zero. The generated file is downloaded directly and is not retained by the application server. Browser memory/device constraints must fail safely with a smaller-range suggestion; they must not mutate trip/tour state.
