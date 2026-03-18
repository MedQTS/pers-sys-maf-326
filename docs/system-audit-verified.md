# VERIFIED FINDINGS

## Verification Scope Note
- This document reflects the current repository state only.
- It does **not** confirm whether the live Supabase environment has applied the same migrations or schema changes.
- Where the repo now contains remediation migrations, those items are marked as repo-level remediations and any remaining uncertainty is about deployment/application state, not repository absence.

## Critical
- `pers_sys_signal_audit_v2` repo migration coverage is now present.
  - Status: REPO-LEVEL REMEDIATION PRESENT
  - Evidence:
    - Evaluator writes audit rows with `supabase.from("pers_sys_signal_audit_v2").upsert(...)`.
    - Repo migrations now contain `20260309113200_create_signal_audit_v2.sql`, which creates `public.pers_sys_signal_audit_v2`.
  - Why it matters:
    - The repository blocker is cleared, but evaluator writes still depend on the target environment having applied this migration.
  - Remaining unknown:
    - Live database application state is not verified by repository inspection alone.

- `collision_rank` repo/schema alignment is now present.
  - Status: REPO-LEVEL REMEDIATION PRESENT
  - Evidence:
    - Evaluator selects `collision_rank` from `pers_sys_system_priority`.
    - Repo migrations now include `20260309113300_add_collision_rank_to_system_priority.sql`, which adds and backfills `collision_rank`.
  - Why it matters:
    - The repository blocker is cleared, but runtime success still depends on migration application in the target environment.
  - Remaining unknown:
    - Live database application state is not verified by repository inspection alone.

- Canonical non-SYS_7 staking path is now present in repo code/migrations.
  - Status: REPO-LEVEL REMEDIATION PRESENT
  - Evidence:
    - Evaluator writes `recommended_units` for all systems.
    - Repo migrations now add canonical staking fields and canonical staking RPC parameters (`p_recommended_bankroll_pct`).
    - UI and RPC paths in the repo now pass `recommended_bankroll_pct` for non-SYS_7 flows.
  - Why it matters:
    - The repository now has a coherent canonical path, but live correctness still depends on migration deployment and target DB state.
  - Remaining unknown:
    - Whether the deployed environment is running the canonical RPC versions cannot be confirmed from repository contents alone.

## High
- Legacy-vs-v2 registry alignment is now remediated in repo migrations.
  - Status: REPO-LEVEL REMEDIATION PRESENT
  - Evidence:
    - Evaluator loads active systems from `pers_sys_systems_v2`.
    - Repo migrations now include `20260309113400_repoint_system_priority_fk_to_v2.sql`, which repoints the priority FK to `pers_sys_systems_v2(system_code)`.
  - Why it matters:
    - The repository blocker is cleared, though live DB application remains unverified.
  - Remaining unknown:
    - Whether production/staging databases have applied the repoint migration is not knowable from repo inspection.

- SYS_8 repo seeding/config support is now present.
  - Status: REPO-LEVEL REMEDIATION PRESENT
  - Evidence:
    - Evaluator contains explicit SYS_8 rule block.
    - Repo migrations now include `20260309113500_add_sys8_totals_to_systems_v2.sql` and `20260309113600_normalize_systems_v2_config_keys.sql`.
  - Why it matters:
    - The repository blocker is cleared, but live migration application remains unknown.
  - Remaining unknown:
    - Deployed environment support for SYS_8 is not confirmed by repository evidence alone.

- Watcher automation has race window before unique-index enforcement handling.
  - Status: REPO REVIEW NEEDED FOR CURRENT RUNTIME POSTURE
  - Evidence:
    - Current repo code catches `23505` in `pers-sys-run-watcher` and returns a duplicate-skip response.
    - Daily batch runners still perform read-then-insert dedupe checks before insert.
  - Why it matters:
    - Idempotency handling is improved in watcher execution, but operational certainty still depends on actual deployed code and how batch entry points are triggered.
  - Remaining unknown:
    - Concurrent runtime behavior in the live environment is not verifiable from repo contents alone.

- Config-vs-code drift across systems is real and material.
  - Status: STILL A LIVE REPO RISK
  - Evidence:
    - Rules/thresholds are hardcoded per SYS block in evaluator.
    - Parallel values also exist in `pers_sys_systems_v2` JSON config (`staking_config`, `amplifier_config`, `overlay_config`) and legacy `pers_sys_systems.params`.
    - Example: many evaluator thresholds are literal constants (odds bands, CLV thresholds, caps) irrespective of JSON values.
  - Why it matters:
    - Operators may change DB config expecting behavior changes that do not happen in evaluator code.
  - Exact fix:
    - Move rule constants to config-driven evaluation with strict schema validation, or declare evaluator constants as canonical and deprecate conflicting JSON keys.

## Medium
- T10->T30 rule-snapshot remapping (except SYS_7) is implemented by code and can surprise operations.
  - Status: INTENTIONAL DESIGN
  - Evidence:
    - Evaluator computes `rulesSnap = modelSnap === "T10" && system_code !== "SYS_7" ? "T30" : modelSnap`.
    - Model inputs are read from `rulesSnap` snapshots.
  - Why it matters:
    - Users expecting true T10 model evaluation for SYS_1..6/8 will get T30 rule evaluation unless aware.
  - Exact fix:
    - Document policy explicitly in runbooks and UI; optionally add per-system explicit flag in config and telemetry field in outputs.

# SYSTEM PARITY CHECK
## SYS_1
- Match status: PARTIAL MATCH
- Evidence:
  - Locked definition (legacy params) describes dead-team line with round window and CLV gate.
  - Evaluator implements dead-team identification, round window (remaining 3–7), opponent top-8 gate, line CLV >= 0.03, and stake amplifiers/cap.
- Deviations:
  - Evaluator hardcodes thresholds and amplifiers rather than loading from config JSON.
  - Potential stake semantic mismatch downstream (recommended units vs computed stake).
- Automation-safe: NO

## SYS_2
- Match status: PARTIAL MATCH
- Evidence:
  - Evaluator enforces GF winner presence, replay exclusion, favourite-at-open check, open odds band, fade side, overlay metadata.
- Deviations:
  - Primary leg uses OPEN line in evaluator leg construction while broader narrative implies close-focused model in some locked text variants.
  - Overlay child execution logic and fixed sizing (0.4) are code-driven.
- Automation-safe: NO

## SYS_3
- Match status: PARTIAL MATCH
- Evidence:
  - Evaluator enforces home underdog, favourite odds band, favourite streak gate, state exclusions, multiple amplifiers, optional overlay metadata.
- Deviations:
  - Thresholds and amplifier magnitudes are hardcoded in evaluator, not fully sourced from config values.
- Automation-safe: NO

## SYS_4
- Match status: PARTIAL MATCH
- Evidence:
  - Evaluator enforces last-rounds window, interstate requirement, allowed venue states, opponent wins gate, favourite line selection.
- Deviations:
  - Staking amplification from config is not directly consumed in evaluator leg sizing path.
- Automation-safe: NO

## SYS_5
- Match status: PARTIAL MATCH
- Evidence:
  - Evaluator enforces dog-side H2H band, positive line, line-CLV threshold, and additive amplifiers with cap.
- Deviations:
  - Hardcoded gate values and cap in evaluator may diverge from config JSON over time.
- Automation-safe: NO

## SYS_6
- Match status: PARTIAL MATCH
- Evidence:
  - Evaluator enforces away dog open band and CLV thresholds with tiering/amplifiers/cap.
- Deviations:
  - Hardcoded thresholds in evaluator and stake semantics mismatch downstream.
- Automation-safe: NO

## SYS_7
- Match status: MOSTLY MATCH
- Evidence:
  - Evaluator keeps SYS_7 at T10 rules snapshot, checks home favourite odds band and prior-loss behavior, applies tier units and momentum amplifiers.
  - Preview/accept functions explicitly treat SYS_7 units as direct input (`p_units`).
- Deviations:
  - Some tier/amplifier details remain hardcoded in evaluator.
- Automation-safe: SAFE WITH FIXES

## SYS_8
- Match status: REPO SUPPORT PRESENT / LIVE APPLICATION UNVERIFIED
- Evidence:
  - Evaluator has SYS_8 totals-over block with thresholds and amplifiers.
  - Repo migrations now seed/update SYS_8 in `pers_sys_systems_v2` and normalize canonical config keys.
- Deviations:
  - Repo support exists, but deployed environment state is still unknown.
- Automation-safe: NO

# STAKING / UNIT SEMANTICS
- Findings:
  - Repo code now includes canonical `recommended_bankroll_pct` support in preview/accept paths.
  - `recommended_units` remains present for backward compatibility and transitional flows.
  - Live-environment adoption of the canonical path remains unverified by repo inspection alone.
- Evidence:
  - Evaluator writes `recommended_units` for all systems.
  - Repo migrations add `recommended_bankroll_pct` and canonical staking RPC parameters.
  - Current repo UI passes `p_recommended_bankroll_pct` into preview and accept RPCs.
- Risk:
  - If target environments have not applied canonical staking migrations/RPCs, deployed behavior may still differ from current repo behavior.
 - Repo conclusion:
  - Repository semantics are materially more coherent than earlier audit notes suggested.

# WATCHER / CRON SAFETY
- Findings:
  - Dedupe is present (`dedupe_key` + unique index + duplicate skip responses).
  - Missed/too-early windows skip downstream unless `force_run` is true.
  - T30 alert logic excludes already logged bets, differentiates NEW/CHANGED/PREVIOUSLY_SENT by fingerprint+change hash, and blocks duplicate run via alert hash unique index.
  - The current watcher code catches `23505`; remaining idempotency concern is mainly about full-system runtime confidence rather than complete repo absence of duplicate handling.
- Evidence:
  - `pers-sys-run-watcher` dedupe/read/insert and missed-window logic.
  - `pers_sys_watcher_runs` unique index on `dedupe_key`.
  - `pers-sys-send-t30-alert` logged-bet filter, status labeling, `actionRows` gating, and alert-run unique hash behavior.
  - `pers_sys_email_alert_runs` and `pers_sys_email_alert_items` unique indexes.
- Risk:
  - Concurrent and deployment-specific behavior is still not fully knowable from repository contents alone.
  - Stale docs must not be mistaken for proof that current repo code is still missing remediations.
- Safe to enable automation now:
  - REPO STATE: materially improved after remediation migrations.
  - LIVE ENVIRONMENT: still unverified.

# OPEN BLOCKERS
- Repository blockers formerly listed here are now remediated in repo migrations/code.
- Remaining blockers are outside repo-only verification scope:
  - whether target environments have applied the remediation migrations
  - whether deployed RPC/function versions match the repository
  - whether runtime automation behavior in production matches current repo code
