-- Ledger + bankroll summary (locked architecture)

-- 1) Ledger table
create table if not exists public.pers_sys_ledger (
  id uuid primary key default gen_random_uuid(),
  season_id integer not null,
  event_type text not null
    check (event_type in ('START','DEPOSIT','WITHDRAWAL','SETTLEMENT','ADJUST')),
  amount numeric not null,
  note text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists pers_sys_ledger_season_created_idx
  on public.pers_sys_ledger (season_id, created_at);

create index if not exists pers_sys_ledger_season_event_idx
  on public.pers_sys_ledger (season_id, event_type);

-- RLS for ledger
alter table public.pers_sys_ledger enable row level security;

create policy "pers_sys_ledger_public_read"
  on public.pers_sys_ledger for select
  using (true);

create policy "pers_sys_ledger_service_write"
  on public.pers_sys_ledger for all
  to service_role
  using (true)
  with check (true);

-- 2) Bankroll summary view (per season)
create or replace view public.pers_sys_bankroll_summary as
with ledger_totals as (
  select
    season_id,
    coalesce(sum(amount), 0)::numeric as total_equity
  from public.pers_sys_ledger
  group by season_id
),
open_exposure as (
  select
    g.season as season_id,
    coalesce(sum(b.stake_amount), 0)::numeric as open_exposure
  from public.pers_sys_bets b
  join public.pers_sys_games g on g.id = b.game_id
  where b.status = 'UNSETTLED'
  group by g.season
)
select
  lt.season_id,
  lt.total_equity,
  coalesce(oe.open_exposure, 0)::numeric as open_exposure,
  (lt.total_equity - coalesce(oe.open_exposure, 0))::numeric as available_balance
from ledger_totals lt
left join open_exposure oe
  on oe.season_id = lt.season_id;

-- 3) Seed START event for current season (2000 AUD)
insert into public.pers_sys_ledger (season_id, event_type, amount, note)
values (extract(year from now())::int, 'START', 2000, 'Initial bankroll seed');