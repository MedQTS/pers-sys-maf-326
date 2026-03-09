create table if not exists public.pers_sys_watcher_runs (
  id uuid primary key default gen_random_uuid(),

  game_id uuid null,
  watch_type text not null,
  run_status text not null default 'STARTED',

  trigger_source text not null default 'manual',
  dedupe_key text not null,

  note text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists pers_sys_watcher_runs_lookup_idx
  on public.pers_sys_watcher_runs (watch_type, started_at desc);

create index if not exists pers_sys_watcher_runs_game_idx
  on public.pers_sys_watcher_runs (game_id, started_at desc);

create unique index if not exists pers_sys_watcher_runs_dedupe_idx
  on public.pers_sys_watcher_runs (dedupe_key);