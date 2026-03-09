create table if not exists public.email_alert_items (
  id uuid primary key default gen_random_uuid(),

  game_id uuid not null,
  snapshot_type text not null,

  bet_fingerprint text not null,
  change_hash text not null,

  system_code text not null,
  leg_type text not null,
  side text not null,
  line_at_bet numeric null,

  book text null,
  price numeric null,
  stake_amount numeric null,

  status_label text not null default 'SENT',
  created_at timestamptz not null default now()
);

create index if not exists email_alert_items_lookup_idx
  on public.email_alert_items (game_id, snapshot_type, bet_fingerprint, created_at desc);

create unique index if not exists email_alert_items_unique_change
  on public.email_alert_items (game_id, snapshot_type, bet_fingerprint, change_hash);