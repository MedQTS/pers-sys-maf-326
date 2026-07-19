CHUNK_ID: 005
DOC_ID: pers-sys-project-snapshot
DOC_TITLE: Pers Sys - Project Snapshot
SECTION_RANGE: auto
PREVIOUS_CHUNK: 004
NEXT_CHUNK: 006
SOURCE_OF_TRUTH: true

### 16.4 SYS_10A weather status

SYS_10A weather infrastructure and historical weather assessments exist, but current SYS_10A email weather integration has not been proven.

Current evidence and interpretation:

- Weather tables exist.
- Historical SYS_10A weather assessment rows exist.
- SYS_10A has policy-level weather support evidence.
- Current SYS_10A Total Guide should not be treated as weather-adjusted unless current email/evaluator wiring is proven.
- Outdoor venues require manual weather checking before betting.
- Docklands / Marvel can be treated as roof or indoor where reliably identified.

Current status:

SYS_10A remains a base totals / alt-over manual guide unless a later governed change proves active weather integration.

### 16.5 SYS_10A email layout status

The SYS_10A notify email has been refined and deployed as a wording/layout-only change.

Changed function:

- `supabase/functions/pers-sys-sys10a-notify/index.ts`

Confirmed behaviour after dry-run:

- Heading changed to `SYS_10A Total Guide`.
- Dense top admin/manual-check block removed.
- Reader-facing `Lean` label removed.
- Internal enum labels are mapped to readable text.
- `Edge` now displays as `Base edge`.
- Every game card shows a weather line.
- Outdoor venues display that weather is not included in the email and require weather check first.
- Docklands / Marvel displays roof or indoor where reliably identified.
- Suppression notes are moved to a compact footer.
- The guide remains manual and does not create ACTION NOW alerts or place bets.

Current interpretation:

SYS_10A email readability and disclosure are improved, but this is not active weather decisioning and not live bet automation.

### 16.6 Updated confirmed/pending position

Additional confirmed items:

- SYS_12 Phase 1A candidate-leg evaluator/audit scope is implemented and accepted.
- SYS_7 T30-action alignment fix has been deployed.
- SYS_7 operator exclusion overlay has been deployed.
- SYS_10A notify email layout has been deployed and dry-run verified.

Additional pending items:

- SYS_7 post-fix runtime verification.
- SYS_7 `operator_excluded_team` fresh audit verification.
- SYS_10A active weather integration proof if later pursued.
- SYS_12 basket/stake/SYS_10A pairing/action phases if later pursued.
- Broader repeated-cycle watcher trust remains open.
- Trusted end-to-end automation remains incomplete until repeated-cycle, duplicate-side-effect, alerting and post-fix verification are closed.

### 16.7 Current decision position update

The project remains structurally close and mostly aligned between repo and live environment.

The latest closeout adds three important qualifications:

- SYS_7 has had a specific audit-to-signal timing issue diagnosed and fixed, but runtime verification is still pending.
- SYS_10A guide presentation is improved and deployed, but the guide is not weather-adjusted live automation.
- SYS_12 is now recognised as a current system concept, but only its candidate/audit phase is implemented.

The system should still not be treated as fully trusted end-to-end automation until watcher repeated-cycle behaviour, duplicate effects, SYS_7 post-fix materialisation, operator-exclusion audit output, and remaining live-cycle checks are verified.

## 17. Current closeout addendum - SYS_10A W1 weather display and warning-state verification

This addendum records the current SYS_10A status after the July 2026 weather-display, seed-precheck and warning-rendering work.

### 17.1 SYS_10A locked-rule position

SYS_10A is locked source-based as a manual AFL totals guide.

Current locked position:

- Main totals guide plus alternate Over cascade.
- Main-total side may be Over, Under or Pass.
- Alternate path is Over-only.
- No alternate Under path.
- No automatic betting.
- No ACTION NOW alerts.
- No bet placement.
- Staking remains manual guide only.

Current model rules remain:

- estimated_total = 0.35 home average + 0.35 away average + 0.30 venue average.
- Main Over if edge is at least +5.
- Main Under if edge is at most -5.
- Pass if edge is between -5 and +5.
- Main guide stake remains 0.5u for non-PASS lean.
- Alt bands remain 160 / 170 / 180.
- Alt clearance remains 0.40 home + 0.40 away + 0.20 venue.
- Alt thresholds remain 0.75 / 0.70 / 0.65.
- Alt exposure cap remains 0.5u, split as 0.30u anchor and 0.20u upside where applicable.

### 17.2 SYS_10A W1 weather display status

SYS_10A weather display is now source-wired and dry-run verified for the email/report path.

Current proven behaviour:

- `pers-sys-sys10a-report` attaches a display-only weather block to SYS_10A report items.
- The lookup reads `pers_sys_weather_assessments`.
- Lookup order is SYS_10A T30 first, then SYS_8 T30 fallback, then no-data.
- `pers-sys-sys10a-notify` renders the display-only weather banner and weather lines.
- Weather display does not change candidate selection, pick logic, stake logic, suppression logic, alerts or betting behaviour.

Dry-run proof from this thread confirmed Fremantle v Sydney displayed:

- Weather: Weather OK (clear)
- Status: shadow / source SYS_10A

This proves the W1 email display path can consume a current SYS_10A weather assessment row.

### 17.3 SYS_10A weather seed-precheck status

The SYS_10A seed-precheck override has been patched and verified.

Current proven behaviour:

- `pers-sys-weather-seed-precheck` accepts explicit `system_codes: ["SYS_10A"]`.
- Explicit system_codes bypass `pers_sys_systems_v2` filtering.
- SYS_10A does not need to be present in `pers_sys_systems_v2` for this out-of-band precheck.
- A seed-precheck invocation returned `systems: ["SYS_10A"]`.
- The same run created or updated one weather snapshot and one SYS_10A weather assessment.
- Errors returned empty.

Current safe operating rule:

1. Run `pers-sys-weather-seed-precheck` for SYS_10A.
2. Confirm assessment rows are created.
3. Run `pers-sys-sys10a-notify` with dry_run true.
4. Send only after dry-run review.
