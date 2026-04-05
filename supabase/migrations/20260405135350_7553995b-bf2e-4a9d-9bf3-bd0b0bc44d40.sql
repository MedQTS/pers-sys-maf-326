INSERT INTO public.pers_sys_systems_v2 (
  system_code, system_name, active, system_group, system_priority,
  evaluation_version, primary_market, overlay_market,
  execution_snapshot, model_snapshot, allow_candidate,
  exclude_seasons, staking_config, amplifier_config, overlay_config
) VALUES (
  'SYS_9',
  'Collingwood High-Total Suppression (PROVISIONAL+)',
  true,
  'TOTALS_MODEL',
  9,
  1,
  'TOTALS',
  NULL,
  'T30',
  'T10',
  true,
  ARRAY[2020, 2021],
  '{"global_1u_pct": 0.015, "max_pct_bankroll": 1.5, "base_bankroll_pct": 1.0, "base_pct_bankroll": 1.0, "model_total_min": 178.0, "under_price_min": 1.45, "fixed_target_total_line": 189.5}'::jsonb,
  NULL,
  NULL
);