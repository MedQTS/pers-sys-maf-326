-- 1) Prevent duplicate H2H legs per game/system/side
CREATE UNIQUE INDEX IF NOT EXISTS uq_pers_sys_bets_leg_h2h
ON public.pers_sys_bets (game_id, system_code, leg_type, side)
WHERE leg_type = 'H2H';

-- 2) Prevent duplicate LINE legs per game/system/side/line
CREATE UNIQUE INDEX IF NOT EXISTS uq_pers_sys_bets_leg_line
ON public.pers_sys_bets (game_id, system_code, leg_type, side, line_at_bet)
WHERE leg_type = 'LINE';