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
  p_snapshot_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bankroll numeric;
  v_one_u_pct_global numeric := 0.015;
  v_one_u_pct_sys numeric := 0.015;
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

  v_one_u_pct_global :=
    coalesce(
      nullif(v_staking_config ->> 'global_1u_pct', '')::numeric,
      0.015
    );

  v_one_u_pct_sys := v_one_u_pct_global;

  if p_system_code = 'SYS_7' then
    v_one_u_pct_sys :=
      coalesce(
        nullif(v_staking_config ->> 'system_7_1u_pct', '')::numeric,
        v_one_u_pct_global
      );
  end if;

  if p_system_code = 'SYS_7' then
    v_units := round(coalesce(p_units, 0)::numeric * 4) / 4.0;

  elsif p_system_code = 'SYS_3' then
    v_units := round(
      coalesce(
        nullif(v_staking_config ->> 'base_units', '')::numeric,
        1
      ) * 4
    ) / 4.0;

  elsif p_system_code = 'SYS_2' and upper(coalesce(p_leg_type, '')) = 'LINE' then
    v_units := round(
      (
        coalesce(
          nullif(v_staking_config ->> 'line_pct_bankroll', '')::numeric,
          nullif(v_staking_config ->> 'base_pct_bankroll', '')::numeric,
          0.01
        ) / nullif(v_one_u_pct_sys, 0)
      ) * 4
    ) / 4.0;

  else
    v_units := round(
      (
        coalesce(
          nullif(v_staking_config ->> 'base_pct_bankroll', '')::numeric,
          0.01
        ) / nullif(v_one_u_pct_sys, 0)
      ) * 4
    ) / 4.0;
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
    'one_u_pct', v_one_u_pct_sys
  );

  return v_result;
end;
$$;

grant execute on function public.preview_leg_stake(
  uuid, text, text, text, numeric, numeric, text, numeric, numeric, text
) to anon, authenticated, service_role;