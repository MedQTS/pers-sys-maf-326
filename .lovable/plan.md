

## Plan: Refactor Dashboard to Two-Column Layout with Step Cards

**Goal**: Transform the current 3-column grid (screenshot 1) into the two-column layout with explainers, "when to run" guidance, DB-derived "last run" timestamps, and status badges (screenshot 2).

### Single file change: `src/pages/runner/Dashboard.tsx`

**Layout**: Replace the `grid-cols-3` with a `grid-cols-2` layout:
- **Left column ("PIPELINE STEPS")**: Pull Squiggle, Build Features, Evaluate Systems, Settle Bets
- **Right column ("ODDS SNAPSHOTS")**: Pull OPEN, Pull T60, Pull T30, Pull T10

**Keep**: Weekly Pipeline card at top (unchanged), `RunButton` component (reused inside each card).

**Add per-step metadata** below each `RunButton`:
- 1-line explainer (e.g., "Loads fixtures/results from Squiggle and updates games.")
- "When to run" line with clock icon (e.g., "Weekly: Sun ~11:00pm (AET).")
- "Last run" timestamp + status badge ("OK" / "NO DATA")

**"Last run" derivation** via `useEffect` + `Promise.all` on mount — no new tables:
- `pull_squiggle`: `pers_sys_games` → `MAX(updated_at)`
- `build_features`: `pers_sys_team_state` → `MAX(updated_at)`
- `evaluate`: `pers_sys_signals` → `MAX(created_at)`
- `settle`: `pers_sys_bets` where `status='SETTLED'` → `MAX(created_at)`
- Snapshots (OPEN/T60/T30/T10): `pers_sys_market_snapshots` filtered by `snapshot_type` → `MAX(created_at)`

**Status badge**: green "OK" if timestamp exists, muted "NO DATA" if null.

**Timestamp format**: `en-AU` locale string.

Each step card wraps the existing `RunButton` (preserving its loading/result JSON display) with the metadata text below it — matching screenshot 2's visual structure.

