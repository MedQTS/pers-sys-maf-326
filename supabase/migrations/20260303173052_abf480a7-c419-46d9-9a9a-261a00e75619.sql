alter table public.pers_sys_season_meta
add column if not exists gf_runner_up_team_id uuid;

create index if not exists pers_sys_season_meta_gf_runner_up_idx
on public.pers_sys_season_meta (gf_runner_up_team_id);