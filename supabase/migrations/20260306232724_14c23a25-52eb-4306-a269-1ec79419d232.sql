update public.pers_sys_systems_v2
set
  system_name = 'Line Dog (HARD+)',
  system_group = 'MARKET_INEFFICIENCY',
  active = true,
  primary_market = 'LINE',
  overlay_market = null,
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null,
  round_max = null,
  rounds_remaining_min = null,
  rounds_remaining_max = null,
  season_progress_round_min = 6,
  date_start_mmdd = null,
  date_end_mmdd = null,
  exclude_seasons = array[2020, 2021]::int[],
  clv_required = true,
  clv_min = 1.5,
  staking_config = jsonb_build_object(
    'base_pct_bankroll', 1.0,
    'max_pct_bankroll', 2.5
  ),
  amplifier_config = jsonb_build_object(
    'strong_clv_threshold', 3.0,
    'strong_clv_boost_pct', 0.5,
    'home_dog_boost_pct', 0.5,
    'interstate_travel_boost_pct', 0.25,
    'large_spread_points', 18,
    'large_spread_boost_pct', 0.5
  ),
  overlay_config = null,
  updated_at = now()
where system_code = 'SYS_5';