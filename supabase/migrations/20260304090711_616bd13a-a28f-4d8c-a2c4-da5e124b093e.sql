
-- =========================================================
-- ENUM TYPES
-- =========================================================

create type sys_market as enum (
  'H2H',
  'LINE'
);

create type sys_snapshot as enum (
  'OPEN',
  'T30',
  'T10'
);

create type sys_signal_mode as enum (
  'HARD_FAIL',
  'ALLOW_CANDIDATE'
);


-- =========================================================
-- SYSTEM CONFIG TABLE (V2)
-- =========================================================

create table pers_sys_systems_v2 (

  -- identity
  system_code text primary key,
  system_name text not null,

  -- activation
  active boolean default true,

  -- classification
  system_group text,
  system_priority int default 100,
  evaluation_version int default 1,

  -- markets
  primary_market sys_market not null,
  overlay_market sys_market,

  -- execution vs modelling
  execution_snapshot sys_snapshot not null,
  model_snapshot sys_snapshot not null,

  -- signal behaviour
  allow_candidate boolean default true,

  -- time / season gates
  round_min int,
  round_max int,
  rounds_remaining_min int,
  rounds_remaining_max int,
  season_progress_round_min int,
  date_start_mmdd text,
  date_end_mmdd text,
  exclude_seasons int[],

  -- team / favourite conditions
  require_home_favourite boolean,
  require_home_dog boolean,
  require_away_dog boolean,
  gf_winner_required boolean,
  gf_winner_must_be_favourite_open boolean,
  exclude_gf_replay boolean,

  -- odds bands
  open_odds_min numeric,
  open_odds_max numeric,
  close_odds_min numeric,
  close_odds_max numeric,
  fav_close_odds_min numeric,
  fav_close_odds_max numeric,
  dog_close_odds_min numeric,
  dog_close_odds_max numeric,

  -- CLV rules
  clv_required boolean,
  clv_min numeric,
  line_clv_required boolean,
  line_clv_positive_required boolean,

  -- ladder logic
  dead_team_points_behind_8th_min int,
  opponent_must_be_top8 boolean,
  opponent_wins_max int,

  -- team form rules
  fav_streak_min int,
  loss_streak_required boolean,
  draw_counts_as_loss boolean,

  -- venue / travel rules
  interstate_required boolean,
  venue_states_allowed text[],
  exclude_states text[],

  -- line rules
  require_close_line_gt_zero boolean,

  -- configurable structures
  staking_config jsonb,
  amplifier_config jsonb,
  overlay_config jsonb,

  -- metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- RLS
-- =========================================================

alter table pers_sys_systems_v2 enable row level security;

create policy "pers_sys_systems_v2_public_read"
  on pers_sys_systems_v2
  for select
  using (true);

create policy "pers_sys_systems_v2_service_write"
  on pers_sys_systems_v2
  for all
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================

create trigger pers_sys_systems_v2_updated_at
  before update on pers_sys_systems_v2
  for each row
  execute function pers_sys_handle_updated_at();
