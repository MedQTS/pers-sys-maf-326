# VERIFIED FINDINGS

## Critical
- `pers_sys_signal_audit_v2` migration gap blocks evaluator writes.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - Evaluator writes audit rows with `supabase.from("pers_sys_signal_audit_v2").upsert(...)`.
    - Repo migrations contain no `create table ... pers_sys_signal_audit_v2`.
  - Why it matters:
    - If table is absent in target DB, every evaluation run fails at audit write path, preventing reliable signal generation.
  - Exact fix:
    - Add a migration that creates `pers_sys_signal_audit_v2` with all columns used by `upsertAuditV2(...)` and matching unique key `(system_code,game_id,model_snapshot,execution_snapshot,audit_key)`.

- `collision_rank` schema mismatch between evaluator query and migrations.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - Evaluator selects `collision_rank` from `pers_sys_system_priority`.
    - Migration creating `pers_sys_system_priority` does not define `collision_rank`.
    - No migration in repo adds/alters this column.
  - Why it matters:
    - Selecting a non-existent column causes evaluator query failure, halting system evaluation.
  - Exact fix:
    - Add migration `alter table public.pers_sys_system_priority add column collision_rank int;` and seed values; or remove column from evaluator query and logic.

- Staking semantics mismatch can produce wrong dollar stakes for non-SYS_7 alerts/bets.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - Evaluator writes `recommended_units` for all systems.
    - Alert flow passes units to `preview_leg_stake` only for SYS_7; non-SYS_7 pass `p_units = null`.
    - `preview_leg_stake` ignores evaluator `recommended_units` for non-SYS_7 and recomputes units from `staking_config.base_bankroll_pct`.
    - `accept_leg_create_bet` uses same model: explicit units only for SYS_7, computed units for others.
  - Why it matters:
    - Recommended stake amplifiers (e.g., SYS_1/3/5/6/8) may not be reflected in alert stake preview and accepted bet stake.
  - Exact fix:
    - Unify semantics: either (a) always treat `recommended_units` as canonical units and pass to preview/accept for all systems, or (b) rename evaluator field to `recommended_pct_bankroll`/`recommended_signal_strength` and stop presenting it as bet sizing.

## High
- Dual registry mismatch (`pers_sys_systems` vs `pers_sys_systems_v2`) with priority FK anchored to legacy table.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - Evaluator loads active systems from `pers_sys_systems_v2`.
    - `pers_sys_system_priority` migration FK references `public.pers_sys_systems(system_code)` (legacy table), not v2.
  - Why it matters:
    - Priority/collision metadata can drift from evaluator’s true system registry and omit v2-only systems (including SYS_8).
  - Exact fix:
    - Migrate priority FK to `pers_sys_systems_v2(system_code)` and reseed/update priorities in v2 namespace.

- SYS_8 has evaluator logic but no v2 seed/update migration in repo.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - Evaluator contains explicit SYS_8 rule block.
    - No migration contains `SYS_8` insert/update into `pers_sys_systems_v2`.
  - Why it matters:
    - SYS_8 may never run if not manually inserted in DB; environment drift risk is high.
  - Exact fix:
    - Add deterministic migration inserting/updating SYS_8 row in `pers_sys_systems_v2` and (if needed) `pers_sys_system_priority`.

- Watcher automation has race window before unique-index enforcement handling.
  - Status: CONFIRMED DEFECT
  - Evidence:
    - `pers-sys-run-watcher` performs pre-check for dedupe key then inserts run row.
    - Unique index exists on `pers_sys_watcher_runs(dedupe_key)`.
    - Insert path does not catch `23505` and convert to clean duplicate response.
  - Why it matters:
    - Concurrent invocations can produce transient failures (500) instead of idempotent skip behavior.
  - Exact fix:
    - Wrap insert with conflict-safe pattern (`upsert ... on conflict do nothing returning id`) or catch `23505` and return duplicate-skip payload.

- Config-vs-code drift across systems is real and material.
  - Status: CONFIRMED DEFECT
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
- Match status: UNVERIFIABLE / INCOMPLETE
- Evidence:
  - Evaluator has SYS_8 totals-over block with thresholds and amplifiers.
  - No migration seeds/updates SYS_8 in `pers_sys_systems_v2`.
- Deviations:
  - Registry/config parity missing in repo migrations.
- Automation-safe: NO

# STAKING / UNIT SEMANTICS
- Findings:
  - `recommended_units` is not consistently treated as canonical units across systems.
  - SYS_7: treated as raw units in alert preview and bet-accept RPC path.
  - Non-SYS_7: alert/accept recompute units from `staking_config.base_bankroll_pct`, ignoring evaluator `recommended_units`.
- Evidence:
  - Evaluator writes `recommended_units` for all systems.
  - Alert function only passes units to preview for SYS_7.
  - `preview_leg_stake` and `accept_leg_create_bet` branch on `p_system_code = 'SYS_7'` for direct units.
- Risk:
  - Dollar stakes in alerts and created bets can diverge from evaluator recommendation (silent sizing drift).
- Fix:
  - Define one invariant contract: `recommended_units` always raw units (preferred) and pass it for all systems; otherwise rename field and remove sizing implications from alerts.

# WATCHER / CRON SAFETY
- Findings:
  - Dedupe is present (`dedupe_key` + unique index + duplicate skip responses).
  - Missed/too-early windows skip downstream unless `force_run` is true.
  - T30 alert logic excludes already logged bets, differentiates NEW/CHANGED/PREVIOUSLY_SENT by fingerprint+change hash, and blocks duplicate run via alert hash unique index.
  - Race windows remain in watcher run insert path (pre-check then insert without `23505` handler).
- Evidence:
  - `pers-sys-run-watcher` dedupe/read/insert and missed-window logic.
  - `pers_sys_watcher_runs` unique index on `dedupe_key`.
  - `pers-sys-send-t30-alert` logged-bet filter, status labeling, `actionRows` gating, and alert-run unique hash behavior.
  - `pers_sys_email_alert_runs` and `pers_sys_email_alert_items` unique indexes.
- Risk:
  - Concurrent invocations can throw failures instead of idempotent no-op.
  - If staking semantics are unresolved, alerts can be operationally misleading despite dedupe safety.
- Fix:
  - Make watcher insert conflict-safe and idempotent on `23505`.
  - Resolve staking-unit contract before enabling cron dispatch.
- Safe to enable automation now: NO

# OPEN BLOCKERS
- Missing/unknown migration for `pers_sys_signal_audit_v2` in repo.
- `collision_rank` evaluator dependency not represented in repo migrations.
- Staking contract mismatch (`recommended_units` meaning) unresolved for non-SYS_7.
