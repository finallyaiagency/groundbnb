# M1-01AB — bounded authenticated profile and export attempt

Date: 2026-10-10
Result: partial local browser evidence; M1 remains in progress and requirement statuses are unchanged.

## Run

- Source revision: `17974e49e8daa901578389711c0fd0224abc0fb7`.
- Bounded run: `104eb164d5ef4f659e29d9478e68fe5f`, pinned to the synthetic local fixture with full-v1 profile, manual-v1 records, reviewed-v1 transfer, one sign-in request, and scheduled/metered dispatch off.
- The single ordinary sign-in request was accepted. The existing read-only capture helper ran once with elevated permission and produced a 512-byte encrypted artifact for the run. The root decrypted it only in ephemeral memory and entered the code through the ordinary UI; no code or credential is recorded here.
- The UI reached the authenticated profile. The canonical profile view showed the existing synthetic traveler/couple values and existing vehicle/note records. No profile text or account identifier is copied into this report.

## Observed actions

- With home and notes unchecked, the default JSON export completed through the browser download flow. The browser returned `C:\Users\17044\Downloads\groundbnb-profile-2026-10-10.json`; the artifact was copied into the run's `downloads` directory. The retained copy is 464 bytes. Its contents were not inspected during the browser attempt, and no UI import from this downloaded artifact was completed.
- The PDF preview rendered for revision 15. No PDF download was performed or verified.
- A preference edit from the synthetic traveler value 4 to 5 received a visible Saved acknowledgment for operation `f147797a-147e-4685-8606-3156a08c9ecb`.
- A file chooser was opened to begin import. Supplying the retained JSON artifact stalled for about 333 seconds; the local page then refused the connection after bounded-run cleanup. No import preview, merge, or import save acknowledgment was observed.

## Cleanup and limits

The bounded run closed at `2026-10-10T05:51:13.1538557Z`; the exact prior environment was restored, the owned listener was confirmed stopped, and the encrypted OTP artifact and download copy remain under the run evidence directory. No post-save reload, PDF download, import, logout, upstream revocation, preview/two-account isolation, or complete M1 acceptance is claimed. The browser file chooser stall and fixed window expiry prevented completing the import flow. No requirement status was promoted. Task credit usage and provider charges are unavailable and not inferred.

## Offline validation of the retained JSON

After the browser run, the validator parsed the retained 464-byte artifact. Its SHA-256 is `5E0F2A9E43AA8BAA0F49C659678D2D149761D84617A4007C7F3CD5EBA40392E5`. It matched the exact v1 envelope with nine allowlisted fields and a valid timestamp; the import preview validator accepted all nine fields with zero warnings. The artifact contained no `homePoint` or top-level quotes, and `profileNotes` was empty. This validates the artifact structure only; it does not establish a browser import preview, merge, or save.

## Second bounded run — import-only continuation

- Source revision: `52e03683dd8673822ec527afa5fa328a01b6d0b0`. Run `277642a328994b189309587b8aef1599` used the same pinned local synthetic fixture and modes. One ordinary sign-in request was accepted and captured once; the encrypted artifact is retained in the run evidence. No plaintext code is recorded.
- The fresh authenticated canonical GET showed the previously saved traveler value 5 at revision 16 and the full records. This confirms that value was present in a later session; no same-run post-save reload was performed after the earlier save.
- The browser file chooser opened, but selecting the retained JSON file failed because the Chrome extension did not have permission to access local file URLs. No import preview, merge, or write occurred; the artifact was not retried. A request to enable that permission was pending, and no permission change was made during the run.
- The revision 16 PDF preview rendered. A PDF download was clicked once; the UI download event timed out, but a matching `groundbnb-profile-r16.pdf` appeared in Downloads. The file is 9,358 bytes with SHA-256 `7F4B5364F29E72995185646C8A602906964E8E615DAF9A21F56DF9264952FB4E`; the validator copied a byte-identical file into this run's download evidence and reported a valid PDF header, two pages, and revision 16 metadata. No PDF text or layout acceptance was performed, and the UI event timeout is not represented as a successful download event.
- Ordinary UI sign-out cleared the profile fields; reloading the profile returned to the sign-in prompt and the profile request was refused. This is limited local app evidence and does not establish upstream managed-session revocation.
- The owned foreground server was stopped and its listener confirmed absent. The run closed at `2026-10-10T06:03:06.9660247Z`, restoring the exact prior environment. The encrypted code artifact and copied PDF metadata/artifact remain in run evidence.

No browser import, PDF content/layout pass, upstream session revocation, preview/two-account isolation, or complete M1 acceptance is claimed. Requirement statuses remain unchanged.

## Third bounded run — selective field import

- Source revision: `fd099080ae061a93b2908c3b286140cdf945492c`. Run `672e29ab2f8e44bf850a933c60033480` used the pinned local synthetic fixture and modes. One ordinary sign-in request was accepted and one elevated read-only capture produced a 512-byte encrypted artifact.
- After the user enabled local file URL access for the Chrome extension, the native file chooser selected the previously downloaded and offline-validated JSON artifact. The import preview showed one selectable field delta. Only that checkbox was selected; no notes or other fields were selected.
- Applying the selection once produced a visible Saved acknowledgment for operation `f5015494-3d22-449d-8347-1d71293ab2f7`. A subsequent canonical profile reload showed the selected number-of-travelers field at the imported value; the other reviewed preference fields were preserved. Existing vehicle and note records remained present, including the removed note state and two active notes. The artifact had empty `profileNotes`, so no note import is claimed.
- Ordinary UI sign-out cleared the profile controls. Reloading the profile returned to the sign-in prompt; the profile request was refused. This is local app evidence and does not establish upstream managed-session revocation.
- Evidence screenshots: `C:\Users\17044\Documents\Codex\groundbnb-downloaded-file-import-saved-2026-10-10.png` and `C:\Users\17044\Documents\Codex\groundbnb-import-run-signed-out-2026-10-10.png`.
- The owned server was stopped and the listener confirmed absent. The exact run closed at `2026-10-10T06:40:43.5687691Z`, restoring the prior environment. No tests were run for this browser-only acceptance slice.

This run demonstrates a single-field native JSON import acknowledgment and canonical reload for the synthetic local account. It does not establish note import, file export correctness beyond the separate offline validator, PDF text/layout acceptance, upstream logout revocation, preview/two-account isolation, or complete M1 acceptance. Requirement statuses remain unchanged.
