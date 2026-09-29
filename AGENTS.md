# Groundbnb agent operating notes

Read `docs/STATE.md`, the current task packet, `docs/spec/15-shared-safeguards.md`, and only the named derived spec views before editing. The frozen authority is `docs/source/Groundbnb_Route_Planner_Agency_Spec_v3.0.md` (SHA-256 in `docs/spec/SOURCE-HASH.txt`). Derived files never amend it.

Use the existing `finallyaiagency/groundbnb` repository. Preserve its history and source documents. Keep secrets out of Git. Production, preview, local, and recovery environments must be isolated; previews contain only synthetic identities/data and disable metered dispatch by default.

`docs/ledger.csv` is the requirement status authority. Allowed statuses: Not started, Implemented, Verified, Failed, Blocked. A passing test or reproducible observation tied to a revision is required for Verified. A mock cannot prove a required live integration. Mixed-tier requirements retain separate baseline and extension evidence. Do not start M9 before M8 passes.

Preserve account ownership, optimistic revisions, durable save acknowledgments, provenance/rights, financial reservations, MFA/step-up, deletion/recovery controls, and release tiers. Never turn unknown data into zero or a confirmed claim. No supplier booking/payment/rebooking in v1 or v1.1.

For each bounded task: inspect current Git state; implement; run exact checks; record evidence, usage when measurable, defects, and open decisions; update ledger and `docs/STATE.md`; make a coherent Git checkpoint. Do not infer precise Codex credits from unavailable usage data.

The Project Control Center reads repository evidence. Client requests or decisions must be auditable and cannot silently modify the frozen specification. Log approved scope changes as amendments tied to stable requirement IDs.