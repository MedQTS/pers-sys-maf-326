

## Fix: Add missing enum values to `sys_signal_status`

### Problem
The `sys_signal_status` Postgres enum currently only contains `READY` and `PENDING`. The evaluator code writes four statuses: `READY`, `PENDING`, `FAIL`, and `BLOCKED`. Both the signals table (`signal_status`) and audit table (`audit_status`) use this same enum. Every evaluation attempt that results in FAIL or BLOCKED silently errors on the database upsert, meaning audit rows are lost and blocked signals can't be written.

### Root cause
The enum was created with only two values. The evaluator code expects four. This has been broken since the evaluator started using FAIL/BLOCKED statuses.

### Fix (1 migration)
Create a new Supabase migration that adds the two missing enum values:

```sql
ALTER TYPE public.sys_signal_status ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE public.sys_signal_status ADD VALUE IF NOT EXISTS 'FAIL';
```

### What this fixes
- Audit rows for FAIL and BLOCKED will persist correctly
- BLOCKED signals (dominance/collision) will write to `pers_sys_signals_v2`
- The Collingwood exclusion (SYS_8 `excluded_team`) audit rows will persist
- No edge function code changes needed — the code is already correct

### What this does NOT change
- No evaluator logic changes
- No frontend changes
- No staking or RPC changes
- No other schema changes

### Verification
After migration, invoke `pers-sys-evaluate-systems-v2` and confirm:
1. No `invalid input value for enum sys_signal_status` errors in edge function logs
2. `pers_sys_signal_audit_v2` contains rows with `audit_status = 'FAIL'` and `audit_status = 'BLOCKED'`

