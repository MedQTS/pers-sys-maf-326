-- Add executor + staking + settlement state to pers_sys_bets
-- No data preservation required (clean slate).

alter table public.pers_sys_bets
  add column if not exists book text;

alter table public.pers_sys_bets
  add column if not exists stake_amount numeric not null default 0;

alter table public.pers_sys_bets
  add column if not exists status text not null default 'UNSETTLED';

alter table public.pers_sys_bets
  add column if not exists bankroll_snapshot numeric;

-- Add check constraint separately for status
alter table public.pers_sys_bets
  drop constraint if exists pers_sys_bets_status_check;
alter table public.pers_sys_bets
  add constraint pers_sys_bets_status_check
  check (status in ('UNSETTLED','SETTLED','VOID','PUSH'));

-- Helpful indexes for exposure + bankroll computations
create index if not exists pers_sys_bets_status_idx
  on public.pers_sys_bets (status);

create index if not exists pers_sys_bets_game_status_idx
  on public.pers_sys_bets (game_id, status);

create index if not exists pers_sys_bets_placed_ts_idx
  on public.pers_sys_bets (placed_ts);

create index if not exists pers_sys_bets_system_code_idx
  on public.pers_sys_bets (system_code);