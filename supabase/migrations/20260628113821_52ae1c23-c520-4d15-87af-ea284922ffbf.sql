ALTER TABLE public.pers_sys_systems_v2
  ADD COLUMN IF NOT EXISTS weather_active_decisioning_enabled boolean NOT NULL DEFAULT false;