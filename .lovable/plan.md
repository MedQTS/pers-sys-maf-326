

## Plan

Add 12 new columns to `pers_sys_market_snapshots` via a single migration:

- 4 exec-best H2H columns: `exec_best_home_price`, `exec_best_home_book`, `exec_best_away_price`, `exec_best_away_book`
- 6 exec-best LINE columns: `exec_best_home_line`, `exec_best_home_line_price`, `exec_best_home_line_book`, `exec_best_away_line`, `exec_best_away_line_price`, `exec_best_away_line_book`
- 2 observability columns: `ref_books_observed` (jsonb), `exec_books_observed` (jsonb)

Single SQL migration using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. No code changes needed -- just the schema change.

