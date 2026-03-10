-- Item 5 remediation: make SYS_8 reproducible from repo migrations.

-- Ensure totals market is available for systems_v2 primary/overlay market fields.
alter type public.sys_market add value if not exists 'TOTALS';

-- Seed/update SYS_8 in v2 registry.
insert into public.pers_sys_systems_v2 (
  system_code,
  system_name,
  active,
  system_priority,
  system_group,
  primary_market,
  model_snapshot,
  execution_snapshot,
  allow_candidate,
  rounds_remaining_min,
  rounds_remaining_max,
  season_progress_round_min,
  date_start_mmdd,
  date_end_mmdd,
  clv_required,
  clv_min,
  staking_config,
  amplifier_config,
  overlay_config
)
values (
  'SYS_8',
  'Totals Over Model',
  true,
  8,
  'TOTALS_MODEL',
  'TOTALS',
  'T10',
  'T30',
  true,
  null,
  null,
  null,
  null,
  null,
  false,
  null,
  '{"base_pct_bankroll": 1.0, "max_pct_bankroll": 2.5}'::jsonb,
  '{"day_game_boost": 0.25, "marvel_boost": 0.25, "early_agreement_boost": 0.25, "strong_momentum_boost": 0.25}'::jsonb,
  null
)
on conflict (system_code)
do update set
  system_name = excluded.system_name,
  active = excluded.active,
  system_priority = excluded.system_priority,
  system_group = excluded.system_group,
  primary_market = excluded.primary_market,
  model_snapshot = excluded.model_snapshot,
  execution_snapshot = excluded.execution_snapshot,
  allow_candidate = excluded.allow_candidate,
  rounds_remaining_min = excluded.rounds_remaining_min,
  rounds_remaining_max = excluded.rounds_remaining_max,
  season_progress_round_min = excluded.season_progress_round_min,
  date_start_mmdd = excluded.date_start_mmdd,
  date_end_mmdd = excluded.date_end_mmdd,
  clv_required = excluded.clv_required,
  clv_min = excluded.clv_min,
  staking_config = excluded.staking_config,
  amplifier_config = excluded.amplifier_config,
  overlay_config = excluded.overlay_config,
  updated_at = now();
