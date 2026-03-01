import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const snapshotType: string = body.snapshot_type || "OPEN";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("PERS_SYS_ODDS_API_KEY");
    if (!apiKey) throw new Error("PERS_SYS_ODDS_API_KEY not set");

    const bufferMinutes = 60; // START_BUFFER_MINUTES
    const lookaheadDays = 7;
    const now = new Date();

    // Get eligible scheduled games
    const cutoffStart = new Date(now.getTime() + bufferMinutes * 60 * 1000);
    const cutoffEnd = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

    const { data: eligibleGames } = await supabase
      .from("pers_sys_games")
      .select("id, start_time_aet, home_team_id, away_team_id, oddsapi_event_id")
      .eq("status", "SCHEDULED")
      .gte("start_time_aet", cutoffStart.toISOString())
      .lte("start_time_aet", cutoffEnd.toISOString());

    if (!eligibleGames || eligibleGames.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, snapshot_type: snapshotType, eligible: 0, snapshots_stored: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team mapping for name matching
    const { data: teams } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name, oddsapi_name");

    const teamById: Record<string, { canonical_name: string; oddsapi_name: string | null }> = {};
    for (const t of teams || []) {
      teamById[t.id] = { canonical_name: t.canonical_name, oddsapi_name: t.oddsapi_name };
    }

    // Pull from The Odds API - AFL
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/aussierules_afl/odds/?apiKey=${apiKey}&regions=au&markets=h2h,spreads&oddsFormat=decimal`;
    const oddsResp = await fetch(oddsUrl);
    if (!oddsResp.ok) {
      const errText = await oddsResp.text();
      throw new Error(`Odds API ${oddsResp.status}: ${errText}`);
    }
    const oddsEvents = await oddsResp.json();

    const snapshotTs = now.toISOString();
    let snapshotsStored = 0;

    // Try to match odds events to our games
    for (const game of eligibleGames) {
      const homeInfo = teamById[game.home_team_id];
      const awayInfo = teamById[game.away_team_id];
      if (!homeInfo || !awayInfo) continue;

      // Find matching event
      const matchEvent = oddsEvents.find((ev: any) => {
        if (game.oddsapi_event_id && ev.id === game.oddsapi_event_id) return true;
        const htName = (homeInfo.oddsapi_name || homeInfo.canonical_name).toLowerCase();
        const atName = (awayInfo.oddsapi_name || awayInfo.canonical_name).toLowerCase();
        const evHome = ev.home_team?.toLowerCase() || "";
        const evAway = ev.away_team?.toLowerCase() || "";
        return (evHome.includes(htName) || htName.includes(evHome)) &&
               (evAway.includes(atName) || atName.includes(evAway));
      });

      if (!matchEvent) continue;

      // Update oddsapi_event_id if not set
      if (!game.oddsapi_event_id) {
        await supabase
          .from("pers_sys_games")
          .update({ oddsapi_event_id: matchEvent.id })
          .eq("id", game.id);
      }

      // Extract H2H odds
      const h2hBooks: string[] = [];
      const homePrices: number[] = [];
      const awayPrices: number[] = [];

      // Extract LINE odds
      const lineBooks: string[] = [];
      const homeLines: number[] = [];
      const awayLines: number[] = [];
      const homeLinePrices: number[] = [];
      const awayLinePrices: number[] = [];

      for (const bm of matchEvent.bookmakers || []) {
        for (const mkt of bm.markets || []) {
          if (mkt.key === "h2h") {
            const homeOutcome = mkt.outcomes?.find((o: any) =>
              o.name?.toLowerCase() === matchEvent.home_team?.toLowerCase()
            );
            const awayOutcome = mkt.outcomes?.find((o: any) =>
              o.name?.toLowerCase() === matchEvent.away_team?.toLowerCase()
            );
            if (homeOutcome && awayOutcome) {
              h2hBooks.push(bm.key);
              homePrices.push(homeOutcome.price);
              awayPrices.push(awayOutcome.price);
            }
          } else if (mkt.key === "spreads") {
            const homeOutcome = mkt.outcomes?.find((o: any) =>
              o.name?.toLowerCase() === matchEvent.home_team?.toLowerCase()
            );
            const awayOutcome = mkt.outcomes?.find((o: any) =>
              o.name?.toLowerCase() === matchEvent.away_team?.toLowerCase()
            );
            if (homeOutcome && awayOutcome) {
              lineBooks.push(bm.key);
              homeLines.push(homeOutcome.point ?? 0);
              awayLines.push(awayOutcome.point ?? 0);
              homeLinePrices.push(homeOutcome.price);
              awayLinePrices.push(awayOutcome.price);
            }
          }
        }
      }

      // Store H2H snapshot
      if (homePrices.length > 0) {
        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            snapshot_ts: snapshotTs,
            market_type: "H2H",
            agg_method: "MEDIAN",
            books_used: h2hBooks,
            home_price: Number(median(homePrices).toFixed(3)),
            away_price: Number(median(awayPrices).toFixed(3)),
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored++;
      }

      // Store LINE snapshot
      if (homeLines.length > 0) {
        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            snapshot_ts: snapshotTs,
            market_type: "LINE",
            agg_method: "MEDIAN",
            books_used: lineBooks,
            home_line: Number(median(homeLines).toFixed(1)),
            away_line: Number(median(awayLines).toFixed(1)),
            home_line_price: Number(median(homeLinePrices).toFixed(3)),
            away_line_price: Number(median(awayLinePrices).toFixed(3)),
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot_type: snapshotType,
        eligible: eligibleGames.length,
        odds_events: oddsEvents.length,
        snapshots_stored: snapshotsStored,
      }),
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
