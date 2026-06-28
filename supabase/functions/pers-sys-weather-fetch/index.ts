import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATCH_WINDOW_MINUTES = 150;

function normalizeVenue(v: string): string {
  return v.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gameId: string | null = body.game_id ?? null;
    const snapshotStage: "T30" | "T10" =
      body.snapshot_stage === "T10" ? "T10" : "T30";

    if (!gameId) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_game_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Load game
    const { data: game, error: gameErr } = await supabase
      .from("pers_sys_games")
      .select("id, venue, start_time_aet")
      .eq("id", gameId)
      .maybeSingle();

    if (gameErr) throw gameErr;
    if (!game) {
      return new Response(
        JSON.stringify({ ok: false, error: "game_not_found", game_id: gameId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!game.venue) {
      return new Response(
        JSON.stringify({ ok: false, error: "game_has_no_venue", game_id: gameId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!game.start_time_aet) {
      return new Response(
        JSON.stringify({ ok: false, error: "game_has_no_start_time", game_id: gameId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Resolve venue via alias -> canonical
    const rawNorm = normalizeVenue(game.venue);
    const { data: alias } = await supabase
      .from("pers_sys_venue_aliases")
      .select("venue_code")
      .eq("raw_venue_norm", rawNorm)
      .maybeSingle();

    if (!alias) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "venue_alias_not_found",
          raw_venue: game.venue,
          raw_venue_norm: rawNorm,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: venue } = await supabase
      .from("pers_sys_venues")
      .select("venue_code, latitude, longitude, is_outdoor, match_duration_minutes")
      .eq("venue_code", alias.venue_code)
      .maybeSingle();

    if (!venue) {
      return new Response(
        JSON.stringify({ ok: false, error: "venue_not_found", venue_code: alias.venue_code }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Match window (UTC only)
    const kickoffUtc = new Date(game.start_time_aet);
    const windowMins = venue.match_duration_minutes ?? MATCH_WINDOW_MINUTES;
    const windowEndUtc = new Date(kickoffUtc.getTime() + windowMins * 60_000);

    // 4) Indoor venue short-circuit — record snapshot with skipped payload
    if (!venue.is_outdoor) {
      const { data: upserted, error: upsertErr } = await supabase
        .from("pers_sys_weather_snapshots")
        .upsert(
          {
            game_id: gameId,
            snapshot_stage: snapshotStage,
            source: "open-meteo",
            venue_code: venue.venue_code,
            is_outdoor: false,
            window_start_utc: kickoffUtc.toISOString(),
            window_end_utc: windowEndUtc.toISOString(),
            wind_kmh_max: null,
            gust_kmh_max: null,
            rain_mm_total: null,
            hours_matched: 0,
            raw_payload: { skipped: "indoor_venue" },
            checked_at: new Date().toISOString(),
          },
          { onConflict: "game_id,snapshot_stage,source" },
        )
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      return new Response(
        JSON.stringify({ ok: true, snapshot: upserted, indoor: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5) Call Open-Meteo (UTC times). Use start_date/end_date to cover the day(s).
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const startDate = fmtDate(kickoffUtc);
    const endDate = fmtDate(windowEndUtc);

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(venue.latitude));
    url.searchParams.set("longitude", String(venue.longitude));
    url.searchParams.set("hourly", "precipitation,wind_speed_10m,wind_gusts_10m");
    url.searchParams.set("windspeed_unit", "kmh");
    url.searchParams.set("precipitation_unit", "mm");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    const apiRes = await fetch(url.toString());
    const apiJson: any = await apiRes.json().catch(() => null);

    if (!apiRes.ok || !apiJson?.hourly) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "open_meteo_failed",
          status: apiRes.status,
          body: apiJson,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const times: string[] = apiJson.hourly.time ?? [];
    const precip: number[] = apiJson.hourly.precipitation ?? [];
    const winds: number[] = apiJson.hourly.wind_speed_10m ?? [];
    const gusts: number[] = apiJson.hourly.wind_gusts_10m ?? [];

    const windowStartMs = kickoffUtc.getTime();
    const windowEndMs = windowEndUtc.getTime();

    let windMax = -Infinity;
    let gustMax = -Infinity;
    let rainTotal = 0;
    let matched = 0;

    for (let i = 0; i < times.length; i++) {
      // Open-Meteo returns "YYYY-MM-DDTHH:00" without trailing Z when timezone=UTC; treat as UTC.
      const t = times[i].endsWith("Z") ? times[i] : `${times[i]}:00Z`;
      const ts = Date.parse(t);
      if (!Number.isFinite(ts)) continue;
      // Include hour if it overlaps the window at all (hour-bucket start <= windowEnd and hour-bucket end >= windowStart)
      const hourEnd = ts + 3600_000;
      if (hourEnd <= windowStartMs || ts >= windowEndMs) continue;

      matched++;
      if (typeof winds[i] === "number") windMax = Math.max(windMax, winds[i]);
      if (typeof gusts[i] === "number") gustMax = Math.max(gustMax, gusts[i]);
      if (typeof precip[i] === "number") rainTotal += precip[i];
    }

    const windKmhMax = Number.isFinite(windMax) ? windMax : null;
    const gustKmhMax = Number.isFinite(gustMax) ? gustMax : null;
    const rainMmTotal = matched > 0 ? Number(rainTotal.toFixed(3)) : null;

    const { data: upserted, error: upsertErr } = await supabase
      .from("pers_sys_weather_snapshots")
      .upsert(
        {
          game_id: gameId,
          snapshot_stage: snapshotStage,
          source: "open-meteo",
          venue_code: venue.venue_code,
          is_outdoor: true,
          window_start_utc: kickoffUtc.toISOString(),
          window_end_utc: windowEndUtc.toISOString(),
          wind_kmh_max: windKmhMax,
          gust_kmh_max: gustKmhMax,
          rain_mm_total: rainMmTotal,
          hours_matched: matched,
          raw_payload: apiJson,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "game_id,snapshot_stage,source" },
      )
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, snapshot: upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unexpected_error",
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
