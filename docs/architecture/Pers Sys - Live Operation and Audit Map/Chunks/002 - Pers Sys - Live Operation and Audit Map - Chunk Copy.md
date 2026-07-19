CHUNK_ID: 002
DOC_ID: pers-sys-live-operation-and-audit-map
DOC_TITLE: Pers Sys - Live Operation and Audit Map
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

### Step 1 - Confirm game exists

Check:
- pers_sys_games
- game_id
- season
- round
- home team
- away team
- start_time_aet
- status

### Step 2 - Confirm snapshots exist

Check pers_sys_market_snapshots by:
- game_id
- snapshot_type
- market_type
- agg_method
- created_at
- snapshot_ts

Expected completed-game rows:
- OPEN H2H / LINE / TOTALS
- T60 H2H / LINE / TOTALS
- T30 H2H / LINE / TOTALS
- T10 H2H / LINE / TOTALS

If these exist, the watcher/snapshot side is not the primary issue.

### Step 3 - Check audit table

Check pers_sys_signal_audit_v2 by:
- game_id
- system_code
- audit_status
- fail_stage
- fail_code
- evaluated_at
- reason_json

If audit rows exist, evaluator activity is proven.

### Step 4 - Check actionable signals

Check pers_sys_signals_v2 by game_id.

Interpretation:
- rows exist with READY: signal fired;
- no rows but audit FAIL rows exist: legitimate no-signal unless fail codes indicate missing data or stale evaluation;
- no rows and no audit rows: evaluator or audit write path needs investigation.

### Step 5 - Check active systems

Check pers_sys_systems_v2.active.

Inactive systems should not be treated as live candidates even if old audit or signal rows exist.

### Step 6 - Check alert and suppression path

Only after a READY signal exists, inspect:
- T30 alert function output;
- already accepted/logged bet suppression;
- prior-sent or fingerprint state;
- accept/log RPC behavior.

Do not investigate alerting first when there is no READY signal.

## 7. Known fail codes

### h2h_band

Meaning:
The relevant dog H2H price was outside the permitted band for the system.

Operational interpretation:
Legitimate model no-pass unless the H2H price source was missing or stale.

Observed example:
SYS_5 failed where dog close H2H was too long, such as 3.9, 6.0 or 6.5.

### line_clv

Meaning:
Line CLV was not strong enough.

Operational interpretation:
Legitimate model no-pass when line movement does not meet threshold.

Observed example:
SYS_5 failed with line_clv where line_clv_points was only 1.

### odds_band

Meaning:
The system's required odds range was not met.

Operational interpretation:
Legitimate model no-pass.

Observed example:
SYS_7 failed odds_band in Round 16 completed games.

### totals_move_lt_3

Meaning:
Total movement was below the required +3 over-momentum threshold.

Operational interpretation:
Legitimate SYS_8 no-pass.

Observed examples:
- open_total 172.5, model_total 174.5, total_move 2;
- open_total 173.5, model_total 170.5, total_move -3;
- open_total 165.5, model_total 162.5, total_move -3.

### excluded_team

Meaning:
A system-specific team exclusion applied.

Operational interpretation:
Legitimate model no-pass.

Observed example:
SYS_8 excluded Collingwood.

### missing_model_data

Meaning:
The evaluator did not have required model inputs for that system/game.

Operational interpretation:
Could be expected if run too early before required window/model data exists, or a real data issue if after the required window.

### missing_totals_data

Meaning:
Required totals data was missing.

Operational interpretation:
Could be expected where totals market data is not available or not yet written. If TOTALS snapshots exist but this persists, inspect evaluator data reads.

## 8. Round 16 no-bet review outcome

Completed games reviewed:
- Hawthorn v GWS
- Carlton v West Coast
- Collingwood v Richmond
- Port Adelaide v Adelaide

Finding:
- T60, T30 and T10 snapshots existed for completed games.
- pers_sys_signal_audit_v2 contained model/data fail rows.
- pers_sys_signals_v2 had no READY rows for those games.
- No T30 bet was therefore a legitimate no-signal outcome, not a broken snapshot pipeline.

Key fail outcomes:
- SYS_5 failed h2h_band or line_clv.
- SYS_7 failed odds_band.
- SYS_8 failed totals_move_lt_3 or excluded_team.
- SYS_6 and SYS_9 historical or inactive rows should not be treated as live current candidates.

## 9. What not to infer

Do not infer:

- No pers_sys_signals_v2 rows means evaluator failed.
- Historical SYS_6 or SYS_9 rows mean those systems are currently active.
- Snapshot existence alone means a bet should exist.
- T30 alert absence means alerting is broken.
- CURRENT snapshot rows are substitutes for T30 rows.
- OPEN duplicate-key noise explains T30 no-bets unless T30 rows are actually missing.

## 10. Minimum SQL checks

### Game schedule

    select *
    from pers_sys_games
    where season = 2026
      and round = 16
    order by start_time_aet;

### Snapshot inventory

    select
      game_id,
      snapshot_type,
      market_type,
      agg_method,
      count(*) as rows_found,
      min(created_at) as first_created_at,
      max(created_at) as latest_created_at,
      max(snapshot_ts) as latest_snapshot_ts
    from pers_sys_market_snapshots
    where game_id = '<game_id>'
    group by game_id, snapshot_type, market_type, agg_method
    order by snapshot_type, market_type;

### Audit summary

    select
      system_code,
      audit_status,
      fail_stage,
      fail_code,
      count(*) as row_count,
      min(evaluated_at) as first_evaluated_at,
      max(evaluated_at) as latest_evaluated_at
    from pers_sys_signal_audit_v2
    where game_id = '<game_id>'
    group by system_code, audit_status, fail_stage, fail_code
    order by system_code, audit_status, fail_stage, fail_code;

### Actionable signals

    select *
    from pers_sys_signals_v2
    where game_id = '<game_id>'
    order by created_at desc;

### Active systems

    select
      system_code,
      system_name,
      active,
      system_group,
      system_priority,
      model_snapshot,
      execution_snapshot,
      primary_market,
      overlay_market,
      allow_candidate
    from pers_sys_systems_v2
    order by system_code;
