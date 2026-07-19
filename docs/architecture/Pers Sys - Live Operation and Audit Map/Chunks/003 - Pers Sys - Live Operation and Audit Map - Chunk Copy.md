CHUNK_ID: 003
DOC_ID: pers-sys-live-operation-and-audit-map
DOC_TITLE: Pers Sys - Live Operation and Audit Map
SECTION_RANGE: auto
PREVIOUS_CHUNK: 002
NEXT_CHUNK: 004
SOURCE_OF_TRUTH: true

## 11. Bottom line

For Pers Sys, no-bet diagnosis must follow this order:

    games
    -> snapshots
    -> signal audit
    -> actionable signals
    -> alert/suppression
    -> acceptance/logging

The audit table is the bridge between "the system did nothing" and "the system evaluated and correctly rejected every system."

## 12. Current closeout addendum - SYS_10A weather/email diagnostic boundary

This addendum records the operational diagnostic rule for SYS_10A weather and email output after the SYS_10A email review.

### 12.1 Diagnostic distinction

When diagnosing SYS_10A output, keep these evidence layers separate:

1. Weather subsystem exists.
2. Weather snapshots exist.
3. Weather assessments exist.
4. SYS_10A historical weather assessments exist.
5. SYS_10A email displays weather-status wording.
6. SYS_10A evaluator, watcher, email or active-decision path actually uses current weather assessment.

Only the sixth item proves active SYS_10A weather integration.

Historical weather assessment rows or displayed email wording do not by themselves prove that SYS_10A is weather-adjusted live automation.

### 12.2 Current SYS_10A operational interpretation

Current safe interpretation:

- SYS_10A Total Guide is a manual guide.
- Outdoor SYS_10A candidates require manual weather checking before betting.
- Docklands / Marvel may be treated as roof or indoor where reliably identified.
- The email may display weather-status wording for operator awareness.
- The wording does not create active weather decisioning.
- The wording does not create ACTION NOW alerts.
- The wording does not place bets.

If current weather integration is claimed later, require fresh repo and live evidence.

### 12.3 Minimum checks for SYS_10A weather claims

To prove SYS_10A weather integration, check at minimum:

1. Current SYS_10A registry/config state.
2. Current weather snapshot rows for the relevant game.
3. Current SYS_10A weather assessment rows for the relevant game.
4. Assessment stage, normally T30 unless changed by governed decision.
5. Outcome:
   - FULL_STAKE
   - HALF_STAKE
   - PASS
   - NOT_APPLICABLE
6. Whether the relevant evaluator, watcher or notify function actually reads and applies the assessment.
7. Whether any signal, alert, suppression or stake behaviour changed because of that weather assessment.

Do not treat the presence of WX_SYS10A_ALT_TOTAL_OVER_STD alone as proof of active integration.

### 12.4 Minimum SQL checks for SYS_10A weather review

Weather assessment summary:

select
  system_code,
  policy_code,
  assessment_stage,
  outcome,
  count(*) as rows,
  max(assessed_at) as latest_assessed_at
from pers_sys_weather_assessments
where system_code in ('SYS_10A', 'SYS10A')
group by system_code, policy_code, assessment_stage, outcome
order by latest_assessed_at desc nulls last;

Latest SYS_10A weather assessments:

select
  id,
  game_id,
  system_code,
  policy_code,
  assessment_stage,
  outcome,
  reason_code,
  wind_kmh_max,
  gust_kmh_max,
  rain_mm_total,
  weather_snapshot_id,
  assessed_at
from pers_sys_weather_assessments
where system_code in ('SYS_10A', 'SYS10A')
order by assessed_at desc
limit 20;

Latest weather snapshots:

select
  game_id,
  snapshot_stage,
  source,
  venue_code,
  is_outdoor,
  wind_kmh_max,
  gust_kmh_max,
  rain_mm_total,
  hours_matched,
  checked_at
from pers_sys_weather_snapshots
order by checked_at desc
limit 20;

### 12.5 Current no-bet interpretation boundary

For SYS_10A, do not use weather rows to explain no-bet, no-alert or no-action behaviour unless the current code path is proven to consume those weather rows.

Current boundary:

- weather assessment rows can explain stored weather verdicts;
- email wording can explain operator-facing disclosure;
- neither proves evaluator suppression, alert suppression, stake reduction, or bet-placement behaviour unless code/live evidence shows that wiring.

### 12.6 Future escalation rule

If SYS_10A weather is later promoted from manual disclosure to active integration, update this operation map again.

That future update should record:

- exact function or evaluator path changed;
- whether the weather decision affects candidate qualification, stake sizing, alert display, or only operator notes;
- whether PASS suppresses output;
- whether HALF_STAKE changes stake guidance;
- whether NOT_APPLICABLE is handled for roof/indoor venues;
- whether ACTION NOW or bet placement remains prohibited or becomes authorised by a separate governed change.

## 13. Current closeout addendum - SYS_10A W1 operational diagnostic update

This addendum records the current operational diagnostic rule after the July 2026 SYS_10A weather-display and warning-rendering work.

### 13.1 Updated diagnostic distinction

When diagnosing SYS_10A output, separate these layers:

1. Weather snapshot exists.
2. SYS_10A weather assessment exists.
3. SYS_10A report reads the assessment.
4. SYS_10A notify renders the assessment.
5. SYS_10A warning states render in email.
6. SYS_10A weather or warning state changes automated pick, stake, suppression, alert or bet-placement behaviour.

Current proven state:

- Layers 1 to 5 have partial or direct proof from this thread.
- Layer 6 remains false for W1.

### 13.2 Current proven operational workflow

Current weather-supported SYS_10A email workflow:

1. Invoke `pers-sys-weather-seed-precheck`.
2. Include explicit `system_codes: ["SYS_10A"]`.
3. Confirm response includes `systems: ["SYS_10A"]`.
4. Confirm snapshots created or updated.
5. Confirm assessments created or updated.
6. Invoke `pers-sys-sys10a-notify` with dry-run true.
7. Inspect text and HTML.
8. Send real email only after manual review.

Current proof from this thread:

- Seed-precheck produced a SYS_10A assessment.
- Notify dry-run rendered SYS_10A weather as `Weather OK (clear)`.
- Recent-form warning dry-run rendered `RECENT FORM WARNING / PRICE CHECK ONLY`.
- Warning output set operator-facing stake guidance to `0u default`.
