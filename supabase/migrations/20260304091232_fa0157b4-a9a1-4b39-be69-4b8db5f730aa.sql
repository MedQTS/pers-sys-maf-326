
-- =========================================================
-- SIGNAL STATUS ENUM
-- =========================================================

do $$
begin
    if not exists (
        select 1
        from pg_type
        where typname = 'sys_signal_status'
    ) then
        create type sys_signal_status as enum (
            'READY',
            'PENDING'
        );
    end if;
end$$;


-- =========================================================
-- ALTER SIGNALS TABLE
-- =========================================================

alter table pers_sys_signals
    add column if not exists signal_status sys_signal_status,
    add column if not exists parent_signal_id uuid,
    add column if not exists execution_snapshot sys_snapshot,
    add column if not exists execution_market sys_market,
    add column if not exists recommended_units numeric,
    add column if not exists system_priority int;


-- =========================================================
-- INDEXES FOR UI PERFORMANCE
-- =========================================================

create index if not exists idx_signals_status
on pers_sys_signals(signal_status);

create index if not exists idx_signals_game
on pers_sys_signals(game_id);


-- =========================================================
-- OVERLAY RELATIONSHIP
-- =========================================================

do $$
begin
    if not exists (
        select 1
        from information_schema.table_constraints
        where constraint_name = 'fk_signal_parent'
    ) then
        alter table pers_sys_signals
        add constraint fk_signal_parent
        foreign key (parent_signal_id)
        references pers_sys_signals(id)
        on delete cascade;
    end if;
end$$;
