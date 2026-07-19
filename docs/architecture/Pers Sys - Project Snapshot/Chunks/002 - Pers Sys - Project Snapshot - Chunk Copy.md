CHUNK_ID: 002
DOC_ID: pers-sys-project-snapshot
DOC_TITLE: Pers Sys - Project Snapshot
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

### 6.1 Migration provenance unclear

Expected remediation migration versions were not returned from migration history, even though the live objects themselves appear present.

This means:

- live environment looks functionally aligned
- but provenance is unclear

### 6.2 Full runtime behavior not yet fully proven

Even where schema, RPCs, functions, and cron jobs are present, that does not yet prove:

- correct repeated-hit behavior under watcher automation
- no duplicate side effects across repeated watcher hits
- clean watcher behavior across T60/T30/T10 windows
- full end-to-end operational trust over repeated live cycles

### 6.3 Post-hotfix staking output not yet verified

The SYS_6 and SYS_7 staking hotfix has been prepared/applied at evaluator replacement-content level, but no fresh post-hotfix audit or signal rows had been generated at closeout.

Expected verification after the evaluator next runs:

- SYS_6 maximum recommended bankroll percent should be at or below 1.5%.
- SYS_7 maximum recommended bankroll percent should be at or below 2.5%.

Historical rows will still show the old aggressive values unless purged and regenerated.

## 7. Cron and orchestration status

Confirmed platform state:

- pg_cron enabled
- pg_net enabled

Cron model locked.

The intended cron model is:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly
- pers-sys-dispatch-watchers

The project is not intended to use one cron per raw sub-step.

Confirmed active in production:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly
- pers-sys-dispatch-watchers

Observed live behavior from later thread work:

- Nightly and open-nightly jobs were visible and firing in production logs.
- A recurring dispatcher cron was created for pers-sys-dispatch-watchers.
- A T30 alert was received in production after watcher cron activation, confirming the cron -> dispatcher -> run-watcher -> send-t30-alert path is live.

Watcher cron status:

- Activated
- Partially proven

Watcher automation is no longer treated as missing or deferred.

It is active but not yet fully trusted.

## 8. Current business-rule status

### 8.1 Pre-bet dollar stake source

Resolved for the active inspected paths.

Later thread work confirmed that:

- WeekView uses preview_leg_stake for READY signals and passes recommended bankroll percent where available.
- pers-sys-send-t30-alert also calls preview_leg_stake and passes recommended bankroll percent where available.
- accept_leg_create_bet uses the same preferred recommended_bankroll_pct contract in the newer overload.

This means the current live direction is now effectively:

    one shared preview stake calculator path used by UI, T30 email, and acceptance logic for current live use

### 8.2 Suppression rule level

Resolved for the active inspected paths.

Later thread work confirmed that:

- T30 logged-bet matching is leg-level, not coarse game-level.
- The current accept duplicate-protection path is leg-level for the active live market scope that was inspected.
- The inspected live data shows current active H2H and LINE usage, not a live TOTALS case.

### 8.3 Acceptance/logging compatibility

Substantially resolved for the active inspected paths.

Later thread work confirmed that:

- already accepted / already placed rows are explicitly separated from actionable rows in T30 email behavior
- the earlier generic exclusion-count communication weakness has been materially improved in the inspected function logic
- the current business-rule concern is no longer the broad earlier fear that all additional unsettled bets on the same game are being suppressed in current live paths

### 8.4 T30 email content behavior

Materially improved and now specifically confirmed for the active SYS_2 path.

Later thread work confirmed that the T30 function now separates:

- ACTION NOW
- ALREADY ACCEPTED / ALREADY PLACED - DO NOT DUPLICATE
- PREVIOUSLY SENT / NON-ACTIONABLE - BET NOT LOGGED

Further live diagnosis and verification established a specific SYS_2 rule now operating in the active alert path:

- the Week view can show both an OPEN base LINE leg and a T30 H2H overlay for the same SYS_2 game
- the T30 alert originally selected only T30 READY rows, which caused the linked OPEN LINE leg to be omitted from the email
- a targeted fix was deployed in pers-sys-send-t30-alert so that, when a SYS_2 T30 H2H overlay is actionable, the function also pulls the linked OPEN base LINE leg from the overlay reason_json and includes it if it remains READY and is not already accepted/logged

Dry-run verification then confirmed the intended behavior:

- ready_signals = 2
- candidates_after_logged_filter = 2
- action_now = 1
- previously_sent = 1
- logged_excluded = 0
- the linked SYS_2 LINE leg appeared in ACTION NOW
- the SYS_2 H2H overlay appeared in PREVIOUSLY SENT because it had already been alerted earlier

This materially resolves the previously observed SYS_2 Week-versus-email mismatch for the active live path while preserving existing prior-sent dedupe and logged/unsettled suppression behavior.

Operational confirmation over repeated live cycles is still desirable, but the earlier diagnosed content mismatch is no longer an open blocker for the active SYS_2 path.

### 8.5 Fingerprint separation

Resolved in the inspected T30 path.

Later thread work confirmed:

- placed-bet identity is represented by a stable leg fingerprint
- change-detection identity is represented separately using mutable action/display fields such as book, price, and stake

This distinction is now operationally represented, not merely conceptually stated.

### 8.6 Live market-scope note

Current live data inspected in thread work showed H2H and LINE rows, but no TOTALS rows.

Therefore:

- TOTALS remains a latent future-risk area that should be reviewed before activation.
- It is not a current live blocker based on the evidence inspected in this thread.
