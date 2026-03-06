// supabase/functions/pers-sys-evaluate-systems-v2/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MarketType = "H2H" | "LINE";
type Side = "HOME" | "AWAY";
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

type SystemV2Row = {
  system_code: string;
  system_name?: string | null;
  active?: boolean | null;

  primary_market?: "H2H" | "LINE" | null;
  overlay_market?: "H2H" | "LINE" | null;
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
  return s.home_line !== null && s.away_line !== null && !!(s.home_line_price && s.away_line_price);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body.season ?? new Date().getFullYear());
    const horizonDays = Number(body.horizon_days ?? 10);

    const now = new Date();
    const startIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const endIso = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
      .select("system_code, rank, dominates_match, allow_stack, max_exposure_pct, tie_break");

    if (priErr) throw priErr;

    const priByCode = new Map<string, any>();
    for (const p of (pri || []) as any[]) priByCode.set(p.system_code, p);

    const systemsSorted = [...(systems || [])].sort((a: any, b: any) => {
      const ra = Number(priByCode.get(a.system_code)?.rank ?? 999);
      const rb = Number(priByCode.get(b.system_code)?.rank ?? 999);
      return ra - rb;
    });

    const dominatesByCode = new Set<string>(
      ((pri || []) as any[]).filter((p) => !!p.dominates_match).map((p) => p.system_code)
    );

    // per-game dominance latch (filled as we evaluate)
    const dominatedByGame: Record<string, string> = {};

    // upcoming games
    const { data: upcomingGames, error: gamesErr } = await supabase
      .from("pers_sys_games")
      .select(`
        *,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(id, canonical_name, home_state),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(id, canonical_name, home_state)
      `)
      .eq("season", season)
      .eq("status", "SCHEDULED")
      .gte("start_time_aet", startIso)
      .lte("start_time_aet", endIso)
      .order("start_time_aet", { ascending: true })
      .limit(200);

    if (gamesErr) throw gamesErr;

    if (!systems?.length || !upcomingGames?.length) {
      return new Response(JSON.stringify({ ok: true, season, signals_created: 0 }), {
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
        ...upcomingGames.map((g: any) => (typeof g.round === "number" ? g.round : 0))
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
          reason_json: args.reason_json,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: "system_code,game_id,execution_snapshot,leg_type,side" }
      );
      if (error) console.error("upsert error:", args.system_code, args.game_id, error.message);
      return !error;
    }

    let signalsCreated = 0;

    for (const sysRaw of systemsSorted as any[]) {
      const sys = sysRaw as SystemV2Row;
      const system_code = String(sys.system_code);

      const modelSnap = String(sys.model_snapshot ?? "T10");
      const execSnap = String(sys.execution_snapshot ?? "T30");

      // Rules snapshot policy:
      // - T10 is treated as bookkeeping-only (close), so evaluate criteria using T30 instead.
      // - Exception: SYS_7 is explicitly "close-only" by spec, so it may use T10.
      const rulesSnap =
        modelSnap === "T10" && system_code !== "SYS_7"
          ? "T30"
          : modelSnap;

      const allowCandidate = (sys.signal_mode ?? (sys.allow_candidate ? "ALLOW_CANDIDATE" : "HARD_FAIL")) === "ALLOW_CANDIDATE";

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
        const modelH2H = pickSnap(gameSnaps, rulesSnap, "H2H");
        const modelLine = pickSnap(gameSnaps, rulesSnap, "LINE");
        const execH2H = pickSnap(gameSnaps, execSnap, "H2H");
        const execLine = pickSnap(gameSnaps, execSnap, "LINE");

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

        // default state
        let modelPass = true;

        // -------------------------
        // SYSTEM-SPECIFIC RULES
        // -------------------------

        // SYS_1 — Dead Teams CLV Line
        if (system_code === "SYS_1") {
          if (!homeState || !awayState || !openLine || !modelLine) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const rc = roundCtxByRound[round];
            if (!rc || typeof rc.points_8th !== "number") {
              modelPass = false;
              reason.fail = "missing_round_context";
            } else {
              const homePts = premiershipPoints(homeState.wins, homeState.draws);
              const awayPts = premiershipPoints(awayState.wins, awayState.draws);

              const minBehind = 8;
              const homeBehind = rc.points_8th - homePts;
              const awayBehind = rc.points_8th - awayPts;

              const homeDead = homeBehind >= minBehind;
              const awayDead = awayBehind >= minBehind;

              if ((homeDead && awayDead) || (!homeDead && !awayDead)) {
                modelPass = false;
                reason.fail = "dead_side_ambiguous";
              } else {
                const deadSide: Side = homeDead ? "HOME" : "AWAY";
                reason.dead_side = deadSide;

                const oppPts = deadSide === "HOME" ? awayPts : homePts;
                if (oppPts < rc.points_8th) {
                  modelPass = false;
                  reason.fail = "opponent_not_top8";
                }

                if (sys.clv_required) {
                  const openPrice = deadSide === "HOME" ? openLine.home_line_price : openLine.away_line_price;
                  const closePrice = deadSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price;

                  if (!openPrice || !closePrice) {
                    modelPass = false;
                    reason.fail = "missing_clv_prices";
                  } else {
                    const clv = relCLV(openPrice, closePrice);
                    reason.clv_rel = Number(clv.toFixed(4));
                    const min = Number(sys.clv_min ?? 0.03);
                    if (clv <= min) {
                      modelPass = false;
                      reason.fail = "clv_fail";
                    }
                  }
                }

                const lineAtModel = deadSide === "HOME" ? modelLine.home_line : modelLine.away_line;
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
                  })
                );
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
                    })
                  );

                  reason.overlay = { type: "H2H", enabled: true, depends_on: execSnap };
                }
              }
            }
          }
        }

        // SYS_3 — Form Dog (HOME underdog H2H)
        if (system_code === "SYS_3") {
          if (!modelH2H || !homeState || !awayState) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const homeFav = (modelH2H.home_price ?? 999) < (modelH2H.away_price ?? 999);
            const favSide: Side = homeFav ? "HOME" : "AWAY";
            const dogSide: Side = homeFav ? "AWAY" : "HOME";

            if (dogSide !== "HOME") {
              modelPass = false;
              reason.fail = "not_home_underdog";
            } else {
              const favPrice = favSide === "HOME" ? modelH2H.home_price : modelH2H.away_price;
              if (!favPrice || favPrice < 1.55 || favPrice > 1.85) {
                modelPass = false;
                reason.fail = "fav_odds_band";
              }

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

              const favState = favSide === "HOME" ? homeState : awayState;
              const dogState = favSide === "HOME" ? awayState : homeState;
              const pctDiff = Math.abs(favState.percentage - dogState.percentage);
              reason.pct_diff = Number(pctDiff.toFixed(2));
              if (pctDiff >= 25) {
                modelPass = false;
                reason.fail = "pct_diff";
              }

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
                })
              );
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
                })
              );
            }
          }
        }

        // SYS_5 — Line Dog (dog line; CLV in points is OPEN->modelSnap)
        if (system_code === "SYS_5") {
          if (!openLine || !modelLine || !modelH2H) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const homeDog = (modelH2H.home_price ?? 0) > (modelH2H.away_price ?? 0);
            const dogSide: Side = homeDog ? "HOME" : "AWAY";
            const dogCloseH2H = dogSide === "HOME" ? modelH2H.home_price : modelH2H.away_price;

            if (!dogCloseH2H || dogCloseH2H < 1.95 || dogCloseH2H >= 2.85) {
              modelPass = false;
              reason.fail = "h2h_band";
            }

            const dogModelLine = dogSide === "HOME" ? modelLine.home_line : modelLine.away_line;
            if (!(dogModelLine !== null && dogModelLine > 0)) {
              modelPass = false;
              reason.fail = "line_not_positive";
            }

            const openDogLine = dogSide === "HOME" ? openLine.home_line : openLine.away_line;
            const modelDogLine = dogSide === "HOME" ? modelLine.home_line : modelLine.away_line;
            if (openDogLine === null || modelDogLine === null) {
              modelPass = false;
              reason.fail = "missing_lines";
            } else {
              const clvPts = Number((modelDogLine - openDogLine).toFixed(2));
              reason.line_clv_points = clvPts;
              if (clvPts <= 0) {
                modelPass = false;
                reason.fail = "line_clv";
              }
            }

            if (modelPass) {
              reason.legs.push(
                buildLegLine({
                  system_code,
                  snapshot_type: modelSnap,
                  side: dogSide,
                  line_at_bet: dogSide === "HOME" ? modelLine.home_line : modelLine.away_line,
                  ref_price: dogSide === "HOME" ? modelLine.home_line_price : modelLine.away_line_price,
                  exec_best_price: null,
                  exec_best_book: null,
                  ref_books_observed: modelLine.ref_books_observed ?? [],
                  exec_books_observed: modelLine.exec_books_observed ?? [],
                })
              );
            }
          }
        }

        // SYS_6 — Dog Mid-Season (away dog OPEN; CLV OPEN->modelSnap)
        if (system_code === "SYS_6") {
          if (!openH2H || !modelH2H) {
            modelPass = false;
            reason.fail = "missing_model_data";
          } else {
            const awayIsDogOpen = (openH2H.away_price ?? 0) > (openH2H.home_price ?? 0);
            if (!awayIsDogOpen) {
              modelPass = false;
              reason.fail = "not_away_dog_open";
            }

            const openAway = openH2H.away_price;
            if (!openAway || openAway < 3.5 || openAway > 7.0) {
              modelPass = false;
              reason.fail = "open_band";
            }

            if (modelPass) {
              const closeAway = modelH2H.away_price;
              if (!openAway || !closeAway) {
                modelPass = false;
                reason.fail = "missing_clv_prices";
              } else {
                const clv = relCLV(openAway, closeAway);
                reason.clv_rel = Number(clv.toFixed(4));
                if (clv < 0.01) {
                  modelPass = false;
                  reason.fail = "clv_fail";
                }
              }
            }

            if (modelPass) {
              reason.legs.push(
                buildLegH2H({
                  system_code,
                  snapshot_type: modelSnap,
                  side: "AWAY",
                  ref_price: modelH2H.away_price ?? null,
                  exec_best_price: null,
                  exec_best_book: null,
                  ref_books_observed: modelH2H.ref_books_observed ?? [],
                  exec_books_observed: modelH2H.exec_books_observed ?? [],
                })
              );
            }
          }
        }

        // SYS_7 — Home Favourite Bounce Escalation
        if (system_code === "SYS_7") {
          if (!modelH2H || !homeState) {
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
              const lossLike = await getLossLikeStreakBeforeGame({
                supabase,
                season,
                teamId: g.home_team_id,
                gameStartIso: g.start_time_aet,
                drawCountsAsLoss: true,
              });

              let tier: "tier1" | "tier2" | "tier3" = "tier1";
              if (lossLike >= 3) tier = "tier3";
              else if (lossLike === 2) tier = "tier2";

              const units = tier === "tier3" ? 3.0 : tier === "tier2" ? 2.25 : 1.5;

              reason.tier = tier;
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
                })
              );
            }
          }
        }

        // -------------------------
        // READY vs PENDING vs SKIP (don't write FAILs)
        // -------------------------
        const primaryLeg = (reason.legs?.[0] ?? null) as any;

        if (!modelPass || !primaryLeg) {
          // Model failed or no leg — skip writing signal
          continue;
        }

        const primaryMarket: MarketType = primaryLeg.leg_type === "LINE" ? "LINE" : "H2H";
        const execSnapRow = primaryMarket === "LINE" ? execLine : execH2H;
        const execHas = hasMarketData(execSnapRow, primaryMarket);

        let signalStatus: string = "PENDING";
        let execBestPrice: number | null = null;
        let execBestBook: string | null = null;
        let lineAtBet: number | null = primaryLeg.line_at_bet ?? null;

        if (execHas) {
          signalStatus = "READY";
          if (primaryMarket === "H2H") {
            const side = primaryLeg.side as Side;
            execBestPrice = side === "HOME" ? execSnapRow!.exec_best_home_price : execSnapRow!.exec_best_away_price;
            execBestBook = side === "HOME" ? execSnapRow!.exec_best_home_book : execSnapRow!.exec_best_away_book;
          } else {
            const side = primaryLeg.side as Side;
            execBestPrice = side === "HOME" ? execSnapRow!.exec_best_home_line_price : execSnapRow!.exec_best_away_line_price;
            execBestBook = side === "HOME" ? execSnapRow!.exec_best_home_line_book : execSnapRow!.exec_best_away_line_book;
            // For LINE execution, use execution snapshot line if available
            if (execSnapRow) {
              const execLineVal = side === "HOME" ? execSnapRow.exec_best_home_line : execSnapRow.exec_best_away_line;
              if (execLineVal !== null) lineAtBet = execLineVal;
            }
          }
        } else if (!allowCandidate) {
          // Not allowed to show as PENDING — skip
          continue;
        }

        // dominance: if a dominating system already qualified on this match, block others
        const blocker = dominatedByGame[g.id];
        if (blocker && blocker !== system_code) {
          signalStatus = "BLOCKED";
          reason.fail = `blocked_by_${blocker}`;
          reason.blocked_by = blocker;

          // execution fields should not be actionable when blocked
          execBestBook = null;
          execBestPrice = null;
        }

        // Enrich reason_json (keep it lean — typed columns hold the primary data)
        reason.status = signalStatus;

        const wrote = await upsertSignalV2({
          system_code,
          game_id: g.id,
          model_snapshot: modelSnap,
          execution_snapshot: execSnap,
          model_market: sys.primary_market ?? primaryMarket,
          execution_market: primaryMarket,
          pass: signalStatus !== "BLOCKED",
          signal_status: signalStatus,
          leg_type: primaryMarket,
          side: primaryLeg.side as Side,
          line_at_bet: lineAtBet,
          ref_price: primaryLeg.ref_price ?? null,
          exec_best_price: execBestPrice,
          exec_best_book: execBestBook,
          recommended_units: reason.recommended_units ?? null,
          reason_json: reason,
        });

        if (wrote) signalsCreated++;

        // latch dominance for this game if applicable
        if (signalStatus === "READY" && dominatesByCode.has(system_code) && !dominatedByGame[g.id]) {
          dominatedByGame[g.id] = system_code;
        }

        // --- Overlay child signal (SYS_2: AWAY H2H at T30 if CLV > threshold) ---
        if (signalStatus !== "BLOCKED")
          try {
            const overlayEnabled = !!reason?.overlay_config?.overlay_h2h;
            const primaryReady = signalStatus === "READY";

            // Only SYS_2 has the locked overlay rule:
            // "H2H overlay only if Away + CLV(open->T30) > 0.03"
            if (overlayEnabled && primaryReady && system_code === "SYS_2") {
              const overlayExecSnap: "T30" = "T30";

              // We only ever overlay the AWAY side (locked spec).
              const overlaySide: Side = "AWAY";

              // Need OPEN + T30 H2H snapshots to evaluate CLV and to fill exec_best_*
              const openSnap = openH2H;
              const t30Snap = pickSnap(gameSnaps, overlayExecSnap, "H2H");

              // If we can't evaluate yet, do not create/keep a misleading overlay row.
              if (!openSnap || !t30Snap) {
                // Upsert a watch-state placeholder so the UI shows a potential upcoming overlay
                const placeholderReason: Record<string, any> = {
                  ...reason,
                  status: "PENDING",
                  execution_snapshot: overlayExecSnap,
                  overlay: { type: "H2H", enabled: true, depends_on: overlayExecSnap },
                  overlay_child: {
                    required_execution_snapshot: overlayExecSnap,
                    market: "H2H",
                    side: overlaySide,
                  },
                  fail: "awaiting_t30_snapshot",
                };

                await supabase.from("pers_sys_signals_v2").upsert(
                  {
                    system_code,
                    game_id: g.id,
                    model_snapshot: modelSnap,
                    execution_snapshot: overlayExecSnap,
                    model_market: "H2H",
                    execution_market: "H2H",
                    pass: false,
                    signal_status: "PENDING",
                    parent_signal_id: null,
                    leg_type: "H2H",
                    side: overlaySide,
                    line_at_bet: null,
                    ref_price: null,
                    exec_best_price: null,
                    exec_best_book: null,
                    recommended_units: null,
                    reason_json: placeholderReason,
                    evaluated_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "system_code,game_id,execution_snapshot,leg_type,side" }
                );
              } else {
                const openAway = openSnap.away_price;
                const t30Away = t30Snap.away_price;

                // Compute CLV(open->T30) for AWAY; must be positive and exceed threshold.
                const clvMin = 0.03;
                let clvOk = false;
                let clvRel: number | null = null;

                if (openAway && t30Away) {
                  clvRel = relCLV(openAway, t30Away);
                  clvOk = clvRel > clvMin;
                }

                // If the overlay condition does not pass, remove any prior overlay row.
                if (!clvOk) {
                  await supabase
                    .from("pers_sys_signals_v2")
                    .delete()
                    .eq("system_code", system_code)
                    .eq("game_id", g.id)
                    .eq("execution_snapshot", overlayExecSnap)
                    .eq("leg_type", "H2H");
                } else {
                  // We have the condition satisfied. Now decide READY vs PENDING based on market data at T30.
                  const t30Has = hasMarketData(t30Snap, "H2H");

                  const overlayStatus: Status = t30Has ? "READY" : "PENDING";

                  // Exec best fields are drawn from the T30 snapshot row.
                  const overlayExecBestPrice = t30Has ? t30Snap.exec_best_away_price : null;
                  const overlayExecBestBook = t30Has ? t30Snap.exec_best_away_book : null;

                  const overlayReason: Record<string, any> = {
                    ...reason,
                    // Align metadata to what we're actually doing for overlay
                    status: overlayStatus,
                    execution_snapshot: overlayExecSnap,
                    overlay: { type: "H2H", enabled: true, depends_on: overlayExecSnap },
                    overlay_child: {
                      required_execution_snapshot: overlayExecSnap,
                      market: "H2H",
                      side: overlaySide,
                      clv_rel: clvRel !== null ? Number(clvRel.toFixed(4)) : null,
                      clv_min: clvMin,
                    },
                  };

                  if (overlayStatus === "PENDING") {
                    overlayReason.fail = "waiting_overlay_snapshot";
                  } else {
                    // Ensure we don't leave stale fail markers once READY
                    delete overlayReason.fail;
                  }

                  // Upsert overlay row using the same conflict key pattern (system_code,game_id,execution_snapshot,leg_type,side)
                  await supabase.from("pers_sys_signals_v2").upsert(
                    {
                      system_code,
                      game_id: g.id,
                      model_snapshot: modelSnap,
                      execution_snapshot: overlayExecSnap,
                      model_market: "H2H",
                      execution_market: "H2H",
                      pass: overlayStatus === "READY",
                      signal_status: overlayStatus,
                      parent_signal_id: null,
                      leg_type: "H2H",
                      side: overlaySide,
                      line_at_bet: null,
                      ref_price: null,
                      exec_best_price: overlayExecBestPrice,
                      exec_best_book: overlayExecBestBook,
                      recommended_units: null,
                      reason_json: overlayReason,
                      evaluated_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "system_code,game_id,execution_snapshot,leg_type,side" }
                  );
                }
              }
            }
          } catch (e) {
            console.warn("overlay_signal_write_failed", e);
          }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        season,
        horizon_days: horizonDays,
        window: { startIso, endIso },
        signals_created: signalsCreated,
        evaluator: "v2",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
