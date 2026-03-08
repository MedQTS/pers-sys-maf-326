

## Audit: Migrate all references to V2 tables and functions

### Findings

Legacy references that need updating:

| File | Issue |
|------|-------|
| `src/pages/runner/BetsPage.tsx` (line 48) | Queries `pers_sys_systems` — change to `pers_sys_systems_v2` |
| `src/pages/runner/WeekView.tsx` (lines 45, 51) | Queries `pers_sys_signals` — change to `pers_sys_signals_v2` |
| `supabase/functions/pers-sys-evaluate-systems/index.ts` | Entire legacy function — queries `pers_sys_systems` and writes to `pers_sys_signals` |
| `src/App.tsx` (line 7) | Imports `WeekView` from `WeekView_v2` (duplicate of line 8) — redundant but harmless |
| DB function `accept_leg_create_bet` | Reads `pers_sys_systems` for params — needs migration to `pers_sys_systems_v2` |

Already on V2 (no changes needed):
- `src/pages/runner/Dashboard.tsx` — uses `pers_sys_signals_v2` and `pers-sys-evaluate-systems-v2`
- `src/pages/runner/WeekView_v2.tsx` — uses `pers_sys_signals_v2`
- `src/pages/runner/GameDetail.tsx` — uses `pers_sys_signals_v2`
- `supabase/functions/pers-sys-evaluate-systems-v2/index.ts` — uses `pers_sys_systems_v2` and `pers_sys_signals_v2`

### Plan

1. **BetsPage.tsx** — Change the systems query from `pers_sys_systems` to `pers_sys_systems_v2`. The select columns change from `system_code, name` to `system_code, system_name` (column renamed in v2 schema).

2. **WeekView.tsx** — This file is the legacy week view. Since `App.tsx` already routes `/runner/week` to `WeekView_v2`, and `WeekView.tsx` queries legacy `pers_sys_signals`, the cleanest approach is to update its signal queries to use `pers_sys_signals_v2`. However, since the v2 week view already exists and is actively used, an alternative is to simply remove the legacy `WeekView.tsx` import and route. I'll update the queries to v2 for safety in case it's still referenced anywhere.

3. **Legacy edge function `pers-sys-evaluate-systems`** — This function should no longer be invoked. No frontend code calls it. It will be left in the repo but should be deleted from deployment. I'll note this for you to delete via Supabase dashboard, or I can delete the folder.

4. **DB function `accept_leg_create_bet`** — Currently reads `pers_sys_systems` (v1) for `params` to get staking config. This needs a migration to read from `pers_sys_systems_v2` instead, using `staking_config` column. This is a SQL migration.

5. **Clean up App.tsx** — Remove duplicate WeekView import (lines 7-8 both import from `WeekView_v2`).

### Technical details

**BetsPage.tsx change:**
- `pers_sys_systems` → `pers_sys_systems_v2`
- `name` column → `system_name`
- Update any template references from `s.name` to `s.system_name`

**WeekView.tsx signal query changes:**
- `pers_sys_signals` → `pers_sys_signals_v2`
- Select columns need updating to match v2 schema (adds `signal_status`, `leg_type`, `side`, etc.)
- The filtering logic around `pass` remains valid since v2 also has a `pass` column

**accept_leg_create_bet migration:**
- Change `FROM pers_sys_systems WHERE system_code = p_system_code` to `FROM pers_sys_systems_v2 WHERE system_code = p_system_code`
- Replace `params::jsonb` access with direct column reads from v2 (`staking_config`)
- The unit policy fields (`global_1u_pct`, `system_7_1u_pct`, `base_bankroll_pct`) need mapping from `staking_config` jsonb column in v2

**Edge function cleanup:**
- Delete `pers-sys-evaluate-systems` from deployed functions (dashboard action or deploy tool)

