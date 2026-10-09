# M1-01AB — Full-v1 profile and transfer browser continuation

Source revision: `55acba5e02c42eb857984d23096d596096a2f688`; exact CI `37959975974` passed. The build was compiled immediately before that commit from the same code. Local run `ef044d846d6e4bab9ab66535eb172f8c`, fixed expiry `2026-10-09T17:03:24.9813382Z`, existing synthetic local fixture, full-v1 profile mode, and direct loopback port 3000. Exactly one OTP was used. IDs below are displayed request IDs; revisions 8–12 are inferred from the observed single successful mutations and final canonical revision13.

## Observed flow

- A synthetic vehicle with blank fuel and a personal note displayed Saved with request `b1a10d69-1933-4778-9a7e-eb58350bb163`; reload showed the saved data. Removing the note displayed Saved with request `2f290f86-2147-4833-98d6-5aca7d2d538d`; reload showed a disabled removed-note record.
- Default export preview excluded home and quote data. The opt-in note export and its confirmation preview passed. The UI reported a download, but the expected default JSON file was absent. This is not evidence of a completed download or round-trip.
- A vehicle-name change displayed Saved (`9c174134-919a-40e3-b89b-a479934ad1f5`). A stale type change was preserved for explicit whole-record review and reapply (`715286bc-047a-42b8-bda3-6db2cf46a70c`), then displayed Saved. The reviewed whole record intentionally replaced the concurrent name change and retained type `Synthetic camper`.
- Count 6 plus `Family` saved at revision 12 (`0ffa9a21-058e-42a8-9f4b-2a8f8deffd07`). Two duplicate transfer/PDF sections appeared in the page. Reload cleared the duplicates. A stable-key source fix was prepared after this run; it was not part of the live build and has not been browser-verified.
- A native import fixture's unsupported `travelParty` value was ignored. After correction to `groupComposition: Friends`, `travelerCount: 4`, and a synthetic note, the preview showed those supported values. The user selected only the count and note and confirmed. The unselected group composition remained `Family`. The root reloaded while the UI still showed Saving, so the mutation acknowledgment was not observed and a complete import save/reload round-trip is not claimed. A later canonical read showed count 4, `Family`, the distinct new note, and the earlier removed note still absent. The PDF preview showed revision 13 and savedAt `2026-10-09T16:40:11.3674+00:00`.
- Genuine UI logout ended at `Signed out`. The owned PID 17496 was verified loopback-only and stopped; closing the window restored the exact prior environment and retained history.

## Limits

No raw request inspection or account-ID scope proof was performed. There was no downloaded-file round-trip, cross-account test, preview-environment test, or complete M1 acceptance. The browser observations do not establish full account isolation or promote any requirement to Verified. M1 remains open.

## Post-run offline preparation

After the run was closed, the export status message was corrected to “Profile file download started.” A reviewed-copy fallback now offers an explicit “Show JSON to copy” action after the same preview and any required sensitive-data confirmation. It displays the exact native envelope text in a read-only selectable field, without automatic clipboard writes, browser storage, or logging. The copy state is bound to current answers and notes plus account, revision, and session generation; changed profile source, options, review, account, or session hides and clears stale text.

The copy fallback and source-binding behavior pass the focused source-contract tests (2/2), targeted ESLint, and TypeScript check. These offline checks do not verify the UI in a browser, a real download, or an export/import round-trip. They were run after closure and did not rebuild or restart the browser run. The separate synthetic native-import fixture result above is not a downloaded-file round-trip.

Ignored screenshots: `m1-01ab-record-conflict.png`, `m1-01ab-imported-profile.png`.
