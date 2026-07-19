CHUNK_ID: 001
DOC_ID: pers-sys-canonical-architecture
DOC_TITLE: Pers Sys - Canonical Architecture
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - Canonical Architecture

## 1. Purpose

This document defines the canonical architecture for the Pers System AFL Betting project as it stands after repo review, live-environment checks, automation wiring, signal-read audit review, and staking-risk calibration work.

It is intended to be the stable "how the system is actually meant to work" document, separate from:

- delivery sequencing
- implementation status snapshots

This is the target operating architecture, not a minute-by-minute status log.

## 2. System intent

The system is a Supabase-backed AFL betting orchestration platform with:

- a React operator UI
- Supabase Edge Functions for ingestion, evaluation, alerting, and settlement
- database-backed system configuration and audit state
- scheduled orchestration for nightly maintenance, open-market evaluation, and timed watcher refreshes

Its purpose is to move the AFL workflow from partly manual execution to a persistent, rules-driven operating system for:

- data ingestion
- feature generation
- odds snapshotting
- system evaluation
- timed signal refresh
- alert generation
- bet logging and settlement support

## 3. Architectural principle

The core architectural rule is:

    Automation is driven by orchestration entrypoints, not by raw low-level cron steps.

The system should not schedule independent cron jobs for:

- Squiggle pull
- feature build
- open odds pull
- evaluate
- T60 pull
- T30 pull
- T10 pull

Instead, automation should enter through three orchestration functions:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly
- pers-sys-dispatch-watchers

This reduces:

- ordering risk
- overlap risk
- duplicate-trigger risk
- inconsistent intermediate state

## 4. Canonical pipeline layers

### 4.1 Operator layer

The React operator UI provides:

- visibility into pipeline state
- manual execution surfaces
- monitoring and operator intervention points
- review surfaces for bets, signals, and downstream state

This layer is not the primary source of automation sequencing. It is an operator surface.

### 4.2 Orchestration layer

The orchestration layer is the automation control plane. It is responsible for:

- enforcing sequence
- grouping related internal tasks
- reducing duplicate or conflicting runs
- separating daily maintenance from time-window refresh logic

Primary orchestration entrypoints:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly
- pers-sys-dispatch-watchers

### 4.3 Ingestion layer

The ingestion layer pulls external data into the system, including:

- fixture/results data
- odds snapshot data

Primary functions include:

- pers-sys-pull-squiggle
- pers-sys-pull-odds-snapshot

### 4.4 Feature/state layer

This layer computes derived game/team/system context needed for evaluation.

Primary function:

- pers-sys-build-features

### 4.5 Evaluation layer

This layer applies the betting-system logic against snapshot and state inputs.

Primary function:

- pers-sys-evaluate-systems-v2

This is the canonical evaluation path and should align to the v2 system registry.

Operational audit rule:

The live v2 evaluation path must be read through three separate evidence layers:

- pers_sys_market_snapshots = odds/window evidence
- pers_sys_signal_audit_v2 = evaluator audit and fail/pass diagnostic evidence
- pers_sys_signals_v2 = actionable READY signal output

An empty `pers_sys_signals_v2` result does not prove evaluator failure. For no-bet diagnosis, check `pers_sys_signal_audit_v2` before concluding that the pipeline failed.

Detailed operational diagnostic reference:

- Pers Sys - Live Operation and Audit Map.md

### 4.6 Watcher layer

This layer supports timed re-evaluation around key windows:

- T60
- T30
- T10

Primary functions:

- pers-sys-dispatch-watchers
- pers-sys-run-watcher

The dispatcher decides when a game has entered an active window.

The watcher executes the appropriate snapshot/evaluate path for that window.

### 4.7 Alerting layer

This layer is responsible for outbound operational notifications, especially around T30.

Primary function:

- pers-sys-send-t30-alert

Supabase handles orchestration and compute, but outbound email delivery still requires an external provider path.

### 4.8 Acceptance / logging layer

This layer records accepted bets and supports already-bet suppression logic.

Primary logic includes:

- preview stake behavior
- accept/log paths
- duplicate protection
- matching between recommendations and confirmed bets

Primary RPC/path of concern includes:

- accept_leg_create_bet
- preview stake RPCs such as preview_leg_stake

### 4.9 Settlement layer

This layer settles completed bets and updates ledger/bankroll-related state.

Primary function:

- pers-sys-settle

## 5. Canonical sequence

The intended automatic flow is:

### Phase 1 - Nightly maintenance

Run first.

Expected responsibilities:

- Squiggle pull
- feature build
- settlement and housekeeping as applicable

Primary entrypoint:

- pers-sys-run-nightly-maintenance

### Phase 2 - Open nightly

Run second, after nightly maintenance.

Expected responsibilities:

- opening odds snapshot
- evaluation on opening snapshot

Primary entrypoint:

- pers-sys-run-open-nightly

### Phase 3 - Watcher phase

Run after nightly preparation is complete.

Expected responsibilities:

- recurring dispatcher checks for T60, T30, and T10 windows
- window-specific snapshot/evaluation path
- T30 alert path where appropriate

Primary entrypoint:

- pers-sys-dispatch-watchers

This sequence is an operational requirement, not merely a preferred implementation style.
