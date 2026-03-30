create or replace function public.get_runner_operational_truth()
returns table (
  step_key text,
  step_label text,
  schedule_text text,
  schedule_authoritative boolean,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  last_trigger_source text,
  status_authoritative boolean,
  telemetry_source text,
  details text
)
language sql
security definer
set search_path = public
as $$
with
latest_daily_squiggle as (
  select watch_type, run_status, trigger_source, started_at, finished_at
  from public.pers_sys_watcher_runs
  where watch_type = 'DAILY_SQUIGGLE'
  order by started_at desc
  limit 1
),
latest_daily_open as (
  select watch_type, run_status, trigger_source, started_at, finished_at
  from public.pers_sys_watcher_runs
  where watch_type = 'DAILY_OPEN'
  order by started_at desc
  limit 1
),
latest_t60 as (
  select watch_type, run_status, trigger_source, started_at, finished_at
  from public.pers_sys_watcher_runs
  where watch_type = 'T60'
  order by started_at desc
  limit 1
),
latest_t30 as (
  select watch_type, run_status, trigger_source, started_at, finished_at
  from public.pers_sys_watcher_runs
  where watch_type = 'T30'
  order by started_at desc
  limit 1
),
latest_t10 as (
  select watch_type, run_status, trigger_source, started_at, finished_at
  from public.pers_sys_watcher_runs
  where watch_type = 'T10'
  order by started_at desc
  limit 1
)
select * from (
  -- Daily maintenance batch members (status is batch-derived, not per-step invocation telemetry)
  select
    'pull_squiggle'::text,
    'Pull Squiggle'::text,
    'Batch cadence from DAILY_SQUIGGLE orchestrator (see scheduler config).'::text,
    false,
    d.started_at,
    d.finished_at,
    coalesce(d.run_status, 'UNKNOWN')::text,
    d.trigger_source,
    false,
    'pers_sys_watcher_runs:DAILY_SQUIGGLE'::text,
    'Batch-derived status only; not a per-step invocation log.'::text
  from latest_daily_squiggle d

  union all

  select
    'build_features'::text,
    'Build Features'::text,
    'After Pull Squiggle within DAILY_SQUIGGLE orchestration.'::text,
    false,
    d.started_at,
    d.finished_at,
    coalesce(d.run_status, 'UNKNOWN')::text,
    d.trigger_source,
    false,
    'pers_sys_watcher_runs:DAILY_SQUIGGLE'::text,
    'Batch-derived status only; not a per-step invocation log.'::text
  from latest_daily_squiggle d

  union all

  select
    'evaluate'::text,
    'Evaluate Systems'::text,
    'After snapshot pull(s), typically in orchestrated batch.'::text,
    false,
    d.started_at,
    d.finished_at,
    coalesce(d.run_status, 'UNKNOWN')::text,
    d.trigger_source,
    false,
    'pers_sys_watcher_runs:DAILY_SQUIGGLE'::text,
    'Batch-derived status only; not a per-step invocation log.'::text
  from latest_daily_squiggle d

  union all

  select
    'settle'::text,
    'Settle Bets'::text,
    'Post-match settlement step in maintenance flow.'::text,
    false,
    d.started_at,
    d.finished_at,
    coalesce(d.run_status, 'UNKNOWN')::text,
    d.trigger_source,
    false,
    'pers_sys_watcher_runs:DAILY_SQUIGGLE'::text,
    'Batch-derived status only; not a per-step invocation log.'::text
  from latest_daily_squiggle d

  union all

  -- OPEN has dedicated batch telemetry
  select
    'pull_open'::text,
    'Pull OPEN Snapshot'::text,
    'OPEN_NIGHTLY / DAILY_OPEN orchestrator cadence (see scheduler config).'::text,
    false,
    o.started_at,
    o.finished_at,
    coalesce(o.run_status, 'UNKNOWN')::text,
    o.trigger_source,
    true,
    'pers_sys_watcher_runs:DAILY_OPEN'::text,
    'Authoritative for OPEN orchestrator runs; manual direct pulls may not be represented.'::text
  from latest_daily_open o

  union all

  -- CURRENT has no watcher telemetry in this repo path
  select
    'pull_current'::text,
    'Pull CURRENT Snapshot'::text,
    'Manual/on-demand unless separately orchestrated.'::text,
    false,
    null::timestamptz,
    null::timestamptz,
    'UNKNOWN'::text,
    null::text,
    false,
    'none'::text,
    'No dedicated watcher telemetry source in current repository wiring.'::text

  union all

  -- Matchday watcher telemetry
  select
    'pull_t60'::text,
    'Pull T60 Snapshot'::text,
    'Watcher window around ~60 minutes pre-bounce.'::text,
    false,
    t.started_at,
    t.finished_at,
    coalesce(t.run_status, 'UNKNOWN')::text,
    t.trigger_source,
    true,
    'pers_sys_watcher_runs:T60'::text,
    'Authoritative for watcher-dispatched T60 runs.'::text
  from latest_t60 t

  union all

  select
    'pull_t30'::text,
    'Pull T30 Snapshot'::text,
    'Watcher window around ~30 minutes pre-bounce.'::text,
    false,
    t.started_at,
    t.finished_at,
    coalesce(t.run_status, 'UNKNOWN')::text,
    t.trigger_source,
    true,
    'pers_sys_watcher_runs:T30'::text,
    'Authoritative for watcher-dispatched T30 runs.'::text
  from latest_t30 t

  union all

  select
    'pull_t10'::text,
    'Pull T10 Snapshot'::text,
    'Watcher window around ~10 minutes pre-bounce.'::text,
    false,
    t.started_at,
    t.finished_at,
    coalesce(t.run_status, 'UNKNOWN')::text,
    t.trigger_source,
    true,
    'pers_sys_watcher_runs:T10'::text,
    'Authoritative for watcher-dispatched T10 runs.'::text
  from latest_t10 t
) q
order by case step_key
  when 'pull_squiggle' then 1
  when 'build_features' then 2
  when 'pull_open' then 3
  when 'pull_current' then 4
  when 'pull_t60' then 5
  when 'pull_t30' then 6
  when 'pull_t10' then 7
  when 'evaluate' then 8
  when 'settle' then 9
  else 99
end;
$$;

grant execute on function public.get_runner_operational_truth() to anon, authenticated, service_role;
