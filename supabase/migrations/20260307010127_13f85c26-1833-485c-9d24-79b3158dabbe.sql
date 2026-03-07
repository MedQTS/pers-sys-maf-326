
-- SYS_3 — Form Dog (HARD+)
update public.pers_sys_systems_v2
set
  system_name = 'Form Dog (HARD+)',
  system_group = 'FORM_OVERREACTION',
  active = true,
  primary_market = 'H2H',
  overlay_market = 'LINE',
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null, round_max = null,
  rounds_remaining_min = null, rounds_remaining_max = null,
  season_progress_round_min = null,
  date_start_mmdd = '03-25', date_end_mmdd = '06-17',
  exclude_seasons = array[2020, 2021]::int[],
  clv_required = false, clv_min = null,
  staking_config = jsonb_build_object('base_units', 1.0, 'max_units_per_leg', 2.5),
  amplifier_config = jsonb_build_object(
    'interstate_boost_units', 0.5,
    'tight_favourite_min', 1.65, 'tight_favourite_max', 1.80, 'tight_favourite_boost_units', 0.5,
    'clv_momentum_t10_low', 0.06, 'clv_momentum_t10_high', 0.08,
    'clv_momentum_t10_boost_low_units', 0.5, 'clv_momentum_t10_boost_high_units', 1.0,
    'early_agreement_t30_low', 0.04, 'early_agreement_t30_high', 0.06,
    'early_agreement_t30_boost_low_units', 0.25, 'early_agreement_t30_boost_high_units', 0.5
  ),
  overlay_config = jsonb_build_object('overlay_line', true, 'overlay_clv_points_min', 0),
  updated_at = now()
where system_code = 'SYS_3';

-- SYS_4 — Line Last 2 Rounds (HARD+)
update public.pers_sys_systems_v2
set
  system_name = 'Line Last 2 Rounds (HARD+)',
  system_group = 'SEASON_END_INCENTIVES',
  active = true,
  primary_market = 'LINE',
  overlay_market = null,
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null, round_max = null,
  rounds_remaining_min = 1, rounds_remaining_max = 3,
  season_progress_round_min = null,
  date_start_mmdd = null, date_end_mmdd = null,
  exclude_seasons = array[2020, 2021]::int[],
  clv_required = false, clv_min = null,
  staking_config = jsonb_build_object('base_pct_bankroll', 2.0, 'final_two_rounds_pct_bankroll', 4.0),
  amplifier_config = jsonb_build_object('final_two_rounds_remaining_max', 2, 'final_two_rounds_stake_multiplier', 2.0, 'weather_haircut_supported', true),
  overlay_config = null,
  updated_at = now()
where system_code = 'SYS_4';

-- SYS_6 — Dog Mid-Season (HARD+)
update public.pers_sys_systems_v2
set
  system_name = 'Dog Mid-Season (HARD+)',
  system_group = 'LONGSHOT_VALUE',
  active = true,
  primary_market = 'H2H',
  overlay_market = null,
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null, round_max = null,
  rounds_remaining_min = null, rounds_remaining_max = null,
  season_progress_round_min = null,
  date_start_mmdd = '04-01', date_end_mmdd = '07-30',
  exclude_seasons = null,
  clv_required = true, clv_min = 0.01,
  staking_config = jsonb_build_object('base_pct_bankroll', 1.5, 'tier2_clv_min', 0.03, 'tier2_pct_bankroll', 2.0, 'tier3_clv_min', 0.06, 'tier3_pct_bankroll', 2.5, 'max_pct_bankroll', 2.5),
  amplifier_config = jsonb_build_object('large_spread_points', 18, 'large_spread_boost_pct', 0.25, 'early_agreement_t30_min', 0.04, 'early_agreement_t30_boost_pct', 0.25),
  overlay_config = null,
  updated_at = now()
where system_code = 'SYS_6';

-- SYS_7 — Home Favourite Bounce Escalation (HARD+)
update public.pers_sys_systems_v2
set
  system_name = 'Home Favourite Bounce Escalation (HARD+)',
  system_group = 'BEHAVIOURAL_REGRESSION',
  active = true,
  primary_market = 'H2H',
  overlay_market = null,
  model_snapshot = 'T10',
  execution_snapshot = 'T30',
  allow_candidate = true,
  round_min = null, round_max = null,
  rounds_remaining_min = null, rounds_remaining_max = null,
  season_progress_round_min = null,
  date_start_mmdd = '04-01', date_end_mmdd = '07-30',
  exclude_seasons = array[2020, 2021]::int[],
  clv_required = false, clv_min = null,
  staking_config = jsonb_build_object('tier1_units', 1.5, 'tier2_units', 2.25, 'tier3_units', 3.0, 'max_units', 4.0, 'match_cap_pct_bankroll', 6.0),
  amplifier_config = jsonb_build_object(
    'clv_momentum_t10_low', 0.06, 'clv_momentum_t10_high', 0.08,
    'clv_momentum_t10_boost_low_units', 0.5, 'clv_momentum_t10_boost_high_units', 1.0,
    'early_agreement_t30_low', 0.03, 'early_agreement_t30_high', 0.05,
    'early_agreement_t30_boost_low_units', 0.25, 'early_agreement_t30_boost_high_units', 0.5,
    'penalty_band_min', 1.65, 'penalty_band_max', 1.80,
    'penalty_if_shortening_below', 0.06, 'penalty_units', 0.25
  ),
  overlay_config = null,
  updated_at = now()
where system_code = 'SYS_7';
