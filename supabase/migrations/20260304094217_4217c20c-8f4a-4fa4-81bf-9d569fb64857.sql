
INSERT INTO pers_sys_systems_v2 (
  system_code, system_name, active, system_priority, system_group,
  primary_market, model_snapshot, execution_snapshot, allow_candidate,
  rounds_remaining_min, rounds_remaining_max, season_progress_round_min,
  date_start_mmdd, date_end_mmdd, clv_required, clv_min,
  staking_config, amplifier_config, overlay_config
) VALUES
-- SYS_1
('SYS_1', 'Dead Teams CLV Line', true, 5, 'LINE_MODEL',
 'LINE', 'T10', 'T30', true,
 3, 7, null, null, null, true, 0.03,
 '{"base_pct_bankroll":1}', '{"home_state_interstate_boost":0.5}', null),
-- SYS_2
('SYS_2', 'GF Winner Early Fade', true, 6, 'BEHAVIOURAL_MODEL',
 'LINE', 'T10', 'OPEN', true,
 null, null, null, null, null, false, null,
 '{"line_pct_bankroll":1}', null, '{"overlay_h2h":true,"overlay_pct":0.3}'),
-- SYS_3
('SYS_3', 'Form Dog', true, 3, 'DOG_MODEL',
 'H2H', 'T10', 'T30', true,
 null, null, null, '03-25', '06-17', false, null,
 '{"base_units":1}', '{"interstate":0.5,"tight_band":0.5}', null),
-- SYS_4
('SYS_4', 'Line Last Rounds', true, 4, 'SEASONAL_MODEL',
 'LINE', 'T10', 'T30', true,
 null, 3, null, null, null, false, null,
 '{"base_pct_bankroll":2}', '{"final_round_boost":2}', null),
-- SYS_5
('SYS_5', 'Line Dog', true, 2, 'DOG_MODEL',
 'LINE', 'T10', 'T30', true,
 null, null, 6, null, null, true, 0.0,
 '{"base_pct_bankroll":1}', '{"home":0.5,"interstate":0.5}', null),
-- SYS_6
('SYS_6', 'Dog Mid Season', true, 7, 'DOG_MODEL',
 'H2H', 'T10', 'T30', true,
 null, null, null, '04-01', '07-30', true, 0.01,
 '{"base_pct_bankroll":1.5}', null, null),
-- SYS_7
('SYS_7', 'Home Favourite Bounce', true, 1, 'BEHAVIOURAL_MODEL',
 'H2H', 'T10', 'T30', true,
 null, null, null, '04-01', '07-30', false, null,
 '{"unit_pct_bankroll":1.5}', null, null);
