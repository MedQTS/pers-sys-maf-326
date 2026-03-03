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
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawSnapshotType = String(body.snapshot_type || "OPEN").toUpperCase();
    const allowedSnapshotTypes = new Set(["OPEN", "T60", "T30", "T10"]);
    if (!allowedSnapshotTypes.has(rawSnapshotType)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid snapshot_type",
          received: rawSnapshotType,
          allowed: Array.from(allowedSnapshotTypes),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const snapshotType: "OPEN" | "T60" | "T30" | "T10" = rawSnapshotType as
      | "OPEN"
      | "T60"
      | "T30"
      | "T10";

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
    const cutoffEnd = new Date(
      now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000
    );

    const { data: eligibleGames } = await supabase
      .from("pers_sys_games")
      .select("id, start_time_aet, home_team_id, away_team_id, oddsapi_event_id")
      .eq("status", "SCHEDULED")
      .gte("start_time_aet", cutoffStart.toISOString())
      .lte("start_time_aet", cutoffEnd.toISOString());

    if (!eligibleGames || eligibleGames.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          snapshot_type: snapshotType,
          eligible: 0,
          snapshots_stored: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get team mapping for name matching
    const { data: teams } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name, oddsapi_name");

    const teamById: Record<
      string,
      { canonical_name: string; oddsapi_name: string | null }
    > = {};
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

      const homeNames = new Set<string>(
        [homeInfo.canonical_name, homeInfo.oddsapi_name].filter(Boolean) as string[]
      );
      const awayNames = new Set<string>(
        [awayInfo.canonical_name, awayInfo.oddsapi_name].filter(Boolean) as string[]
      );

      const matchedEvent = oddsEvents.find((ev: any) => {
        const home = String(ev.home_team || "");
        const away = String(ev.away_team || "");
        const homeOk = [...homeNames].some((n) => n.toLowerCase() === home.toLowerCase());
        const awayOk = [...awayNames].some((n) => n.toLowerCase() === away.toLowerCase());
        return homeOk && awayOk;
      });

      if (!matchedEvent) continue;

      // If oddsapi_event_id not set, store it for future matching
      if (!game.oddsapi_event_id && matchedEvent.id) {
        await supabase
          .from("pers_sys_games")
          .update({ oddsapi_event_id: matchedEvent.id })
          .eq("id", game.id);
      }

      // Extract markets
      const bookmakers = matchedEvent.bookmakers || [];

      // H2H odds aggregation
      const h2hValues: number[] = [];
      const spreadPoints: number[] = [];
      const spreadPrices: number[] = [];

      for (const bk of bookmakers) {
        for (const m of bk.markets || []) {
          if (m.key === "h2h") {
            for (const o of m.outcomes || []) {
              if (String(o.name).toLowerCase() === homeInfo.canonical_name.toLowerCase()) {
                const price = Number(o.price);
                if (Number.isFinite(price)) h2hValues.push(price);
              }
            }
          }
          if (m.key === "spreads") {
            for (const o of m.outcomes || []) {
              if (String(o.name).toLowerCase() === homeInfo.canonical_name.toLowerCase()) {
                const point = Number(o.point);
                const price = Number(o.price);
                if (Number.isFinite(point) && Number.isFinite(price)) {
                  spreadPoints.push(point);
                  spreadPrices.push(price);
                }
              }
            }
          }
        }
      }

      const h2hMedian = median(h2hValues);

      // For spreads, take median of points and median of prices separately
      const spreadPointMedian = median(spreadPoints);
      const spreadPriceMedian = median(spreadPrices);

      // Store snapshots
      if (Number.isFinite(h2hMedian) && h2hMedian > 0) {
        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            market_type: "H2H",
            agg_method: "median",
            value1: h2hMedian,
            snapshot_ts: snapshotTs,
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored += 1;
      }

      if (
        Number.isFinite(spreadPointMedian) &&
        Number.isFinite(spreadPriceMedian) &&
        spreadPriceMedian > 0
      ) {
        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            market_type: "LINE",
            agg_method: "median",
            value1: spreadPointMedian,
            value2: spreadPriceMedian,
            snapshot_ts: snapshotTs,
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored += 1;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot_type: snapshotType,
        eligible: eligibleGames.length,
        snapshots_stored: snapshotsStored,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
