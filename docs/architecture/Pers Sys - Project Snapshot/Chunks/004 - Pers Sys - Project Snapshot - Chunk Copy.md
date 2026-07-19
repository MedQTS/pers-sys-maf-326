CHUNK_ID: 004
DOC_ID: pers-sys-project-snapshot
DOC_TITLE: Pers Sys - Project Snapshot
SECTION_RANGE: auto
PREVIOUS_CHUNK: 003
NEXT_CHUNK: 005
SOURCE_OF_TRUTH: true

## 13. Current decision position

The best current decision statement is:

The project is structurally close and mostly aligned between repo and live environment.

Nightly orchestration is active.

Watcher dispatcher cron is active and the T30 path has been proven live.

The earlier stake and suppression blocker set has been materially reduced for the current live market scope.

The previously observed SYS_2 Week-versus-email mismatch has now been materially resolved for the active live path through targeted T30 alert logic that includes the linked OPEN base LINE leg when the SYS_2 T30 overlay is actionable.

The signal-read audit indicates the evaluator is alive and low signal volume is mostly current model selectivity when using latest-state completed-game audit rows.

The Round 16 no-bet review confirms the same diagnostic pattern: completed games had snapshots and audit rows, but no READY signal rows because the systems failed valid model criteria.

SYS_6/SYS_7 staking was too aggressive for validation mode and has been hotfixed at evaluator replacement-content level, pending fresh-row verification.

However, the system is not yet fully trusted for automation because repeated watcher behavior is not yet fully proven, cadence/tolerance rules are not yet fully locked, broader live-cycle operational confidence still requires verification, and post-hotfix staking output still needs to be observed.

## 14. Snapshot conclusion

This project should currently be described as:

- Architecture established.
- Repo remediated.
- Live environment mostly aligned.
- Nightly orchestration active.
- Watcher dispatcher cron active and partially proven.
- Stake/suppression rule closure substantially resolved for the current live scope.
- Specific SYS_2 T30 alert-content mismatch resolved for the active live path.
- Signal-read quality mostly validated via latest-state completed-game audit.
- Round 16 no-bet review confirmed no-bet diagnosis must use audit rows before inferring pipeline failure.
- SYS_6/SYS_7 staking-risk hotfix applied, pending fresh-output verification.
- Trusted automation not yet complete.

## 15. Update rule

This snapshot should be updated whenever any of the following changes:

- cron jobs created or modified
- secrets verified
- nightly logs verified
- watcher cadence locked
- watcher behavior across repeated hits verified
- duplicate-behavior verified
- live environment parity materially changes
- duplicate staking RPC overloads are removed or materially changed
- TOTALS market is activated or reviewed for parity
- T30 repeated-live-cycle behavior is confirmed over time
- post-hotfix SYS_6/SYS_7 staking output is verified
- no-bet diagnostic procedure materially changes
- pers_sys_signal_audit_v2 or pers_sys_signals_v2 write behavior materially changes

## 16. Current closeout addendum - SYS_7, SYS_10A, and SYS_12

This addendum records the current point-in-time status after the SYS_7, SYS_10A and SYS_12 closeout work. It should be treated as current snapshot status until the next full snapshot consolidation.

### 16.1 SYS_12 Phase 1A status

SYS_12 is now locked as a separate bottom-2/3 fade multi basket concept, but only Phase 1A has been implemented.

Current status:

- SYS_12 Phase 1A is implemented and accepted.
- Phase 1A scope is candidate-leg evaluator and audit only.
- Phase 1A produced audit evidence without creating actionable signals.
- Phase 1A does not build baskets.
- Phase 1A does not allocate stakes.
- Phase 1A does not add SYS_10A total legs.
- Phase 1A does not run through watcher, T30 action, alerting or bet placement.

Current interpretation:

SYS_12 exists as a current architecture/system item, but not as an automated live betting basket. Any future basket construction, stake allocation, SYS_10A pairing, watcher integration, alerting or bet-placement path requires a later governed phase.

### 16.2 SYS_7 T30-action alignment status

A SYS_7 READY audit case exposed an audit-to-signal materialisation gap.

Observed issue:

- SYS_7 produced a READY audit outcome for a Gold Coast home-favourite case.
- No actionable signal or email materialised.
- Diagnosis: SYS_7 was able to become READY in a timing path that did not align with ACTION_T30 signal materialisation.

Current status:

- A targeted fix has been deployed to align SYS_7 with the T30-action path.
- This is intended to ensure future eligible SYS_7 live-action cases either materialise into actionable signals or fail cleanly.
- Runtime verification remains pending because a fresh post-fix eligible SYS_7 case has not yet proven the behaviour.

Current interpretation:

SYS_7 T30-action alignment is deployed but not yet fully live-verified.

### 16.3 SYS_7 operator exclusion overlay status

A SYS_7 operator exclusion overlay has been added.

Excluded selected-home teams:

- Gold Coast
- Port Adelaide
- North Melbourne
- GWS

Expected behaviour:

- SYS_7 selects the home side.
- If the selected home side is excluded, the evaluator should fail the candidate before actionable signal creation.
- Expected fail code: `operator_excluded_team`.
- No SYS_7 actionable signal should be written for excluded selected-home teams.

Current status:

- Overlay deployed.
- Historical Gold Coast evidence predates the deployed overlay and should not be used as post-deploy proof.
- Fresh runtime verification remains pending.

Current interpretation:

SYS_7 operator exclusion is deployed but still needs fresh audit evidence to close verification.
