create or replace function public.preview_leg_stake(
  p_game_id uuid,
  p_system_code text,
  p_leg_type text,
  p_side text,
  p_line_at_bet numeric default null,
  p_exec_best_price numeric default null,
  p_exec_best_book text default null,
  p_ref_price numeric default null,
  p_units numeric default null,
  p_snapshot_type text default null,
  p_recommended_bankroll_pct numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bankroll numeric;
  v_one_u_pct_global numeric;
  v_one_u_pct_sys numeric;
  v_system_1u_override numeric;
  v_base_pct numeric;
  v_effective_pct numeric;
  v_units numeric;
  v_stake_amount numeric;
  v_price numeric;
  v_book text;
  v_status text;
  v_staking_config jsonb;
  v_result jsonb;
begin
  select coalesce(total_equity, 0)
    into v_bankroll
  from public.pers_sys_bankroll_summary
  limit 1;

  select staking_config
    into v_staking_config
  from public.pers_sys_systems_v2
  where system_code = p_system_code
  limit 1;

  if v_staking_config is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_staking_config',
      'system_code', p_system_code
    );
  end if;

  v_one_u_pct_global := nullif(v_staking_config ->> 'global_1u_pct', '')::numeric;
  if v_one_u_pct_global is null or v_one_u_pct_global <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_global_1u_pct',
      'system_code', p_system_code
    );
  end if;

  if p_system_code in ('SYS_3', 'SYS_7') then
    v_system_1u_override := nullif(v_staking_config ->> 'system_7_1u_pct', '')::numeric;
    v_one_u_pct_sys := coalesce(v_system_1u_override, v_one_u_pct_global);
  else
    v_one_u_pct_sys := v_one_u_pct_global;
  end if;

  if v_one_u_pct_sys is null or v_one_u_pct_sys <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_one_u_pct',
      'system_code', p_system_code
    );
  end if;

  -- Canonical path (preferred)
  if p_recommended_bankroll_pct is not null then
    v_effective_pct := p_recommended_bankroll_pct;
    v_units := round((v_effective_pct / nullif(v_one_u_pct_sys, 0)) * 4) / 4.0;
  -- Backward-compatible units override path
  elsif p_units is not null then
    v_units := round(coalesce(p_units, 0)::numeric * 4) / 4.0;
    v_effective_pct := v_units * v_one_u_pct_sys;
  else
    -- Legacy fallback path (retain behavior; broaden key support to reduce config-key drift)
    v_base_pct := coalesce(
      nullif(v_staking_config ->> 'base_bankroll_pct', '')::numeric,
      nullif(v_staking_config ->> 'base_pct_bankroll', '')::numeric,
      nullif(v_staking_config ->> 'line_pct_bankroll', '')::numeric
    );

    if v_base_pct is null then
      return jsonb_build_object(
        'ok', false,
        'error', 'missing_base_bankroll_pct',
        'system_code', p_system_code
      );
    end if;

    -- Support both fraction and percent-point configs during transition
    if v_base_pct > 1 then
      v_effective_pct := v_base_pct / 100.0;
    else
      v_effective_pct := v_base_pct;
    end if;

    v_units := round((v_effective_pct / nullif(v_one_u_pct_sys, 0)) * 4) / 4.0;
  end if;

  if v_units is null or v_units <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_units',
      'system_code', p_system_code,
      'units', v_units
    );
  end if;

  v_price := coalesce(p_exec_best_price, p_ref_price);
  v_book := p_exec_best_book;

  v_stake_amount := round((v_bankroll * v_units * v_one_u_pct_sys) / 5.0) * 5.0;

  v_status := case
    when v_bankroll <= 0 then 'NO_BANKROLL'
    when v_price is null then 'NO_PRICE'
    else 'READY'
  end;

  v_result := jsonb_build_object(
    'ok', true,
    'status', v_status,
    'game_id', p_game_id,
    'system_code', p_system_code,
    'leg_type', p_leg_type,
    'side', p_side,
    'line_at_bet', p_line_at_bet,
    'snapshot_type', p_snapshot_type,
    'price', v_price,
    'book', v_book,
    'units', v_units,
    'stake_amount', v_stake_amount,
    'bankroll_snapshot', v_bankroll,
    'one_u_pct', v_one_u_pct_sys,
    'recommended_bankroll_pct_effective', v_effective_pct
  );

  return v_result;
end;
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
  p_snapshot_type text,
  p_recommended_bankroll_pct numeric default null
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
  v_staking_config jsonb;
  v_base_pct numeric;
  v_one_u_pct_global numeric;
  v_one_u_pct_sys numeric;
  v_system_1u_override numeric;
  v_effective_pct numeric;
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

  -- Leg-level duplicate check (unsettled only)
  if upper(p_leg_type) = 'H2H' then
    select id into v_existing_id
    from pers_sys_bets
    where game_id = p_game_id and system_code = p_system_code and leg_type = 'H2H' and side = p_side and status = 'UNSETTLED'
    limit 1;
  else
    select id into v_existing_id
    from pers_sys_bets
    where game_id = p_game_id and system_code = p_system_code and leg_type = 'LINE' and side = p_side and line_at_bet = p_line_at_bet and status = 'UNSETTLED'
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

  select staking_config::jsonb into v_staking_config from pers_sys_systems_v2 where system_code = p_system_code;
  if v_staking_config is null then
    return jsonb_build_object('ok', false, 'error', 'system_not_found');
  end if;

  v_one_u_pct_global := nullif(v_staking_config ->> 'global_1u_pct', '')::numeric;
  if v_one_u_pct_global is null or v_one_u_pct_global <= 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_global_1u_pct');
  end if;

  if p_system_code in ('SYS_3', 'SYS_7') then
    v_system_1u_override := nullif(v_staking_config ->> 'system_7_1u_pct', '')::numeric;
    v_one_u_pct_sys := coalesce(v_system_1u_override, v_one_u_pct_global);
  else
    v_one_u_pct_sys := v_one_u_pct_global;
  end if;

  if v_one_u_pct_sys is null or v_one_u_pct_sys <= 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_one_u_pct');
  end if;

  -- Canonical path (preferred)
  if p_recommended_bankroll_pct is not null then
    v_effective_pct := p_recommended_bankroll_pct;
    v_units := public._round_to_quarter(v_effective_pct / v_one_u_pct_sys);
  -- Backward-compatible path
  elsif p_units is not null then
    v_units := public._round_to_quarter(coalesce(p_units, 0));
    if v_units <= 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_units');
    end if;
    v_effective_pct := v_units * v_one_u_pct_sys;
  else
    -- Legacy fallback path
    v_base_pct := coalesce(
      nullif(v_staking_config ->> 'base_bankroll_pct', '')::numeric,
      nullif(v_staking_config ->> 'base_pct_bankroll', '')::numeric,
      nullif(v_staking_config ->> 'line_pct_bankroll', '')::numeric
    );

    if v_base_pct is null then
      return jsonb_build_object('ok', false, 'error', 'missing_base_bankroll_pct');
    end if;

    if v_base_pct > 1 then
      v_effective_pct := v_base_pct / 100.0;
    else
      v_effective_pct := v_base_pct;
    end if;

    v_units := public._round_to_quarter(v_effective_pct / v_one_u_pct_sys);
  end if;

  if v_units <= 0 then
    return jsonb_build_object('ok', false, 'error', 'computed_units_invalid');
  end if;

  v_stake_raw := v_total_equity * v_units * v_one_u_pct_sys;
  v_stake := public._round_to_5(v_stake_raw);
  if v_stake <= 0 then
    return jsonb_build_object('ok', false, 'error', 'stake_computed_invalid');
  end if;

  select coalesce(sum(stake_amount), 0) into v_match_open
  from pers_sys_bets where game_id = p_game_id and status = 'UNSETTLED';

  -- Keep 6% match cap unchanged (locked policy)
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
    'exec_best_book', p_exec_best_book,
    'recommended_bankroll_pct_effective', v_effective_pct
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
    'one_u_pct', v_one_u_pct_sys, 'price', v_price, 'book', v_book,
    'recommended_bankroll_pct_effective', v_effective_pct
  );

exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'unique_violation');
end;
$$;
