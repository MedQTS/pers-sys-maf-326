# System Audit Map (Systems 1–8)

## SYSTEM MAP

### End-to-end evaluation path
1. Fixtures/results and team identities are stored in `pers_sys_games` and `pers_sys_teams`.
2. `pers-sys-build-features` computes pre-game features into `pers_sys_team_state` and ladder cutline context into `pers_sys_round_context`.
3. `pers-sys-pull-odds-snapshot` stores market snapshots for H2H, LINE, and TOTALS in `pers_sys_market_snapshots` with both reference and execution fields.
4. `pers-sys-evaluate-systems-v2` reads active systems from `pers_sys_systems_v2`, applies rule logic for SYS_1..SYS_8, writes audit rows to `pers_sys_signal_audit_v2`, and writes surfaceable signals to `pers_sys_signals_v2`.
5. Timed orchestration (`pers-sys-dispatch-watchers` -> `pers-sys-run-watcher`) triggers T60/T30/T10 snapshot+evaluate cycles; T30 also triggers alerting (`pers-sys-send-t30-alert`).

### Core tables/config touched by evaluation
- Rule/config tables: `pers_sys_systems_v2`, `pers_sys_system_priority`.
- Inputs: `pers_sys_games`, `pers_sys_teams`, `pers_sys_team_state`, `pers_sys_round_context`, `pers_sys_market_snapshots`, `pers_sys_season_meta`, `pers_sys_season_config`, `pers_sys_venue_state`.
- Outputs: `pers_sys_signals_v2`, `pers_sys_signal_audit_v2` (used by evaluator), `pers_sys_watcher_runs` (orchestration log).
- Related execution/staking tables/functions used post-evaluation: `pers_sys_bets`, `preview_leg_stake(...)`, `accept_leg_create_bet(...)`.

## FILES BY SYSTEM

### Shared evaluator implementation file (all systems)
- `supabase/functions/pers-sys-evaluate-systems-v2/index.ts`
  - SYS_1 block
  - SYS_2 block
  - SYS_3 block
  - SYS_4 block
  - SYS_5 block
  - SYS_6 block
  - SYS_7 block
  - SYS_8 block

### System definition/parameter files (DB migrations)
- Baseline v2 inserts (SYS_1..SYS_7):
  - `supabase/migrations/20260304094217_4217c20c-8f4a-4fa4-81bf-9d569fb64857.sql`
- Later per-system updates:
  - SYS_1: `supabase/migrations/20260306220849_6b0f6eeb-1f7d-457f-8b77-8a4d20345635.sql`
  - SYS_2: `supabase/migrations/20260306225126_65e524fb-7180-4589-86c4-9b640536afa6.sql`
  - SYS_5: `supabase/migrations/20260306232724_14c23a25-52eb-4306-a269-1ec79419d232.sql`
  - SYS_3/SYS_4/SYS_6/SYS_7: `supabase/migrations/20260307010127_13f85c26-1833-485c-9d24-79b3158dabbe.sql`

### Legacy/parallel system-definition files (potentially confusing)
- Legacy systems table + params (not v2):
  - `supabase/migrations/20260301051225_07c54fcd-c4d6-4a95-8fad-86ad379a76a3.sql`
  - `supabase/migrations/20260303174813_bc32a0f0-096c-481c-922b-4999500f763e.sql`

### Per-system quick map
- SYS_1: evaluator block + SYS_1 config update migration.
- SYS_2: evaluator block + SYS_2 config update migration + overlay child logic in evaluator.
- SYS_3: evaluator block + SYS_3 config update migration.
- SYS_4: evaluator block + SYS_4 config update migration.
- SYS_5: evaluator block + SYS_5 config update migration.
- SYS_6: evaluator block + SYS_6 config update migration.
- SYS_7: evaluator block + SYS_7 config update migration.
- SYS_8: evaluator block exists; repo now includes explicit seed/update and config-normalization migrations.

## SHARED LOGIC

### Where signals are written
- Main signal rows are upserted in evaluator via `upsertSignalV2(...)` into `pers_sys_signals_v2`.
- Audit rows are upserted in evaluator via `upsertAuditV2(...)` into `pers_sys_signal_audit_v2`.
- READY/PENDING/BLOCKED/FAIL transition logic is centralized in evaluator after each system’s model pass.

### Collision / blocking / dominance
- Priority metadata is loaded from `pers_sys_system_priority`.
- Collision queue logic applies only to H2H/LINE systems with non-null `collision_rank`.
- Per-game latch (`dominatedByGame`) marks later systems as `BLOCKED` (`blocked_by_*`).

### Overlay handling
- SYS_2 primary model attaches overlay metadata; overlay child signal path is handled in evaluator after primary signal resolution.
- SYS_3 overlay appears as metadata in `reason_json` only (comment says single-leg signal engine for now).

### Staking logic
- Evaluator computes `reason.recommended_units` per system block (including amplifiers/caps).
- The current repo also includes canonical `recommended_bankroll_pct` support in `preview_leg_stake(...)` and `accept_leg_create_bet(...)`, while keeping `recommended_units` for backward compatibility.
- Alert flow (`pers-sys-send-t30-alert`) and UI surfaces now read both legacy and canonical staking fields.

### Orchestration that refreshes signals
- `pers-sys-dispatch-watchers` classifies T60/T30/T10 timing windows.
- `pers-sys-run-watcher` performs snapshot -> evaluate (and T30 alert) with dedupe/run logging.
- Batch runners: `pers-sys-run-open-nightly`, `pers-sys-run-nightly-maintenance`.

## HIGH-RISK AREAS

1. **Deployment-state risk:** repo remediations for audit-table coverage, `collision_rank`, v2 registry alignment, and SYS_8 support now exist, but repository inspection cannot prove they are applied in target environments.
2. **Config-vs-code drift risk:** many thresholds remain hardcoded in evaluator blocks, while also represented in `staking_config` / `amplifier_config` JSON for some systems.
3. **Snapshot policy subtlety:** evaluator rewrites `model_snapshot=T10` to rules snapshot `T30` for most systems except SYS_7, which can surprise operators.
4. **Automation/runtime risk:** even where repo-level dedupe/remediation exists, live concurrency and scheduler behavior remain environment-dependent.

## OPEN QUESTIONS

1. Have remediation migrations for audit coverage, `collision_rank`, v2 priority FK, SYS_8 seeding, and canonical staking RPCs been applied in the target Supabase environment?
2. Which source of truth is intended to dominate long term for thresholds: evaluator code literals or JSON config columns?
3. Should stale audit docs be treated as historical snapshots rather than current repo-state assertions?
