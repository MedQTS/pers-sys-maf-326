# STAKING AUDIT

## Current Semantics by System
### SYS_1
- Evaluator output meaning:
  - `recommended_units` is produced from `stake` variable initialized at `1.0`, then modified by additive amplifiers and capped at `2.0`.
  - The inline labels call this a “base stake” with additive boosts; values look like percent-of-bankroll style numbers, not explicitly “units”.
- Evidence:
  - `reason.recommended_units = stake` after additive boosts/cap. See evaluator SYS_1 block.
- Correct or incorrect:
  - Incorrect/ambiguous in current pipeline: downstream preview/accept do not consume this for SYS_1 and recompute stake from config `base_bankroll_pct`.

### SYS_2
- Evaluator output meaning:
  - `recommended_units` is fixed `1.0` for primary leg.
  - Overlay child path writes `recommended_units = 0.4` when READY.
  - Semantics appear bankroll-percent-like for primary and overlay, but field name is “units”.
- Evidence:
  - Primary assignment and overlay assignment in evaluator.
- Correct or incorrect:
  - Incorrect/ambiguous: non-SYS_7 preview/accept ignore this value for stake computation.

### SYS_3
- Evaluator output meaning:
  - `recommended_units` is `stakeUnits` starting at `1.0` and incremented by 0.25/0.5/1.0 style increments, capped at `2.5`.
  - This behaves like raw units.
- Evidence:
  - SYS_3 `let stakeUnits = 1.0; ... reason.recommended_units = stakeUnits;`.
- Correct or incorrect:
  - Incorrect in pipeline: preview/accept only pass explicit units for SYS_7, so SYS_3’s unit-like output is ignored and replaced by config-derived units.

### SYS_4
- Evaluator output meaning:
  - No `recommended_units` assignment in SYS_4 branch.
- Evidence:
  - SYS_4 block builds leg only; no sizing assignment.
- Correct or incorrect:
  - Ambiguous/incomplete: stake is entirely determined downstream by config fallback (`base_bankroll_pct`, default 1%) regardless of SYS_4 strategy narrative.

### SYS_5
- Evaluator output meaning:
  - `recommended_units` is `stakePct` (commented as “Base stake: 1.0%”), incremented by amplifiers, capped at `2.5`.
  - This is percent-of-bankroll style in intent, despite `recommended_units` name.
- Evidence:
  - SYS_5 comments and assignment `reason.recommended_units = stakePct`.
- Correct or incorrect:
  - Incorrect in pipeline: non-SYS_7 preview/accept ignore `recommended_units`; effective stake comes from `base_bankroll_pct` conversion.

### SYS_6
- Evaluator output meaning:
  - `recommended_units` is `stakePct` tiered at 1.5/2.0/2.5 with optional +0.25 amplifiers, then capped at 2.5.
  - Percent-of-bankroll style intent.
- Evidence:
  - SYS_6 `let stakePct = 1.5; ... reason.recommended_units = stakePct;`.
- Correct or incorrect:
  - Incorrect in pipeline for same reason: ignored by preview/accept unless SYS_7.

### SYS_7
- Evaluator output meaning:
  - `recommended_units` is explicit unit count (tier1/2/3 units plus modifiers, cap 4.0).
- Evidence:
  - SYS_7 `let units`, tiering, and `reason.recommended_units = units`.
- Correct or incorrect:
  - Correct relative to current preview/accept implementation: SYS_7 is the only system where `p_units` override is passed and consumed.

### SYS_8
- Evaluator output meaning:
  - `recommended_units` is `stake` starting at 1.0 with amplifier boosts and optional cap via `staking_config.max_pct_bankroll`.
  - Percent-of-bankroll style intent.
- Evidence:
  - SYS_8 assignment `reason.recommended_units = stake` and cap logic.
- Correct or incorrect:
  - Incorrect/ambiguous in pipeline: non-SYS_7 override path means this value is not used for actual stake computation.

## End-to-End Stake Flow
- Evaluator:
  - Writes `recommended_units` into `reason_json`, audit rows, and `pers_sys_signals_v2.recommended_units`.
- Preview:
  - `preview_leg_stake(...)` computes bankroll snapshot, one-unit percent (`global_1u_pct`, and `system_7_1u_pct` for SYS_7), then:
    - SYS_7: uses provided `p_units`.
    - non-SYS_7: ignores `p_units` and computes units from `staking_config.base_bankroll_pct / one_u_pct`.
- Acceptance:
  - `accept_leg_create_bet(...)` mirrors preview semantics:
    - SYS_7 uses provided `p_units`.
    - non-SYS_7 computes units from `base_bankroll_pct / one_u_pct`.
  - Computes `stake_amount = bankroll * units * one_u_pct` and rounds to nearest $5.
  - Applies match cap at `6%` bankroll (hardcoded).
- Storage:
  - `pers_sys_signals_v2` stores evaluator `recommended_units`.
  - `pers_sys_bets` stores accepted `units` and `stake_amount` (which can diverge from evaluator recommendation for non-SYS_7).
- Alert rendering:
  - `pers-sys-send-t30-alert` calls `preview_leg_stake` and displays preview `stake_amount`.
  - It only passes `p_units` for SYS_7; all other systems use preview fallback computation.

## Verified Defects
### Critical
- Issue:
  - `recommended_units` semantic contract is broken for non-SYS_7 systems (SYS_1,2,3,4,5,6,8).
  - Evidence:
    - Evaluator assigns `recommended_units` across systems.
    - Alert and UI pass `p_units` only when `system_code === "SYS_7"`.
    - `preview_leg_stake` and `accept_leg_create_bet` only consume explicit units for SYS_7; others derive from `base_bankroll_pct`.
  - Why it matters:
    - Dollar stakes shown in alerts/previews and dollar stakes on accepted bets can ignore evaluator stake logic/amplifiers.
  - Systems affected:
    - SYS_1, SYS_2, SYS_3, SYS_4, SYS_5, SYS_6, SYS_8.
  - Exact fix:
    - Introduce canonical stake input for all systems (e.g., `recommended_bankroll_pct` or `recommended_units`) and pass it through preview+accept uniformly.

- Issue:
  - Portfolio cap and contract mismatch versus stated policy.
  - Evidence:
    - Acceptance function enforces hard match cap `v_match_cap := v_total_equity * 0.06` (6%), while objective policy states 4% max exposure.
    - System hard cap 3% per bet is not enforced in acceptance logic.
  - Why it matters:
    - Accepted stakes can violate intended risk envelope.
  - Systems affected:
    - All accepted bets.
  - Exact fix:
    - Move policy caps into canonical enforcement layer in `accept_leg_create_bet`:
      - match cap = 4%
      - per-bet cap = 3%
      - validate after normalization.

### High
- Issue:
  - Preview and acceptance are only partially aligned with strategy semantics.
  - Evidence:
    - Preview and acceptance use similar formulas, but both ignore evaluator sizing for non-SYS_7.
    - Acceptance adds match-cap rejection path not represented as a hard pre-filter in preview output.
  - Why it matters:
    - Operators can trust a preview stake that does not reflect evaluator-intended sizing and can still fail at accept time due cap checks.
  - Systems affected:
    - Preview/accept UX across all systems; sizing semantics issue hits non-SYS_7.
  - Exact fix:
    - Use one shared normalization function (SQL or edge) for both preview and accept with identical inputs and cap checks; include cap status in preview response.

- Issue:
  - Config key mismatch risk can silently fall back to default 1% for non-SYS_7.
  - Evidence:
    - Preview/accept read `staking_config.base_bankroll_pct`.
    - Several migrations configure systems with keys such as `base_pct_bankroll`, `line_pct_bankroll`, or `base_units`.
  - Why it matters:
    - Missing expected key causes fallback to default 1%, producing deterministic but incorrect stakes.
  - Systems affected:
    - non-SYS_7 systems lacking `base_bankroll_pct` key.
  - Exact fix:
    - Standardize staking schema keys and add migration validation/check constraints (or runtime strict validation) to reject incomplete config.

## Preview vs Acceptance Consistency
- Same stake path: NO
- Evidence:
  - Both use similar normalization math and SYS_7-only explicit units, but acceptance applies match-cap gating and duplicate guards that preview does not fully emulate.
- Divergence points:
  - Match cap enforced only in accept path.
  - Preview can present stake for a candidate that will be rejected on acceptance (`reason: match_cap`).
- Risk:
  - Operational confusion and false confidence in actionable alert dollar amounts.

## Canonical Recommendation
- Recommended internal contract:
  - Evaluator emits `recommended_bankroll_pct` (canonical final percent after amplifiers/caps) for every system.
  - Preview and accept both convert `recommended_bankroll_pct` -> units via `global_1u_pct` (or system override where explicitly intended) using one shared function.
- Why:
  - The portfolio policy is percentage-based and mixed-mode systems must converge to a single semantic layer before caps/checks.
- Minimum code/schema changes required:
  - Add `recommended_bankroll_pct` to signals/audit schema.
  - Update evaluator to populate it for SYS_1..SYS_8.
  - Update preview/accept signatures to accept canonical percent for all systems (remove SYS_7-only branch).
  - Enforce 4% match cap + 3% per-bet cap in shared normalization layer.

## Safe to trust current dollar stakes
- Alerts: NO
- Bet creation: NO
- Stored bets: NO
