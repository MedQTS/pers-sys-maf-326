// SYS_11A — Mid-Price Favourite Home-Dog Line Guide (manual-check only)
//
// Read-only edge function. Returns JSON only.
// - Does NOT write to pers_sys_signals_v2.
// - Does NOT insert into pers_sys_systems_v2.
// - Does NOT create alerts, bets, or any side effects.
// - Does NOT modify SYS_1..SYS_10A behaviour.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAV_MIN = 1.51;
const FAV_MAX = 1.70;

type Split = {
  home_away: "HOME" | "AWAY";
  games: number;
  covers: number;
  fails: number;
  pushes: number;
  cover_rate: number;
  avg_ats_margin: number;
};

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

async function computeAtsSplits(
  supabase: any,
  season: number,
): Promise<Map<string, Split>> {
  // Map: `${team_id}|HOME` / `${team_id}|AWAY` -> Split
  const splits = new Map<string, Split>();

  // Pull completed games for season
  const { data: games } = await supabase
    .from("pers_sys_games")
    .select("id, home_team_id, away_team_id, home_score, away_score, margin_home, status")
    .eq("season", season)
    .in("status", ["COMPLETE", "COMPLETED", "FINISHED", "FT", "FINAL", "completed", "complete"]);

  if (!games?.length) return splits;

  const gameIds = games.map((g: any) => g.id);

  // Latest LINE snapshot per game — fetch all LINE rows, pick latest in-memory
  const { data: lineRows } = await supabase
    .from("pers_sys_market_snapshots")
    .select("game_id, snapshot_ts, home_line, away_line, exec_best_home_line, exec_best_away_line")
    .eq("market_type", "LINE")
    .in("game_id", gameIds)
    .order("snapshot_ts", { ascending: false });

  const latestLineByGame = new Map<string, any>();
  for (const r of lineRows ?? []) {
    if (!latestLineByGame.has(r.game_id)) latestLineByGame.set(r.game_id, r);
  }

  function bump(teamId: string, side: "HOME" | "AWAY", atsMargin: number) {
    const k = `${teamId}|${side}`;
    let s = splits.get(k);
    if (!s) {
      s = { home_away: side, games: 0, covers: 0, fails: 0, pushes: 0, cover_rate: 0, avg_ats_margin: 0 };
      splits.set(k, s);
    }
    s.games += 1;
    if (atsMargin > 0) s.covers += 1;
    else if (atsMargin < 0) s.fails += 1;
    else s.pushes += 1;
    // running average
    s.avg_ats_margin = s.avg_ats_margin + (atsMargin - s.avg_ats_margin) / s.games;
  }

  for (const g of games) {
    const ln = latestLineByGame.get(g.id);
    if (!ln) continue;
    const home_line = ln.exec_best_home_line ?? ln.home_line;
    const away_line = ln.exec_best_away_line ?? ln.away_line;
    if (home_line === null || home_line === undefined) continue;
    if (away_line === null || away_line === undefined) continue;
    const hm = Number(g.margin_home ?? ((g.home_score ?? 0) - (g.away_score ?? 0)));
    if (!isFinite(hm)) continue;
    bump(g.home_team_id, "HOME", hm + Number(home_line));
    bump(g.away_team_id, "AWAY", -hm + Number(away_line));
  }

  // finalize cover_rate
  for (const s of splits.values()) {
    s.cover_rate = s.games > 0 ? Number((s.covers / s.games).toFixed(3)) : 0;
    s.avg_ats_margin = Number(s.avg_ats_margin.toFixed(2));
  }

  return splits;
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
    const daysAhead = Math.max(1, Math.min(30, Number(daysAheadRaw) || 10));

    // Determine games
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
          system_code: "SYS_11A",
          live: false,
          test_mode: historicalTest,
          candidates: [],
          suppressed_count: 0,
          note: "No games in window.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Preload teams
    const teamIds = Array.from(new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean)));
    const { data: teamRows } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name")
      .in("id", teamIds);
    const teamName = new Map<string, string>((teamRows ?? []).map((t: any) => [t.id, t.canonical_name]));

    // Compute ATS splits per season once
    const seasons = Array.from(new Set(games.map((g) => g.season)));
    const splitsBySeason = new Map<number, Map<string, Split>>();
    for (const s of seasons) {
      splitsBySeason.set(s, await computeAtsSplits(supabase, s));
    }

    const candidates: any[] = [];
    let suppressedCount = 0;

    for (const g of games) {
      const out: any = {
        game_id: g.id,
        home: teamName.get(g.home_team_id) ?? null,
        away: teamName.get(g.away_team_id) ?? null,
        venue: g.venue,
        season: g.season,
        round: g.round,
        start_time_aet: g.start_time_aet,
      };

      const h2h = await latestSnapshot(supabase, g.id, "H2H");
      const line = await latestSnapshot(supabase, g.id, "LINE");

      const home_price = h2h ? (h2h.exec_best_home_price ?? h2h.home_price) : null;
      const away_price = h2h ? (h2h.exec_best_away_price ?? h2h.away_price) : null;
      const home_line = line ? (line.exec_best_home_line ?? line.home_line) : null;
      const away_line = line ? (line.exec_best_away_line ?? line.away_line) : null;
      const home_line_price = line ? (line.exec_best_home_line_price ?? line.home_line_price) : null;
      const away_line_price = line ? (line.exec_best_away_line_price ?? line.away_line_price) : null;

      if (home_price == null || away_price == null) {
        suppressedCount++;
        candidates.push({ ...out, status: "SUPPRESSED", suppression_reason: "h2h_prices_unavailable" });
        continue;
      }
      if (home_line == null || away_line == null) {
        suppressedCount++;
        candidates.push({ ...out, status: "SUPPRESSED", suppression_reason: "line_unavailable" });
        continue;
      }

      const favSide: "HOME" | "AWAY" = Number(home_price) <= Number(away_price) ? "HOME" : "AWAY";
      const dogSide: "HOME" | "AWAY" = favSide === "HOME" ? "AWAY" : "HOME";
      const favPrice = Math.min(Number(home_price), Number(away_price));
      const favTeamId = favSide === "HOME" ? g.home_team_id : g.away_team_id;
      const dogTeamId = dogSide === "HOME" ? g.home_team_id : g.away_team_id;
      const dogLine = dogSide === "HOME" ? Number(home_line) : Number(away_line);
      const dogLinePrice = dogSide === "HOME" ? home_line_price : away_line_price;

      const baseOut = {
        ...out,
        favourite_team: teamName.get(favTeamId) ?? null,
        favourite_side: favSide,
        favourite_price: Number(favPrice),
        dog_team: teamName.get(dogTeamId) ?? null,
        dog_side: dogSide,
        dog_line: dogLine,
        dog_line_price: dogLinePrice != null ? Number(dogLinePrice) : null,
      };

      if (favPrice < FAV_MIN || favPrice > FAV_MAX) {
        suppressedCount++;
        candidates.push({ ...baseOut, status: "SUPPRESSED", suppression_reason: "favourite_price_outside_range" });
        continue;
      }

      const splits = splitsBySeason.get(g.season) ?? new Map<string, Split>();
      const dogSplit = splits.get(`${dogTeamId}|${dogSide}`) ?? null;
      const favSplit = splits.get(`${favTeamId}|${favSide}`) ?? null;

      const rulePath = dogSide === "HOME" ? "HOME_DOG_PREFERRED" : "AWAY_DOG_EXCEPTION";
      const dogMinSample = 4;
      const favMinSample = 4;
      const dogCoverThresh = dogSide === "HOME" ? 0.55 : 0.60;
      const dogMarginThresh = dogSide === "HOME" ? 3 : 6;

      const reasons: string[] = [];
      if (!dogSplit || dogSplit.games < dogMinSample) reasons.push("dog_split_sample_below_threshold");
      if (!favSplit || favSplit.games < favMinSample) reasons.push("favourite_split_sample_below_threshold");
      if (dogSplit && dogSplit.cover_rate < dogCoverThresh) reasons.push("dog_cover_rate_below_threshold");
      if (dogSplit && dogSplit.avg_ats_margin < dogMarginThresh) reasons.push("dog_avg_ats_margin_below_threshold");
      // favourite split must NOT be strongly positive
      if (favSplit && favSplit.cover_rate > 0.50 && favSplit.avg_ats_margin > 0) {
        reasons.push("favourite_split_strongly_positive");
      }

      const warnings: string[] = [];
      if (dogLinePrice == null) warnings.push("line_price_missing");

      const notes = [
        "Manual check only.",
        "No bet has been placed.",
        "SYS_11A uses current-season ATS split data for team selection.",
        "Historical data validates the structure only; historical team names are not used.",
      ];
      if (dogSide === "AWAY") notes.push("AWAY dog exception — stricter threshold applied.");

      if (reasons.length) {
        suppressedCount++;
        candidates.push({
          ...baseOut,
          status: "SUPPRESSED",
          suppression_reason: reasons.join(","),
          dog_split: dogSplit,
          favourite_split: favSplit,
          rule_path: rulePath,
          warnings,
          notes,
        });
        continue;
      }

      candidates.push({
        ...baseOut,
        status: "CANDIDATE",
        suppression_reason: null,
        recommendation: "DOG_LINE_MANUAL_CHECK",
        stake_guidance_u: 0.5,
        dog_split: dogSplit,
        favourite_split: favSplit,
        rule_path: rulePath,
        warnings,
        notes,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        system_code: "SYS_11A",
        live: false,
        test_mode: historicalTest,
        generated_at: new Date().toISOString(),
        games_inspected: games.length,
        candidates,
        suppressed_count: suppressedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sys11a-report error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
