CHUNK_ID: 002
DOC_ID: pers-sys-delivery-gates
DOC_TITLE: Pers Sys - Delivery Gates
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

### Gate status

PASSED for stake-source and suppression behavior in the active inspected scope.

PARTIAL for post-hotfix staking output until fresh evaluator rows verify the caps.

## 9. Gate 6 - Watcher automation activation

### Objective

Prove that watcher automation is active and can drive timed pre-game windows.

### Required outcomes

Watcher automation must support:

- T60
- T30
- T10

The production flow should be:

cron -> pers-sys-dispatch-watchers -> pers-sys-run-watcher -> snapshot/evaluate -> alert where applicable

### Current findings

Confirmed:

- watcher dispatcher cron is active
- T30 path has fired operationally
- T30 alert path has been observed live

Still requiring verification:

- cadence
- tolerance window
- repeated-hit behavior
- duplicate prevention
- side-effect control
- full T60/T30/T10 behavior over time

### Gate status

PARTIALLY PASSED.

Watcher automation is active, but not yet fully trusted.

## 10. Gate 7 - End-to-end trusted automation readiness

### Objective

Prove that the system can be trusted across repeated live cycles, not just one successful path.

### Required outcomes

The system must demonstrate:

- correct nightly sequence over time
- watcher cadence and tolerance locked
- repeated watcher hits do not create duplicate side effects
- duplicate alert prevention works
- no READY signal is missed by alerting
- accepted/logged bets suppress correctly at leg level
- post-hotfix SYS_6/SYS_7 staking caps are verified
- no-bet outcomes are traceable and explainable

### No-bet traceability requirement

Before the system is considered fully trusted, a completed game must be traceable through:

1. pers_sys_games
2. pers_sys_market_snapshots
3. pers_sys_signal_audit_v2
4. pers_sys_signals_v2
5. alert / suppression state
6. accepted / logged bet state

A no-bet outcome is only considered explained when the audit table shows valid fail/pass diagnostics or the missing layer is clearly identified.

Detailed diagnostic reference:

- Pers Sys - Live Operation and Audit Map.md

### Round 16 audit finding

The June 2026 Round 16 no-bet review confirmed:

- completed-game T60/T30/T10 snapshots existed
- evaluator audit rows existed
- no READY signal rows were legitimate no-signal outcomes
- fail codes included h2h_band, line_clv, odds_band, totals_move_lt_3, and excluded_team

Conclusion:

    The no-bet outcome was legitimate model selectivity, not broken snapshot ingestion or a missing T30 pipeline.

### Gate status

OPEN / NOT YET FULLY PASSED.

The system is structurally close and partially live-proven, but repeated-cycle confidence is still required.

## 11. Current gate summary

| Gate | Status | Current meaning |
|---|---|---|
| Gate 1 - Core architecture | PASSED | System shape is established. |
| Gate 2 - Repo remediation | PASSED | Repo blocker set materially reduced. |
| Gate 3 - Live parity | MOSTLY PASSED | Live objects/functions present; provenance caveat remains. |
| Gate 4 - Nightly orchestration | PASSED | Nightly/open cron active. |
| Gate 5 - Stake/suppression | PARTIAL / MOSTLY PASSED | Current live scope resolved; post-hotfix staking output pending. |
| Gate 6 - Watcher activation | PARTIAL | Dispatcher/T30 path live; repeated behavior not yet fully trusted. |
| Gate 7 - Trusted automation | OPEN | Needs repeated-cycle, no-bet, duplicate and staking verification. |

## 12. Immediate gate-focused next steps

The narrow next-step chain is:

1. Verify watcher dispatcher cadence and tolerance.
2. Verify watcher logs and side effects across repeated window hits.
3. Verify no duplicate alerts or duplicate signal creation from repeated watcher hits.
4. Verify required odds/email secrets if not already closed elsewhere.
5. Review duplicate staking RPC overload risk and simplify when safe.
6. Review TOTALS parity before activating that market in live automation.
7. Trigger or wait for fresh evaluator execution.
8. Verify post-hotfix SYS_6 and SYS_7 bankroll caps.
9. Use the no-bet diagnostic chain for every completed-game no-signal review.
10. Only then treat the system as trusted for end-to-end automation.

## 13. Update rule

This delivery gate register should be updated whenever any of the following changes:

- cron jobs are created or modified
- watcher cadence is locked
- watcher tolerance window is locked
- repeated-hit behavior is verified
- duplicate-side-effect behavior is verified
- alert/suppression behavior changes
- accepted/logged bet behavior changes
- staking caps are verified after fresh evaluator rows
- TOTALS market is activated or reviewed for parity
- no-bet diagnostic procedure materially changes
- pers_sys_signal_audit_v2 or pers_sys_signals_v2 write behavior materially changes
- Gate 7 becomes ready to close

## 14. Current closeout addendum - SYS_7, SYS_10A and SYS_12 gate impacts

This addendum records delivery-gate impacts from the SYS_7, SYS_10A and SYS_12 closeout work.

### 14.1 Gate 5 update - stake, suppression and manual-guide boundary

Gate 5 remains mostly passed for the active inspected stake-source and suppression paths, but the SYS_10A guide must remain outside live automation trust.

Additional Gate 5 position:

- SYS_10A Total Guide is a manual guide.
- SYS_10A email wording has been improved and deployed.
- The wording/layout change does not add active weather decisioning.
- The wording/layout change does not add ACTION NOW alerts.
- The wording/layout change does not add bet placement.
- Outdoor SYS_10A candidates still require manual weather checking before betting.
- Docklands / Marvel may be treated as roof or indoor where reliably identified.

Gate interpretation:

SYS_10A email disclosure is improved, but SYS_10A must not be counted as automated live weather-adjusted betting unless a later governed change proves current evaluator, watcher, email or active-decision wiring.
