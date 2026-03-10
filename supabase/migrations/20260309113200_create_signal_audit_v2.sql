-- Ensure pers_sys_signal_audit_v2 exists for evaluator audit upserts
create table if not exists public.pers_sys_signal_audit_v2 (
  id uuid primary key default gen_random_uuid(),

  system_code text not null references public.pers_sys_systems_v2(system_code) on delete cascade,
  game_id uuid not null references public.pers_sys_games(id) on delete cascade,
  season int not null,
  round int null,

  model_snapshot sys_snapshot not null,
  execution_snapshot sys_snapshot not null,
  model_market sys_market not null,
  execution_market sys_market not null,

  audit_status text not null,
  fail_stage text null,
  fail_code text null,

  audit_key text not null,
  leg_type text null,
  side text null,
  line_at_bet numeric null,

  ref_price numeric null,
  exec_best_price numeric null,
  exec_best_book text null,

  recommended_units numeric null,
  recommended_bankroll_pct numeric null,
  staking_contract_version text not null default 'v1_legacy_units',

  reason_json jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pers_sys_signal_audit_v2_uniq
    unique (system_code, game_id, model_snapshot, execution_snapshot, audit_key)
);

create index if not exists pers_sys_signal_audit_v2_game_idx
  on public.pers_sys_signal_audit_v2 (game_id);

create index if not exists pers_sys_signal_audit_v2_status_idx
  on public.pers_sys_signal_audit_v2 (audit_status);

create index if not exists pers_sys_signal_audit_v2_eval_idx
  on public.pers_sys_signal_audit_v2 (evaluated_at desc);

alter table public.pers_sys_signal_audit_v2 enable row level security;

do $$ begin
  create policy "public read signal audit v2"
  on public.pers_sys_signal_audit_v2 for select
  using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service role write signal audit v2"
  on public.pers_sys_signal_audit_v2 for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

drop trigger if exists pers_sys_signal_audit_v2_updated_at on public.pers_sys_signal_audit_v2;
create trigger pers_sys_signal_audit_v2_updated_at
before update on public.pers_sys_signal_audit_v2
for each row execute function public.pers_sys_handle_updated_at();
