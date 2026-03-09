

## Plan: Make `game_id` mandatory in `pers-sys-send-t30-alert`

### Changes (single file: `supabase/functions/pers-sys-send-t30-alert/index.ts`)

**1. Replace the optional `onlyGameId` parsing (lines 285-289) with mandatory `gameId` validation:**
- Parse `game_id` from request body
- If missing/blank, return `{ ok: false, error: "missing_game_id" }` with HTTP 400

**2. After creating the Supabase client (after line 293), add game validation:**
- Fetch the game row from `pers_sys_games` by `gameId`, selecting `id, status, start_time_aet` plus the existing join fields
- If not found: return `{ ok: true, sent: false, skipped_reason: "game_not_found" }`
- If `status !== 'SCHEDULED'`: return `{ ok: true, sent: false, skipped_reason: "game_not_scheduled" }`
- If `start_time_aet` is in the past: return `{ ok: true, sent: false, skipped_reason: "game_start_in_past" }`

**3. Simplify the signals query (lines 295-304):**
- Remove the `let` / conditional `.eq("game_id")` pattern
- Always include `.eq("game_id", gameId)` in the query

**4. Simplify game data lookup (lines 327-339):**
- Since we already fetched the game row for validation, reuse it (or re-fetch with the full join). Replace the `gameIds` array and `.in("id", gameIds)` with a single-game lookup using `gameId`.

**5. Update downstream references:**
- Replace all `onlyGameId` references with `gameId`
- The `gameIds` array becomes `[gameId]` for the bets and alert items queries

No other logic changes — classification, email formatting, dry-run, Postmark, alert_runs/items all stay the same.

