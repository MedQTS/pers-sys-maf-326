CHUNK_ID: 003
DOC_ID: pers-sys-weather-scope
DOC_TITLE: Pers Sys - Weather Scope
SECTION_RANGE: auto
PREVIOUS_CHUNK: 002
NEXT_CHUNK: none
SOURCE_OF_TRUTH: true

### 14.1 Current SYS_10A weather interpretation

SYS_10A weather infrastructure and historical assessment evidence may exist, but that does not by itself prove active SYS_10A email weather integration.

Current status:

- Weather tables exist.
- Historical SYS_10A weather assessment rows exist.
- SYS_10A policy-level weather support exists through `WX_SYS10A_ALT_TOTAL_OVER_STD`.
- Current SYS_10A email output must not be treated as weather-adjusted unless current evaluator, watcher, email or active-decision wiring is separately proven.
- Outdoor SYS_10A candidates still require manual weather checking before betting.
- Docklands / Marvel may be treated as roof or indoor where venue identification is reliable.

Operational interpretation:

SYS_10A remains a base totals / alt-over manual guide unless and until a later governed change proves active weather integration.

### 14.2 SYS_10A notify-email wording change

The SYS_10A notify email has been updated as a wording/layout-only disclosure improvement.

Changed function:

- `supabase/functions/pers-sys-sys10a-notify/index.ts`

The email now exposes weather status in each game card, including:

- outdoor venues: weather not included in the email and check weather first
- Docklands / Marvel: roof or indoor where reliably identified

This email wording does not change the weather subsystem scope.

It does not:

- add evaluator weather wiring
- add watcher weather wiring
- add active decisioning
- add automatic weather suppression
- create ACTION NOW alerts
- place bets
- prove current weather-adjusted SYS_10A decisions

### 14.3 Future integration rule

If SYS_10A weather is later promoted from manual disclosure to active integration, the change must be handled as a separate governed phase.

That future phase must prove:

- current SYS_10A registry/config status
- current weather snapshot creation
- current SYS_10A weather assessment creation
- evaluator or email use of the current assessment
- correct outdoor `FULL_STAKE`, `HALF_STAKE`, and `PASS` handling
- correct roof or indoor `NOT_APPLICABLE` handling
- no accidental ACTION NOW or bet-placement behaviour unless separately authorised

Until that proof exists, the safe position remains:

SYS_10A weather status may be displayed for operator awareness, but SYS_10A should not be described as actively weather-adjusted live automation.

## 15. Current closeout addendum - SYS_10A W1 display integration

This addendum updates the weather scope after the July 2026 SYS_10A W1 work.

### 15.1 What is now proven

SYS_10A weather display is now proven for the report/notify email path.

Confirmed:

- Weather snapshot creation works for a future Perth Stadium game.
- Direct SYS_10A weather assessment works with policy `WX_SYS10A_ALT_TOTAL_OVER_STD`.
- `pers-sys-weather-seed-precheck` now honours explicit `system_codes: ["SYS_10A"]`.
- A seed-precheck run created or updated a SYS_10A assessment.
- `pers-sys-sys10a-notify` dry-run rendered SYS_10A weather output from that assessment.
- Dry-run output showed `Weather OK (clear)` and `source SYS_10A`.

This proves display integration, not active betting integration.

### 15.2 Current SYS_10A weather workflow

Current safe weather-supported SYS_10A workflow:

1. Run `pers-sys-weather-seed-precheck`.
2. Use payload with `system_codes: ["SYS_10A"]`.
3. Use supported stages T30/T10 only, with T30 as current guide-stage label.
4. Confirm snapshots and assessments are created or updated.
5. Run `pers-sys-sys10a-notify` with `dry_run: true`.
6. Review the email.
7. Send only after manual review.

This is an out-of-band operator workflow.

It is not report-time weather fetching.

It is not evaluator wiring.

It is not watcher wiring.

### 15.3 Current boundary

W1 weather display does not:

- change SYS_10A candidate selection;
- change SYS_10A pick logic;
- change SYS_10A stake logic;
- suppress SYS_10A candidates;
- create ACTION NOW alerts;
- place bets;
- add automatic weather decisioning.

The weather outcome is displayed to the operator only.

### 15.4 Current status of weather policy

SYS_10A continues to use policy code:

- `WX_SYS10A_ALT_TOTAL_OVER_STD`

Current outcome mapping remains:

- FULL_STAKE = weather OK for display;
- HALF_STAKE = weather caution for display;
- PASS = weather red / would suppress in shadow wording;
- NOT_APPLICABLE = roof or indoor weather not applicable.

In W1 these are display interpretations only.

### 15.5 Remaining weather-scope caveats

Remaining caveats:

- T30 is still the stored stage label, even when used for next-day guide seeding.
- GUIDE / P24 / P48 stages are not supported without schema/check-constraint work.
- Report-time fetch/assess remains out of scope because report paths should remain read-only.
- Active weather suppression or stake reduction would require a separate governed phase.
- CONFLICT PASS email rendering remains unobserved unless a test or slate triggers it.
