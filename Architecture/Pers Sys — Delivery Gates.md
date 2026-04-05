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

Based on the thread:

pg_cron was enabled

pg_net was enabled

cron setup began

nightly maintenance cron was created

open-nightly cron was identified as the next job to create

Gate status

In progress

This gate is not fully passed until both nightly jobs are present and their execution logs are verified.

8. Gate 5 — Stake and suppression rule closure
Objective

Prove that the system’s business-rule behavior is trustworthy before timed watcher automation is relied upon.

This gate exists because

Even if orchestration runs correctly, the system is still not operationally trustworthy if:

pre-bet dollar values are inconsistent

already-bet suppression is too coarse

duplicate blocking suppresses legitimate overlays or amplifiers

alert behavior and acceptance logic are not aligned

Required outcomes
5.1 Pre-bet dollar stake contract must be locked

One canonical contract must be chosen for pre-bet dollar display:

a shared preview stake calculator used by UI and T30 email

or persistence of recommended dollar stake earlier in the signal lifecycle

Without this, recommendation-stage dollar display is not fully authoritative.

5.2 Suppression must be leg-level

Already-bet filtering and alert suppression must be verified to operate at leg/fingerprint level, not merely at game level.

5.3 Acceptance logic must match business intent

accept_leg_create_bet and related duplicate-protection logic must prevent only true duplicate legs, not all additional unsettled bets on the same game.

5.4 Fingerprint rules must be locked

At minimum, the placed-bet identity should be based on a stable leg signature such as:

game_id

system_code

leg_type

side

line_at_bet or normalized market line

Placed-bet identity and change-detection identity must be treated separately.

What this gate proves

It proves the system will not make incorrect operational decisions simply because automation is running.

Gate status

Not passed

This is one of the main remaining unresolved gates.

9. Gate 6 — Watcher automation activation
Objective

Prove that time-window automation can run safely without duplicate or timing-related side effects.

Required outcomes

Watcher automation must be activated only after nightly orchestration is proven stable.

The active orchestration entrypoint is:

pers-sys-dispatch-watchers

Required design conditions

The watcher model must explicitly define:

dispatcher cadence

tolerance window width

duplicate prevention expectations

expected behavior if dispatcher runs multiple times during the same watch window

Required verification conditions

Watcher automation must be verified for:

no duplicate alerting

no duplicate signal creation from repeated window hits

safe handling when cron timing and game timing do not line up perfectly

correct separation of T60, T30, and T10 behaviors

What this gate proves

It proves the most timing-sensitive layer can be trusted under real schedule conditions.

Gate status

Not started / intentionally deferred

This gate should remain blocked until Gate 4 and Gate 5 are strong enough.

10. Gate 7 — End-to-end trusted automation readiness
Objective

Prove that the full live system can be trusted to run automatically with acceptable correctness and operational risk.

Required outcomes

All prior gates must be effectively satisfied.

Additionally, the following must be true:

nightly jobs fire in the correct order

watcher jobs behave correctly under live cadence

required secrets are present for odds/data/email paths

no duplicate operational outcomes are observed

T30 alerts are operationally correct

already-bet suppression behaves at leg level

preview stake values shown before acceptance are trustworthy

repo-confirmed, live-confirmed, and still-assumed items are explicitly separated

What this gate proves

It proves the project has moved from “structurally close” to “operationally trustworthy.”

Gate status

Not passed

This is the final readiness gate.

11. Current delivery interpretation

The project should currently be interpreted as:

Architecture: established

Repo state: largely remediated and aligned

Live parity: mostly sufficient

Nightly orchestration: underway but not yet fully proven

Stake/suppression rule closure: still open

Watcher automation: deferred

Trusted full automation: not yet achieved

12. Delivery blockers still active

The most important active blockers are:

open-nightly cron not yet fully verified in operation

scheduler execution logs not yet confirmed clean for both nightly jobs

pre-bet dollar stake contract not yet locked

leg-level suppression and acceptance behavior not yet fully verified

watcher cadence/idempotency rules not yet locked

watcher cron not yet activated and proven

secrets verification not yet fully closed unless later confirmed outside this document

13. Narrow next-step chain

The delivery sequence from here should be:

create or verify nightly maintenance cron

create or verify open-nightly cron

verify both nightly jobs execute cleanly

verify secrets required for odds and email delivery

lock the pre-bet stake preview contract

verify suppression is per leg, not per game

verify accept/log duplicate handling only blocks true duplicate legs

decide watcher dispatcher cadence and tolerance model

create watcher dispatcher cron

verify watcher logs and side effects

verify T30 alerts and repeated-window behavior

declare trusted automation readiness only after the above pass

14. Final principle

Delivery gates for this project are not just technical milestones.

They are proof points that the system:

runs in the right order

uses the right rule surface

avoids the wrong suppression behavior

avoids duplicate timing side effects

and can be trusted in the live environment

The final standard is not:
“functions exist and cron is enabled.”

The final standard is:
“the intended orchestration, business rules, and live side effects are all operating correctly enough to trust automation.”