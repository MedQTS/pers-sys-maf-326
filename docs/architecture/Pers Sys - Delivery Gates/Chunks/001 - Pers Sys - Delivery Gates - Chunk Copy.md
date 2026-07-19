CHUNK_ID: 001
DOC_ID: pers-sys-delivery-gates
DOC_TITLE: Pers Sys - Delivery Gates
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - Delivery Gates

## 1. Purpose

This document defines the delivery gates for the Pers System AFL Betting project.

It is not the canonical architecture document and it is not the point-in-time project snapshot.

Its role is to define:

- what must be true before the project is considered ready to move forward
- what each gate is trying to prove
- what remains blocked until that gate is passed

This document is delivery-oriented and decision-oriented.

## 2. Delivery framing

The project has moved beyond basic concept stage.

The main delivery question is no longer:

    Can this system be built?

The main delivery question is now:

    Can this system be trusted to run in the intended sequence, with the intended business rules, in the live environment?

For that reason, the gates are designed around:

- orchestration correctness
- environment parity
- side-effect safety
- business-rule correctness
- operational readiness
- no-bet traceability

## 3. Gate structure overview

The delivery path should be understood as:

1. Gate 1 - Core architecture established
2. Gate 2 - Repo remediation and alignment
3. Gate 3 - Live environment parity
4. Gate 4 - Nightly orchestration activation
5. Gate 5 - Stake and suppression rule closure
6. Gate 6 - Watcher automation activation
7. Gate 7 - End-to-end trusted automation readiness

These gates are intentionally sequential.

Passing a later gate without a prior one being genuinely satisfied creates false confidence.

## 4. Gate 1 - Core architecture established

### Objective

Prove that the project has a coherent system shape rather than disconnected scripts or ad hoc manual actions.

### Required outcomes

The following must exist in a recognizable and connected form:

- React operator UI
- Supabase Edge Functions for pipeline stages
- database-backed system/evaluation structure
- v2-oriented evaluation path
- clear orchestration entrypoints
- settlement and alerting surfaces

### What this gate proves

It proves the project is a real operating system design, not just a loose betting model.

### Gate status

PASSED.

The system architecture is established and documented in:

- Pers Sys - Canonical Architecture.md

## 5. Gate 2 - Repo remediation and alignment

### Objective

Prove that the repository is internally coherent enough to support trusted implementation review.

### Required outcomes

The repository must no longer contain unresolved blocker-level contradictions around:

- audit-table support
- collision_rank
- v2 system registry alignment
- SYS_8 support
- canonical staking path support
- repo-local governance validity
- stale docs claiming already-remediated blockers are still current

### What this gate proves

It proves the repo is no longer the primary source of uncertainty.

### Gate status

PASSED / materially resolved.

Repo-side blocker review and documentation refresh indicate this gate is satisfied for the current live scope.

## 6. Gate 3 - Live environment parity

### Objective

Prove that the live Supabase environment broadly matches the repository on automation-critical surfaces.

### Required outcomes

The live environment should confirm, at minimum:

- key schema objects present
- key columns present
- pers_sys_systems_v2 live and usable
- SYS_8 present and active
- staking RPCs present with expected newer overloads
- critical Edge Functions deployed
- audit and signal tables present

### Important limitation

This gate does not require perfect migration provenance.

Any provenance ambiguity must be explicitly recorded.

### Gate status

MOSTLY PASSED / operationally sufficient.

Live checks showed the key objects and functions required for current operation. Migration-history provenance remains a recorded caveat.

## 7. Gate 4 - Nightly orchestration activation

### Objective

Prove that the system can run its nightly sequence in the intended order using orchestration entrypoints.

### Required outcomes

The nightly automation model must be activated through:

- pers-sys-run-nightly-maintenance
- pers-sys-run-open-nightly

These must be scheduled as orchestration jobs, not replaced by low-level cron fan-out.

### Required sequence

1. Nightly maintenance first.
2. Squiggle pull.
3. Feature build.
4. Settlement / housekeeping as applicable.
5. Open nightly second.
6. Opening odds snapshot.
7. Evaluation on the opening snapshot.

### Gate status

PASSED.

The nightly maintenance and open-nightly jobs are active and have been observed firing in production logs.

## 8. Gate 5 - Stake and suppression rule closure

### Objective

Prove that the system's business-rule behavior is trustworthy before timed watcher automation is relied upon.

### Required outcomes

This gate requires closure of:

- pre-bet dollar stake contract
- leg-level suppression
- acceptance/logging category separation
- stable placed-bet identity
- change-detection identity
- staking-risk calibration for live validation

### Current findings

The active inspected paths show:

- WeekView uses preview_leg_stake for READY signals and passes recommended bankroll percent where available.
- T30 alerting also calls preview_leg_stake and passes recommended bankroll percent where available.
- accept_leg_create_bet uses the preferred recommended_bankroll_pct contract in the newer overload.
- T30 alert matching is leg-level, not coarse game-level, for the inspected live paths.
- Placed-bet identity and change-detection identity are operationally separated.
- SYS_2 linked-base-leg alert behavior has been materially fixed for the active live path.

### Staking-risk caveat

SYS_6 and SYS_7 staking was found too aggressive for validation use.

A staking-only hotfix reduced:

- SYS_6 live-validation exposure to a 1.5% cap.
- SYS_7 live-validation exposure to a 2.5-unit cap.

Fresh post-hotfix audit or signal rows are still required to verify output.
