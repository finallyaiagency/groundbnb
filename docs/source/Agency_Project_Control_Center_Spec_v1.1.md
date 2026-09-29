# Agency Project Control Center — Website Specification

**Version:** 1.1  
**Purpose:** Reusable client-facing implementation, verification, risk, and AI-usage dashboard for AI-assisted software engineering engagements.

## 1. Product principle

The website is a **projection of delivery evidence**, not a separate project-management truth store. It should derive as much status as possible from the repository and CI outputs. Manual fields are reserved for business decisions, client approvals, external blockers, and usage data that the platform does not expose programmatically.

## 2. Primary users

- Client sponsor/product owner: concise progress, blockers, decisions, release readiness, spend/usage visibility.
- Delivery lead: dependency order, task readiness, milestone gates, risk and usage trends.
- Engineer/agent: current task packet, exact acceptance commands, dependencies, evidence destinations.
- QA/reviewer: requirements awaiting verification, failed gates, regression evidence, release comparison.

## 3. Required pages

| Page | Purpose | Key data |
| --- | --- | --- |
| Overview | Executive project state | current milestone, implementation %, verification %, gate status, blockers, open decisions, recent deployment |
| Milestones | Release sequence and exit gates | M0-M9/v2, dependencies, status, entry/exit criteria, evidence |
| Requirements | Contract coverage | ID, title, tier, milestone, status, dependency, evidence, notes |
| Tasks | Execution queue | task ID, requirement IDs, owner/agent, branch, status, expected tests, usage estimate/actual |
| Tests | Verification control | unit/integration/E2E/fixture/live/visual/accessibility runs, revision, result, artifacts |
| Defects & Risks | What can prevent release | severity, impact, owner, affected IDs, mitigation, target milestone |
| Decisions | Audit trail | decision/change ID, requestor, affected requirements, disposition, approval |
| Integrations | External dependency truth | provider, official source, checked date, credentials state, permitted use, live/mock/blocked |
| Usage | Delivery efficiency | Codex/Work credits when reported, API tokens/cost, task attribution, model mix, confidence class |
| Prediction | Capacity-constrained forecast | future credit estimate, five-hour/weekly capacity, minimum-dwell ETA, observed-dwell ETA, limiting factor, confidence |
| Activity | Engineering chronology | commits, pull requests, deployments, state snapshots, milestone changes |
| Handoff | Delivery package | runbooks, environments, release revision, known limitations, acceptance exports |

## 4. Source files

```text
docs/ledger.csv                  authoritative requirement status/evidence
docs/STATE.md                    current execution state and next step
docs/OPEN-DECISIONS.md           unresolved/approved decisions
docs/integrations.md             provider verification and limitations
docs/tasks/*.md                  task packets
docs/implementation-usage.csv    implementation usage snapshots/estimates
test-results/*.json              machine-readable test outcomes
playwright-report/               browser evidence
artifacts/release/*              PDFs, exports, screenshots, reports
Git history / CI / deployment metadata
```

## 5. Progress calculations

Display at least two independent measures:

- **Implementation progress** = requirements in Implemented or Verified / applicable requirements.
- **Verification progress** = Verified requirements / applicable requirements.

Never merge these into one number. Blocked items remain visible in the denominator for a release whose completion definition prohibits Blocked status. Deferred tiers are excluded from the current release denominator but shown separately. Mixed-tier requirements must be represented at the applicable release portion, not blindly counted as a later-tier item.

## 6. Milestone gate model

Each milestone stores `status`, `entry_conditions`, `required_requirement_ids`, `required_tasks`, `required_test_runs`, `blocked_dependencies`, and `exit_evidence`. A milestone may not display Complete merely because all coding tasks are closed; its exit gate must pass.

## 7. Usage view

Keep application runtime usage and agency implementation usage separate. For implementation usage, expose:

- Model and reasoning mode.
- Main session/chat identifier.
- Subagent count when known.
- Platform-reported credits before/after and delta when available.
- API input/cached/output tokens and API cost when calls are made directly through API credentials.
- Attribution: task, feature, milestone.
- Measurement class: Exact API / Platform reported / Derived estimate / Unknown.

Do not show an exact per-feature Codex credit figure unless the platform exposes it or the project has isolated that feature to a single measured task/session.


### 7.1 Completion prediction

Add a Prediction section to the client portal. It estimates remaining implementation credits and calendar completion time under Work/Codex allowance constraints. The forecast assumes, when selected, that this engagement is the only project consuming the applicable Work/Codex allowance.

Do **not** hard-code a plan's five-hour or weekly allowance as a fixed credit quantity. Current limits vary by plan and model, and included allowance is not equivalent to a published fixed number of purchased credits. Use an empirical **credit-equivalent capacity** calibrated from the project's own measured sessions or an explicitly entered owner estimate. Keep the source and confidence visible.

Required inputs/derived values:

- Applicable requirements and verified requirements.
- Measured implementation credits with attribution coverage.
- Optional manual remaining-credit estimate for early project stages.
- Empirical credit-equivalent capacity of a full five-hour window.
- Empirical credit-equivalent weekly capacity.
- Current mandatory wait before work can resume, if either allowance is exhausted.
- Observed **dwell time**: median extra hours between becoming eligible for a new five-hour window and actually starting the next project session.

Required outputs:

- Estimated future credits and the basis used.
- Forecast confidence.
- Minimum-dwell effective weekly capacity and completion date.
- Consistent-dwell effective weekly capacity and completion date.
- Approximate number of full five-hour windows required.
- The active limiting factor: five-hour capacity, weekly capacity, or five-hour capacity plus observed dwell.

For the first approximation, calculate:

```text
five_hour_weekly_capacity(dwell) = five_hour_credit_equivalent * 168 / (5 + dwell_hours)
effective_weekly_capacity(dwell) = min(weekly_credit_equivalent, five_hour_weekly_capacity(dwell))
calendar_days = remaining_credits / effective_weekly_capacity * 7 + current_mandatory_wait_hours / 24
```

The **minimum-dwell** scenario uses `dwell_hours = 0`. The **consistent-dwell** scenario uses the rolling observed median dwell. If the weekly ceiling is already lower than five-hour-derived throughput, reducing dwell does not improve the completion estimate and the UI must say so.

Before enough measured history exists, show `Insufficient observed data` rather than inventing an ETA. Permit an explicitly labeled manual remaining-credit estimate to bootstrap early planning. A production implementation should prefer rolling task/session observations and should display the sample size and measurement coverage that support the forecast. The prediction is an allowance-constrained calendar estimate, not a contractual delivery date.

## 8. Recommended implementation

Use Next.js App Router + TypeScript and deploy on Vercel. Keep the initial client portal read-only. A server-side ingest job should parse repository artifacts into a small normalized project snapshot. GitHub/CI/deployment connectors can enrich the snapshot, but the site must still render from checked-in evidence if a connector is unavailable.

Suggested routes:

```text
/                         overview
/milestones
/requirements
/tasks
/tests
/risks
/decisions
/integrations
/usage
/prediction
/activity
/handoff
```

## 9. Client UX

Use a professional control-room layout rather than a developer console. The first screen should answer five questions without scrolling: What release are we building? How much is implemented? How much is verified? What is blocking progress? What is the next gate?

Use neutral status language: Not started, Implemented, Verified, Failed, Blocked. Make Blocked and Failed visually distinct. Every percentage must be clickable to its underlying requirement set. Every evidence claim should deep-link to the source record, test run, or artifact.

## 10. Reusable agency template requirements

Project-specific fields (name, logo, releases, milestone names, repositories, environments, pricing visibility) live in configuration. The data schema and dashboard components remain reusable. A new client engagement should be created by changing project configuration and source mappings, not forking the entire portal.
