

## Root Cause

All 207 scheduled games for season 2026 have `round = 0`. In the evaluator at line 455:

```javascript
if (!round) continue;
```

Since `!0` is `true` in JavaScript, **every single game is skipped** before any system rules run. This is why `signals_created: 0`.

## Fix

Change the round guard in `supabase/functions/pers-sys-evaluate-systems-v2/index.ts` line 455 from:

```javascript
if (!round) continue;
```

to:

```javascript
if (round === null || round === undefined) continue;
```

This allows round 0 (which likely represents pre-season / opening round games) to be processed, while still skipping games that genuinely have no round assigned.

## Secondary Issue

`totalRounds` (line 371-373) will also be `0` since all games are round 0, which means the "rounds remaining" gate calculation (`totalRounds - round + 1 = 1`) may not behave as expected. However, since no system currently has `rounds_remaining_min` set (only SYS_1 has `rounds_remaining_min: 3` and SYS_4 has `rounds_remaining_max: 3`), those will simply gate out as expected. This is a data issue (rounds not yet populated) rather than a code bug.

## Plan

1. **Fix the falsy-zero guard** in the edge function (line 455) to use strict null check
2. **Redeploy** the edge function

Single-line change, no other files affected.

