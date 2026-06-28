// supabase/functions/pers-sys-evaluate-systems-v2/index.ts
// deploy-test-marker-1
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MarketType = "H2H" | "LINE" | "TOTALS";
type Side = "HOME" | "AWAY" | "OVER" | "UNDER";
type Status = "READY" | "PENDING" | "FAIL" | "BLOCKED";

type SnapshotRow = {
  game_id: string;
  snapshot_type: string;
  market_type: string;
  home_price: number | null;
  away_price: number | null;
  home_line: number | null;
  away_line: number | null;
  home_line_price: number | null;
  away_line_price: number | null;

  exec_best_home_price: number | null;
  exec_best_away_price: number | null;
  exec_best_home_book: string | null;
  exec_best_away_book: string | null;

  exec_best_home_line: number | null;
  exec_best_home_line_price: number | null;
  exec_best_home_line_book: string | null;

  exec_best_away_line: number | null;
  exec_best_away_line_price: number | null;
  exec_best_away_line_book: string | null;

  total_line: number | null;
  over_price: number | null;
  under_price: number | null;
  exec_best_total_line: number | null;
  exec_best_over_price: number | null;
  exec_best_over_book: string | null;
  exec_best_under_price: number | null;
  exec_best_under_book: string | null;

  ref_books_observed: any[];
  exec_books_observed: any[];
};

type TeamStateRow = {
  game_id: string;
  team_id: string;
  season: number;
  round: number | null;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points_for: number;
  points_against: number;
  percentage: number;
  streak: number;
};

type GameRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  season: number;
  round: number | null;
  venue: string | null;
  start_time_aet: string;
  status: string;
  winner_team_id: string | null;
  loser_team_id: string | null;
  is_draw: boolean;
  home_team?: { canonical_name: string | null; home_state?: string | null };
  away_team?: { canonical_name: string | null; home_state?: string | null };
};

type Outcome = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";

type EvaluatorMode = "ACTION_T30" | "PRECHECK_ONLY" | "CLOSEOUT_ONLY";

const VALID_EVALUATOR_MODES: readonly EvaluatorMode[] = ["ACTION_T30", "PRECHECK_ONLY", "CLOSEOUT_ONLY"];

function resolveEvaluatorMode(rawMode: unknown): EvaluatorMode {
  return typeof rawMode === "string" && VALID_EVALUATOR_MODES.includes(rawMode as EvaluatorMode)
    ? (rawMode as EvaluatorMode)
    : "PRECHECK_ONLY";
}

type SystemV2Row = {
  system_code: string;
  system_name?: string | null;
  active?: boolean | null;

  primary_market?: "H2H" | "LINE" | "TOTALS" | null;
  overlay_market?: "H2H" | "LINE" | "TOTALS" | null;
  execution_snapshot?: "OPEN" | "T30" | "T10" | null;
  model_snapshot?: "OPEN" | "T30" | "T10" | null;

  allow_candidate?: boolean | null;
  signal_mode?: "HARD_FAIL" | "ALLOW_CANDIDATE" | null;

  round_min?: number | null;
  round_max?: number | null;
  rounds_remaining_min?: number | null;
  rounds_remaining_max?: number | null;
  season_progress_round_min?: number | null;

  date_start_mmdd?: string | null;
  date_end_mmdd?: string | null;

  exclude_seasons?: number[] | null;

  clv_required?: boolean | null;
  clv_min?: number | null;

  staking_config?: any | null;
  amplifier_config?: any | null;
  overlay_config?: any | null;

  system_priority?: number | null;
  system_group?: string | null;
  evaluation_version?: number | null;
};

function mmddMelbourne(date: Date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${m}-${d}`;
}

function inDateWindowAET(startMMDD: string, endMMDD: string, dateAET: Date) {
  const x = mmddMelbourne(dateAET);
  return x >= startMMDD && x <= endMMDD;
}

function premiershipPoints(wins: number, draws: number) {
  return wins * 4 + draws * 2;
}

function relCLV(openPrice: number, closePrice: number) {
  return (closePrice - openPrice) / openPrice;
}

function readCfgNum(obj: any, keys: string[], fallback: number | null = null): number | null {
  for (const key of keys) {
    const raw = obj?.[key];
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function assertSys8Config(sys: SystemV2Row) {
  const stakingCfg = sys.staking_config ?? {};
  const ampCfg = sys.amplifier_config ?? {};

  const required: Array<[string, number | null]> = [
    ["stake_base_pct", readCfgNum(stakingCfg, ["stake_base_pct", "base_pct_bankroll", "base_bankroll_pct"], null)],
    ["max_pct_bankroll", readCfgNum(stakingCfg, ["max_pct_bankroll"], null)],
    ["totals_move_min", readCfgNum(stakingCfg, ["totals_move_min"], null)],
    ["model_total_min", readCfgNum(stakingCfg, ["model_total_min"], null)],
    ["model_total_max_exclusive", readCfgNum(stakingCfg, ["model_total_max_exclusive"], null)],
    ["early_agreement_move_min", readCfgNum(stakingCfg, ["early_agreement_move_min"], null)],
    ["strong_momentum_move_min", readCfgNum(stakingCfg, ["strong_momentum_move_min"], null)],
    ["day_game_boost_pct", readCfgNum(ampCfg, ["day_game_boost_pct", "day_game_boost"], null)],
    ["marvel_boost_pct", readCfgNum(ampCfg, ["marvel_boost_pct", "marvel_boost"], null)],
    ["early_agreement_boost_pct", readCfgNum(ampCfg, ["early_agreement_boost_pct", "early_agreement_boost"], null)],
    ["strong_momentum_boost_pct", readCfgNum(ampCfg, ["strong_momentum_boost_pct", "strong_momentum_boost"], null)],
  ];

  const missing = required.filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`SYS_8 config missing required keys: ${missing.join(", ")}`);
  }
}

function pickSnap(snaps: SnapshotRow[], snapshot_type: string, market_type: MarketType): SnapshotRow | null {
  return snaps.find((s) => s.snapshot_type === snapshot_type && s.market_type === market_type) ?? null;
}

function buildLegH2H(args: {
  system_code: string;
  snapshot_type: string;
  side: Side;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  ref_books_observed?: any[];
  exec_books_observed?: any[];
}) {
  return {
    system_code: args.system_code,
    snapshot_type: args.snapshot_type,
    leg_type: "H2H",
    side: args.side,
    line_at_bet: null,
    ref_price: args.ref_price ?? null,
    exec_best_price: args.exec_best_price ?? null,
    exec_best_book: args.exec_best_book ?? null,
    ref_books_observed: args.ref_books_observed ?? [],
    exec_books_observed: args.exec_books_observed ?? [],
  };
}

function buildLegLine(args: {
  system_code: string;
  snapshot_type: string;
  side: Side;
  line_at_bet: number | null;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  ref_books_observed?: any[];
  exec_books_observed?: any[];
}) {
  return {
    system_code: args.system_code,
    snapshot_type: args.snapshot_type,
    leg_type: "LINE",
    side: args.side,
    line_at_bet: args.line_at_bet ?? null,
    ref_price: args.ref_price ?? null,
    exec_best_price: args.exec_best_price ?? null,
    exec_best_book: args.exec_best_book ?? null,
    ref_books_observed: args.ref_books_observed ?? [],
    exec_books_observed: args.exec_books_observed ?? [],
  };
}

function buildLegTotals(args: {
  system_code: string;
  snapshot_type: string;
  side: "OVER" | "UNDER";
  line_at_bet: number | null;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  ref_books_observed?: any[];
  exec_books_observed?: any[];
}) {
  return {
    system_code: args.system_code,
    snapshot_type: args.snapshot_type,
    leg_type: "TOTALS",
    side: args.side,
    line_at_bet: args.line_at_bet ?? null,
    ref_price: args.ref_price ?? null,
    exec_best_price: args.exec_best_price ?? null,
    exec_best_book: args.exec_best_book ?? null,
    ref_books_observed: args.ref_books_observed ?? [],
    exec_books_observed: args.exec_books_observed ?? [],
  };
}

async function getPriorOutcomeForTeam(args: {
  supabase: any;
  season: number;
  teamId: string;
  gameStartIso: string;
}): Promise<Outcome> {
  const { supabase, season, teamId, gameStartIso } = args;

  const { data: priorGames, error } = await supabase
    .from("pers_sys_games")
    .select("id,start_time_aet,winner_team_id,loser_team_id,is_draw,status,home_team_id,away_team_id")
    .eq("season", season)
    .eq("status", "FT")
    .lt("start_time_aet", gameStartIso)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("start_time_aet", { ascending: false })
    .limit(5);

  if (error || !priorGames || priorGames.length === 0) return "UNKNOWN";

  for (const pg of priorGames as any[]) {
    if (pg.is_draw) return "DRAW";
    if (pg.winner_team_id && pg.loser_team_id) {
      if (pg.winner_team_id === teamId) return "WIN";
      if (pg.loser_team_id === teamId) return "LOSS";
    }
  }
  return "UNKNOWN";
}

async function getWinStreakBeforeGame(args: {
  supabase: any;
  season: number;
  teamId: string;
  gameStartIso: string;
  maxLookback?: number;
}): Promise<number> {
  const { supabase, season, teamId, gameStartIso, maxLookback = 10 } = args;

  const { data: priorGames, error } = await supabase
    .from("pers_sys_games")
    .select("id,start_time_aet,winner_team_id,loser_team_id,is_draw,status,home_team_id,away_team_id")
    .eq("season", season)
    .eq("status", "FT")
    .lt("start_time_aet", gameStartIso)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("start_time_aet", { ascending: false })
    .limit(maxLookback);

  if (error || !priorGames || priorGames.length === 0) return 0;

  let streak = 0;
  for (const pg of priorGames as any[]) {
    if (pg.is_draw) break;
    if (pg.winner_team_id === teamId) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

async function getLossLikeStreakBeforeGame(args: {
  supabase: any;
  season: number;
  teamId: string;
  gameStartIso: string;
  drawCountsAsLoss: boolean;
  maxLookback?: number;
}): Promise<number> {
  const { supabase, season, teamId, gameStartIso, drawCountsAsLoss, maxLookback = 10 } = args;

  const { data: priorGames, error } = await supabase
    .from("pers_sys_games")
    .select("id,start_time_aet,winner_team_id,loser_team_id,is_draw,status,home_team_id,away_team_id")
    .eq("season", season)
    .eq("status", "FT")
    .lt("start_time_aet", gameStartIso)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("start_time_aet", { ascending: false })
    .limit(maxLookback);

  if (error || !priorGames || priorGames.length === 0) return 0;

  let streak = 0;
  for (const pg of priorGames as any[]) {
    if (pg.is_draw) {
      if (!drawCountsAsLoss) break;
      streak += 1;
      continue;
    }
    if (pg.loser_team_id === teamId) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function hasMarketData(s: SnapshotRow | null, market: MarketType) {
  if (!s) return false;
  if (market === "H2H") return !!(s.home_price && s.away_price);
  if (market === "TOTALS") return s.total_line !== null && !!(s.over_price && s.under_price);
  return s.home_line !== null && s.away_line !== null && !!(s.home_line_price && s.away_line_price);
}

function resolveOneUPctForSystem(systemCode: string, stakingConfig: any): number | null {
  const globalOneU = Number(stakingConfig?.global_1u_pct);

  if (systemCode === "SYS_3" || systemCode === "SYS_7") {
    const systemOverride = Number(stakingConfig?.system_7_1u_pct);
    if (Number.isFinite(systemOverride) && systemOverride > 0) return systemOverride;
    if (Number.isFinite(globalOneU) && globalOneU > 0) return globalOneU;
    return null;
  }

  if (Number.isFinite(globalOneU) && globalOneU > 0) return globalOneU;
  return null;
}

function toCanonicalBankrollPct(args: {
  systemCode: string;
  recommendedUnits: number | null | undefined;
  stakingConfig: any;
}): number | null {
  const { systemCode, stakingConfig } = args;
  const v = Number(args.recommendedUnits);

  // Unit-based systems normalize via 1u precedence: system override -> global -> null
  if (systemCode === "SYS_3" || systemCode === "SYS_7") {
    if (!Number.isFinite(v) || v <= 0) return null;
    const oneU = resolveOneUPctForSystem(systemCode, stakingConfig);
    if (!oneU) return null;
    return Number((v * oneU).toFixed(6));
  }

  // Percent-style systems currently emit percent-point-like numbers in recommended_units.
  if (Number.isFinite(v) && v > 0) {
    return Number((v / 100).toFixed(6));
  }

  // Fallback for systems that may not set recommended_units (e.g. SYS_4 transitional cases)
  const cfgRaw =
    stakingConfig?.base_bankroll_pct ??
    stakingConfig?.base_pct_bankroll ??
    stakingConfig?.line_pct_bankroll ??
    null;
  const cfg = Number(cfgRaw);
  if (!Number.isFinite(cfg) || cfg <= 0) return null;
  return Number((cfg > 1 ? cfg / 100 : cfg).toFixed(6));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body.season ?? new Date().getFullYear());
    const horizonDays = Number(body.horizon_days ?? 10);
    const evaluatorMode = resolveEvaluatorMode(body.evaluator_mode);
    const onlyGameId =
      typeof body.game_id === "string" && body.game_id.trim()
        ? body.game_id.trim()
        : null;

    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // systems v2
    const { data: systems, error: systemsErr } = await supabase
      .from("pers_sys_systems_v2")
      .select("*")
      .eq("active", true);

    if (systemsErr) throw systemsErr;

    // system priority (cascade)
    const { data: pri, error: priErr } = await supabase
      .from("pers_sys_system_priority")
      .select("system_code, rank, collision_rank, dominates_match, allow_stack, max_exposure_pct, tie_break");

    if (priErr) throw priErr;

    const priByCode = new Map<string, any>();
    for (const p of (pri || []) as any[]) priByCode.set(p.system_code, p);

    const systemsSorted = [...(systems || [])].sort((a: any, b: any) => {
      const ra = Number(priByCode.get(a.system_code)?.rank ?? 999);
      const rb = Number(priByCode.get(b.system_code)?.rank ?? 999);
      return ra - rb;
    });

    const dominatesByCode = new Set<string>(
      ((pri || []) as any[]).filter((p) => !!p.dominates_match).map((p) => p.system_code),
    );

    // A system is in the side/line collision queue only if collision_rank is not null
    // AND its primary market is H2H or LINE. TOTALS systems (e.g. SYS_8, SYS_9) stay outside.
    const isInCollisionQueue = (sysCode: string, primaryMarket: string): boolean => {
      const p = priByCode.get(sysCode);
      if (!p || p.collision_rank == null) return false;
      return primaryMarket === "H2H" || primaryMarket === "LINE";
    };

    // per-game side/line dominance latch (filled as we evaluate, only for collision-queue systems)
    const dominatedByGame: Record<string, string> = {};

    // upcoming games
    let gamesQuery = supabase
      .from("pers_sys_games")
      .select(`
        *,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(id, canonical_name, home_state),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(id, canonical_name, home_state)
      `)
      .eq("season", season)
      .eq("status", "SCHEDULED");

    if (onlyGameId) {
      gamesQuery = gamesQuery.eq("id", onlyGameId);
    } else {
      gamesQuery = gamesQuery
        .gte("start_time_aet", startIso)
        .lte("start_time_aet", endIso);
    }

    gamesQuery = gamesQuery
      .order("start_time_aet", { ascending: true })
      .limit(200);

    const { data: upcomingGames, error: gamesErr } = await gamesQuery;

    if (gamesErr) throw gamesErr;

    if (!systems?.length || !upcomingGames?.length) {
      return new Response(JSON.stringify({ ok: true, season, evaluator_mode: evaluatorMode, signals_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameIds = upcomingGames.map((g: any) => g.id);

    const { data: teamStates, error: teamStatesErr } = await supabase
      .from("pers_sys_team_state")
      .select("*")
      .in("game_id", gameIds);
    if (teamStatesErr) throw teamStatesErr;

    const { data: snapshots, error: snapsErr } = await supabase
      .from("pers_sys_market_snapshots")
      .select("*")
      .in("game_id", gameIds);
    if (snapsErr) throw snapsErr;

    const { data: roundCtx, error: roundCtxErr } = await supabase
      .from("pers_sys_round_context")
      .select("*")
      .eq("season", season);
    if (roundCtxErr) throw roundCtxErr;

    const { data: seasonMeta, error: seasonMetaErr } = await supabase
      .from("pers_sys_season_meta")
      .select("*")
      .eq("season", season - 1)
      .maybeSingle();
    if (seasonMetaErr) throw seasonMetaErr;

    // totalRounds (authoritative):
    // 1) prefer pers_sys_season_config.total_rounds
    // 2) fallback to max(round) from pers_sys_games for the season
    // 3) final fallback to upcomingGames max round
    let totalRounds = 0;

    {
      const { data: seasonCfg, error: seasonCfgErr } = await supabase
        .from("pers_sys_season_config")
        .select("total_rounds")
        .eq("season", season)
        .maybeSingle();

      if (seasonCfgErr) throw seasonCfgErr;

      if (
        seasonCfg &&
        typeof (seasonCfg as any).total_rounds === "number" &&
        (seasonCfg as any).total_rounds > 0
      ) {
        totalRounds = Number((seasonCfg as any).total_rounds);
      }
    }

    if (!totalRounds) {
      const { data: seasonRounds, error: seasonRoundsErr } = await supabase
        .from("pers_sys_games")
        .select("round")
        .eq("season", season)
        .not("round", "is", null)
        .order("round", { ascending: false })
        .limit(1);

      if (seasonRoundsErr) throw seasonRoundsErr;

      const maxRound = Number((seasonRounds?.[0] as any)?.round ?? 0);
      if (maxRound > 0) totalRounds = maxRound;
    }

    if (!totalRounds) {
      totalRounds = Math.max(
        ...upcomingGames.map((g: any) => (typeof g.round === "number" ? g.round : 0)),
      );
    }

    const stateByGameTeam: Record<string, TeamStateRow> = {};
    for (const s of (teamStates as any[]) || []) stateByGameTeam[`${s.game_id}_${s.team_id}`] = s;

    const snapsByGame: Record<string, SnapshotRow[]> = {};
    for (const s of (snapshots as any[]) || []) {
      if (!snapsByGame[s.game_id]) snapsByGame[s.game_id] = [];
      snapsByGame[s.game_id].push(s);
    }

    const roundCtxByRound: Record<number, any> = {};
    for (const rc of (roundCtx as any[]) || []) if (typeof rc.round === "number") roundCtxByRound[rc.round] = rc;

    // ------------------------------------------------------------
    // Top 10 ladder cutoff (SYS_1 era migration).
    // Structural Top 10 / wildcard-era migration: legacy build-features
    // only persists points_8th. Compute points_10th here from completed
    // games without altering schema. No historical Top 10 backtest exists.
    // ------------------------------------------------------------
    const points10thByRound: Record<number, number> = {};
    {
      const { data: completedGames } = await supabase
        .from("pers_sys_games")
        .select("round, home_team_id, away_team_id, home_score, away_score, status")
        .eq("season", season)
        .eq("status", "FT");

      const rounds = [
        ...new Set(
          ((completedGames as any[]) || [])
            .map((g) => g.round)
            .filter((r: any) => typeof r === "number" && Number.isFinite(r)),
        ),
      ].sort((a: number, b: number) => a - b);

      for (const r of rounds) {
        const upTo = ((completedGames as any[]) || []).filter(
          (g) => typeof g.round === "number" && g.round <= r,
        );
        const ladder: Record<string, { wins: number; draws: number; pf: number; pa: number }> = {};
        for (const g of upTo) {
          if (!ladder[g.home_team_id]) ladder[g.home_team_id] = { wins: 0, draws: 0, pf: 0, pa: 0 };
          if (!ladder[g.away_team_id]) ladder[g.away_team_id] = { wins: 0, draws: 0, pf: 0, pa: 0 };
          const hs = g.home_score ?? 0;
          const as_ = g.away_score ?? 0;
          ladder[g.home_team_id].pf += hs;
          ladder[g.home_team_id].pa += as_;
          ladder[g.away_team_id].pf += as_;
          ladder[g.away_team_id].pa += hs;
          if (hs > as_) ladder[g.home_team_id].wins++;
          else if (as_ > hs) ladder[g.away_team_id].wins++;
          else { ladder[g.home_team_id].draws++; ladder[g.away_team_id].draws++; }
        }
        const sorted = Object.entries(ladder)
          .map(([tid, s]) => ({ tid, points: s.wins * 4 + s.draws * 2, pct: s.pa > 0 ? (s.pf / s.pa) * 100 : 100 }))
          .sort((a, b) => b.points - a.points || b.pct - a.pct);
        if (sorted.length >= 10) {
          points10thByRound[r as number] = sorted[9].points;
        }
      }
    }

    const venueStateByVenue: Record<string, string> = {};
    {
      const { data: vs } = await supabase.from("pers_sys_venue_state").select("*").limit(5000);
      for (const row of (vs as any[]) || []) {
        const venueKey = (row.venue_key ?? row.venue) as string | null;
        const st = row.state as string | null;
        if (venueKey && st) venueStateByVenue[String(venueKey)] = String(st);
      }
    }

    async function upsertSignalV2(args: {
      system_code: string;
      game_id: string;
      model_snapshot: string;
      execution_snapshot: string;
      model_market: MarketType;
      execution_market: MarketType;
      pass: boolean;
      signal_status: string; // READY | PENDING
      leg_type: MarketType;
      side: Side;
      line_at_bet: number | null;
      ref_price: number | null;
      exec_best_price: number | null;
      exec_best_book: string | null;
      recommended_units: number | null;
      recommended_bankroll_pct: number | null;
      staking_contract_version: string;
      reason_json: Record<string, any>;
    }) {
      const { error } = await supabase.from("pers_sys_signals_v2").upsert(
        {
          system_code: args.system_code,
          game_id: args.game_id,
          model_snapshot: args.model_snapshot,
          execution_snapshot: args.execution_snapshot,
          model_market: args.model_market,
          execution_market: args.execution_market,
          pass: args.pass,
          signal_status: args.signal_status,
          leg_type: args.leg_type,
          side: args.side,
          line_at_bet: args.line_at_bet,
          ref_price: args.ref_price,
          exec_best_price: args.exec_best_price,
          exec_best_book: args.exec_best_book,
          recommended_units: args.recommended_units,
          recommended_bankroll_pct: args.recommended_bankroll_pct,
          staking_contract_version: args.staking_contract_version,
          reason_json: args.reason_json,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: "system_code,game_id,execution_snapshot,leg_type,side" },
      );
      if (error) console.error("upsert error:", args.system_code, args.game_id, error.message);
      return !error;
    }

    async function upsertAuditV2(args: {
      system_code: string;
      game_id: string;
      season: number;
      round: number | null;
      model_snapshot: string;
      execution_snapshot: string;
      model_market: MarketType;
      execution_market: MarketType;
      audit_status: "READY" | "PENDING" | "FAIL" | "BLOCKED";
      fail_stage: "GATE" | "DATA" | "MODEL" | "EXEC" | "OVERLAY" | "SYSTEM" | null;
      fail_code: string | null;
      leg_type: MarketType | null;
      side: Side | null;
      line_at_bet: number | null;
      ref_price: number | null;
      exec_best_price: number | null;
      exec_best_book: string | null;
      recommended_units: number | null;
      recommended_bankroll_pct: number | null;
      staking_contract_version: string;
      reason_json: Record<string, any>;
    }) {
      const audit_key = `${args.leg_type ?? "NONE"}:${args.side ?? "NONE"}`;

      const { error } = await supabase
        .from("pers_sys_signal_audit_v2")
        .upsert(
          {
            system_code: args.system_code,
            game_id: args.game_id,
            season: args.season,
            round: args.round,
            model_snapshot: args.model_snapshot,
            execution_snapshot: args.execution_snapshot,
            model_market: args.model_market,
            execution_market: args.execution_market,
            audit_status: args.audit_status,
            fail_stage: args.fail_stage,
            fail_code: args.fail_code,
            audit_key,
            leg_type: args.leg_type,
            side: args.side,
            line_at_bet: args.line_at_bet,
            ref_price: args.ref_price,
            exec_best_price: args.exec_best_price,
            exec_best_book: args.exec_best_book,
            recommended_units: args.recommended_units,
            recommended_bankroll_pct: args.recommended_bankroll_pct,
            staking_contract_version: args.staking_contract_version,
            reason_json: args.reason_json,
            evaluated_at: new Date().toISOString(),
          },
          { onConflict: "system_code,game_id,model_snapshot,execution_snapshot,audit_key" },
        );

      if (error) {
        console.error("audit upsert error:", args.system_code, args.game_id, error.message);
      }
    }

    // ---------------------------------------------------------------
    // Phase 2A — Passive weather visibility (read-only).
    // Reads latest pers_sys_weather_assessments row for (game, system, T30)
    // and returns a flat payload to be merged into audit reason_json.
    // MUST NOT alter signal decisions, stake, or any side-effects.
    // ---------------------------------------------------------------
    function computeWeatherShadow(payload: Record<string, any>): Record<string, any> {
      const weather_enabled = Boolean(payload.weather_enabled);
      const status = payload.weather_status;
      const outcome = payload.weather_outcome;
      const reason = payload.weather_reason_code;

      let shadow_action = "NO_WEATHER_ACTION";
      let shadow_reason: string | null = reason ?? null;
      let would_suppress = false;
      let would_halve = false;
      let would_keep_full = false;

      if (status === "NOT_ENABLED" || !weather_enabled) {
        shadow_action = "WEATHER_NOT_ENABLED";
        shadow_reason = "system_weather_not_enabled";
      } else if (status === "ERROR") {
        shadow_action = "WEATHER_ERROR";
        shadow_reason = reason ?? "weather_read_error";
      } else if (status === "NOT_FOUND") {
        shadow_action = "WEATHER_NOT_FOUND";
        shadow_reason = "missing_t30_weather_assessment";
      } else if (status === "NOT_APPLICABLE" || outcome === "NOT_APPLICABLE") {
        shadow_action = "NO_WEATHER_ACTION";
        shadow_reason = reason ?? "indoor_venue";
      } else if (status === "FOUND") {
        if (outcome === "PASS") {
          shadow_action = "WOULD_SUPPRESS_SIGNAL";
          would_suppress = true;
        } else if (outcome === "HALF_STAKE") {
          shadow_action = "WOULD_HALF_STAKE";
          would_halve = true;
        } else if (outcome === "FULL_STAKE") {
          shadow_action = "WOULD_KEEP_FULL_STAKE";
          would_keep_full = true;
        }
        shadow_reason = reason ?? null;
      }

      return {
        ...payload,
        weather_shadow_enabled: weather_enabled,
        weather_shadow_action: shadow_action,
        weather_shadow_reason: shadow_reason,
        weather_shadow_would_suppress: would_suppress,
        weather_shadow_would_halve_stake: would_halve,
        weather_shadow_would_keep_full_stake: would_keep_full,
        weather_shadow_applied: false,
      };
    }

    // ---------------------------------------------------------------
    // Phase 4A: Active weather decisioning helper (disabled by default).
    // Pure mapping over the shadow payload. When the per-system flag
    // weather_active_decisioning_enabled is false (the default for all
    // systems), this helper records DISABLED audit fields only and does
    // NOT alter signal status, stake, alerts, bets, or any side-effect.
    // The active path is consumed by callers ONLY behind the flag; the
    // evaluator does not act on these fields in Phase 4A.
    // ---------------------------------------------------------------
    function computeWeatherActiveDecision(
      payload: Record<string, any>,
      active_enabled: boolean,
    ): Record<string, any> {
      if (!active_enabled) {
        return {
          ...payload,
          weather_active_decisioning_enabled: false,
          weather_active_action: "DISABLED",
          weather_active_reason: "weather_active_decisioning_disabled",
          weather_active_applied: false,
          weather_active_would_change_signal: false,
          weather_active_would_change_stake: false,
        };
      }

      const status = payload.weather_status;
      const outcome = payload.weather_outcome;
      const reason = payload.weather_reason_code;

      let action = "ACTIVE_NO_ACTION";
      let action_reason: string | null = reason ?? null;
      let would_change_signal = false;
      let would_change_stake = false;

      if (status === "NOT_ENABLED") {
        action = "ACTIVE_NOT_ENABLED";
        action_reason = "system_weather_not_enabled";
      } else if (status === "ERROR") {
        action = "ACTIVE_WEATHER_ERROR";
        action_reason = reason ?? "weather_read_error";
      } else if (status === "NOT_FOUND") {
        action = "ACTIVE_WEATHER_NOT_FOUND";
        action_reason = "missing_t30_weather_assessment";
      } else if (status === "NOT_APPLICABLE" || outcome === "NOT_APPLICABLE") {
        action = "ACTIVE_NO_ACTION";
        action_reason = reason ?? "indoor_venue";
      } else if (status === "FOUND") {
        if (outcome === "PASS") {
          action = "WOULD_ACTIVE_SUPPRESS";
          action_reason = "active_weather_pass";
          would_change_signal = true;
        } else if (outcome === "HALF_STAKE") {
          action = "WOULD_ACTIVE_HALF_STAKE";
          action_reason = "active_weather_half_stake";
          would_change_stake = true;
        } else if (outcome === "FULL_STAKE") {
          action = "WOULD_ACTIVE_KEEP_FULL_STAKE";
          action_reason = reason ?? null;
        }
      }

      return {
        ...payload,
        weather_active_decisioning_enabled: true,
        weather_active_action: action,
        weather_active_reason: action_reason,
        // Phase 4A: never actually applied to live signals/stake.
        weather_active_applied: false,
        weather_active_would_change_signal: would_change_signal,
        weather_active_would_change_stake: would_change_stake,
      };
    }
    async function loadPassiveWeatherAssessmentWithActive(
      sys: any,
      game_id: string,
    ): Promise<Record<string, any>> {
      const shadow = await loadPassiveWeatherAssessment(sys, game_id);
      const active_enabled = Boolean(sys?.weather_active_decisioning_enabled);
      return computeWeatherActiveDecision(shadow, active_enabled);
    }

    async function loadPassiveWeatherAssessment(
      sys: any,
      game_id: string,
    ): Promise<Record<string, any>> {
      const weather_enabled = Boolean(sys?.weather_enabled);
      const weather_policy_code = sys?.weather_policy_code ?? null;
      const weather_assessment_stage = sys?.weather_gate_snapshot ?? "T30";

      const base = {
        weather_enabled,
        weather_policy_code,
        weather_assessment_stage,
        weather_outcome: null as string | null,
        weather_reason_code: null as string | null,
        weather_wind_kmh_max: null as number | null,
        weather_gust_kmh_max: null as number | null,
        weather_rain_mm_total: null as number | null,
        weather_snapshot_id: null as string | null,
        weather_assessed_at: null as string | null,
        weather_status: "NOT_ENABLED" as
          | "FOUND"
          | "NOT_FOUND"
          | "NOT_ENABLED"
          | "NOT_APPLICABLE"
          | "ERROR",
      };

      if (!weather_enabled) return computeWeatherShadow(base);

      try {
        const { data, error } = await supabase
          .from("pers_sys_weather_assessments")
          .select(
            "outcome, reason_code, wind_kmh_max, gust_kmh_max, rain_mm_total, weather_snapshot_id, assessed_at",
          )
          .eq("game_id", game_id)
          .eq("system_code", String(sys.system_code))
          .eq("assessment_stage", "T30")
          .order("assessed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          return computeWeatherShadow({ ...base, weather_status: "ERROR", weather_reason_code: "read_error" });
        }
        if (!data) {
          return computeWeatherShadow({ ...base, weather_status: "NOT_FOUND" });
        }

        const outcome = (data as any).outcome ?? null;
        const status = outcome === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "FOUND";

        return computeWeatherShadow({
          ...base,
          weather_outcome: outcome,
          weather_reason_code: (data as any).reason_code ?? null,
          weather_wind_kmh_max: (data as any).wind_kmh_max ?? null,
          weather_gust_kmh_max: (data as any).gust_kmh_max ?? null,
          weather_rain_mm_total: (data as any).rain_mm_total ?? null,
          weather_snapshot_id: (data as any).weather_snapshot_id ?? null,
          weather_assessed_at: (data as any).assessed_at ?? null,
          weather_status: status,
        });
      } catch (_e) {
        return computeWeatherShadow({ ...base, weather_status: "ERROR", weather_reason_code: "exception" });
      }
    }


    let signalsCreated = 0;

    for (const sysRaw of systemsSorted as any[]) {
      const sys = sysRaw as SystemV2Row;
      const system_code = String(sys.system_code);

      if (system_code === "SYS_8") {
        assertSys8Config(sys);
      }

      const modelSnap = String(sys.model_snapshot ?? "T10");
      const execSnap = String(sys.execution_snapshot ?? "T30");

      // Rules snapshot policy:
      // - T10 is treated as bookkeeping-only (close), so evaluate criteria using T30 instead.
      // - Exception: SYS_7 is explicitly "close-only" by spec, so it may use T10.
      const rulesSnap =
        modelSnap === "T10" && system_code !== "SYS_7"
          ? "T30"
          : modelSnap;

      const allowCandidate = (sys.signal_mode ?? (sys.allow_candidate ? "ALLOW_CANDIDATE" : "HARD_FAIL")) ===
        "ALLOW_CANDIDATE";

      for (const game of upcomingGames as any[]) {
        const g = game as GameRow;
        const round = g.round;
        if (round === null || round === undefined) continue;

        // season excludes
        if (Array.isArray(sys.exclude_seasons) && sys.exclude_seasons.includes(season)) continue;

        // round gates
        const roundMin = (sys as any).round_min;
        const roundMax = (sys as any).round_max;

        if (typeof roundMin === "number" && round < roundMin) continue;
        if (typeof roundMax === "number" && round > roundMax) continue;

        if (typeof sys.season_progress_round_min === "number" && round < sys.season_progress_round_min) continue;

        // rounds remaining gate
        if (typeof sys.rounds_remaining_min === "number" || typeof sys.rounds_remaining_max === "number") {
          const rr = totalRounds - round + 1;
          if (typeof sys.rounds_remaining_min === "number" && rr < sys.rounds_remaining_min) continue;
          if (typeof sys.rounds_remaining_max === "number" && rr > sys.rounds_remaining_max) continue;
        }

        // date window (MM-DD)
        if (sys.date_start_mmdd && sys.date_end_mmdd) {
          const ok = inDateWindowAET(String(sys.date_start_mmdd), String(sys.date_end_mmdd), new Date(g.start_time_aet));
          if (!ok) continue;
        }

        const homeState = stateByGameTeam[`${g.id}_${g.home_team_id}`];
        const awayState = stateByGameTeam[`${g.id}_${g.away_team_id}`];
        const gameSnaps = snapsByGame[g.id] || [];

        const openH2H = pickSnap(gameSnaps, "OPEN", "H2H");
        const openLine = pickSnap(gameSnaps, "OPEN", "LINE");
        const openTotals = pickSnap(gameSnaps, "OPEN", "TOTALS");
        const modelH2H = pickSnap(gameSnaps, rulesSnap, "H2H");
        const modelLine = pickSnap(gameSnaps, rulesSnap, "LINE");
        const modelTotals = pickSnap(gameSnaps, rulesSnap, "TOTALS");
        const execH2H = pickSnap(gameSnaps, execSnap, "H2H");
        const execLine = pickSnap(gameSnaps, execSnap, "LINE");
        const execTotals = pickSnap(gameSnaps, execSnap, "TOTALS");

        const reason: Record<string, any> = {
          system_code,
          season,
          round,
          model_snapshot: modelSnap,
          execution_snapshot: execSnap,
          rules_snapshot: rulesSnap,
          legs: [] as any[],
          staking_config: sys.staking_config ?? null,
          amplifier_config: sys.amplifier_config ?? null,
          overlay_config: sys.overlay_config ?? null,
          system_priority: sys.system_priority ?? null,
          system_group: sys.system_group ?? null,
          evaluation_version: sys.evaluation_version ?? null,
        };

        const classifyFailStage = (
          code: string | undefined | null,
        ): "GATE" | "DATA" | "MODEL" | "EXEC" | "OVERLAY" | "SYSTEM" => {
          const c = String(code || "");
          if (
            c.startsWith("missing_") ||
            c === "no_gf_winner_set"
          ) return "DATA";

          if (
            c === "window"
          ) return "GATE";

          if (
            c.startsWith("blocked_by_")
          ) return "SYSTEM";

          if (
            c.includes("overlay") ||
            c.includes("awaiting_t30_snapshot") ||
            c.includes("waiting_overlay_snapshot")
          ) return "OVERLAY";

          return "MODEL";
        };

        const isStructuralFail = (code: string | undefined | null): boolean => {
          const c = String(code || "");

          // Pure time/market-dependent states are NOT structural
          if (
            c === "awaiting_t30_snapshot" ||
            c === "waiting_overlay_snapshot" ||
            c === "missing_execution_snapshot" ||
            c === "overlay_clv_fail" ||
            c === "clv_fail" ||
            c === "line_clv" ||
            c === "missing_clv_prices" ||
            c === "missing_lines"
          ) {
            return false;
          }

          // If it is a gate/system/data issue tied to fixture/identity/window, treat as structural
          if (
            c === "window" ||
            c === "gf_replay_excluded" ||
            c === "gf_winner_not_in_game" ||
            c === "gf_not_fav_open" ||
            c === "gf_open_odds_band" ||
            c === "not_home_underdog" ||
            c === "not_away_dog_open" ||
            c === "not_home_fav" ||
            c === "not_interstate" ||
            c === "venue_state" ||
            c === "opponent_not_top8" ||
            c === "opponent_not_top10_or_wildcard_live" ||
            c === "dead_team_not_identified_vs_10th" ||
            c === "opponent_wins" ||
            c === "dead_side_ambiguous" ||
            c === "h2h_band" ||
            c === "line_not_positive" ||
            c === "fav_odds_band" ||
            c === "fav_streak" ||
            c === "pct_diff" ||
            c === "open_band" ||
            c === "odds_band" ||
            c === "excluded_state" ||
            c === "not_lost_prior" ||
            c === "totals_move_lt_3" ||
            c === "totals_band" ||
            c === "missing_totals_data" ||
            c === "missing_totals_line"
          ) {
            return true;
          }

          // missing model data / missing round context are effectively structural for UI purposes
          if (
            c === "missing_model_data" ||
            c === "missing_round_context" ||
            c === "no_gf_winner_set"
          ) {
            return true;
          }

          return false;
        };

        // default state
        let modelPass = true;

        // -------------------------
        // SYSTEM-SPECIFIC RULES
        // -------------------------

        // ==============================
        // SYS_1 — Dead Teams CLV Line Model (HARD+)
        // Top 10 / wildcard era migration: dead team measured vs 10th place,
        // opponent must be Top 10 or wildcard-live (within 8 pts of 10th).
        // No historical Top 10 backtest exists; this is a structural
        // extrapolation of the prior Top 8 rule.
        // ==============================
        if (system_code === "SYS_1") {
          // --- window check (rounds remaining 3–7) ---
          const rc = roundCtxByRound[round];
          const points10th = points10thByRound[round];
          if (!rc || typeof points10th !== "number") {
            modelPass = false;
            reason.fail = "missing_round_context";
            reason.cutline_basis = "top10";
          } else {
            const remaining = totalRounds - round + 1;
            reason.remaining_rounds = remaining;
            reason.cutline_basis = "top10";
            reason.points_10th = points10th;

            if (remaining < 3 || remaining > 7) {
              modelPass = false;
              reason.fail = "window";
            }
          }

          // --- ladder rule (vs 10th place) ---
          if (modelPass) {
            if (!homeState || !awayState) {
              modelPass = false;
              reason.fail = "missing_ladder";
            } else {
              const homePts = premiershipPoints(homeState.wins, homeState.draws);
              const awayPts = premiershipPoints(awayState.wins, awayState.draws);

              const minBehind = 8; // >= 8 premiership points behind 10th place
              const homeBehind = points10th - homePts;
              const awayBehind = points10th - awayPts;

              const homeDead = homeBehind >= minBehind;
              const awayDead = awayBehind >= minBehind;

              if (!homeDead && !awayDead) {
                modelPass = false;
                reason.fail = "dead_team_not_identified_vs_10th";
              } else if (homeDead && awayDead) {
                modelPass = false;
                reason.fail = "dead_side_ambiguous";
              } else {
                const deadSide: Side = homeDead ? "HOME" : "AWAY";
                reason.dead_side = deadSide;
                reason.dead_team_behind_10th = homeDead ? homeBehind : awayBehind;

                // opponent must be Top 10 OR wildcard-live (within 8 pts of 10th)
                const oppPts = deadSide === "HOME" ? awayPts : homePts;
                const oppBehind = points10th - oppPts;
                reason.opponent_behind_10th = oppBehind;
                const oppTop10OrWildcard = oppBehind < minBehind; // at-or-above 10th, or live for wildcard contention
                if (!oppTop10OrWildcard) {
                  modelPass = false;
                  reason.fail = "opponent_not_top10_or_wildcard_live";
                }


                if (modelPass) {
                  // --- CLV check (line-based, >= 3%) ---
                  if (!openLine || !modelLine) {
                    modelPass = false;
                    reason.fail = "missing_model_data";
                  } else {
                    const openPrice = deadSide === "HOME" ? openLine.home_line_price : openLine.away_line_price;
                    const closePrice = deadSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price;

                    if (!openPrice || !closePrice) {
                      modelPass = false;
                      reason.fail = "missing_clv_prices";
                    } else {
                      const clv = relCLV(openPrice, closePrice);
                      reason.clv_rel = Number(clv.toFixed(4));
                      if (clv < 0.03) {
                        modelPass = false;
                        reason.fail = "clv_fail";
                      }
                    }
                  }
                }

                if (modelPass && openLine && modelLine) {
                  // --- base stake ---
                  let stake = 1.0;

                  // --- amplifier 1: interstate advantage ---
                  const homeTeamState = (g.home_team as any)?.home_state ?? null;
                  const awayTeamState = (g.away_team as any)?.home_state ?? null;
                  const v = g.venue ?? null;
                  const venueState = v ? venueStateByVenue[v] : null;

                  if (homeTeamState && awayTeamState && homeTeamState !== awayTeamState && venueState) {
                    const deadIsHome = deadSide === "HOME";
                    if (
                      (deadIsHome && homeTeamState === venueState) ||
                      (!deadIsHome && awayTeamState === venueState)
                    ) {
                      stake += 0.5;
                      reason.amplifiers = reason.amplifiers || [];
                      reason.amplifiers.push("home_state_interstate");
                    }
                  }

                  // --- amplifier 2: large spread ---
                  const lineAtModel = deadSide === "HOME" ? modelLine.home_line : modelLine.away_line;
                  if (lineAtModel !== null && lineAtModel >= 18) {
                    stake += 0.5;
                    reason.amplifiers = reason.amplifiers || [];
                    reason.amplifiers.push("large_spread_floor");
                  }

                  // --- cap stake ---
                  if (stake > 2.0) stake = 2.0;
                  reason.recommended_units = stake;

                  const refPriceModel = deadSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price;

                  reason.legs.push(
                    buildLegLine({
                      system_code,
                      snapshot_type: modelSnap,
                      side: deadSide,
                      line_at_bet: lineAtModel ?? null,
                      ref_price: refPriceModel ?? null,
                      exec_best_price: null,
                      exec_best_book: null,
                      ref_books_observed: modelLine.ref_books_observed ?? [],
                      exec_books_observed: modelLine.exec_books_observed ?? [],
                    }),
                  );
                }
              }
            }
          }
        }

        // SYS_2 — GF Winner Early Fade
        if (system_code === "SYS_2") {
          const gfWinnerId = seasonMeta?.gf_winner_team_id ?? null;
          const gfRunnerUpId = seasonMeta?.gf_runner_up_team_id ?? null;

          if (!gfWinnerId) {
            modelPass = false;
            reason.fail = "no_gf_winner_set";
          } else if (!openH2H || !openLine) {
            modelPass = false;
            reason.fail = "missing_open_odds";
          } else {
            {
              const teams = new Set([g.home_team_id, g.away_team_id]);
              if (gfRunnerUpId && teams.has(gfWinnerId) && teams.has(gfRunnerUpId)) {
                modelPass = false;
                reason.fail = "gf_replay_excluded";
              }
            }

            if (modelPass) {
              const gfIsHome = g.home_team_id === gfWinnerId;
              const gfIsAway = g.away_team_id === gfWinnerId;
              if (!gfIsHome && !gfIsAway) {
                modelPass = false;
                reason.fail = "gf_winner_not_in_game";
              } else {
                const gfOpen = gfIsHome ? openH2H.home_price : openH2H.away_price;
                reason.gf_winner_open_h2h = gfOpen;

                const homeFavOpen = (openH2H.home_price ?? 999) < (openH2H.away_price ?? 999);
                const gfIsFav = gfIsHome ? homeFavOpen : !homeFavOpen;
                if (!gfIsFav) {
                  modelPass = false;
                  reason.fail = "gf_not_fav_open";
                }

                if (!gfOpen || gfOpen >= 1.48) {
                  modelPass = false;
                  reason.fail = "gf_open_odds_band";
                }

                if (modelPass) {
                  const fadeSide: Side = gfIsHome ? "AWAY" : "HOME";

                  const lineAtOpen = fadeSide === "HOME" ? openLine.home_line : openLine.away_line;
                  const refPriceOpen = fadeSide === "HOME" ? openLine.home_line_price : openLine.away_line_price;

                  reason.legs.push(
                    buildLegLine({
                      system_code,
                      snapshot_type: "OPEN",
                      side: fadeSide,
                      line_at_bet: lineAtOpen ?? null,
                      ref_price: refPriceOpen ?? null,
                      exec_best_price: null,
                      exec_best_book: null,
                      ref_books_observed: openLine.ref_books_observed ?? [],
                      exec_books_observed: openLine.exec_books_observed ?? [],
                    }),
                  );

                  reason.overlay = {
                    type: "H2H",
                    enabled: true,
                    depends_on: "T30",
                    side: fadeSide,
                    clv_min: 0.03,
                  };
                  reason.recommended_units = 1.0;
                }
              }
            }
          }
        }

        // SYS_3 — Form Dog (HARD+)
        if (system_code === "SYS_3") {
          if (!openH2H || !modelH2H || !homeState || !awayState) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            // Venue-state exclusion: ACT, NT, TAS
            const v = g.venue ?? null;
            const venueState = v ? venueStateByVenue[v] : null;
            if (venueState && ["ACT", "NT", "TAS"].includes(venueState)) {
              modelPass = false;
              reason.fail = "excluded_state";
              reason.venue_state = venueState;
            }

            if (modelPass) {
              // Home must be underdog at close/model snapshot
              const homePrice = modelH2H.home_price;
              const awayPrice = modelH2H.away_price;

              if (!homePrice || !awayPrice) {
                modelPass = false;
                reason.fail = "missing_prices";
              } else {
                const homeIsDog = homePrice > awayPrice;
                if (!homeIsDog) {
                  modelPass = false;
                  reason.fail = "not_home_underdog";
                } else {
                  const favouritePrice = Math.min(homePrice, awayPrice);
                  reason.favourite_close_price = favouritePrice;

                  // Favourite close band 1.55–1.85
                  if (favouritePrice < 1.55 || favouritePrice > 1.85) {
                    modelPass = false;
                    reason.fail = "fav_odds_band";
                  }

                  // Favourite win streak ≥ 2
                  const favSide: Side = homePrice < awayPrice ? "HOME" : "AWAY";
                  const favTeamId = favSide === "HOME" ? g.home_team_id : g.away_team_id;

                  const favStreak = await getWinStreakBeforeGame({
                    supabase,
                    season,
                    teamId: favTeamId,
                    gameStartIso: g.start_time_aet,
                  });

                  reason.fav_win_streak = favStreak;
                  if (favStreak < 2) {
                    modelPass = false;
                    reason.fail = "fav_streak";
                  }

                  if (modelPass) {
                    let stakeUnits = 1.0;
                    reason.amplifiers = [];

                    // Interstate boost
                    const hs = (g.home_team as any)?.home_state ?? null;
                    const as_ = (g.away_team as any)?.home_state ?? null;
                    if (hs && as_ && hs !== as_) {
                      stakeUnits += 0.5;
                      reason.amplifiers.push("interstate");
                    }

                    // Tight favourite pocket 1.65–1.80
                    if (favouritePrice >= 1.65 && favouritePrice <= 1.80) {
                      stakeUnits += 0.5;
                      reason.amplifiers.push("tight_favourite_pocket");
                    }

                    // CLV momentum confirmation OPEN -> T10 (rules snapshot)
                    const openHome = openH2H.home_price;
                    const closeHome = modelH2H.home_price;

                    if (openHome && closeHome) {
                      const shorten = (openHome - closeHome) / openHome;
                      reason.open_to_t10_shorten = Number(shorten.toFixed(4));

                      if (shorten >= 0.08) {
                        stakeUnits += 1.0;
                        reason.amplifiers.push("clv_momentum_8_plus");
                      } else if (shorten >= 0.06) {
                        stakeUnits += 0.5;
                        reason.amplifiers.push("clv_momentum_6_8");
                      }
                    }

                    // Early market agreement OPEN -> T30
                    const t30H2H = execH2H;
                    const t30Home = t30H2H?.home_price ?? null;

                    if (openHome && t30Home) {
                      const earlyShorten = (openHome - t30Home) / openHome;
                      reason.open_to_t30_shorten = Number(earlyShorten.toFixed(4));

                      if (earlyShorten >= 0.06) {
                        stakeUnits += 0.5;
                        reason.amplifiers.push("early_agreement_6_plus");
                      } else if (earlyShorten >= 0.04) {
                        stakeUnits += 0.25;
                        reason.amplifiers.push("early_agreement_4_plus");
                      }
                    }

                    if (stakeUnits > 2.5) stakeUnits = 2.5;
                    reason.recommended_units = stakeUnits;

                    // Primary leg: HOME H2H
                    reason.legs.push(
                      buildLegH2H({
                        system_code,
                        snapshot_type: modelSnap,
                        side: "HOME",
                        ref_price: modelH2H.home_price ?? null,
                        exec_best_price: null,
                        exec_best_book: null,
                        ref_books_observed: modelH2H.ref_books_observed ?? [],
                        exec_books_observed: modelH2H.exec_books_observed ?? [],
                      }),
                    );

                    // Overlay leg metadata only; actual signal engine remains single-leg for now.
                    // Record overlay eligibility in reason_json for audit/reporting.
                    if (openLine && modelLine) {
                      const openHomeLine = openLine.home_line;
                      const modelHomeLine = modelLine.home_line;

                      if (openHomeLine !== null && modelHomeLine !== null) {
                        const overlayClv = Number((modelHomeLine - openHomeLine).toFixed(2));
                        reason.overlay = {
                          type: "LINE",
                          enabled: overlayClv > 0,
                          side: "HOME",
                          clv_points: overlayClv,
                          clv_min: 0,
                        };
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // SYS_4 — Line Last 2 Rds (fav line)
        if (system_code === "SYS_4") {
          if (!homeState || !awayState || !modelH2H || !modelLine) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const rr = totalRounds - round + 1;
            if (rr > 3) {
              modelPass = false;
              reason.fail = "window";
            }

            const hs = (g.home_team as any)?.home_state ?? null;
            const as_ = (g.away_team as any)?.home_state ?? null;
            if (!hs || !as_ || hs === as_) {
              modelPass = false;
              reason.fail = "not_interstate";
            }

            const v = g.venue ?? null;
            const venueState = v ? venueStateByVenue[v] : null;
            if (!venueState || !["VIC", "NSW", "QLD", "SA", "WA"].includes(venueState)) {
              modelPass = false;
              reason.fail = "venue_state";
            }

            const homeFav = (modelH2H.home_price ?? 999) < (modelH2H.away_price ?? 999);
            const favSide: Side = homeFav ? "HOME" : "AWAY";
            const dogSide: Side = homeFav ? "AWAY" : "HOME";
            const dogWins = dogSide === "HOME" ? homeState.wins : awayState.wins;
            if (dogWins > 4) {
              modelPass = false;
              reason.fail = "opponent_wins";
            }

            if (modelPass) {
              reason.legs.push(
                buildLegLine({
                  system_code,
                  snapshot_type: modelSnap,
                  side: favSide,
                  line_at_bet: favSide === "HOME" ? modelLine.home_line : modelLine.away_line,
                  ref_price: favSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price,
                  exec_best_price: null,
                  exec_best_book: null,
                  ref_books_observed: modelLine.ref_books_observed ?? [],
                  exec_books_observed: modelLine.exec_books_observed ?? [],
                }),
              );
            }
          }
        }

        // SYS_5 — Line Dog (HARD+)
        if (system_code === "SYS_5") {
          if (!openLine || !modelLine || !modelH2H) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            // Determine dog from near-close H2H prices
            const homeDog = (modelH2H.home_price ?? 0) > (modelH2H.away_price ?? 0);
            const dogSide: Side = homeDog ? "HOME" : "AWAY";
            const dogCloseH2H = dogSide === "HOME" ? modelH2H.home_price : modelH2H.away_price;

            reason.dog_side = dogSide;
            reason.dog_close_h2h = dogCloseH2H ?? null;

            // H2H close band: 1.95 ≤ dog < 2.85
            if (!dogCloseH2H || dogCloseH2H < 1.95 || dogCloseH2H >= 2.85) {
              modelPass = false;
              reason.fail = "h2h_band";
            }

            // Dog must be receiving points at the model snapshot
            const dogModelLine = dogSide === "HOME" ? modelLine.home_line : modelLine.away_line;
            if (!(dogModelLine !== null && dogModelLine > 0)) {
              modelPass = false;
              reason.fail = "line_not_positive";
            }

            // Spread CLV in points: modelSnap - OPEN, must be ≥ +1.5 points
            const openDogLine = dogSide === "HOME" ? openLine.home_line : openLine.away_line;
            const modelDogLine = dogSide === "HOME" ? modelLine.home_line : modelLine.away_line;

            let clvPts: number | null = null;
            if (openDogLine === null || modelDogLine === null) {
              modelPass = false;
              reason.fail = "missing_lines";
            } else {
              clvPts = Number((modelDogLine - openDogLine).toFixed(2));
              reason.line_clv_points = clvPts;
              if (clvPts < 1.5) {
                modelPass = false;
                reason.fail = "line_clv";
              }
            }

            if (modelPass) {
              // Base stake: 1.0%
              let stakePct = 1.0;
              reason.amplifiers = [];

              // Amplifier 1 — Strong CLV ≥ 3.0 points
              if (clvPts !== null && clvPts >= 3.0) {
                stakePct += 0.5;
                reason.amplifiers.push("strong_clv");
              }

              // Amplifier 2 — Home Dog
              if (dogSide === "HOME") {
                stakePct += 0.5;
                reason.amplifiers.push("home_dog");
              }

              // Amplifier 3 — Interstate Travel
              const hs = (g.home_team as any)?.home_state ?? null;
              const as_ = (g.away_team as any)?.home_state ?? null;
              if (hs && as_ && hs !== as_) {
                stakePct += 0.25;
                reason.amplifiers.push("interstate_travel");
              }

              // Amplifier 4 — Large Spread (dog receiving ≥ 18 points)
              if (dogModelLine !== null && dogModelLine >= 18) {
                stakePct += 0.5;
                reason.amplifiers.push("large_spread");
              }

              // Cap at 2.5%
              if (stakePct > 2.5) stakePct = 2.5;
              reason.recommended_units = stakePct;

              reason.legs.push(
                buildLegLine({
                  system_code,
                  snapshot_type: modelSnap,
                  side: dogSide,
                  line_at_bet: dogModelLine ?? null,
                  ref_price: dogSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price,
                  exec_best_price: null,
                  exec_best_book: null,
                  ref_books_observed: modelLine.ref_books_observed ?? [],
                  exec_books_observed: modelLine.exec_books_observed ?? [],
                }),
              );
            }
          }
        }

        // SYS_6 — Dog Mid-Season (HARD+) — AWAY underdog only
        if (system_code === "SYS_6") {
          if (!openH2H || !modelH2H) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const dogSide: Side = "AWAY";

            const openDogPrice = openH2H.away_price;
            const modelDogPrice = modelH2H.away_price;

            if (!openDogPrice || !modelDogPrice) {
              modelPass = false;
              reason.fail = "missing_prices";
            } else if (openDogPrice < 3.5 || openDogPrice > 7.0) {
              modelPass = false;
              reason.fail = "open_band";
              reason.open_away_price = openDogPrice;
            } else {
              const clv = Number((modelDogPrice - openDogPrice).toFixed(3));
              reason.h2h_clv = clv;
              reason.open_away_price = openDogPrice;

              if (clv < 0.01) {
                modelPass = false;
                reason.fail = "clv_below_threshold";
              }

              if (modelPass) {
                let stakePct = 0.75;

                if (clv >= 0.03) stakePct = 1.0;
                if (clv >= 0.06) stakePct = 1.25;

                reason.tier = stakePct;

                // Amplifier tracking
                reason.amplifiers = [];

                // Large spread amplifier (AWAY line)
                if (modelLine) {
                  const dogLine = modelLine.away_line;

                  if (dogLine !== null && dogLine >= 18) {
                    stakePct += 0.125;
                    reason.amplifiers.push("large_spread");
                  }
                }

                // Early agreement amplifier (T30 CLV, AWAY price)
                if (execH2H) {
                  const execDogPrice = execH2H.away_price;

                  if (execDogPrice && openDogPrice) {
                    const t30Clv = execDogPrice - openDogPrice;

                    if (t30Clv >= 0.04) {
                      stakePct += 0.125;
                      reason.amplifiers.push("early_agreement");
                    }
                  }
                }

                if (stakePct > 1.5) stakePct = 1.5;

                reason.recommended_units = stakePct;

                reason.legs.push(
                  buildLegH2H({
                    system_code,
                    snapshot_type: modelSnap,
                    side: "AWAY",
                    ref_price: modelDogPrice,
                    exec_best_price: null,
                    exec_best_book: null,
                    ref_books_observed: modelH2H.ref_books_observed ?? [],
                    exec_books_observed: modelH2H.exec_books_observed ?? [],
                  }),
                );
              }
            }
          }
        }

        // SYS_7 — Home Favourite Bounce Escalation (HARD+)
        if (system_code === "SYS_7") {
          if (!modelH2H || !openH2H || !homeState) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const homeFav = (modelH2H.home_price ?? 999) < (modelH2H.away_price ?? 999);
            if (!homeFav) {
              modelPass = false;
              reason.fail = "not_home_fav";
            }

            const homeOdds = modelH2H.home_price;
            if (!homeOdds || homeOdds < 1.5 || homeOdds > 1.85) {
              modelPass = false;
              reason.fail = "odds_band";
            }

            if (modelPass) {
              const prior = await getPriorOutcomeForTeam({
                supabase,
                season,
                teamId: g.home_team_id,
                gameStartIso: g.start_time_aet,
              });
              const drawCountsAsLoss = true;
              const lostPrior = prior === "LOSS" || (drawCountsAsLoss && prior === "DRAW");
              reason.home_prior_outcome = prior;
              if (!lostPrior) {
                modelPass = false;
                reason.fail = "not_lost_prior";
              }
            }

            if (modelPass) {
              // Fetch last 3 completed games for the home team before this game
              const { data: recentGames, error: recentErr } = await supabase
                .from("pers_sys_games")
                .select("id,start_time_aet,winner_team_id,loser_team_id,is_draw,status,home_team_id,away_team_id")
                .eq("season", season)
                .eq("status", "FT")
                .lt("start_time_aet", g.start_time_aet)
                .or(`home_team_id.eq.${g.home_team_id},away_team_id.eq.${g.home_team_id}`)
                .order("start_time_aet", { ascending: false })
                .limit(3);

              if (recentErr || !recentGames || recentGames.length === 0) {
                modelPass = false;
                reason.fail = "missing_recent_games";
              } else {
                // Classify each recent game as WIN or LOSS (draw = LOSS)
                const outcomes: ("WIN" | "LOSS")[] = [];
                for (const pg of recentGames as any[]) {
                  if (pg.is_draw) {
                    outcomes.push("LOSS");
                  } else if (pg.winner_team_id === g.home_team_id) {
                    outcomes.push("WIN");
                  } else {
                    outcomes.push("LOSS");
                  }
                }

                const lost_last_1 = outcomes.length >= 1 && outcomes[0] === "LOSS";
                const lost_2_of_last_3 = outcomes.filter((o) => o === "LOSS").length >= 2;
                const lost_2_straight = outcomes.length >= 2 && outcomes[0] === "LOSS" && outcomes[1] === "LOSS";

                reason.lost_last_1 = lost_last_1;
                reason.lost_2_of_last_3 = lost_2_of_last_3;
                reason.lost_2_straight = lost_2_straight;

                let tier: "tier1" | "tier2" | "tier3";
                let units: number;

                if (lost_2_straight) {
                  tier = "tier3";
                  units = 2.0;
                } else if (lost_2_of_last_3) {
                  tier = "tier2";
                  units = 1.5;
                } else {
                  tier = "tier1";
                  units = 1.0;
                }

                reason.tier = tier;
                reason.amplifiers = [];

                // Amplifiers: OPEN -> T10 shortening (modelH2H is T10 for SYS_7)
                const openHome = openH2H.home_price;
                const modelHome = modelH2H.home_price;

                if (openHome && modelHome) {
                  const shorten = (openHome - modelHome) / openHome;
                  reason.open_to_t10_shorten = Number(shorten.toFixed(4));

                  if (shorten >= 0.08) {
                    units += 0.5;
                    reason.amplifiers.push("clv_momentum_8_plus");
                  } else if (shorten >= 0.06) {
                    units += 0.25;
                    reason.amplifiers.push("clv_momentum_6_8");
                  }

                  // Amplifiers: OPEN -> T30 shortening (execH2H is T30 for SYS_7)
                  const t30Home = execH2H?.home_price ?? null;

                  if (t30Home) {
                    const earlyShorten = (openHome - t30Home) / openHome;
                    reason.open_to_t30_shorten = Number(earlyShorten.toFixed(4));

                    if (earlyShorten >= 0.05) {
                      units += 0.25;
                      reason.amplifiers.push("early_agreement_5_plus");
                    } else if (earlyShorten >= 0.03) {
                      units += 0.125;
                      reason.amplifiers.push("early_agreement_3_plus");
                    }
                  }

                  // Penalty: soft momentum in tight favourite pocket
                  if (homeOdds && homeOdds >= 1.65 && homeOdds <= 1.80 && shorten < 0.06) {
                    units -= 0.25;
                    reason.amplifiers.push("penalty_soft_momentum");
                  }
                }

                // Cap
                if (units > 2.5) units = 2.5;
                reason.recommended_units = units;

                reason.legs.push(
                  buildLegH2H({
                    system_code,
                    snapshot_type: modelSnap,
                    side: "HOME",
                    ref_price: modelH2H.home_price ?? null,
                    exec_best_price: null,
                    exec_best_book: null,
                    ref_books_observed: modelH2H.ref_books_observed ?? [],
                    exec_books_observed: modelH2H.exec_books_observed ?? [],
                  }),
                );
              }
            }
          }
        }

        // ==============================
        // SYS_8 — Totals Over Model
        // ==============================
        if (system_code === "SYS_8") {
          // Collingwood exclusion — SYS_8 does not evaluate games involving Collingwood
          const homeName = g.home_team?.canonical_name ?? "";
          const awayName = g.away_team?.canonical_name ?? "";
          if (homeName === "Collingwood" || awayName === "Collingwood") {
            modelPass = false;
            reason.fail = "excluded_team";
            reason.excluded_team = "Collingwood";
          } else if (!openTotals || !modelTotals) {
            modelPass = false;
            reason.fail = "missing_totals_data";
          } else {
            const openTotal = openTotals.total_line;
            const modelTotal = modelTotals.total_line;

            if (openTotal === null || modelTotal === null) {
              modelPass = false;
              reason.fail = "missing_totals_line";
            } else {
              const totalsMove = modelTotal - openTotal;
              reason.total_move = totalsMove;
              reason.open_total = openTotal;
              reason.model_total = modelTotal;

              const totalsMoveMin = readCfgNum(sys.staking_config ?? {}, ["totals_move_min"], 3)!;
              const modelTotalMin = readCfgNum(sys.staking_config ?? {}, ["model_total_min"], 165)!;
              const modelTotalMaxExclusive = readCfgNum(sys.staking_config ?? {}, ["model_total_max_exclusive"], 175)!;
              const earlyAgreementMoveMin = readCfgNum(sys.staking_config ?? {}, ["early_agreement_move_min"], 1.5)!;
              const strongMomentumMoveMin = readCfgNum(sys.staking_config ?? {}, ["strong_momentum_move_min"], 4.5)!;

              if (totalsMove < totalsMoveMin) {
                modelPass = false;
                reason.fail = "totals_move_lt_3";
              } else if (modelTotal < modelTotalMin || modelTotal >= modelTotalMaxExclusive) {
                modelPass = false;
                reason.fail = "totals_band";
              }

              if (modelPass) {
                let stake = readCfgNum(sys.staking_config ?? {}, ["stake_base_pct", "base_pct_bankroll", "base_bankroll_pct"], 1.0)!;
                reason.amplifiers = [];

                const ampCfg = sys.amplifier_config ?? {};

                // Day game boost
                const kickoffHour = new Date(g.start_time_aet).getHours();
                const dayGameBoost = readCfgNum(ampCfg, ["day_game_boost_pct", "day_game_boost"], 0)!;
                if (kickoffHour < 18 && dayGameBoost > 0) {
                  stake += dayGameBoost;
                  reason.amplifiers.push("day_game");
                }

                // Marvel boost
                const marvelBoost = readCfgNum(ampCfg, ["marvel_boost_pct", "marvel_boost"], 0)!;
                if (g.venue && g.venue.toLowerCase().includes("marvel") && marvelBoost > 0) {
                  stake += marvelBoost;
                  reason.amplifiers.push("marvel");
                }

                // Early agreement boost
                const earlyAgreementBoost = readCfgNum(ampCfg, ["early_agreement_boost_pct", "early_agreement_boost"], 0)!;
                if (execTotals && execTotals.total_line !== null && openTotal !== null && earlyAgreementBoost > 0) {
                  const earlyMove = execTotals.total_line - openTotal;
                  reason.early_move = earlyMove;
                  if (earlyMove >= earlyAgreementMoveMin) {
                    stake += earlyAgreementBoost;
                    reason.amplifiers.push("early_agreement");
                  }
                }

                // Strong momentum boost
                const strongMomentumBoost = readCfgNum(ampCfg, ["strong_momentum_boost_pct", "strong_momentum_boost"], 0)!;
                if (totalsMove >= strongMomentumMoveMin && strongMomentumBoost > 0) {
                  stake += strongMomentumBoost;
                  reason.amplifiers.push("strong_momentum");
                }

                // Cap stake
                const stakingCfg = sys.staking_config ?? {};
                if (stakingCfg.max_pct_bankroll && stake > Number(stakingCfg.max_pct_bankroll)) {
                  stake = Number(stakingCfg.max_pct_bankroll);
                }

                reason.recommended_units = stake;

                reason.legs.push(
                  buildLegTotals({
                    system_code,
                    snapshot_type: modelSnap,
                    side: "OVER",
                    line_at_bet: modelTotal,
                    ref_price: modelTotals.over_price ?? null,
                    exec_best_price: null,
                    exec_best_book: null,
                    ref_books_observed: modelTotals.ref_books_observed ?? [],
                    exec_books_observed: modelTotals.exec_books_observed ?? [],
                  }),
                );
              }
            }
          }
        }

        // ==============================
        // SYS_9 — Collingwood High-Total Suppression (PROVISIONAL+) — UNDER 189.5
        // ==============================
        if (system_code === "SYS_9") {
          const homeName = g.home_team?.canonical_name ?? "";
          const awayName = g.away_team?.canonical_name ?? "";

          if (homeName !== "Collingwood" && awayName !== "Collingwood") {
            // Skip SYS_9 entirely for non-Collingwood games — no audit, no signal
            continue;
          } else if (!openTotals || !modelTotals) {
            modelPass = false;
            reason.fail = "missing_totals_data";
          } else {
            const modelTotal = modelTotals.total_line;
            const underPrice = modelTotals.under_price;
            const stakingCfg = sys.staking_config ?? {} as Record<string, any>;
            const modelTotalMin = readCfgNum(stakingCfg, ["model_total_min"], 178)!;
            const underPriceMin = readCfgNum(stakingCfg, ["under_price_min"], 1.45)!;
            const fixedLine = readCfgNum(stakingCfg, ["fixed_target_total_line"], 189.5)!;

            reason.target_team = "Collingwood";
            reason.sys9_variant = "U189.5_single_leg_v1";
            reason.model_total = modelTotal;
            reason.under_price = underPrice;

            if (modelTotal === null || modelTotal < modelTotalMin) {
              modelPass = false;
              reason.fail = "model_total_below_threshold";
            } else if (underPrice === null || underPrice === undefined) {
              modelPass = false;
              reason.fail = "missing_under_price";
            } else if (underPrice < underPriceMin) {
              modelPass = false;
              reason.fail = "under_price_below_threshold";
            }

            if (modelPass) {
              const basePct = readCfgNum(stakingCfg, ["base_bankroll_pct", "base_pct_bankroll"], 1.0)!;
              let stake = basePct;
              const maxPct = readCfgNum(stakingCfg, ["max_pct_bankroll"], 1.5);
              if (maxPct !== null && stake > maxPct) {
                stake = maxPct;
              }
              reason.recommended_units = stake;

              reason.legs.push(
                buildLegTotals({
                  system_code,
                  snapshot_type: modelSnap,
                  side: "UNDER",
                  line_at_bet: fixedLine,
                  ref_price: underPrice,
                  exec_best_price: null,
                  exec_best_book: null,
                  ref_books_observed: modelTotals.ref_books_observed ?? [],
                  exec_books_observed: modelTotals.exec_books_observed ?? [],
                }),
              );
            }
          }
        }

        let recommendedUnits =
          Number.isFinite(Number(reason.recommended_units))
            ? Number(reason.recommended_units)
            : null;
        let recommendedBankrollPct = toCanonicalBankrollPct({
          systemCode: system_code,
          recommendedUnits,
          stakingConfig: sys.staking_config ?? null,
        });

        // Final policy guardrail normalization before any writes.
        if (system_code === "SYS_6") {
          if (recommendedUnits !== null) {
            recommendedUnits = Math.min(recommendedUnits, 1.5);
          }

          if (recommendedBankrollPct !== null) {
            recommendedBankrollPct = Math.min(recommendedBankrollPct, 0.015);
          } else if (recommendedUnits !== null) {
            recommendedBankrollPct = Number((Math.min(recommendedUnits, 1.5) / 100).toFixed(6));
          }
        }

        if (system_code === "SYS_7") {
          const oneU = resolveOneUPctForSystem(system_code, sys.staking_config ?? null);

          if (oneU && oneU > 0) {
            const maxUnitsByPct = Math.floor((0.03 / oneU) * 4) / 4;

            if (recommendedUnits !== null) {
              recommendedUnits = Math.min(recommendedUnits, maxUnitsByPct);
            } else if (recommendedBankrollPct !== null) {
              recommendedUnits = Math.min(
                Math.floor((recommendedBankrollPct / oneU) * 4) / 4,
                maxUnitsByPct,
              );
            }

            if (recommendedUnits !== null) {
              recommendedBankrollPct = Number((recommendedUnits * oneU).toFixed(6));
            }
          }

          if (recommendedBankrollPct !== null) {
            recommendedBankrollPct = Math.min(recommendedBankrollPct, 0.03);
          }
        }

        reason.recommended_units = recommendedUnits;
        const stakingContractVersion = "v2_canonical_pct";
        reason.recommended_bankroll_pct = recommendedBankrollPct;
        reason.staking_contract_version = stakingContractVersion;

        // -------------------------
        // READY vs PENDING vs SKIP (don't write FAILs)
        // -------------------------
        const primaryLeg = (reason.legs?.[0] ?? null) as any;

        // Phase 2A: passive weather visibility (read-only; never affects decisions).
        const passiveWeather = await loadPassiveWeatherAssessmentWithActive(sys, g.id);
        reason.weather = passiveWeather;

        if (!modelPass || !primaryLeg) {
          await upsertAuditV2({
            system_code,
            game_id: g.id,
            season,
            round: round ?? null,
            model_snapshot: modelSnap,
            execution_snapshot: execSnap,
            model_market: (sys.primary_market ?? "H2H") as MarketType,
            execution_market: (sys.primary_market ?? "H2H") as MarketType,
            audit_status: "FAIL",
            fail_stage: classifyFailStage(reason.fail),
            fail_code: reason.fail ?? "model_failed",
            leg_type: null,
            side: null,
            line_at_bet: null,
            ref_price: null,
            exec_best_price: null,
            exec_best_book: null,
            recommended_units: reason.recommended_units ?? null,
            recommended_bankroll_pct: recommendedBankrollPct,
            staking_contract_version: stakingContractVersion,
            reason_json: reason,
          });
          continue;
        }

        const primaryMarket: MarketType =
          primaryLeg.leg_type === "TOTALS" ? "TOTALS" :
          primaryLeg.leg_type === "LINE" ? "LINE" : "H2H";
        const execSnapRow =
          primaryMarket === "TOTALS" ? execTotals :
          primaryMarket === "LINE" ? execLine : execH2H;
        const execHas = hasMarketData(execSnapRow, primaryMarket);

        let signalStatus: string = "PENDING";
        let execBestPrice: number | null = null;
        let execBestBook: string | null = null;
        let lineAtBet: number | null = primaryLeg.line_at_bet ?? null;

        if (primaryMarket === "H2H") {
          if (execH2H) {
            if (primaryLeg.side === "HOME") {
              execBestPrice = execH2H.exec_best_home_price ?? null;
              execBestBook = execH2H.exec_best_home_book ?? null;
            } else {
              execBestPrice = execH2H.exec_best_away_price ?? null;
              execBestBook = execH2H.exec_best_away_book ?? null;
            }
          }
        } else if (primaryMarket === "LINE") {
          if (execLine) {
            if (primaryLeg.side === "HOME") {
              execBestPrice = execLine.exec_best_home_line_price ?? null;
              execBestBook = execLine.exec_best_home_line_book ?? null;
              lineAtBet = execLine.exec_best_home_line ?? lineAtBet;
            } else {
              execBestPrice = execLine.exec_best_away_line_price ?? null;
              execBestBook = execLine.exec_best_away_line_book ?? null;
              lineAtBet = execLine.exec_best_away_line ?? lineAtBet;
            }
          }
        } else if (primaryMarket === "TOTALS") {
          if (execTotals) {
            if (primaryLeg.side === "OVER") {
              execBestPrice = execTotals.exec_best_over_price ?? null;
              execBestBook = execTotals.exec_best_over_book ?? null;
            } else {
              execBestPrice = execTotals.exec_best_under_price ?? null;
              execBestBook = execTotals.exec_best_under_book ?? null;
            }
            lineAtBet = execTotals.exec_best_total_line ?? lineAtBet;
          }
        }

        if (execHas && execBestPrice) {
          signalStatus = "READY";
        }

        await upsertAuditV2({
          system_code,
          game_id: g.id,
          season,
          round: round ?? null,
          model_snapshot: modelSnap,
          execution_snapshot: execSnap,
          model_market: (sys.primary_market ?? primaryMarket) as MarketType,
          execution_market: primaryMarket,
          audit_status: signalStatus === "READY" ? "READY" : "PENDING",
          fail_stage: signalStatus === "READY" ? null : "EXEC",
          fail_code: signalStatus === "READY" ? null : "missing_execution_snapshot",
          leg_type: primaryMarket,
          side: primaryLeg.side,
          line_at_bet: lineAtBet,
          ref_price: primaryLeg.ref_price ?? null,
          exec_best_price: execBestPrice,
          exec_best_book: execBestBook,
          recommended_units: recommendedUnits,
          recommended_bankroll_pct: recommendedBankrollPct,
          staking_contract_version: stakingContractVersion,
          reason_json: {
            ...reason,
            status: signalStatus,
          },
        });

        if (signalStatus !== "READY") continue;

        if (evaluatorMode !== "ACTION_T30") continue;

        const signalOk = await upsertSignalV2({
          system_code,
          game_id: g.id,
          model_snapshot: modelSnap,
          execution_snapshot: execSnap,
          model_market: (sys.primary_market ?? primaryMarket) as MarketType,
          execution_market: primaryMarket,
          pass: true,
          signal_status: signalStatus,
          leg_type: primaryMarket,
          side: primaryLeg.side,
          line_at_bet: lineAtBet,
          ref_price: primaryLeg.ref_price ?? null,
          exec_best_price: execBestPrice,
          exec_best_book: execBestBook,
          recommended_units: recommendedUnits,
          recommended_bankroll_pct: recommendedBankrollPct,
          staking_contract_version: stakingContractVersion,
          reason_json: {
            ...reason,
            status: signalStatus,
          },
        });

        if (signalOk) signalsCreated += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, season, evaluator_mode: evaluatorMode, signals_created: signalsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
