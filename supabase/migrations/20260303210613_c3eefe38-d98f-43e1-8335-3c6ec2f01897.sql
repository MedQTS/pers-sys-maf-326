
create or replace function public._round_to_quarter(x numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(x,0) * 4) / 4;
$$;

create or replace function public._round_to_5(x numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(x,0) / 5) * 5;
$$;

create or replace function public.accept_leg_create_bet(
  p_game_id uuid,
  p_system_code text,
  p_leg_type text,
  p_side text,
  p_line_at_bet numeric,
  p_exec_best_price numeric,
  p_exec_best_book text,
  p_ref_price numeric,
  p_units numeric,
  p_snapshot_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_existing_status text;
  v_season int;
  v_total_equity numeric;
  v_open_exposure numeric;
  v_sys_params jsonb;
  v_base_pct numeric;
  v_one_u_pct_global numeric := 0.015;
  v_one_u_pct_sys numeric := null;
  v_units numeric;
  v_stake_raw numeric;
  v_stake numeric;
  v_match_open numeric;
  v_match_cap numeric;
  v_price numeric;
  v_book text;
  v_notes text;
begin
  if p_game_id is null or p_system_code is null or p_leg_type is null or p_side is null then
    return jsonb_build_object('ok', false, 'error', 'missing_required_args');
  end if;

  select id, status into v_existing_id, v_existing_status
  from pers_sys_bets
  where game_id = p_game_id and status = 'UNSETTLED'
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'already_unsettled', 'existing_bet_id', v_existing_id);
  end if;

  if upper(p_leg_type) = 'H2H' then
    select id into v_existing_id
    from pers_sys_bets
    where game_id = p_game_id and system_code = p_system_code and leg_type = 'H2H' and side = p_side
    limit 1;
  else
    select id into v_existing_id
    from pers_sys_bets
    where game_id = p_game_id and system_code = p_system_code and leg_type = 'LINE' and side = p_side and line_at_bet = p_line_at_bet
    limit 1;
  end if;

  if v_existing_id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'already_exists', 'existing_bet_id', v_existing_id);
  end if;

  select season into v_season from pers_sys_games where id = p_game_id;
  if v_season is null then
    return jsonb_build_object('ok', false, 'error', 'game_not_found');
  end if;

  select total_equity, open_exposure into v_total_equity, v_open_exposure
  from pers_sys_bankroll_summary where season_id = v_season;

  v_total_equity := coalesce(v_total_equity, 0);
  v_open_exposure := coalesce(v_open_exposure, 0);

  if v_total_equity <= 0 then
    return jsonb_build_object('ok', false, 'error', 'bankroll_not_initialized');
  end if;

  select params::jsonb into v_sys_params from pers_sys_systems where system_code = p_system_code;
  if v_sys_params is null then
    return jsonb_build_object('ok', false, 'error', 'system_not_found');
  end if;

  v_one_u_pct_global := coalesce((v_sys_params #>> '{unit_policy,global_1u_pct}')::numeric, 0.015);

  if p_system_code = 'SYS_7' then
    v_one_u_pct_sys := (v_sys_params #>> '{unit_policy,system_7_1u_pct}')::numeric;
  end if;
  v_one_u_pct_sys := coalesce(v_one_u_pct_sys, v_one_u_pct_global);

  if p_system_code = 'SYS_7' then
    v_units := public._round_to_quarter(coalesce(p_units, 0));
    if v_units <= 0 then
      return jsonb_build_object('ok', false, 'error', 'missing_units_for_sys7');
    end if;
  else
    v_base_pct := coalesce((v_sys_params #>> '{staking,base_bankroll_pct}')::numeric, 0.01);
    v_units := public._round_to_quarter(v_base_pct / v_one_u_pct_sys);
    if v_units <= 0 then
      return jsonb_build_object('ok', false, 'error', 'computed_units_invalid');
    end if;
  end if;

  v_stake_raw := v_total_equity * v_units * v_one_u_pct_sys;
  v_stake := public._round_to_5(v_stake_raw);
  if v_stake <= 0 then
    return jsonb_build_object('ok', false, 'error', 'stake_computed_invalid');
  end if;

  select coalesce(sum(stake_amount), 0) into v_match_open
  from pers_sys_bets where game_id = p_game_id and status = 'UNSETTLED';

  v_match_cap := v_total_equity * 0.06;

  if (v_match_open + v_stake) > v_match_cap then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'match_cap', 'cap', v_match_cap, 'attempt', (v_match_open + v_stake));
  end if;

  v_price := coalesce(p_exec_best_price, p_ref_price);
  v_book := case when p_exec_best_price is not null then p_exec_best_book else null end;

  if v_price is null then
    return jsonb_build_object('ok', false, 'error', 'missing_price');
  end if;

  v_notes := jsonb_build_object(
    'snapshot_type', p_snapshot_type,
    'ref_price', p_ref_price,
    'exec_best_price', p_exec_best_price,
    'exec_best_book', p_exec_best_book
  )::text;

  insert into pers_sys_bets (
    system_code, game_id, leg_type, placed_ts, side, line_at_bet,
    price, units, status, stake_amount, bankroll_snapshot, book, notes
  ) values (
    p_system_code, p_game_id, upper(p_leg_type), now(), upper(p_side),
    case when upper(p_leg_type) = 'LINE' then p_line_at_bet else null end,
    v_price, v_units, 'UNSETTLED', v_stake, v_total_equity, v_book, v_notes
  ) returning id into v_existing_id;

  return jsonb_build_object(
    'ok', true, 'created', true, 'bet_id', v_existing_id,
    'stake_amount', v_stake, 'units', v_units,
    'one_u_pct', v_one_u_pct_sys, 'price', v_price, 'book', v_book
  );

exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'unique_violation');
end;
$$;

grant execute on function public.accept_leg_create_bet(
  uuid, text, text, text, numeric, numeric, text, numeric, numeric, text
) to anon, authenticated;
