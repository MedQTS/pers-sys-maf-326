

## Plan: UTC-safe date parsing in pers-sys-pull-squiggle

**Single file change**: `supabase/functions/pers-sys-pull-squiggle/index.ts`

### Edit 1 — Replace date parsing block (lines 58-68)
Replace the naive `new Date(g.date).toISOString()` with a safer parser that:
- Checks if `g.date` already has timezone info (Z or +HH:MM) — parse directly
- If no tz info but `g.tz` field exists — append offset before parsing
- Falls back to `g.unixtime` (always UTC) if above fails
- Skips row if neither produces a valid date

### Edit 2 — Update upsert payload (line 106)
Change `start_time_aet: startTime` to `start_time_aet: startTimeUtc`

### Deployment
Deploy `pers-sys-pull-squiggle` after edits.

