
-- 1) Table: per-system cascade priority (separate PK, system_code unique)
create table if not exists public.pers_sys_system_priority (
  id uuid primary key default gen_random_uuid(),
  system_code text not null,
  rank int not null,
  dominates_match boolean not null default false,
  allow_stack boolean not null default false,
  max_exposure_pct numeric null,
  tie_break jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pers_sys_system_priority_system_code_uk unique (system_code),
  constraint pers_sys_system_priority_system_code_fk
    foreign key (system_code)
    references public.pers_sys_systems (system_code)
    on update cascade
    on delete cascade
);

create index if not exists pers_sys_system_priority_rank_idx
  on public.pers_sys_system_priority (rank);

-- 2) updated_at trigger
drop trigger if exists pers_sys_system_priority_updated_at on public.pers_sys_system_priority;
create trigger pers_sys_system_priority_updated_at
  before update on public.pers_sys_system_priority
  for each row execute function public.pers_sys_handle_updated_at();

-- 3) RLS
alter table public.pers_sys_system_priority enable row level security;

create policy "pers_sys_system_priority_public_read"
  on public.pers_sys_system_priority for select
  using (true);

create policy "pers_sys_system_priority_service_write"
  on public.pers_sys_system_priority for all
  to service_role
  using (true)
  with check (true);

-- 4) Seed canonical cascade order
with seed(system_code, rank, dominates_match) as (
  values
    ('SYS_7', 1, true),
    ('SYS_6', 2, false),
    ('SYS_5', 3, false),
    ('SYS_3', 4, false),
    ('SYS_4', 5, false),
    ('SYS_1', 6, false),
    ('SYS_2', 7, false)
)
insert into public.pers_sys_system_priority (system_code, rank, dominates_match)
select s.system_code, seed.rank, seed.dominates_match
from seed
join public.pers_sys_systems s using (system_code)
on conflict (system_code)
do update set
  rank = excluded.rank,
  dominates_match = excluded.dominates_match,
  updated_at = now();
