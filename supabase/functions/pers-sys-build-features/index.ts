import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type BuildFeaturesResponse =
  | {
      ok: true;
      season: number;
      states_upserted: number;
      contexts_upserted: number;
      season_meta_seeded: boolean;
      diagnostics: {
        total_games: number;
        completed_games: number;
        upcoming_games: number;
        target_games: number;
      };
    }
  | {
      ok: false;
      season?: number;
      error: string;
      details?: any;
    };

function jsonResponse(body: BuildFeaturesResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { season } = await req.json().catch(() => ({
      season: new Date().getFullYear(),
    }));

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      return jsonResponse({
        ok: false,
        error: "missing_env",
        details: { has_url: !!url, has_service_role_key: !!serviceKey },
      });
    }

    const supabase = createClient(url, serviceKey);

    // Get all games for season ordered by time
    const { data: allGames, error: gamesErr } = await supabase
      .from("pers_sys_games")
      .select("*")
      .eq("season", season)
      .order("start_time_aet", { ascending: true });

    if (gamesErr) {
      return jsonResponse({
        ok: false,
        season,
        error: "games_select_failed",
        details: gamesErr,
      });
    }

    if (!allGames || allGames.length === 0) {
      return jsonResponse({
        ok: true,
        season,
        states_upserted: 0,
        contexts_upserted: 0,
        season_meta_seeded: false,
        diagnostics: {
          total_games: 0,
          completed_games: 0,
          upcoming_games: 0,
          target_games: 0,
        },
      });
    }

    // Get all teams
    const { data: teams, error: teamsErr } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name");

    if (teamsErr) {
      return jsonResponse({
        ok: false,
        season,
        error: "teams_select_failed",
        details: teamsErr,
      });
    }

    const teamById = new Map<string, string>(
      (teams || []).map((t) => [t.id, t.canonical_name])
    );

    // Seed last season GF winner in pers_sys_season_meta if missing:
    // User-approved default: Brisbane Lions (matches seeded team canonical_name).
    const lastSeason = season - 1;
    let seasonMetaSeeded = false;

    {
      const { data: metaRow, error: metaErr } = await supabase
        .from("pers_sys_season_meta")
        .select("season, gf_winner_team_id")
        .eq("season", lastSeason)
        .maybeSingle();

      if (metaErr) {
        return jsonResponse({
          ok: false,
          season,
          error: "season_meta_select_failed",
          details: metaErr,
        });
      }

      if (!metaRow) {
        const brisbane =
          (teams || []).find(
            (t) => (t.canonical_name || "").toLowerCase() === "brisbane lions"
          ) ||
          (teams || []).find((t) =>
            (t.canonical_name || "").toLowerCase().includes("brisbane")
          );

        if (!brisbane) {
          return jsonResponse({
            ok: false,
            season,
            error: "gf_winner_team_not_found",
            details: { attempted: ["Brisbane Lions", "*brisbane*"] },
          });
        }

        const { error: upsertMetaErr } = await supabase
          .from("pers_sys_season_meta")
          .upsert(
            { season: lastSeason, gf_winner_team_id: brisbane.id },
            { onConflict: "season" }
          );

        if (upsertMetaErr) {
          return jsonResponse({
            ok: false,
            season,
            error: "season_meta_upsert_failed",
            details: upsertMetaErr,
          });
        }

        seasonMetaSeeded = true;
      }
    }

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
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points_for: 0,
      points_against: 0,
      results: [],
    });

    // Process games in order to snapshot pre-game states
    const gameStates: Record<string, Record<string, TeamStats>> = {};

    for (const game of allGames) {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;

      if (!teamStats[homeId]) teamStats[homeId] = initStats();
      if (!teamStats[awayId]) teamStats[awayId] = initStats();

      // Store pre-game state
      gameStates[game.id] = {
        [homeId]: {
          ...teamStats[homeId],
          results: [...teamStats[homeId].results],
        },
        [awayId]: {
          ...teamStats[awayId],
          results: [...teamStats[awayId].results],
        },
      };

      // If game is complete, update running totals
      if (
        game.status === "FT" &&
        game.home_score !== null &&
        game.away_score !== null
      ) {
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

    // Upsert team_state for upcoming games (and if none, last 36 games)
    let statesUpserted = 0;
    const writeErrors: any[] = [];

    const targetGames = upcoming.length > 0 ? upcoming : allGames.slice(-36);

    for (const game of targetGames) {
      const states = gameStates[game.id];
      if (!states) continue;

      for (const teamId of [game.home_team_id, game.away_team_id]) {
        const s = states[teamId];
        if (!s) continue;

        const pct =
          s.points_against > 0
            ? Number(((s.points_for / s.points_against) * 100).toFixed(2))
            : s.points_for > 0
            ? 999.99
            : 100.0;

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

        if (error) {
          if (writeErrors.length < 10) {
            writeErrors.push({
              table: "pers_sys_team_state",
              game_id: game.id,
              team_id: teamId,
              team_name: teamById.get(teamId) || null,
              error,
            });
          }
        } else {
          statesUpserted++;
        }
      }
    }

    // If we had games but wrote 0 states, treat as hard failure
    if (statesUpserted === 0) {
      return jsonResponse({
        ok: false,
        season,
        error: "team_state_upserted_0",
        details: {
          total_games: allGames.length,
          completed_games: completed.length,
          upcoming_games: upcoming.length,
          target_games: targetGames.length,
          sample_errors: writeErrors,
        },
      });
    }

    // Build round context (8th place cutline)
    const roundNumbers = [
      ...new Set(completed.map((g) => g.round).filter(Boolean)),
    ] as number[];

    let contextsUpserted = 0;

    for (const round of roundNumbers) {
      const gamesUpTo = completed.filter(
        (g) => g.round !== null && g.round <= round
      );

      const ladder: Record<
        string,
        { wins: number; draws: number; pf: number; pa: number }
      > = {};

      for (const g of gamesUpTo) {
        if (!ladder[g.home_team_id])
          ladder[g.home_team_id] = { wins: 0, draws: 0, pf: 0, pa: 0 };
        if (!ladder[g.away_team_id])
          ladder[g.away_team_id] = { wins: 0, draws: 0, pf: 0, pa: 0 };

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

    return jsonResponse({
      ok: true,
      season,
      states_upserted: statesUpserted,
      contexts_upserted: contextsUpserted,
      season_meta_seeded: seasonMetaSeeded,
      diagnostics: {
        total_games: allGames.length,
        completed_games: completed.length,
        upcoming_games: upcoming.length,
        target_games: targetGames.length,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { ok: false, error: "unhandled_exception", details: String(err) },
      500
    );
  }
});
