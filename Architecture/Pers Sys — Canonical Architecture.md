
Pers Sys — Canonical Architecture


— Canonical Architecture


1. Purpose


This document defines the canonical architecture for the Pers System AFL Betting project as it stands after repo review, live-environment checks, automation wiring, signal-read audit review, and staking-risk calibration work.


It is intended to be the stable “how the system is actually meant to work” document, separate from:


delivery sequencing


implementation status snapshots


This is the target operating architecture, not a minute-by-minute status log.


2. System intent


The system is a Supabase-backed AFL betting orchestration platform with:


a React operator UI


Supabase Edge Functions for ingestion, evaluation, alerting, and settlement


database-backed system configuration and audit state


scheduled orchestration for nightly maintenance, open-market evaluation, and timed watcher refreshes


Its purpose is to move the AFL workflow from partly manual execution to a persistent, rules-driven operating system for:


data ingestion


feature generation


odds snapshotting


system evaluation


timed signal refresh


alert generation


bet logging and settlement support


3. Architectural principle


The core architectural rule is:


Automation is driven by orchestration entrypoints, not by raw low-level cron steps.


The system should not schedule independent cron jobs for:


Squiggle pull


feature build


open odds pull


evaluate


T60 pull


T30 pull


T10 pull


Instead, automation should enter through three orchestration functions:


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


pers-sys-dispatch-watchers


This reduces:


ordering risk


overlap risk


duplicate-trigger risk


inconsistent intermediate state


4. Canonical pipeline layers
4.1 Operator layer


The React operator UI provides:


visibility into pipeline state


manual execution surfaces


monitoring and operator intervention points


review surfaces for bets, signals, and downstream state


This layer is not the primary source of automation sequencing. It is an operator surface.


4.2 Orchestration layer


The orchestration layer is the automation control plane. It is responsible for:


enforcing sequence


grouping related internal tasks


reducing duplicate or conflicting runs


separating daily maintenance from time-window refresh logic


Primary orchestration entrypoints:


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


pers-sys-dispatch-watchers


4.3 Ingestion layer


The ingestion layer pulls external data into the system, including:


fixture/results data


odds snapshot data


Primary functions include:


pers-sys-pull-squiggle


pers-sys-pull-odds-snapshot


4.4 Feature/state layer


This layer computes derived game/team/system context needed for evaluation.


Primary function:


pers-sys-build-features


4.5 Evaluation layer


This layer applies the betting-system logic against snapshot and state inputs.


Primary function:


pers-sys-evaluate-systems-v2


This is the canonical evaluation path and should align to the v2 system registry.


4.6 Watcher layer


This layer supports timed re-evaluation around key windows:


T60


T30


T10


Primary functions:


pers-sys-dispatch-watchers


pers-sys-run-watcher


The dispatcher decides when a game has entered an active window.
The watcher executes the appropriate snapshot/evaluate path for that window.


4.7 Alerting layer


This layer is responsible for outbound operational notifications, especially around T30.


Primary function:


pers-sys-send-t30-alert


Supabase handles orchestration and compute, but outbound email delivery still requires an external provider path.


4.8 Acceptance / logging layer


This layer records accepted bets and supports already-bet suppression logic.


Primary logic includes:


preview stake behavior


accept/log paths


duplicate protection


matching between recommendations and confirmed bets


Primary RPC/path of concern includes:


accept_leg_create_bet


preview stake RPCs such as preview_leg_stake


4.9 Settlement layer


This layer settles completed bets and updates ledger/bankroll-related state.


Primary function:


pers-sys-settle


5. Canonical sequence


The intended automatic flow is:


Phase 1 — Nightly maintenance


Run first.


Expected responsibilities:


Squiggle pull


feature build


settlement and housekeeping as applicable


Primary entrypoint:


pers-sys-run-nightly-maintenance


Phase 2 — Open nightly


Run second, after nightly maintenance.


Expected responsibilities:


opening odds snapshot


evaluation on opening snapshot


Primary entrypoint:


pers-sys-run-open-nightly


Phase 3 — Watcher phase


Run after nightly preparation is complete.


Expected responsibilities:


recurring dispatcher checks for T60, T30, and T10 windows


window-specific snapshot/evaluation path


T30 alert path where appropriate


Primary entrypoint:


pers-sys-dispatch-watchers


This sequence is an operational requirement, not merely a preferred implementation style.


6. Time-window model


The architecture recognizes three key pre-game windows:


T60


T30


T10


The canonical model is:


dispatcher runs on a recurring cadence


dispatcher identifies games in active windows


watcher executes the relevant work for that window


repeated scheduler hits must not create duplicate operational outcomes


The architecture therefore requires:


duplicate-safe watcher handling


duplicate-safe alert handling


tolerance for imperfect alignment between cron timing and actual game timing


The exact cadence and tolerance window are operational settings, not architectural constants, but the architecture requires that they exist and be verified.


Live update from later thread work: the canonical dispatcher model has now been activated in production via a recurring cron job targeting pers-sys-dispatch-watchers. This confirms the intended architecture path (cron -> dispatcher -> run-watcher) is now live. The remaining open issue is not whether watcher cron exists, but whether cadence, tolerance, duplicate behavior, and downstream alert content are all fully aligned with business requirements.


Later live verification confirmed that the intended dispatcher model is now active in production through a recurring cron job targeting pers-sys-dispatch-watchers. This reinforces the architectural position that cron should enter through the dispatcher/orchestration layer rather than schedule separate low-level watcher steps. Remaining open items are operational-verification matters such as cadence, tolerance, duplicate handling, and downstream alert correctness.


7. Identity and suppression rules
7.1 Hard rule: suppression is per leg, not per game


Already-bet suppression and alert suppression must operate at leg/fingerprint level.


They must not rely on a coarse game-level rule such as:


“any unsettled bet exists on this game”


That is too coarse and can wrongly suppress:


overlays


amplifiers


alternate leg types


different sides or lines within the same game


7.2 Canonical placed-bet identity


At minimum, the placed-bet identity should be based on a stable leg signature such as:


game_id


system_code


leg_type


side


line_at_bet or normalized market line where applicable


7.3 Distinguish placed-bet identity from change-detection identity


These are not the same thing.


Placed-bet identity asks:


is this already the same accepted leg?


Change-detection identity asks:


has the recommendation changed enough to justify a new alert or refreshed action state?


Bookmaker may matter for display or change detection, but should not automatically define whether something is “the same bet” for suppression purposes.


Later live verification also confirmed a specific cross-snapshot alert behavior for SYS_2: when a T30 H2H overlay is actionable, pers-sys-send-t30-alert may intentionally include the linked OPEN base LINE leg in the same alert, provided that base leg is still READY and not already accepted/logged. This is now a confirmed alert-content rule for the active live SYS_2 path and does not change the broader architectural principle that alert suppression and duplicate handling remain leg-specific.


8. Stake architecture


The system distinguishes between:


recommendation-stage values


such as recommended_units


possibly recommended_bankroll_pct


accepted-bet values


such as final stake_amount


A critical architectural rule is:


Pre-bet dollar stake must come from one canonical contract.


That should be one of:


a canonical preview stake calculator used by both UI and T30 email


persistence of recommended dollar stake earlier in the signal lifecycle


Until one of those is locked, pre-bet dollar display is not fully authoritative.


This is one of the most important business-logic architecture items.


Later live review established that the active inspected paths use the shared preview stake calculator pattern: WeekView, T30 alerting, and accept/log behavior all rely on the recommended bankroll percentage contract where available. This closes the broad stake-source concern for the active inspected paths.


A later bankroll-risk audit identified a separate issue: source alignment did not mean stake sizing was safe. Live signal review showed SYS_6 repeatedly reaching 2.5% bankroll recommendations and SYS_7 producing a 6.0% recommendation. The evaluator staking logic was therefore adjusted as a risk hotfix so that SYS_6 uses a compressed live-validation ladder capped at 1.5%, and SYS_7 uses a compressed unit ladder capped at 2.5%. This was a staking-risk calibration change, not a model-eligibility change.


Post-hotfix verification remains required because no new post-hotfix audit or signal rows had been generated at the time of closeout.


9. Registry and evaluation authority


The canonical evaluation path is v2-based.


The architecture should align around:


pers_sys_systems_v2


v2 evaluator flow


v2-aligned priority/config relationships


Legacy structures may still exist historically, but the critical operational path should be v2-aligned.


10. Live-service dependencies


The architecture depends on several external or operational dependencies beyond raw repo code:


Supabase database


Supabase Edge Functions


pg_cron


pg_net


external odds/data providers


external outbound email provider path


project secrets for alerting/provider access


Supabase is the orchestration and execution platform, but not the email sender by itself.


11. Cron architecture


The cron model should remain narrow:


Supported cron entrypoints


pers-sys-run-nightly-maintenance


pers-sys-run-open-nightly


pers-sys-dispatch-watchers


Disallowed cron style


Do not fan out separate cron jobs for each low-level internal function unless architecture is intentionally changed.


The cron layer should trigger orchestrators.
Internal sequencing should remain inside those orchestrators.


12. Verification model


The canonical architecture must be understood through three separate truth layers:


Repo-confirmed


What repository code, migrations, docs, and configuration explicitly support.


Live-confirmed


What has actually been verified in the deployed Supabase environment.


Still assumed / pending verification


What is intended or inferred but not yet proven in the live environment.


This separation is mandatory because:


repo remediation does not itself prove live deployment parity


live objects may exist without clean migration provenance


deployed functions may lag repo state


scheduler wiring and secrets may still be incomplete


Signal-read verification must use latest-state completed-game audit rows, not raw historical audit counts. Raw audit rows can include legitimate early evaluations before later T30/T10 snapshots exist, which can make historical missing_model_data rows appear misleading after snapshots arrive. Latest-state audit by system and game is the correct diagnostic surface for determining whether low signal volume reflects data failure or model selectivity.


The current latest-state completed-round review showed the evaluator and signal pipeline are alive. SYS_2 and SYS_6 are the main current signal producers, SYS_7 is live but sparse, and SYS_3, SYS_5, SYS_8, and SYS_9 were mostly no-pass under current criteria. This supports the conclusion that low signal volume to date is mainly model selectivity rather than broad read failure, while still requiring future post-hotfix signal verification.


13. Current known unresolved architecture items


These are not delivery tasks; they are architecture items that remain open or require hard confirmation:


watcher dispatcher cron is now activated in live production, but watcher cadence and tolerance-window rules are still not finally locked


duplicate handling expectations across repeated watcher hits need explicit verification


pre-bet dollar stake source is effectively aligned for active inspected paths, but post-hotfix staking output requires verification after fresh evaluator runs


final accept/log duplicate-protection behavior must be confirmed to be per-leg, not coarse per-game across broader future market scope


outbound email provider decision/path must remain explicit


live migration provenance may remain unclear even when objects exist


14. Canonical design position


The system should be understood as:


A Supabase-based AFL betting orchestration system that schedules high-level orchestration entrypoints, maintains ordered nightly preparation, performs timed pre-game refreshes at T60/T30/T10, enforces leg-level suppression and duplicate rules, uses latest-state audit rows for signal-read diagnosis, maintains staking-risk controls separately from model eligibility, and separates repository truth, live-environment truth, and unverified assumptions.


15. Final principle


The canonical architecture is not:


one cron per low-level action


one coarse game-level suppression rule


one mixed bucket of repo findings and live assumptions


raw historical audit counts treated as final read-quality truth


It is:


orchestration-led


sequence-sensitive


leg-specific


duplicate-aware


environment-aware


latest-state-audit aware


explicit about unresolved contracts