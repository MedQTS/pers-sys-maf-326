-- Item 2 remediation: align schema with evaluator reads for collision_rank.

alter table if exists public.pers_sys_system_priority
  add column if not exists collision_rank int null;

-- Deterministic backfill for currently active systems:
-- use existing rank so collision ordering remains unchanged.
update public.pers_sys_system_priority p
set collision_rank = p.rank
from public.pers_sys_systems s
where p.system_code = s.system_code
  and s.active = true
  and p.collision_rank is null;
