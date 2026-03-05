import { aetEpochMs } from "@/lib/time";

export type MarketSnapshot = {
  id?: string;
  game_id: string;
  snapshot_type: string;
  market_type: string;
  agg_method?: string;

  snapshot_ts?: string;
  created_at?: string;

  home_price?: number | null;
  away_price?: number | null;

  home_line?: number | null;
  away_line?: number | null;
  home_line_price?: number | null;
  away_line_price?: number | null;

  exec_best_home_price?: number | null;
  exec_best_away_price?: number | null;
  exec_best_home_book?: string | null;
  exec_best_away_book?: string | null;

  exec_best_home_line?: number | null;
  exec_best_home_line_price?: number | null;
  exec_best_home_line_book?: string | null;
  exec_best_away_line?: number | null;
  exec_best_away_line_price?: number | null;
  exec_best_away_line_book?: string | null;
};

/**
 * Returns OPEN and CURRENT snapshot rows for a given market type.
 *
 * OPEN = first snapshot with snapshot_type === "OPEN"
 * CURRENT = most recent snapshot by snapshot_ts
 *           excluding OPEN when newer snapshots exist
 */
export function getMarketSnapshots(
  snapshots: MarketSnapshot[],
  marketType: string,
  aggMethod = "median"
) {
  const marketRows = snapshots.filter(
    (s) =>
      s.market_type === marketType &&
      (!aggMethod || s.agg_method === aggMethod)
  );

  if (!marketRows.length) {
    return { open: null, current: null };
  }

  const open = marketRows.find((s) => s.snapshot_type === "OPEN") ?? null;

  const sorted = [...marketRows].sort((a, b) => {
    const ta = aetEpochMs(a.snapshot_ts) ?? 0;
    const tb = aetEpochMs(b.snapshot_ts) ?? 0;
    return tb - ta;
  });

  const current =
    sorted.find((s) => s.snapshot_type !== "OPEN") ??
    sorted[0] ??
    null;

  return { open, current };
}
