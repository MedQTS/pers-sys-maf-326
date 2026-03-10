-- Item 6 remediation: reduce config/code drift with canonical config keys.

-- Normalize common staking base key for percent-based systems.
update public.pers_sys_systems_v2
set staking_config = jsonb_set(
  coalesce(staking_config, '{}'::jsonb),
  '{base_bankroll_pct}',
  to_jsonb(
    coalesce(
      nullif(staking_config ->> 'base_bankroll_pct', '')::numeric,
      nullif(staking_config ->> 'base_pct_bankroll', '')::numeric,
      nullif(staking_config ->> 'line_pct_bankroll', '')::numeric
    )
  ),
  true
)
where coalesce(staking_config, '{}'::jsonb) <> '{}'::jsonb
  and (staking_config ? 'base_pct_bankroll' or staking_config ? 'line_pct_bankroll')
  and not (staking_config ? 'base_bankroll_pct');

-- Ensure SYS_8 has canonical threshold + boost keys (no-op if SYS_8 row absent).
update public.pers_sys_systems_v2
set staking_config = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                coalesce(staking_config, '{}'::jsonb),
                '{stake_base_pct}',
                to_jsonb(coalesce(nullif(staking_config ->> 'stake_base_pct', '')::numeric, nullif(staking_config ->> 'base_bankroll_pct', '')::numeric, nullif(staking_config ->> 'base_pct_bankroll', '')::numeric, 1.0)),
                true
              ),
              '{totals_move_min}',
              to_jsonb(coalesce(nullif(staking_config ->> 'totals_move_min', '')::numeric, 3.0)),
              true
            ),
            '{model_total_min}',
            to_jsonb(coalesce(nullif(staking_config ->> 'model_total_min', '')::numeric, 165.0)),
            true
          ),
          '{model_total_max_exclusive}',
          to_jsonb(coalesce(nullif(staking_config ->> 'model_total_max_exclusive', '')::numeric, 175.0)),
          true
        ),
        '{early_agreement_move_min}',
        to_jsonb(coalesce(nullif(staking_config ->> 'early_agreement_move_min', '')::numeric, 1.5)),
        true
      ),
      '{strong_momentum_move_min}',
      to_jsonb(coalesce(nullif(staking_config ->> 'strong_momentum_move_min', '')::numeric, 4.5)),
      true
    ),
    amplifier_config = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(amplifier_config, '{}'::jsonb),
            '{day_game_boost_pct}',
            to_jsonb(coalesce(nullif(amplifier_config ->> 'day_game_boost_pct', '')::numeric, nullif(amplifier_config ->> 'day_game_boost', '')::numeric, 0.0)),
            true
          ),
          '{marvel_boost_pct}',
          to_jsonb(coalesce(nullif(amplifier_config ->> 'marvel_boost_pct', '')::numeric, nullif(amplifier_config ->> 'marvel_boost', '')::numeric, 0.0)),
          true
        ),
        '{early_agreement_boost_pct}',
        to_jsonb(coalesce(nullif(amplifier_config ->> 'early_agreement_boost_pct', '')::numeric, nullif(amplifier_config ->> 'early_agreement_boost', '')::numeric, 0.0)),
        true
      ),
      '{strong_momentum_boost_pct}',
      to_jsonb(coalesce(nullif(amplifier_config ->> 'strong_momentum_boost_pct', '')::numeric, nullif(amplifier_config ->> 'strong_momentum_boost', '')::numeric, 0.0)),
      true
    )
where system_code = 'SYS_8';
