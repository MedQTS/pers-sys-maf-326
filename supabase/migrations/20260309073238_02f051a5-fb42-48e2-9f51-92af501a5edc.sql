alter table if exists public.email_alert_runs
  rename to pers_sys_email_alert_runs;

alter table if exists public.email_alert_items
  rename to pers_sys_email_alert_items;

alter index if exists public.email_alert_runs_unique
  rename to pers_sys_email_alert_runs_unique;

alter index if exists public.email_alert_items_lookup_idx
  rename to pers_sys_email_alert_items_lookup_idx;

alter index if exists public.email_alert_items_unique_change
  rename to pers_sys_email_alert_items_unique_change;