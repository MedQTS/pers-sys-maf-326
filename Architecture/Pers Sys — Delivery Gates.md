
Pers Sys — Delivery Gates


1. Purpose


This document defines the delivery gates for the Pers System AFL Betting project.


It is not the canonical architecture document and it is not the point-in-time status snapshot.


Its role is to define:


what must be true before the project is considered ready to move forward


what each gate is trying to prove


what remains blocked until that gate is passed


This document is delivery-oriented and decision-oriented.


2. Delivery framing


The project has already moved beyond basic concept stage.


It now sits in late-stage implementation and operationalization, where the main question is no longer:


“Can this system be built?”


The main question is now:


“Can this system be trusted to run in the intended sequence, with the intended business rules, in the live environment?”


For that reason, the delivery gates are designed around:


orchestration correctness


environment parity


side-effect safety


business-rule correctness


operational readiness


3. Gate structure overview


The delivery path should be understood as:


Gate 1 — Core architecture established


Gate 2 — Repo remediation and alignment


Gate 3 — Live environment parity


Gate 4 — Nightly orchestration activation


Gate 5 — Stake and suppression rule closure


Gate 6 — Watcher automation activation


Gate 7 — End-to-end trusted automation readiness


These gates are intentionally sequential.


Passing a later gate without a prior one being genuinely satisfied creates false confidence.


4. Gate 1 — Core architecture established


Objective


Prove that the project has a coherent system shape rather than disconnected scripts or ad hoc manual actions.


Required outcomes


The following must exist in a recognizable and connected form:


React operator UI


Supabase Edge Functions for pipeline stages


database-backed system/evaluation structure


v2-oriented evaluation path


clear orchestration entrypoints


settlement and alerting surfaces


What this gate proves


It proves the project is a real operating system design, not just a loose betting model.


Practical evidence


Examples of evidence include:


operator runner/dashboard surfaces


ingestion functions


evaluation function


watcher functions


alert function


settlement function


migration/config structure


Gate status


Passed


This gate is already satisfied based on repo review and function inventory.


5. Gate 2 — Repo remediation and alignment


Objective


Prove that the repository itself is internally coherent enough to support trusted implementation review.


Required outcomes


The repository must no longer contain unresolved blocker-level contradictions around:


audit-table support


collision_rank


v2 system registry alignment


SYS_8 support


canonical staking path support


repo-local governance file validity


stale docs claiming already-remediated blockers are still current


What this gate proves


It proves the repo is no longer the primary source of uncertainty.


Practical evidence


Examples:


remediation migrations present


governance file corrected


audit docs refreshed


repo review no longer concluding “not ready due to repo defects”


Gate status


Passed


Repo-side blocker review and documentation refresh indicate this gate is satisfied.


6. Gate 3 — Live environment parity


Objective


Prove that the live Supabase environment broadly matches the repository on automation-critical surfaces.


Required outcomes


The live environment should confirm, at minimum:


key schema objects present


key columns present


pers_sys_systems_v2 live and usable


SYS_8 present and active


staking RPCs present with expected newer overloads


critical Edge Functions deployed


Important limitation


This gate does not require perfect migration provenance, but any provenance ambiguity must be explicitly recorded.


What this gate proves


It proves the live system is not obviously lagging behind the repo in the key areas that matter for automation.


Practical evidence already seen


Live checks already showed:


key column remediations present


SYS_8 present and active


newer staking RPC overloads present


core Edge Functions deployed


Remaining caveat


Migration-history provenance remained unclear because expected migration versions were not returned from migration history.


Gate status


Mostly passed / operationally sufficient


This gate is close enough to proceed, but provenance ambiguity should remain recorded as an operational caveat.


7. Gate 4 — Nightly orchestration activation


Objective


Prove that the system can run its nightly sequence in the intended order using orchestration entrypoints.


Required outcomes


The nightly automation model must be activated through:


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


These must be scheduled as orchestration jobs, not replaced by low-level cron fan-out.


Required sequence


nightly maintenance first


Squiggle pull


feature build


settlement/housekeeping as applicable


open nightly second


opening odds snapshot


evaluation on the opening snapshot


Required operational conditions


pg_cron enabled


pg_net enabled if required by the scheduling path


jobs created successfully


jobs scheduled in intended order


sufficient spacing between jobs


logs show successful execution


no overlap or duplicate side effects


What this gate proves


It proves that basic automation works in the correct order before the timing-sensitive watcher layer is introduced.


Current position


Based on later live thread work:


pg_cron is enabled


the nightly maintenance job is active


the open-nightly job is active


cron logs showed both jobs firing successfully across multiple days


Gate status


Passed


This gate is now satisfied at the orchestration-activation level. Sequence correctness should still remain part of ongoing operational monitoring, but the gate itself is no longer blocked by missing nightly jobs.


8. Gate 5 — Stake and suppression rule closure


Objective


Prove that the system’s business-rule behavior is trustworthy before timed watcher automation is relied upon.


This gate exists because


Even if orchestration runs correctly, the system is still not operationally trustworthy if:


pre-bet dollar values are inconsistent


already-bet suppression is too coarse


duplicate blocking suppresses legitimate overlays or amplifiers


alert behavior and acceptance logic are not aligned


recommended bankroll sizing is materially too aggressive for live-validation use


Required outcomes


8.1 Pre-bet dollar stake contract must be locked


One canonical contract must be chosen for pre-bet dollar display:


a shared preview stake calculator used by UI and T30 email


or persistence of recommended dollar stake earlier in the signal lifecycle


Current judgment


Confirmed closed for the active inspected paths.


Later thread evidence established that:


WeekView uses preview_leg_stake for READY signals and passes recommended bankroll percent where available


pers-sys-send-t30-alert also calls preview_leg_stake and passes recommended bankroll percent where available


accept_leg_create_bet uses the same preferred recommended_bankroll_pct contract in the newer overload


This means the pre-bet dollar contract is now effectively the shared preview stake calculator path for current live use.


8.2 Suppression must be leg-level


Already-bet filtering and alert suppression must be verified to operate at leg/fingerprint level, not merely at game level.


Current judgment


Confirmed closed for the active inspected paths.


Later thread evidence established that the current T30 alert matching is leg-level, not coarse game-level, for the inspected live paths.


8.3 Acceptance logic must match business intent


The system must correctly distinguish between:


actionable bets


already accepted / already placed bets


previously sent / non-actionable rows


Current judgment


Substantially resolved for the active inspected paths.


Later thread work confirmed correct separation of these categories in the T30 alert path.


Later live verification also closed a previously observed SYS_2 alert-content mismatch. The active T30 alert path was updated so that when a SYS_2 T30 H2H overlay is actionable, the linked OPEN base LINE leg can also be included in the alert if it remains READY and is not already accepted/logged. Verification confirmed that the linked LINE leg now appears as actionable when appropriate, while previously sent overlay rows still remain deduplicated and logged/unsettled suppression behavior remains intact. This strengthens Gate 5 closure for the active SYS_2 live path without removing the broader watcher-verification caveats in later gates.


8.4 Fingerprint rules must be locked


Placed-bet identity and change-detection identity must be explicitly separated.


Current judgment


Resolved for the inspected T30 path.


Later thread work confirmed that placed-bet identity is represented by a stable leg fingerprint, while change-detection identity uses mutable fields such as book, price, and stake.


8.5 Bankroll sizing must be safe enough for live validation


Recommended stake sizing must be treated as a business-rule risk separate from whether the signal itself qualifies.


Current judgment


Hotfixed for SYS_6 and SYS_7; post-hotfix verification pending.


Later thread evidence established that the evaluator and signal pipeline were reading accurately enough when latest-state completed-game audit rows were used. The low signal volume was mainly model selectivity rather than broad read failure. However, bankroll exposure review showed the live staking model was too aggressive for validation use:


SYS_6 produced five live signals all at 2.5% bankroll, creating 12.5% cumulative exposure across those historical rows.


SYS_7 produced one live signal at 6.0% bankroll.


SYS_2 remained modest and did not require urgent change.


The resulting hotfix compressed staking only, without changing model eligibility:


SYS_6 live-validation ladder reduced to 0.75 / 1.0 / 1.25 with smaller amplifiers and a 1.5% cap.


SYS_7 unit ladder reduced to 1.0 / 1.5 / 2.0 with smaller amplifiers and a 2.5-unit cap.


At closeout, no post-hotfix audit or signal rows had yet been generated, so verification remains pending. Expected post-hotfix checks are:


SYS_6 maximum recommended bankroll percent should be at or below 1.5%.


SYS_7 maximum recommended bankroll percent should be at or below 2.5%.


Gate status


Passed for stake-source and suppression behavior in the current live scope; staking-aggression hotfix applied, with post-hotfix output verification pending.


9. Gate 6 — Watcher automation activation


Objective


Prove that the system can run timed watcher refreshes (T60, T30, T10) automatically via dispatcher logic.


Required outcomes


pers-sys-dispatch-watchers must be scheduled as a recurring cron job


pers-sys-run-watcher must execute correctly for triggered games


T30 alert path must be operationally observed


Current position


Later thread work confirmed:


dispatcher cron has been created


T30 alert has been observed in production


cron -> dispatcher -> run-watcher -> send-t30-alert path is live


Gate status


Activated / partially verified


The gate is no longer blocked by missing automation, but repeated-hit behavior and cadence still require verification.


10. Gate 7 — End-to-end trusted automation readiness


Objective


Prove that the full system can be trusted to run without manual intervention across complete cycles.


Required outcomes


nightly sequencing verified over time


watcher cadence and tolerance window locked


no duplicate side effects across repeated watcher hits


alert behavior stable and correct across multiple cycles


secrets and provider dependencies confirmed


post-hotfix staking output verified on fresh evaluator runs


Current status


Not yet passed


The system is close, but still requires:


watcher behavior verification across repeated runs


cadence/tolerance lock


final operational confidence in automation


post-hotfix SYS_6/SYS_7 staking verification after fresh audit/signal rows are generated


11. Decision summary


The project has progressed through:


core architecture


repo remediation


live environment alignment


nightly orchestration activation


stake/suppression rule closure for the current live scope


watcher automation activation (partial)


latest-state completed-round signal-read audit confirming the evaluator is alive and low output is mostly model selectivity


SYS_6/SYS_7 staking-risk hotfix application


The remaining gap is not structural — it is operational trust over time plus post-hotfix staking verification.


12. Next-step chain


The correct next steps are:


verify watcher cadence and tolerance rules


verify behavior under repeated scheduler hits


confirm no duplicate alerts or duplicate signal creation


confirm secrets and provider readiness


review TOTALS parity before live activation


trigger or wait for fresh evaluator runs and verify post-hotfix SYS_6/SYS_7 recommended bankroll caps


Only after these are satisfied should the system be considered fully trusted for automated execution.