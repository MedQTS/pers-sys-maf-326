
Pers Sys — Project Snapshot


1. Purpose


This document records the current point-in-time project status for the Pers System AFL Betting project.


It is not the canonical architecture document and it is not the delivery-gates document.


Its purpose is to capture:


what is actually confirmed right now


what remains pending


what is live versus repo-confirmed versus still-assumed


This is the project-status snapshot, not the stable architecture target.


2. Current overall position


The project is structurally close.


Architecture is established.


Repo remediation has largely been completed.


The live environment appears mostly aligned on the automation-critical surfaces already checked.


Nightly orchestration is active.


Watcher dispatcher cron is active and the T30 path has been proven live.


The earlier stake and suppression blocker set has been materially reduced for the current live market scope.


A specific SYS_2 T30 alert-content mismatch has now also been diagnosed and materially resolved for the active live path: when a SYS_2 T30 H2H overlay is actionable, the alert can now include the linked OPEN base LINE leg where that base leg remains READY and is not already accepted/logged.


A later signal-read audit confirmed that the evaluator and signal pipeline are alive when completed games are reviewed using latest-state audit rows rather than raw historical audit counts. Low signal volume to date is mainly model selectivity, not broad read failure.


A later bankroll-risk audit identified that SYS_6 and SYS_7 staking recommendations were too aggressive for live-validation use. A staking-only hotfix has been applied to the evaluator replacement content to compress SYS_6 and SYS_7 exposure. No post-hotfix audit or signal rows had yet been generated at closeout, so verification remains pending.


The system is not yet fully trusted for end-to-end automation because watcher cadence, repeated-hit behavior, broader operational confidence, and post-hotfix staking output still require verification.


3. Repo and live-state framing


This project must still be understood through three different truth layers:


Repo-confirmed


What repository code, migrations, and governed docs explicitly support.


Live-confirmed


What has actually been checked in the deployed Supabase environment.


Still assumed / pending verification


What is intended or likely, but not yet fully proven in live operation.


This distinction remains mandatory.


4. Repo-confirmed status


The repo now supports the core operating model:


orchestration-first cron entrypoints


v2 evaluation path


staking RPC overloads for canonical preview/accept logic


watcher and alert functions


runner/operator surfaces


The repository is no longer the main blocker set.


The repo-side concerns that previously dominated the project have been materially reduced.


The evaluator replacement content now includes a staking-only risk hotfix for SYS_6 and SYS_7. This is a bankroll-risk calibration change and does not alter model eligibility rules.


5. Live-confirmed status


5.1 Environment and platform surfaces


The later thread work confirmed or materially supported:


live key schema objects present


live key columns present


SYS_8 present and active


newer staking RPC overloads present


core Edge Functions deployed


pg_cron enabled


pg_net enabled


nightly maintenance cron active


open-nightly cron active


watcher dispatcher cron active


T30 live alert path operationally observed


5.2 Production orchestration path


The following chain is now operationally evidenced at least for T30:


cron -> pers-sys-dispatch-watchers -> pers-sys-run-watcher -> pers-sys-send-t30-alert


This means the production gap is no longer “watcher cron missing.”


The remaining question is whether repeated-hit behavior, cadence, tolerance, and duplicate side effects are correct enough to trust over time.


5.3 Signal-read audit status


A completed-game latest-state audit confirmed that the system is reading and evaluating. The key result was that raw audit counts were misleading because they mixed future games and stale early evaluations with later final state.


Current latest-state completed-game interpretation:


SYS_2 is a healthy producer.


SYS_6 is a healthy producer but required staking-risk calibration.


SYS_7 is live but sparse.


SYS_3, SYS_5, SYS_8, and SYS_9 were mostly genuine model no-pass systems under current criteria.


This supports the conclusion that low live signal volume is mostly model selectivity rather than broad data starvation or evaluator failure.


6. Live caveats still recorded


The following remain true and should still be recorded as caveats:


6.1 Migration provenance unclear


Expected remediation migration versions were not returned from migration history, even though the live objects themselves appear present.


This means:


live environment looks functionally aligned


but provenance is unclear


6.2 Full runtime behavior not yet fully proven


Even where schema, RPCs, functions, and cron jobs are present, that does not yet prove:


correct repeated-hit behavior under watcher automation


no duplicate side effects across repeated watcher hits


clean watcher behavior across T60/T30/T10 windows


full end-to-end operational trust over repeated live cycles


6.3 Post-hotfix staking output not yet verified


The SYS_6 and SYS_7 staking hotfix has been prepared/applied at evaluator replacement-content level, but no fresh post-hotfix audit or signal rows had been generated at closeout.


Expected verification after the evaluator next runs:


SYS_6 maximum recommended bankroll percent should be at or below 1.5%.


SYS_7 maximum recommended bankroll percent should be at or below 2.5%.


Historical rows will still show the old aggressive values unless purged and regenerated.


7. Cron and orchestration status


Confirmed platform state


pg_cron enabled


pg_net enabled


Cron model locked


The intended cron model is:


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


pers-sys-dispatch-watchers


The project is not intended to use one cron per raw sub-step.


Confirmed cron creation status


Confirmed active in production:


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


pers-sys-dispatch-watchers


Observed live behavior from later thread work


Nightly and open-nightly jobs were visible and firing in production logs.


A recurring dispatcher cron was created for pers-sys-dispatch-watchers.


A T30 alert was received in production after that watcher cron activation, confirming the cron -> dispatcher -> run-watcher -> send-t30-alert path is live.


Watcher cron status


Activated


Partially proven


Watcher automation is no longer treated as missing or deferred.


It is active but not yet fully trusted.


8. Current business-rule status


8.1 Pre-bet dollar stake source


Resolved for the active inspected paths


Later thread work confirmed that:


WeekView uses preview_leg_stake for READY signals and passes recommended bankroll percent where available


pers-sys-send-t30-alert also calls preview_leg_stake and passes recommended bankroll percent where available


accept_leg_create_bet uses the same preferred recommended_bankroll_pct contract in the newer overload


This means the current live direction is now effectively:


one shared preview stake calculator path used by UI, T30 email, and acceptance logic for current live use


8.2 Suppression rule level


Resolved for the active inspected paths


Later thread work confirmed that:


T30 logged-bet matching is leg-level, not coarse game-level


the current accept duplicate-protection path is leg-level for the active live market scope that was inspected


the inspected live data shows current active H2H and LINE usage, not a live TOTALS case


8.3 Acceptance/logging compatibility


Substantially resolved for the active inspected paths


Later thread work confirmed that:


already accepted / already placed rows are explicitly separated from actionable rows in T30 email behavior


the earlier generic exclusion-count communication weakness has been materially improved in the inspected function logic


the current business-rule concern is no longer the broad earlier fear that all additional unsettled bets on the same game are being suppressed in current live paths


8.4 T30 email content behavior


Materially improved and now specifically confirmed for the active SYS_2 path


Later thread work confirmed that the T30 function now separates:


ACTION NOW


ALREADY ACCEPTED / ALREADY PLACED — DO NOT DUPLICATE


PREVIOUSLY SENT / NON-ACTIONABLE — BET NOT LOGGED


Further live diagnosis and verification established a specific SYS_2 rule now operating in the active alert path:


the Week view can show both an OPEN base LINE leg and a T30 H2H overlay for the same SYS_2 game


the T30 alert originally selected only T30 READY rows, which caused the linked OPEN LINE leg to be omitted from the email


a targeted fix was deployed in pers-sys-send-t30-alert so that, when a SYS_2 T30 H2H overlay is actionable, the function also pulls the linked OPEN base LINE leg from the overlay reason_json and includes it if it remains READY and is not already accepted/logged


dry-run verification then confirmed the intended behavior:


ready_signals = 2


candidates_after_logged_filter = 2


action_now = 1


previously_sent = 1


logged_excluded = 0


the linked SYS_2 LINE leg appeared in ACTION NOW


the SYS_2 H2H overlay appeared in PREVIOUSLY SENT because it had already been alerted earlier


This materially resolves the previously observed SYS_2 Week-versus-email mismatch for the active live path while preserving existing prior-sent dedupe and logged/unsettled suppression behavior.


Operational confirmation over repeated live cycles is still desirable, but the earlier diagnosed content mismatch is no longer an open blocker for the active SYS_2 path.


8.5 Fingerprint separation


Resolved in the inspected T30 path


Later thread work confirmed:


placed-bet identity is represented by a stable leg fingerprint


change-detection identity is represented separately using mutable action/display fields such as book, price, and stake


This distinction is now operationally represented, not merely conceptually stated.


8.6 Live market-scope note


Current live data inspected in thread work showed H2H and LINE rows, but no TOTALS rows.


Therefore:


TOTALS remains a latent future-risk area that should be reviewed before activation


but it is not a current live blocker based on the evidence inspected in this thread


8.7 Bankroll staking risk


Resolved at hotfix level; verification pending.


The latest staking review found that the previous live recommendations were too aggressive for validation use:


SYS_6 produced five historical signals at 2.5% bankroll each.


SYS_7 produced one historical signal at 6.0% bankroll.


SYS_2 remained modest and unchanged.


The evaluator replacement content was updated as a staking-only hotfix:


SYS_6: compressed ladder to 0.75 / 1.0 / 1.25, smaller amplifiers, hard cap 1.5%.


SYS_7: compressed tier ladder to 1.0 / 1.5 / 2.0 units, smaller amplifiers, hard cap 2.5 units.


This change reduces bankroll risk without changing model qualification criteria.


9. Watcher status


Watch windows recognized


T60


T30


T10


Current watcher position


Watcher architecture exists in repo and live deployment, and watcher automation is now active through the dispatcher cron model.


What is now confirmed


The dispatcher cron path has been activated in production.


The T30 watcher path has fired operationally.


The cron -> dispatcher -> run-watcher -> send-t30-alert chain is therefore confirmed live at least for T30.


Still pending for watcher trust


The following are still under-specified or unverified:


dispatcher cadence


tolerance window width


expected behavior on repeated hits inside the same window


duplicate prevention expectations across repeated runs


duplicate alert prevention under repeated scheduling


full watcher behavior across all watch windows


Current stance


Watcher automation is no longer “off.”


It is active but not yet fully trusted.


10. Email and external dependency status


Known architectural reality


Supabase provides:


database


functions


cron orchestration


But outbound email still requires a delivery provider path such as:


Postmark


or equivalent


Current status


The provider dependency is understood as operationally required.


Later thread work also confirmed that T30 outbound email is operationally firing in production.


Still pending


Secrets and operational readiness for:


alert/email path


odds/data-provider path


should still be explicitly confirmed unless already verified outside this snapshot.


11. What is confirmed vs pending


Confirmed


architecture shape is coherent


repo blocker set largely remediated


live key schema columns present


live SYS_8 present and active


live staking RPC overloads present


live core Edge Functions deployed


pg_cron enabled


pg_net enabled


nightly maintenance cron active


open-nightly cron active


watcher dispatcher cron active


orchestration-first cron model clarified


T30 live alert path operationally observed


shared preview stake path aligned across UI, T30, and accept logic for current live use


placed-bet identity separated from change-detection identity in T30


leg-level suppression behavior confirmed for the active inspected market scope


specific SYS_2 linked-base-leg T30 alert behavior now confirmed in the active live path


latest-state completed-game signal-read audit supports that evaluator/pipeline is alive


low signal volume to date appears mostly model-selective, not broad read failure


SYS_6/SYS_7 staking-risk hotfix applied at evaluator replacement-content level


Pending


nightly sequencing confidence over time


secrets verification


watcher cadence/tolerance lock


watcher behavior across repeated hits verification


duplicate-side-effect verification across repeated watcher hits


full watcher verification across T60/T30/T10


final trusted automation readiness


duplicate staking RPC cleanup if desired


TOTALS parity review before live activation of that market


T30 repeated-live-cycle behavior is confirmed over time


post-hotfix SYS_6/SYS_7 staking output verification after fresh evaluator rows are generated


12. Immediate next-step chain


The narrow next-step sequence should be:


verify watcher dispatcher cadence and tolerance model


verify watcher logs and side effects across repeated window hits


verify no duplicate alerts or duplicate signal creation from repeated window hits


verify required odds/email secrets are present if not already closed elsewhere


review duplicate staking RPC overload risk and simplify when safe


review TOTALS parity before activating that market in live automation


trigger or wait for fresh evaluator execution and verify post-hotfix SYS_6/SYS_7 bankroll caps


only then treat the system as trusted for end-to-end automation


13. Current decision position


The best current decision statement is:


The project is structurally close and mostly aligned between repo and live environment.


Nightly orchestration is active.


Watcher dispatcher cron is active and the T30 path has been proven live.


The earlier stake and suppression blocker set has been materially reduced for the current live market scope.


The previously observed SYS_2 Week-versus-email mismatch has now been materially resolved for the active live path through targeted T30 alert logic that includes the linked OPEN base LINE leg when the SYS_2 T30 overlay is actionable.


The signal-read audit indicates the evaluator is alive and low signal volume is mostly current model selectivity when using latest-state completed-game audit rows.


SYS_6/SYS_7 staking was too aggressive for validation mode and has been hotfixed at evaluator replacement-content level, pending fresh-row verification.


However, the system is not yet fully trusted for automation because repeated watcher behavior is not yet fully proven, cadence/tolerance rules are not yet fully locked, broader live-cycle operational confidence still requires verification, and post-hotfix staking output still needs to be observed.


14. Snapshot conclusion


This project should currently be described as:


Architecture established.


Repo remediated.


Live environment mostly aligned.


Nightly orchestration active.


Watcher dispatcher cron active and partially proven.


Stake/suppression rule closure substantially resolved for the current live scope.


Specific SYS_2 T30 alert-content mismatch resolved for the active live path.


Signal-read quality mostly validated via latest-state completed-game audit.


SYS_6/SYS_7 staking-risk hotfix applied, pending fresh-output verification.


Trusted automation not yet complete.


15. Update rule


This snapshot should be updated whenever any of the following changes:


cron jobs created or modified


secrets verified


nightly logs verified


watcher cadence locked


watcher behavior across repeated hits verified


duplicate-behavior verified


live environment parity materially changes


duplicate staking RPC overloads are removed or materially changed


TOTALS market is activated or reviewed for parity


T30 repeated-live-cycle behavior is confirmed over time


post-hotfix SYS_6/SYS_7 staking output is verified