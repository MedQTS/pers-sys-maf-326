// SYS_12A — June/July Short Favourite Dog-Line Compression Guide (manual-check only)
//
// Read-only edge function. Returns JSON only.
// - Does NOT write to pers_sys_signals_v2.
// - Does NOT insert into pers_sys_systems_v2.
// - Does NOT create alerts, bets, or any side effects.
// - Does NOT modify SYS_1..SYS_11A behaviour.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAV_PRICE_MAX = 1.20; // strict less-than
const FAV_LINE_MIN = -49.5; // inclusive (more negative bound)
const FAV_LINE_MAX = -30.0; // inclusive (less negative bound)

const UPCOMING_STATUSES = new Set([
  "SCHEDULED", "scheduled", "UPCOMING", "upcoming", "PENDING", "pending",
  "NOT_STARTED", "not_started", "TBD", "tbd", null, undefined, "",
]);

async function latestSnapshot(supabase: any, gameId: string, marketType: string) {
  const { data } = await supabase
    .from("pers_sys_market_snapshots")
    .select("*")
    .eq("game_id", gameId)
    .eq("market_type", marketType)
    .order("snapshot_ts", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

function aetMonth(iso: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      month: "numeric",
    }).formatToParts(new Date(iso));
    const m = parts.find((p) => p.type === "month")?.value;
    return m ? Number(m) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const gameIdParam: string | null = body.game_id ?? url.searchParams.get("game_id");
    const daysAheadRaw = body.days_ahead ?? url.searchParams.get("days_ahead");
    const daysAhead = Math.max(1, Math.min(60, Number(daysAheadRaw) || 21));

    let games: any[] = [];
    let historicalTest = false;
    if (gameIdParam) {
      const { data } = await supabase
        .from("pers_sys_games")
        .select("id, season, round, start_time_aet, venue, home_team_id, away_team_id, status")
        .eq("id", gameIdParam)
        .maybeSingle();
      if (data) {
        games = [data];
        if (new Date(data.start_time_aet).getTime() < Date.now()) historicalTest = true;
      }
    } else {
      const nowIso = new Date().toISOString();
      const horizonIso = new Date(Date.now() + daysAhead * 86400000).toISOString();
      const { data } = await supabase
        .from("pers_sys_games")
        .select("id, season, round, start_time_aet, venue, home_team_id, away_team_id, status")
        .gte("start_time_aet", nowIso)
        .lte("start_time_aet", horizonIso)
        .order("start_time_aet", { ascending: true });
      games = data ?? [];
    }

    if (!games.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          system_code: "SYS_12A",
          live: false,
          test_mode: historicalTest,
          generated_at: new Date().toISOString(),
          games_inspected: 0,
          candidates: [],
          suppressed_count: 0,
          suppression_breakdown: {},
          note: "No games in window.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const teamIds = Array.from(new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean)));
    const { data: teamRows } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name")
      .in("id", teamIds);
    const teamName = new Map<string, string>((teamRows ?? []).map((t: any) => [t.id, t.canonical_name]));

    const candidates: any[] = [];
    const suppressionBreakdown: Record<string, number> = {};
    let suppressedCount = 0;
    const bump = (reason: string) => {
      suppressionBreakdown[reason] = (suppressionBreakdown[reason] ?? 0) + 1;
      suppressedCount++;
    };

    for (const g of games) {
      const base: any = {
        game_id: g.id,
        home: teamName.get(g.home_team_id) ?? null,
        away: teamName.get(g.away_team_id) ?? null,
        venue: g.venue,
        season: g.season,
        round: g.round,
        start_time_aet: g.start_time_aet,
      };

      if (!historicalTest && !UPCOMING_STATUSES.has(g.status)) {
        candidates.push({ ...base, status: "SUPPRESSED", suppression_reason: "game_not_upcoming" });
        bump("game_not_upcoming");
        continue;
      }

      const month = aetMonth(g.start_time_aet);
      if (month !== 6 && month !== 7) {
        candidates.push({ ...base, status: "SUPPRESSED", suppression_reason: "month_not_june_or_july" });
        bump("month_not_june_or_july");
        continue;
      }

      const h2h = await latestSnapshot(supabase, g.id, "H2H");
      const line = await latestSnapshot(supabase, g.id, "LINE");

      const home_price = h2h ? (h2h.exec_best_home_price ?? h2h.home_price) : null;
      const away_price = h2h ? (h2h.exec_best_away_price ?? h2h.away_price) : null;
      if (home_price == null || away_price == null) {
        candidates.push({ ...base, status: "SUPPRESSED", suppression_reason: "h2h_prices_unavailable" });
        bump("h2h_prices_unavailable");
        continue;
      }

      const home_line = line ? (line.exec_best_home_line ?? line.home_line) : null;
      const away_line = line ? (line.exec_best_away_line ?? line.away_line) : null;
      const home_line_price = line ? (line.exec_best_home_line_price ?? line.home_line_price) : null;
      const away_line_price = line ? (line.exec_best_away_line_price ?? line.away_line_price) : null;
      if (home_line == null || away_line == null) {
        candidates.push({ ...base, status: "SUPPRESSED", suppression_reason: "line_unavailable" });
        bump("line_unavailable");
        continue;
      }

      const favSide: "HOME" | "AWAY" = Number(home_price) <= Number(away_price) ? "HOME" : "AWAY";
      const dogSide: "HOME" | "AWAY" = favSide === "HOME" ? "AWAY" : "HOME";
      const favPrice = Math.min(Number(home_price), Number(away_price));
      const favTeamId = favSide === "HOME" ? g.home_team_id : g.away_team_id;
      const dogTeamId = dogSide === "HOME" ? g.home_team_id : g.away_team_id;
      const favLine = favSide === "HOME" ? Number(home_line) : Number(away_line);
      const dogLine = dogSide === "HOME" ? Number(home_line) : Number(away_line);
      const dogLinePrice = dogSide === "HOME" ? home_line_price : away_line_price;

      const enriched = {
        ...base,
        favourite_team: teamName.get(favTeamId) ?? null,
        favourite_side: favSide,
        favourite_price: favPrice,
        favourite_line: favLine,
        dog_team: teamName.get(dogTeamId) ?? null,
        dog_side: dogSide,
        dog_line: dogLine,
        dog_line_price: dogLinePrice != null ? Number(dogLinePrice) : null,
      };

      if (favPrice >= FAV_PRICE_MAX) {
        candidates.push({ ...enriched, status: "SUPPRESSED", suppression_reason: "favourite_price_not_short_enough" });
        bump("favourite_price_not_short_enough");
        continue;
      }
      if (favLine > FAV_LINE_MAX) {
        candidates.push({ ...enriched, status: "SUPPRESSED", suppression_reason: "favourite_line_too_small" });
        bump("favourite_line_too_small");
        continue;
      }
      if (favLine < FAV_LINE_MIN) {
        candidates.push({ ...enriched, status: "SUPPRESSED", suppression_reason: "favourite_line_too_large" });
        bump("favourite_line_too_large");
        continue;
      }

      const warnings: string[] = [
        "Manual check only.",
        "No bet has been placed.",
        "Do not use if market line/price has materially moved.",
        "Avoid if favourite line has moved to -50 or bigger.",
      ];
      if (dogLinePrice == null) warnings.push("dog_line_price_missing");

      candidates.push({
        ...enriched,
        status: "CANDIDATE",
        suppression_reason: null,
        recommendation: "DOG_LINE_MANUAL_CHECK",
        stake_guidance_u: 0.5,
        rule_path: "JUNE_JULY_SHORT_FAV_DOG_LINE_COMPRESSION",
        historical_basis: {
          sample: "June/July favourite price <1.20, favourite line -30 to -49.5",
          dog_cover_rate: 0.605,
          estimated_roi_at_1_90: 0.15,
          note: "Historical result validates structure only; current market still requires manual check.",
        },
        warnings,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        system_code: "SYS_12A",
        live: false,
        test_mode: historicalTest,
        generated_at: new Date().toISOString(),
        games_inspected: games.length,
        candidates,
        suppressed_count: suppressedCount,
        suppression_breakdown: suppressionBreakdown,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sys12a-report error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
