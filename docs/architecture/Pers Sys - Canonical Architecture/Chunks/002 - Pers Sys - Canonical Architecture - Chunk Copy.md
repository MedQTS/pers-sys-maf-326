CHUNK_ID: 002
DOC_ID: pers-sys-canonical-architecture
DOC_TITLE: Pers Sys - Canonical Architecture
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

## 6. Time-window model

The architecture recognizes three key pre-game windows:

- T60
- T30
- T10

The canonical model is:

- dispatcher runs on a recurring cadence
- dispatcher identifies games in active windows
- watcher executes the relevant work for that window
- repeated scheduler hits must not create duplicate operational outcomes

The architecture therefore requires:

- duplicate-safe watcher handling
- duplicate-safe alert handling
- tolerance for imperfect alignment between cron timing and actual game timing

The exact cadence and tolerance window are operational settings, not architectural constants, but the architecture requires that they exist and be verified.

Live update from later thread work: the canonical dispatcher model has now been activated in production via a recurring cron job targeting `pers-sys-dispatch-watchers`. This confirms the intended architecture path:

    cron -> dispatcher -> run-watcher

The remaining open issue is not whether watcher cron exists, but whether cadence, tolerance, duplicate behavior, and downstream alert content are all fully aligned with business requirements.

Later live verification confirmed that the intended dispatcher model is now active in production through a recurring cron job targeting `pers-sys-dispatch-watchers`. This reinforces the architectural position that cron should enter through the dispatcher/orchestration layer rather than schedule separate low-level watcher steps. Remaining open items are operational-verification matters such as cadence, tolerance, duplicate handling, and downstream alert correctness.

## 7. Identity and suppression rules

### 7.1 Hard rule: suppression is per leg, not per game

Already-bet suppression and alert suppression must operate at leg/fingerprint level.

They must not rely on a coarse game-level rule such as:

    any unsettled bet exists on this game

That is too coarse and can wrongly suppress:

- overlays
- amplifiers
- alternate leg types
- different sides or lines within the same game

### 7.2 Canonical placed-bet identity

At minimum, the placed-bet identity should be based on a stable leg signature such as:

- game_id
- system_code
- leg_type
- side
- line_at_bet or normalized market line where applicable

### 7.3 Distinguish placed-bet identity from change-detection identity

These are not the same thing.

Placed-bet identity asks:

    is this already the same accepted leg?

Change-detection identity asks:

    has the recommendation changed enough to justify a new alert or refreshed action state?

Bookmaker may matter for display or change detection, but should not automatically define whether something is the same bet for suppression purposes.

Later live verification also confirmed a specific cross-snapshot alert behavior for SYS_2: when a T30 H2H overlay is actionable, `pers-sys-send-t30-alert` may intentionally include the linked OPEN base LINE leg in the same alert, provided that base leg is still READY and not already accepted/logged. This is now a confirmed alert-content rule for the active live SYS_2 path and does not change the broader architectural principle that alert suppression and duplicate handling remain leg-specific.

## 8. Stake architecture

The system distinguishes between:

- recommendation-stage values such as recommended_units and possibly recommended_bankroll_pct
- accepted-bet values such as final stake_amount

A critical architectural rule is:

    Pre-bet dollar stake must come from one canonical contract.

That should be one of:

- a canonical preview stake calculator used by both UI and T30 email
- persistence of recommended dollar stake earlier in the signal lifecycle

Until one of those is locked, pre-bet dollar display is not fully authoritative.

This is one of the most important business-logic architecture items.

Later live review established that the active inspected paths use the shared preview stake calculator pattern: WeekView, T30 alerting, and accept/log behavior all rely on the recommended bankroll percentage contract where available. This closes the broad stake-source concern for the active inspected paths.

A later bankroll-risk audit identified a separate issue: source alignment did not mean stake sizing was safe. Live signal review showed SYS_6 repeatedly reaching 2.5% bankroll recommendations and SYS_7 producing a 6.0% recommendation. The evaluator staking logic was therefore adjusted as a risk hotfix so that SYS_6 uses a compressed live-validation ladder capped at 1.5%, and SYS_7 uses a compressed unit ladder capped at 2.5%. This was a staking-risk calibration change, not a model-eligibility change.

Post-hotfix verification remains required because no new post-hotfix audit or signal rows had been generated at the time of closeout.

## 9. Registry and evaluation authority

The canonical evaluation path is v2-based.

The architecture should align around:

- pers_sys_systems_v2
- v2 evaluator flow
- v2-aligned priority/config relationships

Legacy structures may still exist historically, but the critical operational path should be v2-aligned.

## 10. Live-service dependencies

The architecture depends on several external or operational dependencies beyond raw repo code:

- Supabase database
- Supabase Edge Functions
- pg_cron
- pg_net
- external odds/data providers
- external outbound email provider path
- project secrets for alerting/provider access

Supabase is the orchestration and execution platform, but not the email sender by itself.

## 11. Cron architecture

The cron model should remain narrow.

Supported cron entrypoints:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly
- pers-sys-dispatch-watchers

Disallowed cron style:

- Do not fan out separate cron jobs for each low-level internal function unless architecture is intentionally changed.

The cron layer should trigger orchestrators.

Internal sequencing should remain inside those orchestrators.
