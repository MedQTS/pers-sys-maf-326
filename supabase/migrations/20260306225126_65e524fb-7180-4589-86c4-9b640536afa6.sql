
update public.pers_sys_systems_v2
set
  system_name = 'GF Winner Early Fade (HARD+)',
  system_group = 'BEHAVIOURAL_MODEL',
  active = true,
  primary_market = 'LINE',
  overlay_market = 'H2H',
  model_snapshot = 'T10',
  execution_snapshot = 'OPEN',
  allow_candidate = true,
  round_min = 0,
  round_max = 5,
  rounds_remaining_min = null,
  rounds_remaining_max = null,
  season_progress_round_min = null,
  date_start_mmdd = null,
  date_end_mmdd = null,
  exclude_seasons = array[2020, 2021]::int[],
  clv_required = false,
  clv_min = null,
  staking_config = jsonb_build_object(
    'line_pct_bankroll', 1.0,
    'overlay_pct_bankroll', 0.4
  ),
  amplifier_config = null,
  overlay_config = jsonb_build_object(
    'overlay_h2h', true,
    'overlay_pct', 0.4,
    'overlay_side', 'AWAY',
    'overlay_clv_min', 0.03,
    'overlay_execution_snapshot', 'T30'
  ),
  updated_at = now()
where system_code = 'SYS_2';
