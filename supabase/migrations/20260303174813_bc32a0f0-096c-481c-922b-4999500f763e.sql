
-- Add description column if missing
ALTER TABLE public.pers_sys_systems
ADD COLUMN IF NOT EXISTS description text;

-- Upsert SYS_1..SYS_7
INSERT INTO public.pers_sys_systems
(system_code, name, description, staking_policy, active, params)
VALUES
(
'SYS_1',
'Dead Teams CLV Line Model',
'Late-season dead-teams CLV line model. Bet the dead team line when CLV confirmed vs T10.',
'BANKROLL_PCT',
true,
jsonb_build_object(
'version','2026-approved',
'window','Remaining 3–7 rounds',
'market','LINE',
'selection_rule','BET_DEAD_TEAM',
'dead_team_points_behind_8th_min',8,
'clv_required',true,
'clv_anchor_snapshot_type','T10',
'clv_min',0.03,
'opponent_must_be_top8',true,
'amplifiers', jsonb_build_array(
jsonb_build_object('code','HOME_STATE_ADV','desc','Home-state advantage vs interstate opponent','stake_multiplier',1.5),
jsonb_build_object('code','VIC_VENUE_BOOST','desc','VIC venue boost (apply only if OOS validated)','stake_multiplier',null,'gated',true)
),
'staking', jsonb_build_object(
'base_bankroll_pct',0.01,
'amplifiers_proportional',true,
'no_multis',true,
'no_forced_bets',true
),
'process_controls', jsonb_build_array('close-to-close execution','monitor weather','monitor late outs','strict CLV discipline')
)
),
(
'SYS_2',
'GF Winner Early Fade',
'Rounds 1–5. Fade prior-year GF winner when favourite at OPEN and OPEN H2H < 1.48. Exclude GF replay vs runner-up. Primary LINE at close; optional H2H overlay gate.',
'BANKROLL_PCT',
true,
jsonb_build_object(
'version','modern',
'rounds_min',1,
'rounds_max',5,
'exclude_seasons', jsonb_build_array(2021,2022),
'gf_winner_required',true,
'exclude_gf_replay',true,
'gf_winner_open_h2h_max',1.48,
'gf_winner_must_be_favourite_at_open',true,
'primary_market','LINE',
'primary_price_anchor_snapshot_type','T10',
'overlay_h2h_gate', jsonb_build_object(
'enabled',true,
'only_if_gf_winner_is_away',true,
'clv_required',true,
'clv_anchor_snapshot_type','T10',
'clv_min',0.03,
'size_bankroll_pct_min',0.0025,
'size_bankroll_pct_max',0.0040
),
'staking', jsonb_build_object(
'line_bankroll_pct',0.01,
'no_multis',true,
'no_forced_bets',true
),
'process_controls', jsonb_build_array('execute close-to-close','confirm no major late outs','track CLV','do not widen price band','do not remove replay exclusion')
)
),
(
'SYS_3',
'Form Dog',
'Mid-season form dog. Home underdog at close; favourite in 1.55–1.85 pocket; favourite streak >=2. Primary H2H home dog; optional LINE overlay if line CLV > 0.',
'UNIT_BASED',
true,
jsonb_build_object(
'version','production',
'date_window_aet', jsonb_build_object('start','03-25','end','06-17'),
'exclude_venues_states', jsonb_build_array('ACT','NT','TAS'),
'market_primary','H2H',
'market_overlay','LINE',
'close_anchor_snapshot_type','T10',
'fav_close_odds_min',1.55,
'fav_close_odds_max',1.85,
'fav_streak_min',2,
'home_must_be_underdog_at_close',true,
'pct_diff_max',25,
'line_overlay_gate', jsonb_build_object(
'enabled',true,
'require_line_clv_positive',true,
'clv_anchor_snapshot_type','T10'
),
'amplifiers', jsonb_build_array(
jsonb_build_object('code','INTERSTATE','desc','Home state ≠ Away state','add_units',0.5),
jsonb_build_object('code','TIGHT_FAV_POCKET','desc','1.65 ≤ Away close odds ≤ 1.80','add_units',0.5)
),
'staking', jsonb_build_object(
'base_units_per_leg',1.0,
'max_units_per_leg',2.0,
'amplifiers_stack',true,
'no_multis',true,
'no_chase',true
),
'process_controls', jsonb_build_array('execute 30–60 mins pre-bounce','do not accept ≥1 point worse than model line','confirm no major late outs')
)
),
(
'SYS_4',
'Line Last 2 Rounds',
'Last 3 rounds. Interstate matchup, major states venues only, opponent ≤4 wins. Favourite LINE. Amplifier doubles stake in final 2 rounds.',
'BANKROLL_PCT',
true,
jsonb_build_object(
'version','clean-final',
'window','Last 3 rounds',
'amplifier_window','Final 2 rounds',
'exclude_seasons', jsonb_build_array(2020,2021),
'market','LINE',
'interstate_required',true,
'venue_states_allowed', jsonb_build_array('VIC','NSW','QLD','SA','WA'),
'opponent_wins_max',4,
'bet_side_rule','FAVOURITE_LINE',
'staking', jsonb_build_object(
'base_bankroll_pct',0.02,
'final_2_rounds_extra_bankroll_pct',0.02,
'max_bankroll_pct',0.04
),
'weather_haircut', jsonb_build_object('wind_kmh_min',25,'heavy_rain',true,'action','halve_or_pass'),
'process_controls', jsonb_build_array('bet near close','track CLV informational','apply weather haircut','no deviation from ≤4 wins rule')
)
),
(
'SYS_5',
'Line Dog',
'Season progress ≥25% (round >= 7). Dog LINE with close H2H 1.95–2.85, positive line CLV, close line > 0. Amplifiers for home dog and interstate travel.',
'BANKROLL_PCT',
true,
jsonb_build_object(
'version','clean-final',
'exclude_seasons', jsonb_build_array(2020,2021),
'season_progress_round_min',7,
'market','LINE',
'dog_required',true,
'h2h_close_min',1.95,
'h2h_close_max',2.85,
'require_line_clv_positive',true,
'clv_anchor_snapshot_type','T10',
'require_close_line_gt_zero',true,
'amplifiers', jsonb_build_array(
jsonb_build_object('code','HOME_DOG','stake_multiplier',1.5),
jsonb_build_object('code','INTERSTATE_TRAVEL','stake_multiplier_min',1.25,'stake_multiplier_max',1.5)
),
'staking', jsonb_build_object(
'base_bankroll_pct',0.01,
'max_bankroll_pct_per_game',0.02
),
'process_controls', jsonb_build_array('bet 30–60 mins pre-bounce','do not lose ≥1 point vs model line','CLV required','weather execution only')
)
),
(
'SYS_6',
'Dog Mid-Season',
'April 1 – July 30. Away dog at OPEN with open odds 3.5–7.0 and CLV ≥ 0.01. H2H open price.',
'BANKROLL_PCT',
true,
jsonb_build_object(
'version','v1.0',
'date_window_aet', jsonb_build_object('start','04-01','end','07-30'),
'market','H2H',
'selection_rule','AWAY_DOG_OPEN',
'open_odds_min',3.5,
'open_odds_max',7.0,
'clv_required',true,
'clv_anchor_snapshot_type','T10',
'clv_min',0.01,
'staking', jsonb_build_object(
'base_bankroll_pct',0.015,
'boost_bankroll_pct',0.02,
'boost_clv_min',0.03
),
'monitoring', jsonb_build_object('approved_live_bankroll_pct_max',0.015,'notes','high variance; monitoring required')
)
),
(
'SYS_7',
'Home Favourite Bounce Escalation',
'Apr 1 – Jul 30. Home favourite at close in 1.50–1.85 band; lost prior match. Tiered staking by recent loss pattern. Close price only (T10).',
'DYNAMIC_PCT',
true,
jsonb_build_object(
'version','locked-v1.1',
'date_window_aet', jsonb_build_object('start','04-01','end','07-30'),
'exclude_seasons', jsonb_build_array(2020,2021),
'market','H2H',
'close_anchor_snapshot_type','T10',
'home_must_be_favourite_at_close',true,
'home_close_odds_min',1.50,
'home_close_odds_max',1.85,
'lost_prior_match_required',true,
'draw_counts_as_loss',true,
'unit_policy', jsonb_build_object('type','DYNAMIC_PCT_OF_BANKROLL','global_1u_pct',0.015,'system_7_1u_pct',0.02),
'tier_units', jsonb_build_object('tier1',1.5,'tier2',2.25,'tier3',3.0),
'no_clv_required',true,
'no_multis',true,
'no_forced_bets',true
)
)
ON CONFLICT (system_code) DO UPDATE SET
name = excluded.name,
description = excluded.description,
staking_policy = excluded.staking_policy,
active = excluded.active,
params = excluded.params;
