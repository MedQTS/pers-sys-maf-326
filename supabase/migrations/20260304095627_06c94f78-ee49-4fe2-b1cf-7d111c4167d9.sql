
-- pers_sys_signals_v2: built for READY/PENDING/MADE/IN_PLAY UI and v2 evaluator semantics

-- 1) Enums (if you already have some, keep only the missing ones)
do $$ begin
  create type sys_signal_status as enum ('PENDING','READY','MADE','IN_PLAY','SETTLED','CANCELLED','DROPPED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sys_leg_type as enum ('H2H','LINE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sys_side as enum ('HOME','AWAY');
exception when duplicate_object then null; end $$;

-- 2) Table
create table if not exists pers_sys_signals_v2 (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  system_code text not null references pers_sys_systems_v2(system_code) on delete cascade,
  game_id uuid not null references pers_sys_games(id) on delete cascade,

  -- Snapshots (separate model vs execution)
  model_snapshot sys_snapshot not null,
  execution_snapshot sys_snapshot not null,

  -- Markets
  model_market sys_market not null,
  execution_market sys_market not null,

  -- Pass/fail of the full rule-set at evaluation time
  pass boolean not null default false,

  -- UI lifecycle
  signal_status sys_signal_status not null default 'PENDING',

  -- Optional linking: overlays / amplifiers as children of a parent "base" signal
  parent_signal_id uuid null references pers_sys_signals_v2(id) on delete cascade,

  -- What to bet (single-leg representation)
  leg_type sys_leg_type not null,
  side sys_side not null,
  line_at_bet numeric null,

  -- Prices (ref vs best-exec)
  ref_price numeric null,
  exec_best_price numeric null,
  exec_best_book text null,

  -- Sizing
  recommended_units numeric null,

  -- Explainability (JSONB)
  reason_json jsonb not null default '{}'::jsonb,

  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Uniqueness
  constraint pers_sys_signals_v2_uniq unique (system_code, game_id, execution_snapshot, leg_type, side)
);

-- 3) Indexes for UI queries
create index if not exists pers_sys_signals_v2_game_idx on pers_sys_signals_v2(game_id);
create index if not exists pers_sys_signals_v2_status_idx on pers_sys_signals_v2(signal_status);
create index if not exists pers_sys_signals_v2_eval_idx on pers_sys_signals_v2(evaluated_at desc);

-- 4) RLS
alter table pers_sys_signals_v2 enable row level security;

do $$ begin
  create policy "public read signals v2"
  on pers_sys_signals_v2 for select
  using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service role write signals v2"
  on pers_sys_signals_v2 for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

-- 5) updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_pers_sys_signals_v2_updated_at on pers_sys_signals_v2;
create trigger trg_pers_sys_signals_v2_updated_at
before update on pers_sys_signals_v2
for each row execute function set_updated_at();
