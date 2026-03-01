

## Investigation Results

I found **two distinct issues** preventing the Western Bulldogs v Brisbane Lions (R0) game from appearing in the bet queue:

### Issue 1: Round 0 is skipped by evaluate-systems

In `pers-sys-evaluate-systems/index.ts` line 86:

```typescript
if (!round) continue;
```

The game is Round 0 (opening round). In JavaScript, `!0` is `true`, so **every Round 0 game is silently skipped** and never gets a signal created. This is why there are zero signals for game `2026_R0_G38497`.

Round 1 games DO get evaluated but fail with `missing_odds` (odds haven't been pulled yet).

**Fix**: Change the guard to `if (round === null || round === undefined) continue;` so that round 0 is processed.

### Issue 2: SYS_2 `rounds_min: 0` still passes the gate, but `rounds_max: 5` means R0 is valid

The SYS_2 params have `rounds_min: 0` and `rounds_max: 5`, so once Issue 1 is fixed, round 0 games will correctly enter the SYS_2 evaluation path. Good.

### Issue 3: Missing odds data

Even for Round 1 games that DO get evaluated for SYS_2, they all fail with `"fail": "missing_odds"`. The `Pull Odds Snapshot` function needs to be run to populate `pers_sys_market_snapshots` with OPEN H2H and LINE data. Without odds, SYS_2 can never pass.

### Plan

1. **Fix the round-0 guard** in `supabase/functions/pers-sys-evaluate-systems/index.ts` line 86: change `if (!round) continue;` to `if (round === null || round === undefined) continue;`
2. **No other changes needed** -- once fixed, re-running evaluate-systems (after pulling odds) will create SYS_2 signals for the Bulldogs v Lions R0 game.

### After deployment

You'll need to:
1. Run **Pull Odds Snapshot** to get market data for upcoming games
2. Re-run **Evaluate Systems** to generate signals with the round-0 fix

