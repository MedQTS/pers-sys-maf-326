

## Plan: Surgical fixes to `pers-sys-pull-odds-snapshot/index.ts`

Four targeted changes to a single file, no schema or other file modifications.

### Changes

**1. Fix LINE anchor bug when median is 0.0** (lines 350-351)
Replace `refHomeLineMed || null` and `refAwayLineMed || null` with `Number.isFinite(refHomeLineMed) ? refHomeLineMed : null` (same for away). The `|| null` pattern treats `0` as falsy, breaking anchor selection for even-line games.

**2. Harden OddsAPI event matching with time tolerance** (lines 179-185)
- Add `const TOL_MS = 6 * 60 * 60 * 1000;` before the game loop.
- Inside `matchedEvent = oddsEvents.find(...)`, after the existing home/away name check, parse `ev.commence_time` and `game.start_time_aet` as timestamps and require `Math.abs(evTs - gameTs) <= TOL_MS`. If either timestamp is NaN, treat as no match.

**3. Make H2H best-exec deterministic on price ties** (lines 249-252, 259-262)
When `price === execBestHomePrice`, compare `execPriority.get(bmKey)` vs `execPriority.get(execBestHomeBook)` and take the lower priority index. Same pattern for away side.

**4. Add diagnostic counters to response JSON** (lines 162-165, 170, 187, plus response)
- Initialize counters: `skipped_no_team_map`, `skipped_no_event_match`, `skipped_no_ref_h2h`, `skipped_no_ref_line`, `skipped_no_exec_books`.
- Increment at each existing `continue` / skip point.
- Include all five in the final response JSON object.

### Technical Detail

All changes are within the single file `supabase/functions/pers-sys-pull-odds-snapshot/index.ts`. The function will be redeployed after edits.

