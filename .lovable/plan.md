

## Fix Starting Bankroll Display

**Problem:** The header shows Starting Bankroll as $0.00 because the code filters `pers_sys_ledger` by `event_type = 'DEPOSIT'`, but the actual seed record uses `event_type = 'START'`.

Database evidence: the $2,000 seed row has `event_type: 'START'`, not `'DEPOSIT'`.

**Fix:** Edit `src/components/RunnerLayout.tsx` — change the ledger query filter to include both `START` and `DEPOSIT` event types using `.in('event_type', ['START', 'DEPOSIT'])` instead of `.eq('event_type', 'DEPOSIT')`.

Single line change in the `fetchBankroll` function.

