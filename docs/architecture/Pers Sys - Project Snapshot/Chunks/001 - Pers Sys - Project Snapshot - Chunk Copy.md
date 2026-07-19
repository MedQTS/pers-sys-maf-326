CHUNK_ID: 001
DOC_ID: pers-sys-project-snapshot
DOC_TITLE: Pers Sys - Project Snapshot
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - Project Snapshot

## 1. Purpose

This document records the current point-in-time project status for the Pers System AFL Betting project.

It is not the canonical architecture document and it is not the delivery-gates document.

Its purpose is to capture:

- what is actually confirmed right now
- what remains pending
- what is live versus repo-confirmed versus still-assumed

This is the project-status snapshot, not the stable architecture target.

## 2. Current overall position

The project is structurally close.

Architecture is established.

Repo remediation has largely been completed.

The live environment appears mostly aligned on the automation-critical surfaces already checked.

Nightly orchestration is active.

Watcher dispatcher cron is active and the T30 path has been proven live.

The earlier stake and suppression blocker set has been materially reduced for the current live market scope.

A specific SYS_2 T30 alert-content mismatch has now also been diagnosed and materially resolved for the active live path: when a SYS_2 T30 H2H overlay is actionable, the alert can now include the linked OPEN base LINE leg where that base leg remains READY and is not already accepted/logged.

A later signal-read audit confirmed that the evaluator and signal pipeline are alive when completed games are reviewed using latest-state audit rows rather than raw historical audit counts. Low signal volume to date is mainly model selectivity, not broad read failure.

June 2026 Round 16 no-bet review confirmed that completed-game T60/T30/T10 snapshots existed, evaluator audit rows existed, and no READY signal rows were legitimate no-signal outcomes. Fail codes included h2h_band, line_clv, odds_band, totals_move_lt_3, and excluded_team. This confirms that the no-bet outcome in that review was model selectivity, not broken snapshot ingestion or a missing T30 pipeline.

A later bankroll-risk audit identified that SYS_6 and SYS_7 staking recommendations were too aggressive for live-validation use. A staking-only hotfix has been applied to the evaluator replacement content to compress SYS_6 and SYS_7 exposure. No post-hotfix audit or signal rows had yet been generated at closeout, so verification remains pending.

The system is not yet fully trusted for end-to-end automation because watcher cadence, repeated-hit behavior, broader operational confidence, and post-hotfix staking output still require verification.

Detailed no-bet diagnosis and audit interpretation are now documented in:

- Pers Sys - Live Operation and Audit Map.md

## 3. Repo and live-state framing

This project must still be understood through three different truth layers.

### Repo-confirmed

What repository code, migrations, and governed docs explicitly support.

### Live-confirmed

What has actually been checked in the deployed Supabase environment.

### Still assumed / pending verification

What is intended or likely, but not yet fully proven in live operation.

This distinction remains mandatory.

## 4. Repo-confirmed status

The repo now supports the core operating model:

- orchestration-first cron entrypoints
- v2 evaluation path
- staking RPC overloads for canonical preview/accept logic
- watcher and alert functions
- runner/operator surfaces

The repository is no longer the main blocker set.

The repo-side concerns that previously dominated the project have been materially reduced.

The evaluator replacement content now includes a staking-only risk hotfix for SYS_6 and SYS_7. This is a bankroll-risk calibration change and does not alter model eligibility rules.

## 5. Live-confirmed status

### 5.1 Environment and platform surfaces

The later thread work confirmed or materially supported:

- live key schema objects present
- live key columns present
- SYS_8 present and active
- newer staking RPC overloads present
- core Edge Functions deployed
- pg_cron enabled
- pg_net enabled
- nightly maintenance cron active
- open-nightly cron active
- watcher dispatcher cron active
- T30 live alert path operationally observed

### 5.2 Production orchestration path

The following chain is now operationally evidenced at least for T30:

    cron -> pers-sys-dispatch-watchers -> pers-sys-run-watcher -> pers-sys-send-t30-alert

This means the production gap is no longer "watcher cron missing."

The remaining question is whether repeated-hit behavior, cadence, tolerance, and duplicate side effects are correct enough to trust over time.

### 5.3 Signal-read audit status

A completed-game latest-state audit confirmed that the system is reading and evaluating. The key result was that raw audit counts were misleading because they mixed future games and stale early evaluations with later final state.

Current latest-state completed-game interpretation:

- SYS_2 is a healthy producer.
- SYS_6 is a healthy producer but required staking-risk calibration.
- SYS_7 is live but sparse.
- SYS_3, SYS_5, SYS_8, and SYS_9 were mostly genuine model no-pass systems under current criteria.

This supports the conclusion that low live signal volume is mostly model selectivity rather than broad data starvation or evaluator failure.

The later Round 16 no-bet review made the operational diagnosis clearer:

- `pers_sys_market_snapshots` showed the relevant window odds evidence.
- `pers_sys_signal_audit_v2` showed evaluator fail/pass diagnostic evidence.
- `pers_sys_signals_v2` remained empty because no READY signal qualified.

The specific fail codes for the completed games included:

- h2h_band
- line_clv
- odds_band
- totals_move_lt_3
- excluded_team

This means an empty `pers_sys_signals_v2` result is not enough to infer failure. The audit table must be checked before concluding that the evaluator or watcher pipeline failed.

Detailed reference:

- Pers Sys - Live Operation and Audit Map.md

## 6. Live caveats still recorded

The following remain true and should still be recorded as caveats.
