
-- Align pers_sys_teams.oddsapi_name with OddsAPI participant names
UPDATE pers_sys_teams SET oddsapi_name = 'Greater Western Sydney Giants' WHERE canonical_name IN ('GWS', 'GWS Giants', 'Greater Western Sydney') OR oddsapi_name IN ('GWS Giants');
UPDATE pers_sys_teams SET oddsapi_name = 'St Kilda Saints' WHERE canonical_name IN ('St Kilda', 'St Kilda Saints') OR oddsapi_name IN ('St Kilda');
UPDATE pers_sys_teams SET oddsapi_name = 'Collingwood Magpies' WHERE canonical_name IN ('Collingwood', 'Collingwood Magpies') OR oddsapi_name IN ('Collingwood');
UPDATE pers_sys_teams SET oddsapi_name = 'Western Bulldogs' WHERE canonical_name IN ('W. Bulldogs', 'Western Bulldogs', 'Footscray') OR oddsapi_name IN ('W. Bulldogs');
UPDATE pers_sys_teams SET oddsapi_name = 'Hawthorn Hawks' WHERE canonical_name IN ('Hawthorn', 'Hawthorn Hawks') OR oddsapi_name IN ('Hawthorn');
UPDATE pers_sys_teams SET oddsapi_name = 'Carlton Blues' WHERE canonical_name IN ('Carlton', 'Carlton Blues') OR oddsapi_name IN ('Carlton');
UPDATE pers_sys_teams SET oddsapi_name = 'Sydney Swans' WHERE canonical_name IN ('Sydney', 'Sydney Swans') OR oddsapi_name IN ('Sydney');
UPDATE pers_sys_teams SET oddsapi_name = 'Gold Coast Suns' WHERE canonical_name IN ('Gold Coast', 'Gold Coast Suns') OR oddsapi_name IN ('Gold Coast');
UPDATE pers_sys_teams SET oddsapi_name = 'Geelong Cats' WHERE canonical_name IN ('Geelong', 'Geelong Cats') OR oddsapi_name IN ('Geelong');
UPDATE pers_sys_teams SET oddsapi_name = 'Brisbane Lions' WHERE canonical_name IN ('Brisbane Lions', 'Brisbane') OR oddsapi_name IN ('Brisbane');
