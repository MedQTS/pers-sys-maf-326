

## Plan: Replace Overlay Block with Full SYS_2 Spec

### What changes
**File**: `supabase/functions/pers-sys-evaluate-systems-v2/index.ts` (lines 1084-1168)

Replace the entire overlay section with the provided block, which adds:

1. **Stale row cleanup**: When OPEN or T30 snapshots are missing, or when CLV does not pass the threshold, any prior overlay row for that game/system is explicitly deleted
2. **PENDING support**: If CLV passes but T30 market data is incomplete (`hasMarketData` returns false), the overlay is written as PENDING with `fail: "waiting_overlay_snapshot"`
3. **Richer reason_json**: Includes `overlay.depends_on`, `overlay_child.clv_rel`, `overlay_child.clv_min`, and `overlay_child.side`
4. **Upsert pattern**: Uses `.upsert()` with `onConflict: "system_code,game_id,execution_snapshot,leg_type,side"` instead of manual select+insert/update

### Technical detail
- Lines 1084-1168 are replaced wholesale
- No other lines in the file change
- Edge function will be redeployed after edit

