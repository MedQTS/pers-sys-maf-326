-- Item 4 remediation: align priority governance FK with evaluator registry (v2).

-- Remove any orphan priority rows before validating FK against v2.
delete from public.pers_sys_system_priority p
where not exists (
  select 1
  from public.pers_sys_systems_v2 s2
  where s2.system_code = p.system_code
);

alter table public.pers_sys_system_priority
  drop constraint if exists pers_sys_system_priority_system_code_fk;

alter table public.pers_sys_system_priority
  add constraint pers_sys_system_priority_system_code_fk
  foreign key (system_code)
  references public.pers_sys_systems_v2 (system_code)
  on update cascade
  on delete cascade;

-- Keep existing priority behavior; just ensure canonical seed alignment uses v2 registry.
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
select s2.system_code, seed.rank, seed.dominates_match
from seed
join public.pers_sys_systems_v2 s2 using (system_code)
on conflict (system_code)
do update set
  rank = excluded.rank,
  dominates_match = excluded.dominates_match,
  updated_at = now();
