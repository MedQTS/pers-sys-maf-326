-- Seed team home_state for interstate logic (SYS_1 amplifiers, SYS_4, SYS_5 amplifier 2)

update public.pers_sys_teams
set home_state = case
  when canonical_name = 'Adelaide' then 'SA'
  when canonical_name = 'Brisbane Lions' then 'QLD'
  when canonical_name = 'Carlton' then 'VIC'
  when canonical_name = 'Collingwood' then 'VIC'
  when canonical_name = 'Essendon' then 'VIC'
  when canonical_name = 'Fremantle' then 'WA'
  when canonical_name = 'Geelong' then 'VIC'
  when canonical_name = 'Gold Coast' then 'QLD'
  when canonical_name = 'GWS' then 'NSW'
  when canonical_name = 'Hawthorn' then 'VIC'
  when canonical_name = 'Melbourne' then 'VIC'
  when canonical_name = 'North Melbourne' then 'VIC'
  when canonical_name = 'Port Adelaide' then 'SA'
  when canonical_name = 'Richmond' then 'VIC'
  when canonical_name = 'St Kilda' then 'VIC'
  when canonical_name = 'Sydney' then 'NSW'
  when canonical_name = 'West Coast' then 'WA'
  when canonical_name = 'Western Bulldogs' then 'VIC'
  else home_state
end
where home_state is null;