import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const season = body.season || new Date().getFullYear();

    // Stage 2: Lock close definition. "Close" is always T10.
    // No system code is allowed to choose another anchor.
    const CLOSE_SNAPSHOT_TYPE = "T10" as const;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get active systems
    const { data: systems } = await supabase
      .from("pers_sys_systems")
      .select("*")
      .eq("active", true);

    // Get upcoming games with team state and market snapshots
    const { data: upcomingGames } = await supabase
      .from("pers_sys_games")
      .select(`
        *,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(id, canonical_name),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(id, canonical_name)
      `)
      .eq("season", season)
      .eq("status", "SCHEDULED")
      .order("start_time_aet");

    if (!upcomingGames || upcomingGames.length === 0 || !systems) {
      return new Response(
        JSON.stringify({ ok: true, signals_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team states for these games
    const gameIds = upcomingGames.map((g) => g.id);
    const { data: teamStates } = await supabase
      .from("pers_sys_team_state")
      .select("*")
      .in("game_id", gameIds);

    // Get market snapshots
    const { data: snapshots } = await supabase
      .from("pers_sys_market_snapshots")
      .select("*")
      .in("game_id", gameIds);

    // Get GF winner for SYS_2
    const { data: seasonMeta } = await supabase
      .from("pers_sys_season_meta")
      .select("*")
      .eq("season", season - 1)
      .maybeSingle();

    // Index data
    const stateByGameTeam: Record<string, any> = {};
    for (const s of teamStates || []) {
      stateByGameTeam[`${s.game_id}_${s.team_id}`] = s;
    }

    const snapshotsByGame: Record<string, any[]> = {};
    for (const s of snapshots || []) {
      if (!snapshotsByGame[s.game_id]) snapshotsByGame[s.game_id] = [];
      snapshotsByGame[s.game_id].push(s);
    }

    let signalsCreated = 0;

    for (const sys of systems) {
      const params = sys.params as Record<string, any>;

      for (const game of upcomingGames) {
        const round = game.round;
        if (round === null || round === undefined) continue;

        // Check excluded seasons
        if (params.exclude_seasons?.includes(season)) continue;

        // Check round window
        if (params.rounds_min && round < params.rounds_min) continue;
        if (params.rounds_max && round > params.rounds_max) continue;

        const homeState = stateByGameTeam[`${game.id}_${game.home_team_id}`];
        const awayState = stateByGameTeam[`${game.id}_${game.away_team_id}`];
        const gameSnaps = snapshotsByGame[game.id] || [];
        const openH2H = gameSnaps.find(
          (s) => s.snapshot_type === "OPEN" && s.market_type === "H2H"
        );
        const openLine = gameSnaps.find(
          (s) => s.snapshot_type === "OPEN" && s.market_type === "LINE"
        );

        const closeH2H = gameSnaps.find(
          (s) => s.snapshot_type === CLOSE_SNAPSHOT_TYPE && s.market_type === "H2H"
        );
        const closeLine = gameSnaps.find(
          (s) => s.snapshot_type === CLOSE_SNAPSHOT_TYPE && s.market_type === "LINE"
        );

        if (sys.system_code === "SYS_3") {
          // Form Dog system
          const reason: Record<string, any> = {
            system: "SYS_3",
            round,
            season,
          };

          let pass = true;

          // Need OPEN H2H, CLOSE (T10) H2H, and team states
          if (!openH2H || !closeH2H || !homeState || !awayState) {
            pass = false;
            reason.fail = "missing_data";
          } else {
            // Determine who is favourite (lower H2H price = fav)
            const homeFav = openH2H.home_price < openH2H.away_price;
            const favTeamId = homeFav ? game.home_team_id : game.away_team_id;
            const dogTeamId = homeFav ? game.away_team_id : game.home_team_id;
            const favState = homeFav ? homeState : awayState;
            const dogState = homeFav ? awayState : homeState;
            const favPrice = homeFav ? openH2H.home_price : openH2H.away_price;
            const dogPrice = homeFav ? openH2H.away_price : openH2H.home_price;

            reason.fav_team = homeFav
              ? (game.home_team as any)?.canonical_name
              : (game.away_team as any)?.canonical_name;
            reason.dog_team = homeFav
              ? (game.away_team as any)?.canonical_name
              : (game.home_team as any)?.canonical_name;
            reason.fav_price = favPrice;
            reason.dog_price = dogPrice;

            // % differential
            const pctDiff = Math.abs(favState.percentage - dogState.percentage);
            reason.pct_diff = Number(pctDiff.toFixed(2));
            reason.fav_pct = favState.percentage;
            reason.dog_pct = dogState.percentage;

            if (pctDiff >= (params.pct_diff_max || 25)) {
              pass = false;
              reason.fail_pct_diff = true;
            }

            // Fav streak (must be winning streak >= threshold)
            const favStreak = favState.streak;
            reason.fav_streak = favStreak;
            if (favStreak < (params.fav_streak_min || 2)) {
              pass = false;
              reason.fail_fav_streak = true;
            }

            // Fav close odds check - locked to CLOSE (T10)
            const favClosePrice = homeFav ? closeH2H.home_price : closeH2H.away_price;
            reason.fav_odds = favClosePrice;
            if (favClosePrice < (params.fav_close_odds_min || 1.55)) {
              // Fav odds too short - this is checking fav odds >= 1.55
              // Actually the spec says "Favourite close odds ≥ 1.55"
              // meaning the favourite can't be too short
              pass = false;
              reason.fail_fav_odds_too_short = true;
            }

            // Must be HOME underdog
            const homeIsDog = !homeFav;
            reason.home_is_dog = homeIsDog;
            if (!homeIsDog) {
              pass = false;
              reason.fail_not_home_dog = true;
            }

            reason.bet_side = "HOME";
            reason.bet_market = "H2H";
            reason.bet_price = openH2H.home_price;

            // Stage 4: attach execution best (H2H)
            reason.exec_best_home_price = openH2H.exec_best_home_price ?? null;
            reason.exec_best_home_book = openH2H.exec_best_home_book ?? null;
            reason.exec_best_away_price = openH2H.exec_best_away_price ?? null;
            reason.exec_best_away_book = openH2H.exec_best_away_book ?? null;

            reason.ref_books_observed = openH2H.ref_books_observed ?? [];
            reason.exec_books_observed = openH2H.exec_books_observed ?? [];

            reason.exec_available =
              !!openH2H.exec_best_home_price && !!openH2H.exec_best_home_book;
          }

          const { error } = await supabase.from("pers_sys_signals").upsert(
            {
              system_code: "SYS_3",
              game_id: game.id,
              snapshot_type: "OPEN",
              pass,
              reason,
            },
            { onConflict: "system_code,game_id,snapshot_type" }
          );
          if (!error) signalsCreated++;
        }

        if (sys.system_code === "SYS_2") {
          // GF Winner Early Fade
          const reason: Record<string, any> = {
            system: "SYS_2",
            round,
            season,
          };
          let pass = true;

          const gfWinnerId = seasonMeta?.gf_winner_team_id;
          if (!gfWinnerId) {
            pass = false;
            reason.fail = "no_gf_winner_set";
          } else if (!openH2H || !openLine) {
            pass = false;
            reason.fail = "missing_odds";
          } else {
            // Check if GF winner is playing in this game
            const gfIsHome = game.home_team_id === gfWinnerId;
            const gfIsAway = game.away_team_id === gfWinnerId;

            if (!gfIsHome && !gfIsAway) {
              pass = false;
              reason.fail = "gf_winner_not_in_game";
            } else {
              const gfH2HPrice = gfIsHome ? openH2H.home_price : openH2H.away_price;
              reason.gf_winner_h2h = gfH2HPrice;

              // Gate: GF winner OPEN H2H >= 1.25
              if (gfH2HPrice < (params.gf_winner_open_h2h_min || 1.25)) {
                pass = false;
                reason.fail_gf_odds_too_short = true;
              }

              // Bet opponent LINE at OPEN
              reason.bet_side = gfIsHome ? "AWAY_LINE" : "HOME_LINE";
              reason.bet_line = gfIsHome ? openLine.away_line : openLine.home_line;
              reason.bet_price = gfIsHome ? openLine.away_line_price : openLine.home_line_price;

              // Stage 4: attach execution best (LINE)
              reason.exec_best_home_line = openLine.exec_best_home_line ?? null;
              reason.exec_best_home_line_price = openLine.exec_best_home_line_price ?? null;
              reason.exec_best_home_line_book = openLine.exec_best_home_line_book ?? null;

              reason.exec_best_away_line = openLine.exec_best_away_line ?? null;
              reason.exec_best_away_line_price = openLine.exec_best_away_line_price ?? null;
              reason.exec_best_away_line_book = openLine.exec_best_away_line_book ?? null;

              reason.ref_books_observed = openLine.ref_books_observed ?? [];
              reason.exec_books_observed = openLine.exec_books_observed ?? [];

              reason.exec_available =
                !!openLine.exec_best_away_line_price &&
                !!openLine.exec_best_away_line_book;
            }
          }

          const { error } = await supabase.from("pers_sys_signals").upsert(
            {
              system_code: "SYS_2",
              game_id: game.id,
              snapshot_type: "OPEN",
              pass,
              reason,
            },
            { onConflict: "system_code,game_id,snapshot_type" }
          );
          if (!error) signalsCreated++;
        }

        // SYS_1 stores primitives only for now (no qualification logic yet)
        if (sys.system_code === "SYS_1") {
          const reason: Record<string, any> = {
            system: "SYS_1",
            round,
            season,
            note: "primitives_only_v1",
          };

          if (homeState && awayState) {
            reason.home_pct = homeState.percentage;
            reason.away_pct = awayState.percentage;
            reason.home_streak = homeState.streak;
            reason.away_streak = awayState.streak;
          }

          if (openLine) {
            // Stage 4: attach execution best (LINE)
            reason.exec_best_home_line = openLine.exec_best_home_line ?? null;
            reason.exec_best_home_line_price = openLine.exec_best_home_line_price ?? null;
            reason.exec_best_home_line_book = openLine.exec_best_home_line_book ?? null;

            reason.exec_best_away_line = openLine.exec_best_away_line ?? null;
            reason.exec_best_away_line_price = openLine.exec_best_away_line_price ?? null;
            reason.exec_best_away_line_book = openLine.exec_best_away_line_book ?? null;

            reason.ref_books_observed = openLine.ref_books_observed ?? [];
            reason.exec_books_observed = openLine.exec_books_observed ?? [];

            reason.exec_available =
              !!openLine.exec_best_away_line_price &&
              !!openLine.exec_best_away_line_book;
          }

          const { error } = await supabase.from("pers_sys_signals").upsert(
            {
              system_code: "SYS_1",
              game_id: game.id,
              snapshot_type: "OPEN",
              pass: false,
              reason,
            },
            { onConflict: "system_code,game_id,snapshot_type" }
          );
          if (!error) signalsCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, season, signals_created: signalsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
