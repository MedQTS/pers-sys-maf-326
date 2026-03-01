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
    const { season } = await req.json().catch(() => ({
      season: new Date().getFullYear(),
    }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all games for season ordered by time
    const { data: allGames } = await supabase
      .from("pers_sys_games")
      .select("*")
      .eq("season", season)
      .order("start_time_aet", { ascending: true });

    if (!allGames || allGames.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, states_upserted: 0, contexts_upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all teams
    const { data: teams } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name");
    const teamMap = Object.fromEntries(
      (teams || []).map((t) => [t.id, t.canonical_name])
    );

    // Separate completed and upcoming
    const completed = allGames.filter((g) => g.status === "FT");
    const upcoming = allGames.filter((g) => g.status === "SCHEDULED");

    // Build cumulative state for each team from completed games
    type TeamStats = {
      played: number;
      wins: number;
      losses: number;
      draws: number;
      points_for: number;
      points_against: number;
      results: ("W" | "L" | "D")[];
    };

    const teamStats: Record<string, TeamStats> = {};
    const initStats = (): TeamStats => ({
      played: 0, wins: 0, losses: 0, draws: 0,
      points_for: 0, points_against: 0, results: [],
    });

    // Process completed games in order to build state
    const gameStates: Record<string, Record<string, TeamStats>> = {};

    for (const game of allGames) {
      // Snapshot current state BEFORE this game for both teams
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;

      if (!teamStats[homeId]) teamStats[homeId] = initStats();
      if (!teamStats[awayId]) teamStats[awayId] = initStats();

      // Store pre-game state
      gameStates[game.id] = {
        [homeId]: { ...teamStats[homeId], results: [...teamStats[homeId].results] },
        [awayId]: { ...teamStats[awayId], results: [...teamStats[awayId].results] },
      };

      // If game is complete, update running totals
      if (game.status === "FT" && game.home_score !== null && game.away_score !== null) {
        const hs = game.home_score;
        const as_ = game.away_score;

        teamStats[homeId].played++;
        teamStats[homeId].points_for += hs;
        teamStats[homeId].points_against += as_;

        teamStats[awayId].played++;
        teamStats[awayId].points_for += as_;
        teamStats[awayId].points_against += hs;

        if (hs > as_) {
          teamStats[homeId].wins++;
          teamStats[homeId].results.push("W");
          teamStats[awayId].losses++;
          teamStats[awayId].results.push("L");
        } else if (as_ > hs) {
          teamStats[awayId].wins++;
          teamStats[awayId].results.push("W");
          teamStats[homeId].losses++;
          teamStats[homeId].results.push("L");
        } else {
          teamStats[homeId].draws++;
          teamStats[homeId].results.push("D");
          teamStats[awayId].draws++;
          teamStats[awayId].results.push("D");
        }
      }
    }

    // Calculate streak from results array
    function calcStreak(results: ("W" | "L" | "D")[]): number {
      if (results.length === 0) return 0;
      let streak = 0;
      const last = results[results.length - 1];
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] !== last) break;
        streak++;
      }
      return last === "W" ? streak : last === "L" ? -streak : 0;
    }

    // Upsert team_state for upcoming games (and all games with pre-game state)
    let statesUpserted = 0;
    const targetGames = upcoming.length > 0 ? upcoming : allGames.slice(-36);

    for (const game of targetGames) {
      const states = gameStates[game.id];
      if (!states) continue;

      for (const teamId of [game.home_team_id, game.away_team_id]) {
        const s = states[teamId];
        if (!s) continue;

        const pct = s.points_against > 0
          ? Number(((s.points_for / s.points_against) * 100).toFixed(2))
          : s.points_for > 0 ? 999.99 : 100.0;

        const { error } = await supabase.from("pers_sys_team_state").upsert(
          {
            game_id: game.id,
            team_id: teamId,
            season,
            round: game.round,
            asof_ts: new Date().toISOString(),
            played: s.played,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            points_for: s.points_for,
            points_against: s.points_against,
            percentage: pct,
            streak: calcStreak(s.results),
          },
          { onConflict: "game_id,team_id" }
        );
        if (!error) statesUpserted++;
      }
    }

    // Build round context (8th place cutline)
    // Get unique rounds with completed games
    const roundNumbers = [...new Set(completed.map((g) => g.round).filter(Boolean))] as number[];
    let contextsUpserted = 0;

    // Build ladder at each round end
    for (const round of roundNumbers) {
      // Games completed up to and including this round
      const gamesUpTo = completed.filter((g) => g.round !== null && g.round <= round);

      const ladder: Record<string, { wins: number; draws: number; pf: number; pa: number }> = {};

      for (const g of gamesUpTo) {
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
        else {
          ladder[g.home_team_id].draws++;
          ladder[g.away_team_id].draws++;
        }
      }

      // Sort by premiership points (4 per win, 2 per draw), then percentage
      const sorted = Object.entries(ladder)
        .map(([tid, s]) => ({
          tid,
          points: s.wins * 4 + s.draws * 2,
          pct: s.pa > 0 ? (s.pf / s.pa) * 100 : 100,
        }))
        .sort((a, b) => b.points - a.points || b.pct - a.pct);

      if (sorted.length >= 8) {
        const eighth = sorted[7];
        const { error } = await supabase.from("pers_sys_round_context").upsert(
          {
            season,
            round,
            asof_ts: new Date().toISOString(),
            points_8th: eighth.points,
            percentage_8th: Number(eighth.pct.toFixed(2)),
          },
          { onConflict: "season,round" }
        );
        if (!error) contextsUpserted++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, season, states_upserted: statesUpserted, contexts_upserted: contextsUpserted }),
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
