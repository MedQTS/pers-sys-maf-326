CHUNK_ID: 001
DOC_ID: pers-sys-live-operation-and-audit-map
DOC_TITLE: Pers Sys - Live Operation and Audit Map
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - Live Operation and Audit Map

## 1. Purpose

This document explains how the live Pers Sys AFL betting system operates in practice, with special focus on how to diagnose no-bet outcomes without guessing.

It is an operational map, not a model-design paper.

Use it when checking:

- whether T60, T30 or T10 snapshots were created;
- whether the evaluator ran;
- why no READY signal was written;
- whether a no-bet outcome was legitimate;
- whether an issue is in snapshots, evaluation, audit, signal output, alerting or accepted-bet suppression.

## 2. Core distinction

The main operational rule is:

    Empty pers_sys_signals_v2 does not prove the system failed.

The system must be read through three layers:

1. pers_sys_market_snapshots
   Odds and market-state evidence.

2. pers_sys_signal_audit_v2
   Evaluator diagnostic evidence.

3. pers_sys_signals_v2
   Actionable signal output.

A completed game can have valid T60, T30 and T10 snapshots, valid audit failures, and no READY signal. That means no bet qualified.

## 3. Main live tables

### pers_sys_games

Purpose:
Game fixture, team, venue, timing and result state.

Use for:
- game_id lookup;
- season and round filters;
- start_time_aet;
- home and away team joins;
- status checks.

Important operational point:
Use game_id as the anchor for all downstream checks.

### pers_sys_market_snapshots

Purpose:
Stores odds snapshots by game, snapshot type and market type.

Key snapshot types:
- OPEN
- CURRENT
- T60
- T30
- T10

Key market types:
- H2H
- LINE
- TOTALS

Use for:
- proving odds ingestion worked;
- proving T60/T30/T10 windows fired;
- checking prices, lines and totals used by the evaluator.

A missing T30 snapshot is a snapshot/window issue.
A present T30 snapshot plus no signal requires audit-table review.

### pers_sys_systems_v2

Purpose:
Current v2 system registry and evaluation config.

Use for:
- active system checks;
- system priority;
- model snapshot;
- execution snapshot;
- primary and overlay market;
- candidate permission.

Operational rule:
The evaluator should use active systems only.

Current known active/inactive state from June 2026 review:

- SYS_1 active
- SYS_2 active
- SYS_3 active
- SYS_4 active
- SYS_5 active
- SYS_6 inactive
- SYS_7 active
- SYS_8 active
- SYS_9 inactive

Historical audit or signal rows for inactive systems may remain visible. They are history, not current betting candidates.

### pers_sys_signal_audit_v2

Purpose:
Evaluator audit and diagnostic table.

Use for:
- proving evaluator ran;
- finding fail reasons;
- distinguishing legitimate no-edge from pipeline failure;
- reviewing model/data failure stage;
- diagnosing no-bet outcomes.

Key fields:
- system_code
- game_id
- season
- round
- model_snapshot
- execution_snapshot
- model_market
- execution_market
- audit_status
- fail_stage
- fail_code
- audit_key
- reason_json
- evaluated_at

Important rule:
FAIL rows belong here. A game may fail every system and still have no pers_sys_signals_v2 row.

### pers_sys_signals_v2

Purpose:
Actionable signal table.

Use for:
- READY signal review;
- selection side;
- line_at_bet;
- ref_price;
- exec_best_price;
- exec_best_book;
- recommended_units;
- recommended_bankroll_pct;
- staking contract version.

Important rule:
This table answers "what fired?" It does not reliably answer "what was evaluated and failed?" Use pers_sys_signal_audit_v2 for that.

## 4. Function map

### pers-sys-run-nightly-maintenance

Role:
Nightly maintenance orchestration.

Expected responsibilities:
- pull fixture and result data;
- build features;
- perform housekeeping or settlement-related work where configured.

### pers-sys-run-open-nightly

Role:
Opening-market orchestration.

Expected responsibilities:
- pull OPEN snapshots;
- run opening evaluation where applicable.

Known fix:
OPEN snapshot writes must be idempotent. Repeated OPEN runs should not throw duplicate-key errors when OPEN rows already exist.

### pers-sys-dispatch-watchers

Role:
Recurring watcher dispatcher.

Expected responsibilities:
- find games entering T60, T30 or T10 windows;
- dispatch watcher work for the relevant window;
- avoid duplicate operational side effects.

### pers-sys-run-watcher

Role:
Window runner.

Expected responsibilities:
- execute window-specific snapshot pull;
- invoke evaluation for the relevant game/window;
- support downstream T30 alerting when required.

### pers-sys-pull-odds-snapshot

Role:
Odds snapshot writer.

Expected responsibilities:
- write OPEN, CURRENT, T60, T30 and T10 snapshots;
- write H2H, LINE and TOTALS rows when available;
- use duplicate-safe writes for repeated runs.

### pers-sys-evaluate-systems-v2

Role:
Canonical v2 evaluator.

Expected responsibilities:
- read game, feature and snapshot context;
- apply active system rules;
- write audit outcomes to pers_sys_signal_audit_v2;
- write actionable signals to pers_sys_signals_v2 only when a signal qualifies.

### pers-sys-send-t30-alert

Role:
T30 alerting.

Expected responsibilities:
- read actionable signal rows;
- exclude already accepted/logged bets;
- separate ACTION NOW from already accepted or previously sent items;
- preserve leg-level suppression.

## 5. T60/T30/T10 operational flow

Canonical flow:

    cron
    -> pers-sys-dispatch-watchers
    -> pers-sys-run-watcher
    -> pers-sys-pull-odds-snapshot
    -> pers-sys-evaluate-systems-v2
    -> pers_sys_signal_audit_v2
    -> pers_sys_signals_v2 when READY
    -> pers-sys-send-t30-alert where applicable

Interpretation:

- If snapshots are missing, investigate watcher/snapshot path.
- If snapshots exist but audit rows are missing, investigate evaluator invocation.
- If audit rows exist and all fail, no bet is legitimate.
- If READY signal exists but no alert appears, investigate alerting or suppression.
- If alert appears but bet cannot be logged, investigate acceptance/logging path.

## 6. Standard no-bet diagnostic path

Use this sequence.
