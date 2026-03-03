
ALTER TABLE public.pers_sys_market_snapshots
  ADD COLUMN IF NOT EXISTS exec_best_home_price numeric,
  ADD COLUMN IF NOT EXISTS exec_best_home_book text,
  ADD COLUMN IF NOT EXISTS exec_best_away_price numeric,
  ADD COLUMN IF NOT EXISTS exec_best_away_book text,
  ADD COLUMN IF NOT EXISTS exec_best_home_line numeric,
  ADD COLUMN IF NOT EXISTS exec_best_home_line_price numeric,
  ADD COLUMN IF NOT EXISTS exec_best_home_line_book text,
  ADD COLUMN IF NOT EXISTS exec_best_away_line numeric,
  ADD COLUMN IF NOT EXISTS exec_best_away_line_price numeric,
  ADD COLUMN IF NOT EXISTS exec_best_away_line_book text,
  ADD COLUMN IF NOT EXISTS ref_books_observed jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exec_books_observed jsonb NOT NULL DEFAULT '[]'::jsonb;
