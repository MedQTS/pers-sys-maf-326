// SYS_10A — Total Pairing & Alt-Line Cascade Guide (manual-check only)
//
// Read-only edge function. Returns JSON only.
// - Does NOT write to pers_sys_signals_v2.
// - Does NOT insert into pers_sys_systems_v2.
// - Does NOT create alerts, bets, or any side effects.
// - Does NOT modify SYS_1..SYS_9 behaviour.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProfileRow = {
  team_id?: string;
  venue?: string;
  home_away?: string;
  games: number;
  avg_actual_total: number | null;
  avg_main_total: number | null;
  avg_vs_main_total: number | null;
  over_160_pct: number | null;
  over_170_pct: number | null;
  over_180_pct: number | null;
};

type Band = 160 | 170 | 180;
const BAND_THRESHOLDS: Record<Band, number> = { 160: 0.75, 170: 0.70, 180: 0.65 };
const EDGE_BUFFER = 0.05;

function pctToRate(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  // Views may store either fractions (0..1) or percent (0..100). Normalise.
  return n > 1.5 ? n / 100 : n;
}

function bandRate(row: ProfileRow | null, band: Band): number | null {
  if (!row) return null;
  const key = band === 160 ? "over_160_pct" : band === 170 ? "over_170_pct" : "over_180_pct";
  return pctToRate((row as any)[key]);
}

function venueCautionFlags(venue: string | null | undefined, mainLean: string, altCandidates: Band[]): string[] {
  if (!venue) return [];
  const v = venue.toLowerCase();
  const flags: string[] = [];
  if (v.includes("adelaide oval") || v.includes("perth")) {
    if (mainLean === "MAIN_TOTAL_OVER") flags.push("VENUE_CAUTION_MARGINAL_OVER");
  }
  if (v.includes("docklands") || v.includes("marvel")) {
    flags.push("VENUE_FAVOURS_ALT_NOT_MAIN");
  }
  if (v.includes("gabba") || v.includes("s.c.g") || v.includes("scg") || v.includes("sydney cricket")) {
    if (altCandidates.length > 0 || mainLean === "MAIN_TOTAL_OVER") {
      flags.push("VENUE_NEUTRAL_TO_POSITIVE");
    }
  }
  return flags;
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

    // Build candidate game list
    let games: any[] = [];
    if (gameIdParam) {
      const { data, error } = await supabase
        .from("pers_sys_games")
        .select("id, season, round, start_time_aet, venue, home_team_id, away_team_id, status")
        .eq("id", gameIdParam)
        .maybeSingle();
      if (error) throw error;
      if (data) games = [data];
    } else {
      const nowIso = new Date().toISOString();
      const horizonIso = new Date(Date.now() + daysAhead * 86400000).toISOString();
      const { data, error } = await supabase
        .from("pers_sys_games")
        .select("id, season, round, start_time_aet, venue, home_team_id, away_team_id, status")
        .gte("start_time_aet", nowIso)
        .lte("start_time_aet", horizonIso)
        .order("start_time_aet", { ascending: true });
      if (error) throw error;
      games = data ?? [];
    }

    // test_mode = single-game lookup where the game is already completed
    const anyTestMode = !!(gameIdParam && games[0] && new Date(games[0].start_time_aet).getTime() < Date.now());

    if (!games.length) {
      return new Response(
        JSON.stringify({ ok: true, system_code: "SYS_10A", live: false, test_mode: false, candidates: [], note: "No upcoming games in window." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Preload teams (for display)
    const teamIds = Array.from(new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean)));
    const { data: teamRows } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name")
      .in("id", teamIds);
    const teamName = new Map<string, string>((teamRows ?? []).map((t: any) => [t.id, t.canonical_name]));

    const candidates: any[] = [];

    for (const g of games) {
      const out: any = {
        game_id: g.id,
        season: g.season,
        round: g.round,
        start_time_aet: g.start_time_aet,
        venue: g.venue,
        home: teamName.get(g.home_team_id) ?? null,
        away: teamName.get(g.away_team_id) ?? null,
      };

      // Latest TOTALS market snapshot for this game
      const { data: snapRows } = await supabase
        .from("pers_sys_market_snapshots")
        .select(
          "snapshot_type, snapshot_ts, total_line, over_price, under_price, exec_best_total_line, exec_best_over_price, exec_best_under_price, exec_best_over_book, exec_best_under_book",
        )
        .eq("game_id", g.id)
        .eq("market_type", "TOTALS")
        .order("snapshot_ts", { ascending: false })
        .limit(1);
      const snap = snapRows?.[0] ?? null;

      const main_total = snap ? (snap.exec_best_total_line ?? snap.total_line) : null;
      const over_price = snap ? (snap.exec_best_over_price ?? snap.over_price) : null;
      const under_price = snap ? (snap.exec_best_under_price ?? snap.under_price) : null;

      // Profiles (current season)
      const profileSel =
        "team_id, home_away, games, avg_actual_total, avg_main_total, avg_vs_main_total, over_160_pct, over_170_pct, over_180_pct";

      const { data: homeRows } = await supabase
        .from("pers_sys_team_total_band_profile_v")
        .select(profileSel)
        .eq("season", g.season)
        .eq("team_id", g.home_team_id)
        .eq("home_away", "HOME")
        .limit(1);
      const homeProfile: ProfileRow | null = (homeRows?.[0] as any) ?? null;

      const { data: awayRows } = await supabase
        .from("pers_sys_team_total_band_profile_v")
        .select(profileSel)
        .eq("season", g.season)
        .eq("team_id", g.away_team_id)
        .eq("home_away", "AWAY")
        .limit(1);
      const awayProfile: ProfileRow | null = (awayRows?.[0] as any) ?? null;

      const { data: venueRows } = await supabase
        .from("pers_sys_venue_total_band_profile_v")
        .select("venue, games, avg_actual_total, avg_main_total, over_160_pct, over_170_pct, over_180_pct")
        .eq("season", g.season)
        .eq("venue", g.venue)
        .limit(1);
      const venueProfile: ProfileRow | null = (venueRows?.[0] as any) ?? null;

      out.samples = {
        home_home_games: Number(homeProfile?.games ?? 0),
        away_away_games: Number(awayProfile?.games ?? 0),
        venue_games: Number(venueProfile?.games ?? 0),
      };
      out.main_total = main_total;
      out.over_price = over_price;
      out.under_price = under_price;

      // Eligibility gates
      const gateFails: string[] = [];
      if (!main_total) gateFails.push("missing_main_total");
      if (!homeProfile) gateFails.push("home_profile_missing");
      if (!awayProfile) gateFails.push("away_profile_missing");
      if (!venueProfile) gateFails.push("venue_profile_missing");
      if (homeProfile && out.samples.home_home_games < 4) gateFails.push("home_home_sample_lt_4");
      if (awayProfile && out.samples.away_away_games < 4) gateFails.push("away_away_sample_lt_4");
      if (venueProfile && out.samples.venue_games < 3) gateFails.push("venue_sample_lt_3");

      if (gateFails.length) {
        candidates.push({ ...out, status: "SUPPRESSED", suppression_reason: gateFails.join(","), reasons: gateFails });
        continue;
      }

      // Main-total model
      const home_avg = Number(homeProfile!.avg_actual_total ?? 0);
      const away_avg = Number(awayProfile!.avg_actual_total ?? 0);
      const venue_avg = Number(venueProfile!.avg_actual_total ?? 0);
      const estimated_total = home_avg * 0.35 + away_avg * 0.35 + venue_avg * 0.30;
      const main_edge = estimated_total - Number(main_total);
      const main_lean = main_edge >= 5 ? "MAIN_TOTAL_OVER" : main_edge <= -5 ? "MAIN_TOTAL_UNDER" : "PASS";

      // Alt bands
      const alt_bands: any[] = [];
      const passingBands: Band[] = [];
      for (const band of [160, 170, 180] as Band[]) {
        const hr = bandRate(homeProfile, band);
        const ar = bandRate(awayProfile, band);
        const vr = bandRate(venueProfile, band);
        let clearance: number | null = null;
        if (hr !== null && ar !== null && vr !== null) {
          clearance = hr * 0.40 + ar * 0.40 + vr * 0.20;
        }
        const threshold = BAND_THRESHOLDS[band];
        const candidate = clearance !== null && clearance >= threshold;
        const min_acceptable_odds =
          candidate && clearance! - EDGE_BUFFER > 0 ? Number((1 / (clearance! - EDGE_BUFFER)).toFixed(2)) : null;
        if (candidate) passingBands.push(band);
        alt_bands.push({
          band,
          clearance: clearance !== null ? Number(clearance.toFixed(3)) : null,
          threshold,
          candidate,
          min_acceptable_odds,
        });
      }

      // Cascade guide
      let cascade: any = null;
      if (passingBands.length >= 2) {
        const sorted = [...passingBands].sort((a, b) => a - b);
        const anchor = sorted[0];
        const upside = sorted[sorted.length - 1];
        const anchorRow = alt_bands.find((b) => b.band === anchor);
        const upsideRow = alt_bands.find((b) => b.band === upside);
        cascade = {
          total_exposure_cap_u: 0.5,
          anchor: {
            band: anchor,
            stake_u: 0.30,
            min_acceptable_odds: anchorRow?.min_acceptable_odds ?? null,
            note: `Anchor: Over ${anchor}/${anchor}.5 if odds >= ${anchorRow?.min_acceptable_odds ?? "?"} — 0.30u. Manual check required.`,
          },
          upside: {
            band: upside,
            stake_u: 0.20,
            min_acceptable_odds: upsideRow?.min_acceptable_odds ?? null,
            note: `Upside: Over ${upside}/${upside}.5 if odds >= ${upsideRow?.min_acceptable_odds ?? "?"} — 0.20u. Manual check required.`,
          },
        };
      }

      const venue_caution = venueCautionFlags(g.venue, main_lean, passingBands);

      candidates.push({
        ...out,
        status: "CANDIDATE",
        estimated_total: Number(estimated_total.toFixed(2)),
        main_edge: Number(main_edge.toFixed(2)),
        main_lean,
        main_stake_guidance_u: main_lean === "PASS" ? 0 : 0.5,
        alt_bands,
        cascade,
        venue_caution,
        notes: [
          "Manual check only.",
          "No alternate-line ingestion — odds guidance only.",
          "Take alternate over only if bookmaker line and price are at or above min_acceptable_odds.",
        ],
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        system_code: "SYS_10A",
        live: false,
        test_mode: anyTestMode,
        generated_at: new Date().toISOString(),
        games_inspected: games.length,
        candidates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sys10a-report error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
