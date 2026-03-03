import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

function mmdd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}

function inDateWindowAET(startMMDD: string, endMMDD: string, dateAET: Date) {
  // Assumes window does not cross year boundary (true for AFL season windows)
  const x = mmdd(dateAET);
  return x >= startMMDD && x <= endMMDD;
}

function premiershipPoints(wins: number, draws: number) {
  return wins * 4 + draws * 2;
}

function relCLV(openPrice: number, closePrice: number) {
  // Relative CLV in decimal-odds terms
  return (closePrice - openPrice) / openPrice;
}

function pickSnap(
  snaps: SnapshotRow[],
  snapshot_type: string,
  market_type: "H2H" | "LINE"
): SnapshotRow | null {
  return (
    snaps.find(
      (s) => s.snapshot_type === snapshot_type && s.market_type === market_type
    ) ?? null
  );
}

function buildLegH2H(args: {
  system_code: string;
  snapshot_type: string;
  side: "HOME" | "AWAY";
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
  side: "HOME" | "AWAY";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const season = body.season || new Date().getFullYear();

    // Locked close definition
    const CLOSE_SNAPSHOT_TYPE = "T10" as const;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Active systems
    const { data: systems, error: systemsErr } = await supabase
      .from("pers_sys_systems")
      .select("*")
      .eq("active", true);

    if (systemsErr) throw systemsErr;

    // Upcoming games (SCHEDULED)
    const { data: upcomingGames, error: gamesErr } = await supabase
      .from("pers_sys_games")
      .select(
        `
        *,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(id, canonical_name, home_state),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(id, canonical_name, home_state)
      `
      )
      .eq("season", season)
      .eq("status", "SCHEDULED")
      .order("start_time_aet");

    if (gamesErr) throw gamesErr;

    if (!upcomingGames || upcomingGames.length === 0 || !systems) {
      return new Response(JSON.stringify({ ok: true, season, signals_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameIds = upcomingGames.map((g: any) => g.id);

    // Team states for these games
    const { data: teamStates, error: teamStatesErr } = await supabase
      .from("pers_sys_team_state")
      .select("*")
      .in("game_id", gameIds);

    if (teamStatesErr) throw teamStatesErr;

    // Market snapshots for these games
    const { data: snapshots, error: snapsErr } = await supabase
      .from("pers_sys_market_snapshots")
      .select("*")
      .in("game_id", gameIds);

    if (snapsErr) throw snapsErr;

    // Round context (for points_8th)
    const { data: roundCtx, error: roundCtxErr } = await supabase
      .from("pers_sys_round_context")
      .select("*")
      .eq("season", season);

    if (roundCtxErr) throw roundCtxErr;

    // Season meta (prev season GF teams)
    const { data: seasonMeta, error: seasonMetaErr } = await supabase
      .from("pers_sys_season_meta")
      .select("*")
      .eq("season", season - 1)
      .maybeSingle();

    if (seasonMetaErr) throw seasonMetaErr;

    // Total rounds (derive from games table)
    const totalRounds = Math.max(
      ...upcomingGames
        .map((g: any) => (g.round ?? 0))
        .filter((x: any) => typeof x === "number")
    );

    // Index: team state by (game_id, team_id)
    const stateByGameTeam: Record<string, TeamStateRow> = {};
    for (const s of (teamStates as any[]) || []) {
      stateByGameTeam[`${s.game_id}_${s.team_id}`] = s as TeamStateRow;
    }

    // Index: snapshots by game
    const snapshotsByGame: Record<string, SnapshotRow[]> = {};
    for (const s of (snapshots as any[]) || []) {
      if (!snapshotsByGame[s.game_id]) snapshotsByGame[s.game_id] = [];
      snapshotsByGame[s.game_id].push(s as SnapshotRow);
    }

    // Index: round context by round
    const roundCtxByRound: Record<number, any> = {};
    for (const rc of (roundCtx as any[]) || []) {
      if (typeof rc.round === "number") roundCtxByRound[rc.round] = rc;
    }

    // Optional: venue->state mapping (best-effort). If missing, SYS_4 venue gate will fail safely.
    const venueStateByVenue: Record<string, string> = {};
    {
      const { data: vs, error: vsErr } = await supabase
        .from("pers_sys_venue_state")
        .select("*")
        .limit(5000);

      if (!vsErr && vs) {
        for (const row of vs as any[]) {
          const venueKey =
            (row.venue_key as string | null) ??
            (row.venue as string | null) ??
            null;
          const st = (row.state as string | null) ?? null;
          if (venueKey && st) venueStateByVenue[String(venueKey)] = String(st);
        }
      }
    }

    // Cache: prior result per team_id (best-effort), used for SYS_7 lost_prior_match + draw handling
    const priorResultCache: Record<
      string,
      { outcome: "WIN" | "LOSS" | "DRAW" | "UNKNOWN"; game_id?: string }
    > = {};

    async function getPriorOutcome(teamId: string, gameStartIso: string) {
      const cacheKey = `${teamId}_${gameStartIso}`;
      if (priorResultCache[cacheKey]) return priorResultCache[cacheKey];

      // Find the most recent completed game for this team before the current game's start time.
      const { data: priorGames, error } = await supabase
        .from("pers_sys_games")
        .select("id,start_time_aet,winner_team_id,loser_team_id,is_draw,status")
        .eq("season", season)
        .lt("start_time_aet", gameStartIso)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("start_time_aet", { ascending: false })
        .limit(5);

      if (error || !priorGames || priorGames.length === 0) {
        const res = { outcome: "UNKNOWN" as const };
        priorResultCache[cacheKey] = res;
        return res;
      }

      // Take the first row that has winner/loser or draw flagged.
      for (const pg of priorGames as any[]) {
        if (pg.is_draw) {
          const res = { outcome: "DRAW" as const, game_id: pg.id as string };
          priorResultCache[cacheKey] = res;
          return res;
        }
        if (pg.winner_team_id && pg.loser_team_id) {
          const outcome =
            pg.winner_team_id === teamId
              ? ("WIN" as const)
              : pg.loser_team_id === teamId
              ? ("LOSS" as const)
              : ("UNKNOWN" as const);
          const res = { outcome, game_id: pg.id as string };
          priorResultCache[cacheKey] = res;
          return res;
        }
      }

      const res = { outcome: "UNKNOWN" as const };
      priorResultCache[cacheKey] = res;
      return res;
    }

    let signalsCreated = 0;

    for (const sys of systems as any[]) {
      const params = (sys.params ?? {}) as Record<string, any>;
      const system_code = String(sys.system_code);

      for (const game of upcomingGames as any[]) {
        const g = game as unknown as GameRow;
        const round = g.round;
        if (round === null || round === undefined) continue;

        // excluded seasons
        if (Array.isArray(params.exclude_seasons) && params.exclude_seasons.includes(season)) {
          continue;
        }

        // Numeric round windows
        if (typeof params.rounds_min === "number" && round < params.rounds_min) continue;
        if (typeof params.rounds_max === "number" && round > params.rounds_max) continue;
        if (typeof params.season_progress_round_min === "number" && round < params.season_progress_round_min) continue;

        const homeState = stateByGameTeam[`${g.id}_${g.home_team_id}`];
        const awayState = stateByGameTeam[`${g.id}_${g.away_team_id}`];
        const gameSnaps = snapshotsByGame[g.id] || [];

        const openH2H = pickSnap(gameSnaps, "OPEN", "H2H");
        const openLine = pickSnap(gameSnaps, "OPEN", "LINE");
        const closeH2H = pickSnap(gameSnaps, CLOSE_SNAPSHOT_TYPE, "H2H");
        const closeLine = pickSnap(gameSnaps, CLOSE_SNAPSHOT_TYPE, "LINE");

        // Helper: write signal
        async function upsertSignal(pass: boolean, reason: Record<string, any>, snapshot_type: string) {
          const { error } = await supabase.from("pers_sys_signals").upsert(
            {
              system_code,
              game_id: g.id,
              snapshot_type,
              pass,
              reason,
            },
            { onConflict: "system_code,game_id,snapshot_type" }
          );
          if (!error) signalsCreated++;
        }

        // =========================
        // SYS_1 — Dead Teams CLV Line
        // =========================
        if (system_code === "SYS_1") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          // Requires close line and open line for CLV, team states, and round context
          if (!homeState || !awayState || !openLine || !closeLine) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Window: Remaining 3–7 rounds (inclusive)
            const roundsRemaining = totalRounds - round + 1;
            reason.rounds_remaining = roundsRemaining;
            if (roundsRemaining < 3 || roundsRemaining > 7) {
              pass = false;
              reason.fail_window = true;
            }

            // Compute premiership points and points behind 8th
            const rc = roundCtxByRound[round];
            if (!rc || typeof rc.points_8th !== "number") {
              pass = false;
              reason.fail_round_context = true;
            } else {
              const homePts = premiershipPoints(homeState.wins, homeState.draws);
              const awayPts = premiershipPoints(awayState.wins, awayState.draws);
              reason.home_premiership_points = homePts;
              reason.away_premiership_points = awayPts;
              reason.points_8th = rc.points_8th;

              // Identify dead team: the team that is >= 8 points behind 8th
              const minBehind = Number(params.dead_team_points_behind_8th_min ?? 8);
              const homeBehind = rc.points_8th - homePts;
              const awayBehind = rc.points_8th - awayPts;
              reason.home_points_behind_8th = homeBehind;
              reason.away_points_behind_8th = awayBehind;

              const homeDead = homeBehind >= minBehind;
              const awayDead = awayBehind >= minBehind;

              // Exactly one dead side expected; if both or neither, fail
              if ((homeDead && awayDead) || (!homeDead && !awayDead)) {
                pass = false;
                reason.fail_dead_side_ambiguous = true;
              } else {
                const deadSide: "HOME" | "AWAY" = homeDead ? "HOME" : "AWAY";
                reason.dead_side = deadSide;

                // Opponent must be top8 at time of match (approx via points >= points_8th)
                if (params.opponent_must_be_top8) {
                  const oppPts = deadSide === "HOME" ? awayPts : homePts;
                  if (oppPts < rc.points_8th) {
                    pass = false;
                    reason.fail_opponent_not_top8 = true;
                  }
                }

                // CLV gate: require positive relative CLV on dead-side line price (OPEN->T10)
                if (params.clv_required) {
                  const openPrice =
                    deadSide === "HOME"
                      ? openLine.home_line_price
                      : openLine.away_line_price;
                  const closePrice =
                    deadSide === "HOME"
                      ? closeLine.home_line_price
                      : closeLine.away_line_price;

                  if (!openPrice || !closePrice) {
                    pass = false;
                    reason.fail_missing_clv_prices = true;
                  } else {
                    const clv = relCLV(openPrice, closePrice);
                    reason.clv_rel = Number(clv.toFixed(4));
                    const clvMin = Number(params.clv_min ?? 0.03);
                    if (clv <= clvMin) {
                      pass = false;
                      reason.fail_clv = true;
                    }
                  }
                }

                // Build leg: LINE on dead side at CLOSE (T10)
                const lineAtBet =
                  deadSide === "HOME" ? closeLine.home_line : closeLine.away_line;
                const refPrice =
                  deadSide === "HOME"
                    ? closeLine.home_line_price
                    : closeLine.away_line_price;

                const execBestPrice =
                  deadSide === "HOME"
                    ? closeLine.exec_best_home_line_price
                    : closeLine.exec_best_away_line_price;
                const execBestBook =
                  deadSide === "HOME"
                    ? closeLine.exec_best_home_line_book
                    : closeLine.exec_best_away_line_book;

                reason.legs.push(
                  buildLegLine({
                    system_code,
                    snapshot_type: CLOSE_SNAPSHOT_TYPE,
                    side: deadSide,
                    line_at_bet: lineAtBet ?? null,
                    ref_price: refPrice ?? null,
                    exec_best_price: execBestPrice ?? null,
                    exec_best_book: execBestBook ?? null,
                    ref_books_observed: closeLine.ref_books_observed ?? [],
                    exec_books_observed: closeLine.exec_books_observed ?? [],
                  })
                );

                reason.exec_available = !!execBestPrice && !!execBestBook;
              }
            }
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }

        // =========================
        // SYS_2 — GF Winner Early Fade
        // =========================
        if (system_code === "SYS_2") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          const gfWinnerId = seasonMeta?.gf_winner_team_id ?? null;
          const gfRunnerUpId = seasonMeta?.gf_runner_up_team_id ?? null;

          if (params.gf_winner_required && !gfWinnerId) {
            pass = false;
            reason.fail = "no_gf_winner_set";
          } else if (!openH2H || !openLine || !closeH2H || !closeLine) {
            pass = false;
            reason.fail = "missing_odds";
          } else {
            // Exclude GF replay (winner vs runner-up)
            if (params.exclude_gf_replay && gfWinnerId && gfRunnerUpId) {
              const teams = new Set([g.home_team_id, g.away_team_id]);
              if (teams.has(gfWinnerId) && teams.has(gfRunnerUpId)) {
                pass = false;
                reason.fail = "gf_replay_excluded";
              }
            }

            if (pass && gfWinnerId) {
              const gfIsHome = g.home_team_id === gfWinnerId;
              const gfIsAway = g.away_team_id === gfWinnerId;

              if (!gfIsHome && !gfIsAway) {
                pass = false;
                reason.fail = "gf_winner_not_in_game";
              } else {
                const gfOpenPrice = gfIsHome ? openH2H.home_price : openH2H.away_price;
                reason.gf_winner_open_h2h = gfOpenPrice;

                // GF winner must be favourite at OPEN if required
                if (params.gf_winner_must_be_favourite_at_open) {
                  const homeFavOpen =
                    (openH2H.home_price ?? 999) < (openH2H.away_price ?? 999);
                  const gfIsFavOpen = gfIsHome ? homeFavOpen : !homeFavOpen;
                  if (!gfIsFavOpen) {
                    pass = false;
                    reason.fail_gf_not_fav_at_open = true;
                  }
                }

                // Gate: GF winner OPEN H2H <= max (per params)
                const gfMax = Number(params.gf_winner_open_h2h_max ?? 1.48);
                if (!gfOpenPrice || gfOpenPrice > gfMax) {
                  pass = false;
                  reason.fail_gf_odds_too_long = true;
                }

                if (pass) {
                  // Primary: Bet opponent LINE at OPEN (as per your current SYS_2 implementation)
                  const side: "HOME" | "AWAY" = gfIsHome ? "AWAY" : "HOME";
                  const lineAtOpen = side === "HOME" ? openLine.home_line : openLine.away_line;
                  const refPriceOpen = side === "HOME" ? openLine.home_line_price : openLine.away_line_price;

                  const execBestPrice =
                    side === "HOME"
                      ? openLine.exec_best_home_line_price
                      : openLine.exec_best_away_line_price;
                  const execBestBook =
                    side === "HOME"
                      ? openLine.exec_best_home_line_book
                      : openLine.exec_best_away_line_book;

                  reason.legs.push(
                    buildLegLine({
                      system_code,
                      snapshot_type: "OPEN",
                      side,
                      line_at_bet: lineAtOpen ?? null,
                      ref_price: refPriceOpen ?? null,
                      exec_best_price: execBestPrice ?? null,
                      exec_best_book: execBestBook ?? null,
                      ref_books_observed: openLine.ref_books_observed ?? [],
                      exec_books_observed: openLine.exec_books_observed ?? [],
                    })
                  );

                  // Overlay (optional): only if GF winner is away, CLV gate on H2H (OPEN->T10)
                  const overlay = params.overlay_h2h_gate ?? null;
                  if (overlay?.enabled && overlay.only_if_gf_winner_is_away && gfIsAway) {
                    const gfOpen = openH2H.away_price;
                    const gfClose = closeH2H.away_price;
                    if (overlay.clv_required && gfOpen && gfClose) {
                      const clv = relCLV(gfOpen, gfClose);
                      reason.gf_h2h_clv_rel = Number(clv.toFixed(4));
                      const min = Number(overlay.clv_min ?? 0.03);
                      if (clv > min) {
                        // informational overlay leg (not a second bet leg unless you later choose)
                        reason.overlay_h2h_gate_pass = true;
                      } else {
                        reason.overlay_h2h_gate_pass = false;
                      }
                    } else {
                      reason.overlay_h2h_gate_pass = false;
                      reason.overlay_h2h_gate_fail = "missing_clv_prices";
                    }
                  }

                  reason.exec_available = reason.legs.some(
                    (l: any) => !!l.exec_best_price && !!l.exec_best_book
                  );
                }
              }
            }
          }

          await upsertSignal(pass, reason, "OPEN");
        }

        // =========================
        // SYS_3 — Form Dog (H2H)
        // =========================
        if (system_code === "SYS_3") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          if (!closeH2H || !homeState || !awayState) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Date window
            const dw = params.date_window_aet;
            const gameDate = new Date(g.start_time_aet);
            if (dw?.start && dw?.end) {
              const ok = inDateWindowAET(String(dw.start), String(dw.end), gameDate);
              reason.in_date_window = ok;
              if (!ok) {
                pass = false;
                reason.fail_date_window = true;
              }
            }

            // Determine favourite at CLOSE
            const homeFav = (closeH2H.home_price ?? 999) < (closeH2H.away_price ?? 999);
            const favSide: "HOME" | "AWAY" = homeFav ? "HOME" : "AWAY";
            const dogSide: "HOME" | "AWAY" = homeFav ? "AWAY" : "HOME";

            const favState = homeFav ? homeState : awayState;
            const dogState = homeFav ? awayState : homeState;

            const favClosePrice = homeFav ? closeH2H.home_price : closeH2H.away_price;
            const dogClosePrice = homeFav ? closeH2H.away_price : closeH2H.home_price;

            reason.fav_side = favSide;
            reason.dog_side = dogSide;
            reason.fav_close_price = favClosePrice;
            reason.dog_close_price = dogClosePrice;

            // % differential
            const pctDiff = Math.abs(favState.percentage - dogState.percentage);
            reason.pct_diff = Number(pctDiff.toFixed(2));
            if (pctDiff >= Number(params.pct_diff_max ?? 25)) {
              pass = false;
              reason.fail_pct_diff = true;
            }

            // Fav streak
            const favStreak = favState.streak;
            reason.fav_streak = favStreak;
            if (favStreak < Number(params.fav_streak_min ?? 2)) {
              pass = false;
              reason.fail_fav_streak = true;
            }

            // Fav close odds band
            const minOdds = Number(params.fav_close_odds_min ?? 1.55);
            const maxOdds = Number(params.fav_close_odds_max ?? 1.85);
            if (!favClosePrice || favClosePrice < minOdds || favClosePrice > maxOdds) {
              pass = false;
              reason.fail_fav_odds_band = true;
            }

            // Must be HOME underdog at close (per spec)
            if (params.home_must_be_underdog_at_close) {
              const homeIsDog = !homeFav;
              reason.home_is_dog = homeIsDog;
              if (!homeIsDog) {
                pass = false;
                reason.fail_not_home_dog = true;
              }
            }

            // Legs: H2H HOME (home underdog)
            const side: "HOME" | "AWAY" = "HOME";
            const refPrice = closeH2H.home_price;

            const execBestPrice = closeH2H.exec_best_home_price;
            const execBestBook = closeH2H.exec_best_home_book;

            reason.legs.push(
              buildLegH2H({
                system_code,
                snapshot_type: CLOSE_SNAPSHOT_TYPE,
                side,
                ref_price: refPrice ?? null,
                exec_best_price: execBestPrice ?? null,
                exec_best_book: execBestBook ?? null,
                ref_books_observed: closeH2H.ref_books_observed ?? [],
                exec_books_observed: closeH2H.exec_books_observed ?? [],
              })
            );

            reason.exec_available = !!execBestPrice && !!execBestBook;
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }

        // =========================
        // SYS_4 — Line Last 2 Rounds
        // =========================
        if (system_code === "SYS_4") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          if (!homeState || !awayState || !closeH2H || !closeLine) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Window: last 3 rounds
            const roundsRemaining = totalRounds - round + 1;
            reason.rounds_remaining = roundsRemaining;
            if (roundsRemaining > 3) {
              pass = false;
              reason.fail_window = true;
            }

            // Interstate required
            if (params.interstate_required) {
              const hs = (g.home_team as any)?.home_state ?? null;
              const as_ = (g.away_team as any)?.home_state ?? null;
              reason.home_state = hs;
              reason.away_state = as_;
              if (!hs || !as_ || hs === as_) {
                pass = false;
                reason.fail_not_interstate = true;
              }
            }

            // Venue state allowed (best-effort; fail safely if missing)
            if (Array.isArray(params.venue_states_allowed) && params.venue_states_allowed.length > 0) {
              const v = g.venue ?? null;
              reason.venue = v;
              let venueState: string | null = null;

              if (v && venueStateByVenue[v]) venueState = venueStateByVenue[v];

              // If venue state missing, fail safely (do not qualify)
              if (!venueState) {
                pass = false;
                reason.fail_missing_venue_state = true;
              } else {
                reason.venue_state = venueState;
                if (!params.venue_states_allowed.includes(venueState)) {
                  pass = false;
                  reason.fail_venue_state = true;
                }
              }
            }

            // Opponent has <=4 wins (opponent = underdog team? Spec says opponent has <=4 wins pre-match; interpret as underdog side has <=4 wins)
            const oppWinsMax = Number(params.opponent_wins_max ?? 4);
            const homeFav = (closeH2H.home_price ?? 999) < (closeH2H.away_price ?? 999);
            const favSide: "HOME" | "AWAY" = homeFav ? "HOME" : "AWAY";
            const dogSide: "HOME" | "AWAY" = homeFav ? "AWAY" : "HOME";

            const dogWins = dogSide === "HOME" ? homeState.wins : awayState.wins;
            reason.dog_wins = dogWins;
            if (dogWins > oppWinsMax) {
              pass = false;
              reason.fail_opponent_wins = true;
            }

            // Bet: Favourite — LINE (ATS) at CLOSE
            const lineAtBet =
              favSide === "HOME" ? closeLine.home_line : closeLine.away_line;
            const refPrice =
              favSide === "HOME"
                ? closeLine.home_line_price
                : closeLine.away_line_price;

            const execBestPrice =
              favSide === "HOME"
                ? closeLine.exec_best_home_line_price
                : closeLine.exec_best_away_line_price;
            const execBestBook =
              favSide === "HOME"
                ? closeLine.exec_best_home_line_book
                : closeLine.exec_best_away_line_book;

            reason.legs.push(
              buildLegLine({
                system_code,
                snapshot_type: CLOSE_SNAPSHOT_TYPE,
                side: favSide,
                line_at_bet: lineAtBet ?? null,
                ref_price: refPrice ?? null,
                exec_best_price: execBestPrice ?? null,
                exec_best_book: execBestBook ?? null,
                ref_books_observed: closeLine.ref_books_observed ?? [],
                exec_books_observed: closeLine.exec_books_observed ?? [],
              })
            );

            reason.exec_available = !!execBestPrice && !!execBestBook;
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }

        // =========================
        // SYS_5 — Line Dog
        // =========================
        if (system_code === "SYS_5") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          if (!openLine || !closeLine || !closeH2H) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Determine dog at CLOSE from H2H (higher price = dog)
            const homeDog = (closeH2H.home_price ?? 0) > (closeH2H.away_price ?? 0);
            const dogSide: "HOME" | "AWAY" = homeDog ? "HOME" : "AWAY";
            reason.dog_side = dogSide;

            // H2H close odds band for dog (spec references dog H2H close)
            const dogClosePrice = homeDog ? closeH2H.home_price : closeH2H.away_price;
            reason.dog_h2h_close = dogClosePrice;

            const h2hMin = Number(params.h2h_close_min ?? 1.95);
            const h2hMax = Number(params.h2h_close_max ?? 2.85);
            if (!dogClosePrice || dogClosePrice < h2hMin || dogClosePrice >= h2hMax) {
              pass = false;
              reason.fail_h2h_band = true;
            }

            // Require close line > 0 for dog side
            if (params.require_close_line_gt_zero) {
              const dogCloseLine = dogSide === "HOME" ? closeLine.home_line : closeLine.away_line;
              reason.dog_close_line = dogCloseLine;
              if (dogCloseLine === null || dogCloseLine === undefined || !(dogCloseLine > 0)) {
                pass = false;
                reason.fail_close_line_not_positive = true;
              }
            }

            // Require positive line CLV for dog: CloseLine - OpenLine > 0 (dog receiving more points)
            if (params.require_line_clv_positive) {
              const openDogLine = dogSide === "HOME" ? openLine.home_line : openLine.away_line;
              const closeDogLine = dogSide === "HOME" ? closeLine.home_line : closeLine.away_line;
              if (openDogLine === null || closeDogLine === null || openDogLine === undefined || closeDogLine === undefined) {
                pass = false;
                reason.fail_missing_lines_for_clv = true;
              } else {
                const lineClv = Number((closeDogLine - openDogLine).toFixed(2));
                reason.line_clv_points = lineClv;
                if (lineClv <= 0) {
                  pass = false;
                  reason.fail_line_clv = true;
                }
              }
            }

            // Bet: Dog — LINE (ATS) at CLOSE
            const lineAtBet =
              dogSide === "HOME" ? closeLine.home_line : closeLine.away_line;
            const refPrice =
              dogSide === "HOME"
                ? closeLine.home_line_price
                : closeLine.away_line_price;

            const execBestPrice =
              dogSide === "HOME"
                ? closeLine.exec_best_home_line_price
                : closeLine.exec_best_away_line_price;
            const execBestBook =
              dogSide === "HOME"
                ? closeLine.exec_best_home_line_book
                : closeLine.exec_best_away_line_book;

            reason.legs.push(
              buildLegLine({
                system_code,
                snapshot_type: CLOSE_SNAPSHOT_TYPE,
                side: dogSide,
                line_at_bet: lineAtBet ?? null,
                ref_price: refPrice ?? null,
                exec_best_price: execBestPrice ?? null,
                exec_best_book: execBestBook ?? null,
                ref_books_observed: closeLine.ref_books_observed ?? [],
                exec_books_observed: closeLine.exec_books_observed ?? [],
              })
            );

            reason.exec_available = !!execBestPrice && !!execBestBook;
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }

        // =========================
        // SYS_6 — Dog Mid-Season (Away dog OPEN)
        // =========================
        if (system_code === "SYS_6") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          const dw = params.date_window_aet;
          const gameDate = new Date(g.start_time_aet);
          if (dw?.start && dw?.end) {
            const ok = inDateWindowAET(String(dw.start), String(dw.end), gameDate);
            reason.in_date_window = ok;
            if (!ok) {
              pass = false;
              reason.fail_date_window = true;
            }
          }

          if (!openH2H || !closeH2H) {
            pass = false;
            reason.fail = "missing_odds";
          } else {
            // Selection: AWAY_DOG_OPEN with odds band
            const openAway = openH2H.away_price;
            reason.away_open_h2h = openAway;

            const min = Number(params.open_odds_min ?? 3.5);
            const max = Number(params.open_odds_max ?? 7.0);
            if (!openAway || openAway < min || openAway > max) {
              pass = false;
              reason.fail_open_band = true;
            }

            // Ensure away is dog at OPEN (away price > home price)
            const awayIsDogOpen = (openH2H.away_price ?? 0) > (openH2H.home_price ?? 0);
            reason.away_is_dog_open = awayIsDogOpen;
            if (!awayIsDogOpen) {
              pass = false;
              reason.fail_not_away_dog_open = true;
            }

            // CLV required on AWAY H2H (OPEN->T10)
            if (params.clv_required) {
              const openP = openH2H.away_price;
              const closeP = closeH2H.away_price;
              if (!openP || !closeP) {
                pass = false;
                reason.fail_missing_clv_prices = true;
              } else {
                const clv = relCLV(openP, closeP);
                reason.clv_rel = Number(clv.toFixed(4));
                const minClv = Number(params.clv_min ?? 0.01);
                if (clv <= minClv) {
                  pass = false;
                  reason.fail_clv = true;
                }
              }
            }

            // Bet: H2H AWAY at CLOSE (T10) for execution
            const refPrice = closeH2H.away_price;
            const execBestPrice = closeH2H.exec_best_away_price;
            const execBestBook = closeH2H.exec_best_away_book;

            reason.legs.push(
              buildLegH2H({
                system_code,
                snapshot_type: CLOSE_SNAPSHOT_TYPE,
                side: "AWAY",
                ref_price: refPrice ?? null,
                exec_best_price: execBestPrice ?? null,
                exec_best_book: execBestBook ?? null,
                ref_books_observed: closeH2H.ref_books_observed ?? [],
                exec_books_observed: closeH2H.exec_books_observed ?? [],
              })
            );

            reason.exec_available = !!execBestPrice && !!execBestBook;
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }

        // =========================
        // SYS_7 — Home Favourite Bounce Escalation
        // =========================
        if (system_code === "SYS_7") {
          const reason: Record<string, any> = {
            system_code,
            round,
            season,
            legs: [] as any[],
          };

          let pass = true;

          const dw = params.date_window_aet;
          const gameDate = new Date(g.start_time_aet);
          if (dw?.start && dw?.end) {
            const ok = inDateWindowAET(String(dw.start), String(dw.end), gameDate);
            reason.in_date_window = ok;
            if (!ok) {
              pass = false;
              reason.fail_date_window = true;
            }
          }

          if (!closeH2H || !homeState) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Home must be favourite at CLOSE
            const homeFavClose = (closeH2H.home_price ?? 999) < (closeH2H.away_price ?? 999);
            reason.home_fav_close = homeFavClose;
            if (params.home_must_be_favourite_at_close && !homeFavClose) {
              pass = false;
              reason.fail_not_home_fav = true;
            }

            // Home close odds band
            const homeClose = closeH2H.home_price;
            reason.home_close_odds = homeClose;
            const min = Number(params.home_close_odds_min ?? 1.5);
            const max = Number(params.home_close_odds_max ?? 1.85);
            if (!homeClose || homeClose < min || homeClose > max) {
              pass = false;
              reason.fail_home_odds_band = true;
            }

            // Lost prior match required
            if (params.lost_prior_match_required) {
              // Prefer explicit prior outcome (supports draw_counts_as_loss)
              const prior = await getPriorOutcome(g.home_team_id, g.start_time_aet);
              reason.home_prior_outcome = prior.outcome;

              const drawCountsAsLoss = !!params.draw_counts_as_loss;
              const lostPrior =
                prior.outcome === "LOSS" || (drawCountsAsLoss && prior.outcome === "DRAW");

              if (!lostPrior) {
                // Fallback: if UNKNOWN, use streak heuristic
                if (prior.outcome === "UNKNOWN") {
                  reason.home_streak = homeState.streak;
                  if (!(homeState.streak <= -1)) {
                    pass = false;
                    reason.fail_lost_prior = true;
                  } else {
                    reason.lost_prior_via_streak = true;
                  }
                } else {
                  pass = false;
                  reason.fail_lost_prior = true;
                }
              }
            }

            // Tier assignment via streak (deterministic)
            const st = homeState.streak;
            reason.home_streak = st;

            let tier: "tier1" | "tier2" | "tier3" = "tier1";
            if (st <= -3) tier = "tier3";
            else if (st === -2) tier = "tier2";
            else tier = "tier1";
            reason.tier = tier;

            const tierUnits = params.tier_units ?? {};
            const units =
              tier === "tier3"
                ? Number(tierUnits.tier3 ?? 3.0)
                : tier === "tier2"
                ? Number(tierUnits.tier2 ?? 2.25)
                : Number(tierUnits.tier1 ?? 1.5);

            reason.recommended_units = units;

            // Leg: H2H HOME at CLOSE
            const refPrice = closeH2H.home_price;
            const execBestPrice = closeH2H.exec_best_home_price;
            const execBestBook = closeH2H.exec_best_home_book;

            reason.legs.push(
              buildLegH2H({
                system_code,
                snapshot_type: CLOSE_SNAPSHOT_TYPE,
                side: "HOME",
                ref_price: refPrice ?? null,
                exec_best_price: execBestPrice ?? null,
                exec_best_book: execBestBook ?? null,
                ref_books_observed: closeH2H.ref_books_observed ?? [],
                exec_books_observed: closeH2H.exec_books_observed ?? [],
              })
            );

            reason.exec_available = !!execBestPrice && !!execBestBook;
          }

          await upsertSignal(pass, reason, CLOSE_SNAPSHOT_TYPE);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, season, signals_created: signalsCreated }),
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
