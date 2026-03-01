
-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE public.pers_sys_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text UNIQUE NOT NULL,
  squiggle_name text,
  oddsapi_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pers_sys_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_teams_public_read" ON public.pers_sys_teams FOR SELECT USING (true);
CREATE POLICY "pers_sys_teams_service_write" ON public.pers_sys_teams FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- GAMES
-- ============================================================
CREATE TABLE public.pers_sys_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season int NOT NULL,
  round int,
  start_time_aet timestamptz NOT NULL,
  venue text,
  home_team_id uuid NOT NULL REFERENCES public.pers_sys_teams(id),
  away_team_id uuid NOT NULL REFERENCES public.pers_sys_teams(id),
  status text NOT NULL DEFAULT 'SCHEDULED',
  home_score int,
  away_score int,
  margin_home int,
  winner_team_id uuid REFERENCES public.pers_sys_teams(id),
  loser_team_id uuid REFERENCES public.pers_sys_teams(id),
  is_draw boolean NOT NULL DEFAULT false,
  squiggle_game_id text UNIQUE,
  oddsapi_event_id text,
  game_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pers_sys_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_games_public_read" ON public.pers_sys_games FOR SELECT USING (true);
CREATE POLICY "pers_sys_games_service_write" ON public.pers_sys_games FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_pers_sys_games_season_time ON public.pers_sys_games (season, start_time_aet);
CREATE INDEX idx_pers_sys_games_season_round ON public.pers_sys_games (season, round);
CREATE INDEX idx_pers_sys_games_home ON public.pers_sys_games (home_team_id, season);
CREATE INDEX idx_pers_sys_games_away ON public.pers_sys_games (away_team_id, season);

-- ============================================================
-- TEAM STATE (entering-match derived features)
-- ============================================================
CREATE TABLE public.pers_sys_team_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.pers_sys_teams(id) ON DELETE CASCADE,
  season int NOT NULL,
  round int,
  asof_ts timestamptz NOT NULL,
  played int NOT NULL,
  wins int NOT NULL,
  losses int NOT NULL,
  draws int NOT NULL,
  points_for int NOT NULL,
  points_against int NOT NULL,
  percentage numeric NOT NULL,
  streak int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, team_id)
);
ALTER TABLE public.pers_sys_team_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_team_state_public_read" ON public.pers_sys_team_state FOR SELECT USING (true);
CREATE POLICY "pers_sys_team_state_service_write" ON public.pers_sys_team_state FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- ROUND CONTEXT (dead-team primitives)
-- ============================================================
CREATE TABLE public.pers_sys_round_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season int NOT NULL,
  round int NOT NULL,
  asof_ts timestamptz NOT NULL,
  points_8th int NOT NULL,
  percentage_8th numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, round)
);
ALTER TABLE public.pers_sys_round_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_round_context_public_read" ON public.pers_sys_round_context FOR SELECT USING (true);
CREATE POLICY "pers_sys_round_context_service_write" ON public.pers_sys_round_context FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- MARKET SNAPSHOTS
-- ============================================================
CREATE TABLE public.pers_sys_market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL,
  snapshot_ts timestamptz NOT NULL,
  market_type text NOT NULL,
  agg_method text NOT NULL DEFAULT 'MEDIAN',
  books_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  home_price numeric,
  away_price numeric,
  home_line numeric,
  away_line numeric,
  home_line_price numeric,
  away_line_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, snapshot_type, market_type, agg_method)
);
ALTER TABLE public.pers_sys_market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_market_snapshots_public_read" ON public.pers_sys_market_snapshots FOR SELECT USING (true);
CREATE POLICY "pers_sys_market_snapshots_service_write" ON public.pers_sys_market_snapshots FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SYSTEMS REGISTRY
-- ============================================================
CREATE TABLE public.pers_sys_systems (
  system_code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  staking_policy text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pers_sys_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_systems_public_read" ON public.pers_sys_systems FOR SELECT USING (true);
CREATE POLICY "pers_sys_systems_service_write" ON public.pers_sys_systems FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SIGNALS
-- ============================================================
CREATE TABLE public.pers_sys_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code text NOT NULL REFERENCES public.pers_sys_systems(system_code),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL,
  pass boolean NOT NULL,
  reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_code, game_id, snapshot_type)
);
ALTER TABLE public.pers_sys_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_signals_public_read" ON public.pers_sys_signals FOR SELECT USING (true);
CREATE POLICY "pers_sys_signals_service_write" ON public.pers_sys_signals FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- BETS
-- ============================================================
CREATE TABLE public.pers_sys_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_code text NOT NULL REFERENCES public.pers_sys_systems(system_code),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  leg_type text NOT NULL,
  placed_ts timestamptz NOT NULL,
  side text NOT NULL,
  line_at_bet numeric,
  price numeric NOT NULL,
  units numeric NOT NULL,
  result text,
  profit_units numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pers_sys_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_bets_public_read" ON public.pers_sys_bets FOR SELECT USING (true);
CREATE POLICY "pers_sys_bets_public_write" ON public.pers_sys_bets FOR INSERT WITH CHECK (true);
CREATE POLICY "pers_sys_bets_public_update" ON public.pers_sys_bets FOR UPDATE USING (true);
CREATE POLICY "pers_sys_bets_service_write" ON public.pers_sys_bets FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_pers_sys_bets_system_ts ON public.pers_sys_bets (system_code, placed_ts);

-- ============================================================
-- SEASON META
-- ============================================================
CREATE TABLE public.pers_sys_season_meta (
  season int PRIMARY KEY,
  gf_winner_team_id uuid NOT NULL REFERENCES public.pers_sys_teams(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pers_sys_season_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pers_sys_season_meta_public_read" ON public.pers_sys_season_meta FOR SELECT USING (true);
CREATE POLICY "pers_sys_season_meta_service_write" ON public.pers_sys_season_meta FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- SEED: AFL Teams
-- ============================================================
INSERT INTO public.pers_sys_teams (canonical_name, squiggle_name) VALUES
  ('Adelaide', 'Adelaide'),
  ('Brisbane Lions', 'Brisbane Lions'),
  ('Carlton', 'Carlton'),
  ('Collingwood', 'Collingwood'),
  ('Essendon', 'Essendon'),
  ('Fremantle', 'Fremantle'),
  ('Geelong', 'Geelong'),
  ('Gold Coast', 'Gold Coast'),
  ('GWS', 'Greater Western Sydney'),
  ('Hawthorn', 'Hawthorn'),
  ('Melbourne', 'Melbourne'),
  ('North Melbourne', 'North Melbourne'),
  ('Port Adelaide', 'Port Adelaide'),
  ('Richmond', 'Richmond'),
  ('St Kilda', 'St Kilda'),
  ('Sydney', 'Sydney'),
  ('West Coast', 'West Coast'),
  ('Western Bulldogs', 'Western Bulldogs');

-- ============================================================
-- SEED: Systems
-- ============================================================
INSERT INTO public.pers_sys_systems (system_code, name, active, locked, staking_policy, params) VALUES
  ('SYS_3', 'Form Dog', true, true, 'CLV_SCALE', '{"rounds_min":3,"rounds_max":14,"exclude_seasons":[2020,2021],"pct_diff_max":25,"fav_streak_min":2,"fav_close_odds_min":1.55,"clv_plus_1":0.05,"clv_plus_2":0.10,"cap_units":3}'::jsonb),
  ('SYS_2', 'GF Winner Early Fade', true, false, 'CLV_SCALE', '{"rounds_min":1,"rounds_max":5,"exclude_seasons":[2021,2022],"gf_winner_open_h2h_min":1.25,"clv_plus_1":0.05,"clv_plus_2":0.10,"cap_units":3}'::jsonb),
  ('SYS_1', 'Dead Teams CLV', true, false, 'CLV_CONFIRM', '{"late_season":true}'::jsonb);

-- ============================================================
-- SEED: Season meta (Brisbane = 2024 GF winner)
-- ============================================================
INSERT INTO public.pers_sys_season_meta (season, gf_winner_team_id)
  SELECT 2024, id FROM public.pers_sys_teams WHERE canonical_name = 'Brisbane Lions';

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.pers_sys_handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER pers_sys_teams_updated_at BEFORE UPDATE ON public.pers_sys_teams FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
CREATE TRIGGER pers_sys_games_updated_at BEFORE UPDATE ON public.pers_sys_games FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
CREATE TRIGGER pers_sys_systems_updated_at BEFORE UPDATE ON public.pers_sys_systems FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
CREATE TRIGGER pers_sys_season_meta_updated_at BEFORE UPDATE ON public.pers_sys_season_meta FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
CREATE TRIGGER pers_sys_team_state_updated_at BEFORE UPDATE ON public.pers_sys_team_state FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
CREATE TRIGGER pers_sys_round_context_updated_at BEFORE UPDATE ON public.pers_sys_round_context FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
