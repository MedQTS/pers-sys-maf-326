-- Canonical staking contract fields (v2)
-- Keep recommended_units for backward compatibility.

alter table if exists public.pers_sys_signals_v2
  add column if not exists recommended_bankroll_pct numeric null;

alter table if exists public.pers_sys_signals_v2
  add column if not exists staking_contract_version text not null default 'v1_legacy_units';

do $$
begin
  if to_regclass('public.pers_sys_signal_audit_v2') is not null then
    execute 'alter table public.pers_sys_signal_audit_v2 add column if not exists recommended_bankroll_pct numeric null';
    execute 'alter table public.pers_sys_signal_audit_v2 add column if not exists staking_contract_version text not null default ''v1_legacy_units''';
  end if;
end $$;

create index if not exists pers_sys_signals_v2_staking_contract_version_idx
  on public.pers_sys_signals_v2 (staking_contract_version);
