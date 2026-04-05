Pers Sys — Project Snapshot
1. Purpose

This document is the point-in-time snapshot for the Pers System AFL Betting project.

It is not the canonical architecture document and it is not the delivery-gates document.

Its role is to record:

current implementation position

current live-environment position

what is confirmed

what is still pending

the immediate next-step chain

This document should be updated as the project moves.

2. Snapshot interpretation

The project is no longer at concept stage and no longer mainly blocked by repository uncertainty.

At this point, the project should be understood as:

architecturally coherent

repo-side largely remediated

live environment mostly aligned on key schema/RPC/function surfaces

cron activation underway

business-rule closure still incomplete

watcher automation not yet activated

full trusted automation not yet achieved

3. Current project position
Overall status

Late-stage implementation / operationalization

Practical reading

The main question is no longer:
Can this system be built?

The main question is:
Can this system now be trusted to run automatically in the intended order, with the intended business rules, in the live environment?

4. Repo-confirmed position

The following are repo-confirmed based on the reviewed work:

React operator UI exists

core Supabase Edge Function pipeline exists

v2 evaluation path exists

watcher functions exist

T30 alert function exists

settlement function exists

repo-local governance file was corrected

blocker-related repo migrations were present

stale repo audit docs were refreshed

repo review no longer treated the codebase itself as the main blocker

Repo blocker position

The earlier blocker set was reviewed and repo-side evidence indicated remediation/alignment for:

audit-table support

collision_rank

v2 registry alignment

SYS_8 support

staking-path remediation

governance-file sanity

stale audit doc correction

Repo caveat

Repository remediation does not by itself prove live deployment parity.

5. Live-confirmed position

The following were checked directly against the live Supabase environment and are treated as live-confirmed:

5.1 Key live schema columns present

Confirmed live:

recommended_bankroll_pct on pers_sys_signal_audit_v2

recommended_units on pers_sys_signal_audit_v2

collision_rank on pers_sys_system_priority

5.2 SYS_8 present and active

Confirmed live:

SYS_8 exists in pers_sys_systems_v2

active = true

config fields populated

primary market is totals-oriented as expected

5.3 Staking RPC surfaces present

Confirmed live:

accept_leg_create_bet has both older and newer overloads

preview_leg_stake has both older and newer overloads

newer overloads include p_recommended_bankroll_pct

This indicates the live environment is in a transition-compatible state rather than obviously broken.

5.4 Core Edge Functions deployed

Confirmed live deployment of the key pipeline functions, including:

pers-sys-build-features

pers-sys-dispatch-watchers

pers-sys-evaluate-systems-v2

pers-sys-pull-odds-snapshot

pers-sys-pull-squiggle

pers-sys-run-nightly-maintenance

pers-sys-run-open-nightly

pers-sys-run-watcher

pers-sys-send-t30-alert

pers-sys-settle

6. Live caveats still recorded

The following remain true and should still be recorded as caveats:

6.1 Migration provenance unclear

Expected remediation migration versions were not returned from migration history, even though the live objects themselves appear present.

This means:

live environment looks functionally aligned

but provenance is unclear

6.2 Scheduler wiring was not originally present

At the time of checking:

pg_cron was not yet enabled initially

cron jobs were not yet wired initially

This means the environment could be structurally aligned without actually being automatically operational.

6.3 Full runtime behavior not yet proven

Even where schema, RPCs, and functions are present, that does not yet prove:

correct sequence under scheduler control

no duplicate side effects

clean watcher behavior

correct alert behavior

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

Confirmed created:

pers-sys-run-nightly-maintenance

scheduled at 29 13 * * * UTC

equivalent to 11:29 pm Queensland time

Expected next cron

Planned next:

pers-sys-run-open-nightly

scheduled at 59 13 * * * UTC

equivalent to 11:59 pm Queensland time

Watcher cron status

not yet activated

intentionally deferred

Why watcher cron is deferred

Watcher automation is the most timing-sensitive layer and should only be added after the nightly jobs are confirmed to behave cleanly.

8. Current business-rule status
8.1 Pre-bet dollar stake source

Still unresolved

The system distinguishes between:

recommendation-stage values such as recommended_units and recommended_bankroll_pct

final accepted-bet stake_amount

The authoritative source for pre-bet dollar display in:

Bets Ready

T30 email

is not yet fully locked as one canonical contract.

This remains one of the most important unresolved operational items.

8.2 Suppression rule level

Conceptually clarified, not yet fully closed operationally

The intended rule is:

suppression must operate at leg/fingerprint level

not merely at game level

This needs final operational verification in acceptance/filtering behavior.

8.3 Acceptance/logging compatibility

Still needs explicit verification

The intended business rule is:

logging a base leg should not automatically suppress valid overlay/amplifier opportunities unless they are themselves true duplicates

This still needs direct verification against accept/log duplicate-protection behavior.

8.4 Fingerprint separation

Conceptually clarified

The project now clearly needs two distinct concepts:

placed-bet identity

change-detection identity

This distinction is understood, but final canonical locking still belongs in implementation and rule verification.

9. Watcher status
Watch windows recognized

T60

T30

T10

Current watcher position

Watcher architecture exists in repo and live function deployment, but watcher automation is not yet operationally trusted.

Still pending for watcher activation

The following are still under-specified or unverified:

dispatcher cadence

tolerance window width

expected behavior on repeated hits inside the same window

duplicate prevention expectations

duplicate alert prevention under repeated scheduling

Current stance

Watcher scheduling should remain off until nightly orchestration and business-rule closure are stronger.

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

The exact provider dependency is understood as operationally required.

Still pending

Secrets and operational readiness for:

alert/email path

odds/data-provider path

should still be explicitly confirmed unless already verified outside this snapshot.

11. What is confirmed vs pending
Confirmed

architecture shape is coherent

repo blocker set largely remediated

repo-local governance file corrected

stale audit docs refreshed

live key schema columns present

live SYS_8 present and active

live staking RPC overloads present

live core Edge Functions deployed

pg_cron enabled

pg_net enabled

nightly maintenance cron created

orchestration-first cron model clarified

Pending

open-nightly cron creation/verification

nightly execution log verification

secrets verification

pre-bet dollar stake contract lock

leg-level suppression verification

accept/log duplicate-rule verification

watcher cadence/tolerance lock

watcher cron creation

watcher duplicate-side-effect verification

full T30 operational proof

12. Immediate next-step chain

The narrow next-step sequence should be:

create or verify pers-sys-run-open-nightly cron

verify both nightly jobs execute cleanly in the intended order

verify required odds/email secrets are present

lock the canonical pre-bet stake preview contract

verify suppression is per leg, not per game

verify accept/log duplicate handling only blocks true duplicate legs

decide watcher dispatcher cadence and tolerance model

create watcher dispatcher cron

verify watcher logs and side effects

verify no duplicate alerts or duplicate signal creation from repeated window hits

verify T30 content and operational behavior

only then treat the system as trusted for automation

13. Current decision position

The best current decision statement is:

The project is structurally close and mostly aligned between repo and live environment, but it is not yet fully trusted for automated operation because nightly orchestration still needs proof, the stake/suppression business rules are not fully closed, and watcher automation has not yet been activated and verified.

14. Snapshot conclusion

This project should currently be described as:

Architecture established.
Repo remediated.
Live environment mostly aligned.
Cron activation underway.
Business-rule closure still open.
Watcher automation deferred.
Trusted automation not yet complete.

15. Update rule

This snapshot should be updated whenever any of the following changes:

cron jobs created or modified

secrets verified

nightly logs verified

watcher cadence locked

watcher cron activated

duplicate-behavior verified

stake contract locked

suppression/acceptance logic confirmed

live environment parity materially changes