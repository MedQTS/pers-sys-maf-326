
-- SYS_1: remaining 3–7 rounds
UPDATE public.pers_sys_systems_v2
SET rounds_remaining_min = 3, rounds_remaining_max = 7, round_min = null, round_max = null, updated_at = now()
WHERE system_code = 'SYS_1';

-- SYS_4: last 3 rounds (remaining 1–3)
UPDATE public.pers_sys_systems_v2
SET rounds_remaining_min = 1, rounds_remaining_max = 3, round_min = null, round_max = null, updated_at = now()
WHERE system_code = 'SYS_4';

-- SYS_2: exclude only 2020–2021
UPDATE public.pers_sys_systems_v2
SET exclude_seasons = array[2020, 2021]::int[], updated_at = now()
WHERE system_code = 'SYS_2';

-- Defensive: strip 2022 from any system's exclude_seasons
UPDATE public.pers_sys_systems_v2
SET exclude_seasons = array_remove(exclude_seasons, 2022), updated_at = now()
WHERE exclude_seasons IS NOT NULL AND 2022 = any(exclude_seasons);
