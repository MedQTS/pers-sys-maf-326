create or replace function public._round_to_quarter(p_value numeric)
returns numeric
language sql
immutable
as $$
  select round(p_value * 4.0) / 4.0
$$;

create or replace function public._round_to_5(p_value numeric)
returns numeric
language sql
immutable
as $$
  select round(p_value / 5.0) * 5.0
$$;