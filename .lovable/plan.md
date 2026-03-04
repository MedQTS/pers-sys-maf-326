

## Block 1/2 — Harden normName matching in `pers-sys-pull-odds-snapshot/index.ts`

Four changes within the existing file:

**1a. Replace `normName` helper** (line 150-152) with the enhanced version that strips `&→and`, punctuation, hyphens, and fluff tokens (`fc`, `football`, `club`, `afl`, `the`). Add a `normSet` helper that builds a `Set<string>` from an array of nullable strings.

**1b. Replace `teamById` construction** (lines 145-159) to use a `TeamInfo` type with a `norm_names: Set<string>` field built from both `canonical_name` and `oddsapi_name`. Remove the separate `teamIdByNorm` map — matching will use per-team norm sets instead.

**1c. Replace `matchedEvent` selection** (lines 185-200) to use `expectedHome.norm_names.has(normName(ev.home_team))` instead of the `teamIdByNorm` lookup. Keep the 6-hour `TOL_MS` time tolerance. The `homeInfo`/`awayInfo` variables become `expectedHome`/`expectedAway` of type `TeamInfo`.

**1d. Replace outcome name matching in H2H and spreads loops** (lines 252-256, 288-292) to use `expectedHome.norm_names.has(normName(o.name))` / `expectedAway.norm_names.has(...)` instead of the current case-insensitive string equality checks.

No other logic changes — all reference/exec aggregation, median, upsert, and diagnostics remain identical.

---

## Block 2/2 — New `pers-sys-audit-oddsapi-names` edge function

**New file**: `supabase/functions/pers-sys-audit-oddsapi-names/index.ts`

Calls the OddsAPI `/participants` endpoint (cost: 1 API call), loads `pers_sys_teams`, and cross-references using the same `normName` logic. Returns:
- `unmapped_participants` — API names that don't match any team (no_match or ambiguous)
- `teams_needing_attention` — teams missing `oddsapi_name` or whose `oddsapi_name` doesn't match any participant
- Optional `apply=true` mode: auto-fills `oddsapi_name` where a unique suggestion exists

**Config**: Add `[functions.pers-sys-audit-oddsapi-names] verify_jwt = false` to `supabase/config.toml`.

**Deploy** both functions after changes.

