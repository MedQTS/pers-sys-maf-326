-- Fix security: enable RLS on pers_sys_venue_state + add policies
alter table public.pers_sys_venue_state enable row level security;

create policy "pers_sys_venue_state_public_read"
on public.pers_sys_venue_state for select
using (true);

create policy "pers_sys_venue_state_service_write"
on public.pers_sys_venue_state for all
using (auth.role() = 'service_role'::text)
with check (auth.role() = 'service_role'::text);

-- Fix search_path on normalize function
create or replace function public.pers_sys_normalize_venue(v text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(v,''), '[^a-zA-Z0-9]+', '', 'g'));
$$;