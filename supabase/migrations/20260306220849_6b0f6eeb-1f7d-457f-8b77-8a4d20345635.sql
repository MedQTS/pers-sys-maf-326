
update public.pers_sys_systems_v2
set
  system_name = 'Dead Teams CLV Line Model (HARD+)',
  system_group = 'LINE_MODEL',
  active = true,
  primary_market = 'LINE',
  overlay_market = null,
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null,
  round_max = null,
  rounds_remaining_min = 3,
  rounds_remaining_max = 7,
  season_progress_round_min = null,
  date_start_mmdd = null,
  date_end_mmdd = null,
  clv_required = true,
  clv_min = 0.03,
  exclude_seasons = null,
  staking_config = jsonb_build_object(
    'base_pct_bankroll', 1.0,
    'max_pct_bankroll', 2.0
  ),
  amplifier_config = jsonb_build_object(
    'home_state_interstate_boost_pct', 0.5,
    'large_spread_floor_points', 18,
    'large_spread_boost_pct', 0.5
  ),
  overlay_config = null,
  updated_at = now()
where system_code = 'SYS_1';
