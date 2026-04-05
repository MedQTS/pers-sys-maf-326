Pers Sys — Project Snapshot



1\. Purpose



This document records the current point-in-time project status for the Pers System AFL Betting project.



It is not the canonical architecture document and it is not the delivery-gates document.



Its purpose is to capture:



what is actually confirmed right now



what remains pending



what is live versus repo-confirmed versus still-assumed



This is the project-status snapshot, not the stable architecture target.



2\. Current overall position



The project is structurally close.



Architecture is established.



Repo remediation has largely been completed.



The live environment appears mostly aligned on the automation-critical surfaces already checked.



Nightly orchestration is active.



Watcher dispatcher cron is active and the T30 path has been proven live.



The earlier stake and suppression blocker set has now been materially reduced for the current live market scope.



However, the system is not yet fully trusted for end-to-end automation because watcher cadence, repeated-hit behavior, and broader operational confidence are still not fully proven.



3\. Repo and live-state framing



This project must still be understood through three different truth layers:



Repo-confirmed



What repository code, migrations, and governed docs explicitly support.



Live-confirmed



What has actually been checked in the deployed Supabase environment.



Still assumed / pending verification



What is intended or likely, but not yet fully proven in live operation.



This distinction remains mandatory.



4\. Repo-confirmed status



The repo now supports the core operating model:



orchestration-first cron entrypoints



v2 evaluation path



staking RPC overloads for canonical preview/accept logic



watcher and alert functions



runner/operator surfaces



The repository is no longer the main blocker set.



The repo-side concerns that previously dominated the project have been materially reduced.



5\. Live-confirmed status



5.1 Environment and platform surfaces



The later thread work confirmed or materially supported:



live key schema objects present



live key columns present



SYS\_8 present and active



newer staking RPC overloads present



core Edge Functions deployed



pg\_cron enabled



pg\_net enabled



nightly maintenance cron active



open-nightly cron active



watcher dispatcher cron active



T30 live alert path operationally observed



5.2 Production orchestration path



The following chain is now operationally evidenced at least for T30:



cron -> pers-sys-dispatch-watchers -> pers-sys-run-watcher -> pers-sys-send-t30-alert



This means the production gap is no longer “watcher cron missing.”



The remaining question is whether repeated-hit behavior, cadence, tolerance, and duplicate side effects are correct enough to trust over time.



6\. Live caveats still recorded



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



7\. Cron and orchestration status



Confirmed platform state



pg\_cron enabled



pg\_net enabled



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



8\. Current business-rule status



8.1 Pre-bet dollar stake source



Resolved for the active inspected paths



Later thread work confirmed that:



WeekView uses preview\_leg\_stake for READY signals and passes recommended bankroll percent where available



pers-sys-send-t30-alert also calls preview\_leg\_stake and passes recommended bankroll percent where available



accept\_leg\_create\_bet uses the same preferred recommended\_bankroll\_pct contract in the newer overload



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



Materially improved and conceptually aligned in the inspected function logic



Later thread work confirmed that the T30 function now separates:



ACTION NOW



ALREADY ACCEPTED / ALREADY PLACED — DO NOT DUPLICATE



PREVIOUSLY SENT / NON-ACTIONABLE — BET NOT LOGGED



This materially reduces the earlier duplicate-prevention communication gap.



Operational confirmation over repeated live cycles is still desirable, but the earlier diagnosed content mismatch is no longer the best description of the current logic.



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



9\. Watcher status



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



10\. Email and external dependency status



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



11\. What is confirmed vs pending



Confirmed



architecture shape is coherent



repo blocker set largely remediated



live key schema columns present



live SYS\_8 present and active



live staking RPC overloads present



live core Edge Functions deployed



pg\_cron enabled



pg\_net enabled



nightly maintenance cron active



open-nightly cron active



watcher dispatcher cron active



orchestration-first cron model clarified



T30 live alert path operationally observed



shared preview stake path aligned across UI, T30, and accept logic for current live use



placed-bet identity separated from change-detection identity in T30



leg-level suppression behavior confirmed for the active inspected market scope



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



12\. Immediate next-step chain



The narrow next-step sequence should be:



verify watcher dispatcher cadence and tolerance model



verify watcher logs and side effects across repeated window hits



verify no duplicate alerts or duplicate signal creation from repeated window hits



verify required odds/email secrets are present if not already closed elsewhere



review duplicate staking RPC overload risk and simplify when safe



review TOTALS parity before activating that market in live automation



only then treat the system as trusted for end-to-end automation



13\. Current decision position



The best current decision statement is:



The project is structurally close and mostly aligned between repo and live environment.



Nightly orchestration is active.



Watcher dispatcher cron is active and the T30 path has been proven live.



The earlier stake and suppression blocker set has been materially reduced for the current live market scope.



However, the system is not yet fully trusted for automation because repeated watcher behavior is not yet fully proven, cadence/tolerance rules are not yet fully locked, and broader live-cycle operational confidence still requires verification.



14\. Snapshot conclusion



This project should currently be described as:



Architecture established.



Repo remediated.



Live environment mostly aligned.



Nightly orchestration active.



Watcher dispatcher cron active and partially proven.



Stake/suppression rule closure substantially resolved for the current live scope.



Trusted automation not yet complete.



15\. Update rule



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

