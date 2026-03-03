-- Add missing historical/alternate Squiggle venue aliases to ensure venue→state joins never return NULL.

insert into public.pers_sys_venue_state (venue_name, state, venue_key) values
  ('Docklands','VIC', public.pers_sys_normalize_venue('Docklands')),
  ('Kardinia Park','VIC', public.pers_sys_normalize_venue('Kardinia Park')),
  ('Perth Stadium','WA', public.pers_sys_normalize_venue('Perth Stadium')),
  ('Sydney Showground','NSW', public.pers_sys_normalize_venue('Sydney Showground')),
  ('Carrara','QLD', public.pers_sys_normalize_venue('Carrara')),
  ('York Park','TAS', public.pers_sys_normalize_venue('York Park')),
  ('Bellerive Oval','TAS', public.pers_sys_normalize_venue('Bellerive Oval')),
  ('Marrara Oval','NT', public.pers_sys_normalize_venue('Marrara Oval')),
  ('Eureka Stadium','VIC', public.pers_sys_normalize_venue('Eureka Stadium')),
  ('Traeger Park','NT', public.pers_sys_normalize_venue('Traeger Park'))
on conflict (venue_key) do update
set venue_name = excluded.venue_name,
    state = excluded.state;