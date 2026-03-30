-- Config-only remediation: backfill missing/invalid one-unit calibration keys.
-- Policy basis (interim):
--   global_1u_pct = 0.015 for active systems
--   system_7_1u_pct = 0.02 for SYS_7 only
-- Predicate-guarded and idempotent; no RPC logic changes.

update public.pers_sys_systems_v2
set
  staking_config = jsonb_set(
    coalesce(staking_config, '{}'::jsonb),
    '{global_1u_pct}',
    to_jsonb(0.015::numeric),
    true
  ),
  updated_at = now()
where active = true
  and (
    not (coalesce(staking_config, '{}'::jsonb) ? 'global_1u_pct')
    or nullif(trim(coalesce(staking_config ->> 'global_1u_pct', '')), '') is null
    or trim(coalesce(staking_config ->> 'global_1u_pct', '')) !~ '^[0-9]+(\.[0-9]+)?$'
    or (
      trim(coalesce(staking_config ->> 'global_1u_pct', '')) ~ '^[0-9]+(\.[0-9]+)?$'
      and (trim(coalesce(staking_config ->> 'global_1u_pct', '')))::numeric <= 0
    )
  );

update public.pers_sys_systems_v2
set
  staking_config = jsonb_set(
    coalesce(staking_config, '{}'::jsonb),
    '{system_7_1u_pct}',
    to_jsonb(0.02::numeric),
    true
  ),
  updated_at = now()
where active = true
  and system_code = 'SYS_7'
  and (
    not (coalesce(staking_config, '{}'::jsonb) ? 'system_7_1u_pct')
    or nullif(trim(coalesce(staking_config ->> 'system_7_1u_pct', '')), '') is null
    or trim(coalesce(staking_config ->> 'system_7_1u_pct', '')) !~ '^[0-9]+(\.[0-9]+)?$'
    or (
      trim(coalesce(staking_config ->> 'system_7_1u_pct', '')) ~ '^[0-9]+(\.[0-9]+)?$'
      and (trim(coalesce(staking_config ->> 'system_7_1u_pct', '')))::numeric <= 0
    )
  );
