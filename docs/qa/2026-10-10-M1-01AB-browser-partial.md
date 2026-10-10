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
- A preference edit from the synthetic traveler value 4 to 5 received a visible Saved acknowledgment for operation `f147797a-14e7-4685-8606-3156a08c9ecb`.
- A file chooser was opened to begin import. Supplying the retained JSON artifact stalled for about 333 seconds; the local page then refused the connection after bounded-run cleanup. No import preview, merge, or import save acknowledgment was observed.

## Cleanup and limits

The bounded run closed at `2026-10-10T05:51:13.1538557Z`; the exact prior environment was restored, the owned listener was confirmed stopped, and the encrypted OTP artifact and download copy remain under the run evidence directory. No post-save reload, PDF download, import, logout, upstream revocation, preview/two-account isolation, or complete M1 acceptance is claimed. The browser file chooser stall and fixed window expiry prevented completing the import flow. No requirement status was promoted. Task credit usage and provider charges are unavailable and not inferred.

## Offline validation of the retained JSON

After the browser run, the validator parsed the retained 464-byte artifact. Its SHA-256 is `5E0F2A9E43AA8BAA0F49C659678D2D149761D84617A4007C7F3CD5EBA40392E5`. It matched the exact v1 envelope with nine allowlisted fields and a valid timestamp; the import preview validator accepted all nine fields with zero warnings. The artifact contained no `homePoint` or top-level quotes, and `profileNotes` was empty. This validates the artifact structure only; it does not establish a browser import preview, merge, or save.
