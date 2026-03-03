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

    // Fetch teams for mapping
    const { data: teams } = await supabase
      .from("pers_sys_teams")
      .select("id, squiggle_team_id");

    const teamBySquiggleId: Record<number, string> = {};
    for (const t of teams || []) {
      if (t.squiggle_team_id != null) {
        teamBySquiggleId[Number(t.squiggle_team_id)] = t.id;
      }
    }

    // Pull from Squiggle
    const url = `https://api.squiggle.com.au/?q=games;year=${season}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "pers-sys-runner/1.0 (personal use)" },
    });
    if (!resp.ok) throw new Error(`Squiggle returned ${resp.status}`);
    const json = await resp.json();
    const games = json.games || [];

    let upserted = 0;
    let skipped = 0;

    for (const g of games) {
      const hteam = g.hteam;
      const ateam = g.ateam;
      const homeTeamId = teamBySquiggleId[Number(hteam)];
      const awayTeamId = teamBySquiggleId[Number(ateam)];

      if (!homeTeamId || !awayTeamId) {
        skipped++;
        continue;
      }

      // Parse date - Squiggle 'date' is UTC ISO. Prefer it. Fallback to unixtime if needed.
      let startTime: string | null = null;
      if (g.date) {
        startTime = new Date(g.date).toISOString();
      } else if (g.unixtime) {
        startTime = new Date(Number(g.unixtime) * 1000).toISOString();
      } else {
        // As a last resort, skip malformed rows
        skipped++;
        continue;
      }

      // Determine status
      let status = "SCHEDULED";
      if (g.complete === 100) status = "FT";
      else if (g.complete && g.complete > 0) status = "LIVE";

      const homeScore = g.hscore ?? null;
      const awayScore = g.ascore ?? null;
      const marginHome =
        homeScore !== null && awayScore !== null
          ? homeScore - awayScore
          : null;

      let winnerTeamId = null;
      let loserTeamId = null;
      let isDraw = false;

      if (status === "FT" && marginHome !== null) {
        if (marginHome > 0) {
          winnerTeamId = homeTeamId;
          loserTeamId = awayTeamId;
        } else if (marginHome < 0) {
          winnerTeamId = awayTeamId;
          loserTeamId = homeTeamId;
        } else {
          isDraw = true;
        }
      }

      const roundStr = g.round ?? "NA";
      const gameIdStr = g.id ? String(g.id) : "NA";
      const gameKey = `${season}_R${roundStr}_G${gameIdStr}`;

      const { error } = await supabase.from("pers_sys_games").upsert(
        {
          season,
          round: g.round ?? null,
          start_time_aet: startTime,
          venue: g.venue ?? null,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          status,
          home_score: homeScore,
          away_score: awayScore,
          margin_home: marginHome,
          winner_team_id: winnerTeamId,
          loser_team_id: loserTeamId,
          is_draw: isDraw,
          squiggle_game_id: String(g.id),
          game_key: gameKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_key" }
      );

      if (error) {
        console.error("Upsert error:", error.message, gameKey);
        skipped++;
      } else {
        upserted++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, season, total: games.length, upserted, skipped }),
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
