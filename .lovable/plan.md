

## Add Bankroll Display to Header

**Goal:** Show current balance and starting bankroll in the top-right of the sticky header, visible on all runner pages.

**Data source:** `pers_sys_bankroll_summary` view — `total_equity` (current balance) and we can derive starting bankroll from `total_equity + open_exposure - available_balance` ... actually `available_balance = total_equity - open_exposure`, so the "starting" bankroll needs clarification. More practically, the ledger `DEPOSIT` sum for the season gives the starting bankroll. But simplest: query `pers_sys_bankroll_summary` for `total_equity` (current) and `available_balance`, and query `pers_sys_ledger` filtering `event_type = 'DEPOSIT'` summing `amount` for starting bankroll.

Actually, let me check what's available more carefully. The `pers_sys_bankroll_summary` has `total_equity`, `open_exposure`, `available_balance`. The "starting bankroll" is the sum of deposits. We can get that from `pers_sys_ledger` where `event_type = 'DEPOSIT'`.

**Change: `src/components/RunnerLayout.tsx` only**

1. Add state for `currentBalance` and `startingBankroll`
2. On mount, fetch:
   - `pers_sys_bankroll_summary` filtered by `season_id = currentYear` → `total_equity` as current balance
   - `pers_sys_ledger` filtered by `season_id = currentYear` and `event_type = 'DEPOSIT'` → sum `amount` as starting bankroll
3. Render in the header, right-aligned (`ml-auto`), a small block:
   - Line 1: **Current Balance: $X,XXX.XX** (mono, small text)
   - Line 2: Starting Bankroll: $X,XXX.XX (muted, smaller text)
4. Format as AUD with commas and 2 decimal places; show "—" while loading

No new files. No migrations. Single file edit.

