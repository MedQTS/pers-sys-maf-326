-- Venue → State mapping + team home_state + normalised venue matching
-- Single combined migration (replaces the separate normalisation migration)

-- 1) Venue mapping table (store raw name + normalised key)
create table if not exists public.pers_sys_venue_state (
  venue_name text primary key,
  state text not null check (state in ('VIC','NSW','QLD','SA','WA','TAS','ACT','NT')),
  venue_key text
);

-- 2) Normalisation function (caps + strip punctuation/whitespace)
create or replace function public.pers_sys_normalize_venue(v text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(v,''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

-- 3) Backfill / set venue_key for any existing rows
update public.pers_sys_venue_state
set venue_key = public.pers_sys_normalize_venue(venue_name)
where venue_key is null or venue_key = '';

-- 4) Enforce venue_key presence and uniqueness
alter table public.pers_sys_venue_state
  alter column venue_key set not null;

create unique index if not exists pers_sys_venue_state_venue_key_uq
on public.pers_sys_venue_state (venue_key);

-- 5) Add home_state to teams (for interstate logic)
alter table public.pers_sys_teams
  add column if not exists home_state text
  check (home_state is null or home_state in ('VIC','NSW','QLD','SA','WA','TAS','ACT','NT'));

-- 6) Seed canonical venue rows (store venue_key via normaliser)
insert into public.pers_sys_venue_state (venue_name, state, venue_key) values
  ('Adelaide Oval','SA', public.pers_sys_normalize_venue('Adelaide Oval')),
  ('Barossa Park','SA', public.pers_sys_normalize_venue('Barossa Park')),
  ('Corroboree Group Oval (Manuka)','ACT', public.pers_sys_normalize_venue('Corroboree Group Oval (Manuka)')),
  ('ENGIE Stadium','NSW', public.pers_sys_normalize_venue('ENGIE Stadium')),
  ('Gabba','QLD', public.pers_sys_normalize_venue('Gabba')),
  ('GMHBA Stadium','VIC', public.pers_sys_normalize_venue('GMHBA Stadium')),
  ('Hands Oval','WA', public.pers_sys_normalize_venue('Hands Oval')),
  ('Marvel Stadium','VIC', public.pers_sys_normalize_venue('Marvel Stadium')),
  ('MCG','VIC', public.pers_sys_normalize_venue('MCG')),
  ('Ninja Stadium','TAS', public.pers_sys_normalize_venue('Ninja Stadium')),
  ('Norwood Oval','SA', public.pers_sys_normalize_venue('Norwood Oval')),
  ('Optus Stadium','WA', public.pers_sys_normalize_venue('Optus Stadium')),
  ('People First Stadium','QLD', public.pers_sys_normalize_venue('People First Stadium')),
  ('SCG','NSW', public.pers_sys_normalize_venue('SCG')),
  ('TIO Stadium','NT', public.pers_sys_normalize_venue('TIO Stadium')),
  ('TIO Traeger Park','NT', public.pers_sys_normalize_venue('TIO Traeger Park')),
  ('UTAS Stadium','TAS', public.pers_sys_normalize_venue('UTAS Stadium'))
on conflict (venue_key) do update
set venue_name = excluded.venue_name,
    state = excluded.state;

-- 7) Alias rows (semantic variants Squiggle may emit)
insert into public.pers_sys_venue_state (venue_name, state, venue_key) values
  ('M.C.G.','VIC', public.pers_sys_normalize_venue('M.C.G.')),
  ('Manuka Oval','ACT', public.pers_sys_normalize_venue('Manuka Oval')),
  ('Corroboree Group Oval','ACT', public.pers_sys_normalize_venue('Corroboree Group Oval'))
on conflict (venue_key) do update
set venue_name = excluded.venue_name,
    state = excluded.state;