create table if not exists public.pers_sys_execution_failures (
  id uuid primary key default gen_random_uuid(),

  game_id uuid not null,
  system_code text null,
  leg_type text null,
  side text null,
  line_at_bet numeric null,

  expected_action_at timestamptz null,
  market_snapshot_type text null,

  failure_type text not null,
  caused_by_run_id uuid null references public.pers_sys_watcher_runs(id) on delete set null,

  note_short text null,
  resolved boolean not null default false,
  resolved_at timestamptz null,

  created_at timestamptz not null default now()
);

create index if not exists pers_sys_execution_failures_lookup_idx
  on public.pers_sys_execution_failures (failure_type, created_at desc);

create index if not exists pers_sys_execution_failures_game_idx
  on public.pers_sys_execution_failures (game_id, created_at desc);

create index if not exists pers_sys_execution_failures_unresolved_idx
  on public.pers_sys_execution_failures (resolved, created_at desc);