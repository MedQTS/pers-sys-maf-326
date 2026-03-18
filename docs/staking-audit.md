# STAKING AUDIT

## Scope Note
- This document now distinguishes between current repository behavior and unverified live-environment behavior.
- Repository inspection shows that canonical staking support has been added, but repo-only review cannot prove that deployed RPCs and migrations match the current repository.

## Current Semantics by System
### SYS_1
- Evaluator output meaning:
  - `recommended_units` is produced from `stake` variable initialized at `1.0`, then modified by additive amplifiers and capped at `2.0`.
  - The inline labels call this a “base stake” with additive boosts; values look like percent-of-bankroll style numbers, not explicitly “units”.
- Evidence:
  - `reason.recommended_units = stake` after additive boosts/cap. See evaluator SYS_1 block.
- Correct or incorrect:
  - Legacy interpretation only. Current repo preview/accept paths can now consume canonical `recommended_bankroll_pct`, but live deployment state is unverified.

### SYS_2
- Evaluator output meaning:
  - `recommended_units` is fixed `1.0` for primary leg.
  - Overlay child path writes `recommended_units = 0.4` when READY.
  - Semantics appear bankroll-percent-like for primary and overlay, but field name is “units”.
- Evidence:
  - Primary assignment and overlay assignment in evaluator.
- Correct or incorrect:
  - Legacy interpretation only. Current repo supports canonical bankroll-percent flow in preview/accept.

### SYS_3
- Evaluator output meaning:
  - `recommended_units` is `stakeUnits` starting at `1.0` and incremented by 0.25/0.5/1.0 style increments, capped at `2.5`.
  - This behaves like raw units.
- Evidence:
  - SYS_3 `let stakeUnits = 1.0; ... reason.recommended_units = stakeUnits;`.
- Correct or incorrect:
  - Transitional. Current repo gives preview/accept a canonical bankroll-percent path, but legacy compatibility remains in storage and code paths.

### SYS_4
- Evaluator output meaning:
  - No `recommended_units` assignment in SYS_4 branch.
- Evidence:
  - SYS_4 block builds leg only; no sizing assignment.
- Correct or incorrect:
  - Transitional. Current repo can normalize through canonical bankroll-percent semantics, but evaluator/storage still preserve legacy fields.

### SYS_5
- Evaluator output meaning:
  - `recommended_units` is `stakePct` (commented as “Base stake: 1.0%”), incremented by amplifiers, capped at `2.5`.
  - This is percent-of-bankroll style in intent, despite `recommended_units` name.
- Evidence:
  - SYS_5 comments and assignment `reason.recommended_units = stakePct`.
- Correct or incorrect:
  - Legacy interpretation only. Current repo supports canonical bankroll-percent input in preview/accept.

### SYS_6
- Evaluator output meaning:
  - `recommended_units` is `stakePct` tiered at 1.5/2.0/2.5 with optional +0.25 amplifiers, then capped at 2.5.
  - Percent-of-bankroll style intent.
- Evidence:
  - SYS_6 `let stakePct = 1.5; ... reason.recommended_units = stakePct;`.
- Correct or incorrect:
  - Legacy interpretation only. Current repo supports canonical bankroll-percent input in preview/accept.

### SYS_7
- Evaluator output meaning:
  - `recommended_units` is explicit unit count (tier1/2/3 units plus modifiers, cap 4.0).
- Evidence:
  - SYS_7 `let units`, tiering, and `reason.recommended_units = units`.
- Correct or incorrect:
  - Still supported. SYS_7 retains explicit-unit handling, while the repo also supports canonical bankroll-percent paths.

### SYS_8
- Evaluator output meaning:
  - `recommended_units` is `stake` starting at 1.0 with amplifier boosts and optional cap via `staking_config.max_pct_bankroll`.
  - Percent-of-bankroll style intent.
- Evidence:
  - SYS_8 assignment `reason.recommended_units = stake` and cap logic.
- Correct or incorrect:
  - Legacy interpretation only. Repo migrations now seed SYS_8 and add canonical config-key normalization plus canonical staking support.

## End-to-End Stake Flow
- Evaluator:
  - Still writes `recommended_units`.
  - Repo schema also now supports `recommended_bankroll_pct` and `staking_contract_version`.
- Preview:
  - Current repo `preview_leg_stake(...)` prefers canonical `p_recommended_bankroll_pct`, supports backward-compatible `p_units`, and only then falls back to config-derived sizing.
- Acceptance:
  - Current repo `accept_leg_create_bet(...)` mirrors the same canonical-first behavior.
  - Computes `stake_amount = bankroll * units * one_u_pct` and rounds to nearest $5.
  - Applies match cap at `6%` bankroll (hardcoded).
- Storage:
  - `pers_sys_signals_v2` stores evaluator `recommended_units`.
  - Repo schema now also supports canonical staking fields for signals/audit rows.
- Alert rendering:
  - `pers-sys-send-t30-alert` still reads legacy fields, but the current repo also carries canonical staking fields through the stack.

## Verified Defects
### Critical
- Issue:
  - Historical non-SYS_7 staking ambiguity has been remediated in current repo code/migrations, but live deployment state remains unknown.
  - Evidence:
    - Canonical staking fields and canonical RPC parameters now exist in repo migrations.
    - Current UI passes `p_recommended_bankroll_pct` into preview and accept RPCs.
  - Why it matters:
    - Repository semantics now appear materially more coherent, but deployed behavior still depends on whether target environments have applied the newer RPC migrations.
  - Systems affected:
    - Environment verification required for all systems.
  - Repo conclusion:
    - Repo-level blocker appears remediated.

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
  - Preview and acceptance now share a canonical-first staking path in repo code, but runtime deployment parity is unverified.
  - Evidence:
    - Current repo migrations redefine both RPCs with the same canonical staking contract.
  - Why it matters:
    - Documentation must not continue describing the old repo state as if it were current.
  - Systems affected:
    - All environments pending deployment verification.

- Issue:
  - Config-key drift remains a transition risk, though repo migrations now normalize key names.
  - Evidence:
    - Repo contains normalization migrations for `base_bankroll_pct` and SYS_8 canonical keys.
  - Why it matters:
    - The repo has mitigations, but target environments may still lag if migrations are unapplied.
  - Systems affected:
    - Environment-dependent.

## Preview vs Acceptance Consistency
- Same stake path:
  - REPO STATE: substantially aligned through canonical-first RPCs.
  - LIVE ENVIRONMENT: unverified.
- Evidence:
  - Current repo defines both RPCs with canonical bankroll-percent support.
- Divergence points:
  - Match cap enforced only in accept path.
  - Preview can still present stake for a candidate that will be rejected on acceptance (`reason: match_cap`).
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
- Repo state:
  - more coherent than the earlier blocker audit claimed
- Live environment:
  - still unverified
