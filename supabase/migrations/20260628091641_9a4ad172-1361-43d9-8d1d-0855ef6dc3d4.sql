
-- =========================================================
-- Pers Sys Weather Subsystem — Phase 1 (additive, isolated)
-- =========================================================

-- 1. Extend systems_v2 with weather config columns
ALTER TABLE public.pers_sys_systems_v2
  ADD COLUMN IF NOT EXISTS weather_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weather_policy_code text,
  ADD COLUMN IF NOT EXISTS weather_gate_snapshot text;

-- Seed weather config for existing rows (SYS_10A has no systems_v2 row by design;
-- the assess function falls back to an internal policy map for SYS_10A).
UPDATE public.pers_sys_systems_v2
   SET weather_enabled = true,
       weather_policy_code = 'WX_SYS4_STD',
       weather_gate_snapshot = 'T30'
 WHERE system_code = 'SYS_4';

UPDATE public.pers_sys_systems_v2
   SET weather_enabled = true,
       weather_policy_code = 'WX_SYS8_TOTALS_OVER_STD',
       weather_gate_snapshot = 'T30'
 WHERE system_code = 'SYS_8';

-- =========================================================
-- 2. pers_sys_venues — canonical AFL venue lookup
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pers_sys_venues (
  venue_code text PRIMARY KEY,
  display_name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  is_outdoor boolean NOT NULL,
  match_duration_minutes int NOT NULL DEFAULT 150,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pers_sys_venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pers_sys_venues TO authenticated;
GRANT ALL ON public.pers_sys_venues TO service_role;

ALTER TABLE public.pers_sys_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pers_sys_venues_public_read"
  ON public.pers_sys_venues FOR SELECT
  USING (true);

CREATE POLICY "pers_sys_venues_authenticated_write"
  ON public.pers_sys_venues FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER pers_sys_venues_updated_at
  BEFORE UPDATE ON public.pers_sys_venues
  FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();

-- Seed canonical AFL venues
INSERT INTO public.pers_sys_venues
  (venue_code, display_name, latitude, longitude, is_outdoor) VALUES
  ('MCG',            'Melbourne Cricket Ground',  -37.81995, 144.98345, true),
  ('MARVEL',         'Marvel Stadium',            -37.81655, 144.94755, false),
  ('ADELAIDE_OVAL',  'Adelaide Oval',             -34.91556, 138.59611, true),
  ('PERTH_STADIUM',  'Optus Stadium',             -31.95108, 115.88898, true),
  ('GABBA',          'The Gabba',                 -27.48586, 153.03811, true),
  ('SCG',            'Sydney Cricket Ground',     -33.89175, 151.22468, true),
  ('ENGIE',          'ENGIE Stadium',             -33.84306, 151.06556, true),
  ('GMHBA',          'GMHBA Stadium',             -38.15806, 144.35444, true),
  ('MARS',           'Mars Stadium',              -37.52972, 143.83472, true),
  ('MANUKA',         'Manuka Oval',               -35.31833, 149.13472, true),
  ('TIO',            'TIO Stadium',               -12.39972, 130.88694, true),
  ('TIO_TRAEGER',    'TIO Traeger Park',          -23.70472, 133.87000, true),
  ('BLUNDSTONE',     'Blundstone Arena',          -42.87750, 147.37500, true),
  ('UTAS',           'UTAS Stadium',              -41.42583, 147.13889, true),
  ('NORWOOD',        'Norwood Oval',              -34.91917, 138.63111, true),
  ('CAZALYS',        'Cazalys Stadium',           -16.93333, 145.74944, true)
ON CONFLICT (venue_code) DO NOTHING;

-- =========================================================
-- 3. pers_sys_venue_aliases — raw venue string -> venue_code
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pers_sys_venue_aliases (
  raw_venue_norm text PRIMARY KEY,
  raw_venue text NOT NULL,
  venue_code text NOT NULL REFERENCES public.pers_sys_venues(venue_code),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pers_sys_venue_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pers_sys_venue_aliases TO authenticated;
GRANT ALL ON public.pers_sys_venue_aliases TO service_role;

ALTER TABLE public.pers_sys_venue_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pers_sys_venue_aliases_public_read"
  ON public.pers_sys_venue_aliases FOR SELECT USING (true);

CREATE POLICY "pers_sys_venue_aliases_authenticated_write"
  ON public.pers_sys_venue_aliases FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER pers_sys_venue_aliases_updated_at
  BEFORE UPDATE ON public.pers_sys_venue_aliases
  FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();

-- Seed aliases. raw_venue_norm uses public.pers_sys_normalize_venue.
INSERT INTO public.pers_sys_venue_aliases (raw_venue_norm, raw_venue, venue_code) VALUES
  (public.pers_sys_normalize_venue('MCG'), 'MCG', 'MCG'),
  (public.pers_sys_normalize_venue('M.C.G.'), 'M.C.G.', 'MCG'),
  (public.pers_sys_normalize_venue('Melbourne Cricket Ground'), 'Melbourne Cricket Ground', 'MCG'),
  (public.pers_sys_normalize_venue('Marvel Stadium'), 'Marvel Stadium', 'MARVEL'),
  (public.pers_sys_normalize_venue('Marvel'), 'Marvel', 'MARVEL'),
  (public.pers_sys_normalize_venue('Docklands'), 'Docklands', 'MARVEL'),
  (public.pers_sys_normalize_venue('Docklands Stadium'), 'Docklands Stadium', 'MARVEL'),
  (public.pers_sys_normalize_venue('Etihad Stadium'), 'Etihad Stadium', 'MARVEL'),
  (public.pers_sys_normalize_venue('Adelaide Oval'), 'Adelaide Oval', 'ADELAIDE_OVAL'),
  (public.pers_sys_normalize_venue('Perth Stadium'), 'Perth Stadium', 'PERTH_STADIUM'),
  (public.pers_sys_normalize_venue('Optus Stadium'), 'Optus Stadium', 'PERTH_STADIUM'),
  (public.pers_sys_normalize_venue('The Gabba'), 'The Gabba', 'GABBA'),
  (public.pers_sys_normalize_venue('Gabba'), 'Gabba', 'GABBA'),
  (public.pers_sys_normalize_venue('Brisbane Cricket Ground'), 'Brisbane Cricket Ground', 'GABBA'),
  (public.pers_sys_normalize_venue('SCG'), 'SCG', 'SCG'),
  (public.pers_sys_normalize_venue('Sydney Cricket Ground'), 'Sydney Cricket Ground', 'SCG'),
  (public.pers_sys_normalize_venue('ENGIE Stadium'), 'ENGIE Stadium', 'ENGIE'),
  (public.pers_sys_normalize_venue('Sydney Showground'), 'Sydney Showground', 'ENGIE'),
  (public.pers_sys_normalize_venue('Sydney Showground Stadium'), 'Sydney Showground Stadium', 'ENGIE'),
  (public.pers_sys_normalize_venue('Giants Stadium'), 'Giants Stadium', 'ENGIE'),
  (public.pers_sys_normalize_venue('GMHBA Stadium'), 'GMHBA Stadium', 'GMHBA'),
  (public.pers_sys_normalize_venue('Kardinia Park'), 'Kardinia Park', 'GMHBA'),
  (public.pers_sys_normalize_venue('Simonds Stadium'), 'Simonds Stadium', 'GMHBA'),
  (public.pers_sys_normalize_venue('Mars Stadium'), 'Mars Stadium', 'MARS'),
  (public.pers_sys_normalize_venue('Eureka Stadium'), 'Eureka Stadium', 'MARS'),
  (public.pers_sys_normalize_venue('Manuka Oval'), 'Manuka Oval', 'MANUKA'),
  (public.pers_sys_normalize_venue('TIO Stadium'), 'TIO Stadium', 'TIO'),
  (public.pers_sys_normalize_venue('Marrara Oval'), 'Marrara Oval', 'TIO'),
  (public.pers_sys_normalize_venue('TIO Traeger Park'), 'TIO Traeger Park', 'TIO_TRAEGER'),
  (public.pers_sys_normalize_venue('Traeger Park'), 'Traeger Park', 'TIO_TRAEGER'),
  (public.pers_sys_normalize_venue('Blundstone Arena'), 'Blundstone Arena', 'BLUNDSTONE'),
  (public.pers_sys_normalize_venue('Bellerive Oval'), 'Bellerive Oval', 'BLUNDSTONE'),
  (public.pers_sys_normalize_venue('UTAS Stadium'), 'UTAS Stadium', 'UTAS'),
  (public.pers_sys_normalize_venue('York Park'), 'York Park', 'UTAS'),
  (public.pers_sys_normalize_venue('Norwood Oval'), 'Norwood Oval', 'NORWOOD'),
  (public.pers_sys_normalize_venue('Coopers Stadium'), 'Coopers Stadium', 'NORWOOD'),
  (public.pers_sys_normalize_venue('Cazalys Stadium'), 'Cazalys Stadium', 'CAZALYS')
ON CONFLICT (raw_venue_norm) DO NOTHING;

-- =========================================================
-- 4. pers_sys_weather_snapshots — normalized facts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pers_sys_weather_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  snapshot_stage text NOT NULL CHECK (snapshot_stage IN ('T30','T10')),
  source text NOT NULL DEFAULT 'open-meteo',
  venue_code text REFERENCES public.pers_sys_venues(venue_code),
  is_outdoor boolean,
  window_start_utc timestamptz NOT NULL,
  window_end_utc timestamptz NOT NULL,
  wind_kmh_max numeric,
  gust_kmh_max numeric,
  rain_mm_total numeric,
  hours_matched int,
  raw_payload jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pers_sys_weather_snapshots_unique UNIQUE (game_id, snapshot_stage, source)
);

CREATE INDEX IF NOT EXISTS pers_sys_weather_snapshots_game_stage_idx
  ON public.pers_sys_weather_snapshots (game_id, snapshot_stage);

GRANT SELECT ON public.pers_sys_weather_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pers_sys_weather_snapshots TO authenticated;
GRANT ALL ON public.pers_sys_weather_snapshots TO service_role;

ALTER TABLE public.pers_sys_weather_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pers_sys_weather_snapshots_public_read"
  ON public.pers_sys_weather_snapshots FOR SELECT USING (true);

CREATE POLICY "pers_sys_weather_snapshots_authenticated_write"
  ON public.pers_sys_weather_snapshots FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER pers_sys_weather_snapshots_updated_at
  BEFORE UPDATE ON public.pers_sys_weather_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();

-- =========================================================
-- 5. pers_sys_weather_assessments — per-system verdicts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pers_sys_weather_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.pers_sys_games(id) ON DELETE CASCADE,
  system_code text NOT NULL,
  policy_code text NOT NULL,
  assessment_stage text NOT NULL CHECK (assessment_stage IN ('T30','T10')),
  outcome text NOT NULL CHECK (outcome IN ('FULL_STAKE','HALF_STAKE','PASS','NOT_APPLICABLE')),
  reason_code text,
  wind_kmh_max numeric,
  gust_kmh_max numeric,
  rain_mm_total numeric,
  weather_snapshot_id uuid REFERENCES public.pers_sys_weather_snapshots(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pers_sys_weather_assessments_unique UNIQUE (game_id, system_code, assessment_stage)
);

CREATE INDEX IF NOT EXISTS pers_sys_weather_assessments_game_idx
  ON public.pers_sys_weather_assessments (game_id, system_code);

GRANT SELECT ON public.pers_sys_weather_assessments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pers_sys_weather_assessments TO authenticated;
GRANT ALL ON public.pers_sys_weather_assessments TO service_role;

ALTER TABLE public.pers_sys_weather_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pers_sys_weather_assessments_public_read"
  ON public.pers_sys_weather_assessments FOR SELECT USING (true);

CREATE POLICY "pers_sys_weather_assessments_authenticated_write"
  ON public.pers_sys_weather_assessments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER pers_sys_weather_assessments_updated_at
  BEFORE UPDATE ON public.pers_sys_weather_assessments
  FOR EACH ROW EXECUTE FUNCTION public.pers_sys_handle_updated_at();
