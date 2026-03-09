create table if not exists public.email_alert_runs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  snapshot_type text not null,
  alert_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists email_alert_runs_unique
on public.email_alert_runs (game_id, snapshot_type, alert_hash);