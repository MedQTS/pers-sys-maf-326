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

      // Parse date as a true UTC instant.
      // Squiggle typically provides `date` as UTC ISO (with Z). If not, prefer `unixtime`.
      // If `date` is missing a timezone but `tz` exists (e.g. "+10:00"), interpret `date` in that timezone.
      let startTimeUtc: string | null = null;

      const hasTzInfo = (s: string) =>
        /Z$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s);

      if (g.date && typeof g.date === "string") {
        const raw = g.date.trim();

        if (hasTzInfo(raw)) {
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime())) startTimeUtc = d.toISOString();
        } else if (g.tz && typeof g.tz === "string") {
          // Build an ISO string with explicit offset, e.g. "2026-03-14T16:15:00+11:00"
          const isoLocal = raw.includes("T") ? raw : raw.replace(" ", "T");
          const withOffset = `${isoLocal}${g.tz}`;
          const d = new Date(withOffset);
          if (!Number.isNaN(d.getTime())) startTimeUtc = d.toISOString();
        } else {
          // No timezone in `date` and no `tz` field — fall back to unixtime if available
        }
      }

      if (!startTimeUtc && g.unixtime) {
        const d = new Date(Number(g.unixtime) * 1000);
        if (!Number.isNaN(d.getTime())) startTimeUtc = d.toISOString();
      }

      if (!startTimeUtc) {
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
          start_time_aet: startTimeUtc,
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
