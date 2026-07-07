// SYS_10A — Total Pairing & Alt-Line Cascade Guide (manual-check only)
//
// Read-only edge function. Returns JSON only.
// - Does NOT write to pers_sys_signals_v2.
// - Does NOT insert into pers_sys_systems_v2.
// - Does NOT create alerts, bets, or any side effects.
// - Does NOT modify SYS_1..SYS_12A behaviour.
//
// Output tightening:
// - "actionable candidate" = MAIN over/under with stake_guidance > 0,
//   OR at least one market-near eligible alt-over band.
// - Alt-over cascade suppressed entirely when main lean is MAIN_TOTAL_UNDER.
// - Static 160/170/180 bands are only actionable if within ±12.5 of the
//   current main total, and min_acceptable_odds ∈ [1.25, 2.20].

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

// Market-near filter constants
const ALT_GAP_LIMIT = 12.5;
const MIN_ODDS_FLOOR = 1.25;
const MIN_ODDS_CEIL = 2.20;

function pctToRate(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
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

// ---------- W1 display-only weather block ----------
// Read-only. Never writes. Never calls weather-fetch/weather-assess.
// Lookup order: SYS_10A T30 -> fallback SYS_8 T30 for the same game_id.
type WeatherBlockDisplay = {
  display_only: true;
  assessment_stage: "T30";
  requested_system_code: "SYS_10A";
  source_system_code: "SYS_10A" | "SYS_8" | null;
  fallback_used: boolean;
  outcome: string | null;
  reason_code: string | null;
  policy_code: string | null;
  no_data: boolean;
};

async function fetchWeatherBlockDisplay(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
): Promise<WeatherBlockDisplay> {
  const base: WeatherBlockDisplay = {
    display_only: true,
    assessment_stage: "T30",
    requested_system_code: "SYS_10A",
    source_system_code: null,
    fallback_used: false,
    outcome: null,
    reason_code: null,
    policy_code: null,
    no_data: true,
  };
  try {
    const { data: primary } = await supabase
      .from("pers_sys_weather_assessments")
      .select("outcome, reason_code, policy_code, assessment_stage, system_code")
      .eq("game_id", gameId)
      .eq("system_code", "SYS_10A")
      .eq("assessment_stage", "T30")
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (primary) {
      return {
        ...base,
        source_system_code: "SYS_10A",
        fallback_used: false,
        outcome: (primary as any).outcome ?? null,
        reason_code: (primary as any).reason_code ?? null,
        policy_code: (primary as any).policy_code ?? null,
        no_data: false,
      };
    }
    const { data: fb } = await supabase
      .from("pers_sys_weather_assessments")
      .select("outcome, reason_code, policy_code, assessment_stage, system_code")
      .eq("game_id", gameId)
      .eq("system_code", "SYS_8")
      .eq("assessment_stage", "T30")
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fb) {
      return {
        ...base,
        source_system_code: "SYS_8",
        fallback_used: true,
        outcome: (fb as any).outcome ?? null,
        reason_code: (fb as any).reason_code ?? null,
        policy_code: (fb as any).policy_code ?? null,
        no_data: false,
      };
    }
    return base;
  } catch (_e) {
    return base;
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
    const daysAhead = Math.max(1, Math.min(30, Number(daysAheadRaw) || 10));

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

    const anyTestMode = !!(gameIdParam && games[0] && new Date(games[0].start_time_aet).getTime() < Date.now());

    if (!games.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          system_code: "SYS_10A",
          live: false,
          test_mode: false,
          evaluated_games: 0,
          actionable_candidates: 0,
          suppressed_count: 0,
          suppression_breakdown: {},
          candidates: [],
          note: "No upcoming games in window.",
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
    const suppression_breakdown: Record<string, number> = {};
    const bumpReason = (r: string) => {
      suppression_breakdown[r] = (suppression_breakdown[r] ?? 0) + 1;
    };

    for (const g of games) {
      const weatherBlock = await fetchWeatherBlockDisplay(supabase, g.id);
      const out: any = {
        game_id: g.id,
        season: g.season,
        round: g.round,
        start_time_aet: g.start_time_aet,
        venue: g.venue,
        home: teamName.get(g.home_team_id) ?? null,
        away: teamName.get(g.away_team_id) ?? null,
        weather: weatherBlock,
      };

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

      const gateFails: string[] = [];
      if (!main_total) gateFails.push("missing_main_total");
      if (!homeProfile) gateFails.push("home_profile_missing");
      if (!awayProfile) gateFails.push("away_profile_missing");
      if (!venueProfile) gateFails.push("venue_profile_missing");
      if (homeProfile && out.samples.home_home_games < 4) gateFails.push("home_home_sample_lt_4");
      if (awayProfile && out.samples.away_away_games < 4) gateFails.push("away_away_sample_lt_4");
      if (venueProfile && out.samples.venue_games < 3) gateFails.push("venue_sample_lt_3");

      if (gateFails.length) {
        for (const r of gateFails) bumpReason(r);
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
      const main_stake_guidance_u = main_lean === "PASS" ? 0 : 0.5;

      // -------- Rule D: Recent-form overlay (PASS-lean alt-over suppression) --------
      // Pull each team's last up-to-5 completed (FT) game totals strictly before this
      // game's start time, in season. Read-only.
      async function recent5Totals(teamId: string): Promise<number[]> {
        const { data, error } = await supabase
          .from("pers_sys_games")
          .select("start_time_aet, home_score, away_score, status, home_team_id, away_team_id")
          .eq("season", g.season)
          .eq("status", "FT")
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .lt("start_time_aet", g.start_time_aet)
          .order("start_time_aet", { ascending: false })
          .limit(5);
        if (error || !data) return [];
        return data
          .filter((r: any) => r.home_score !== null && r.away_score !== null)
          .map((r: any) => Number(r.home_score) + Number(r.away_score));
      }

      const [homeRecentTotals, awayRecentTotals] = await Promise.all([
        recent5Totals(g.home_team_id),
        recent5Totals(g.away_team_id),
      ]);
      const avg = (xs: number[]): number | null =>
        xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;
      const home_recent_5_avg_total = avg(homeRecentTotals);
      const away_recent_5_avg_total = avg(awayRecentTotals);
      const sufficient_recent_sample = homeRecentTotals.length >= 4 && awayRecentTotals.length >= 4;
      const blended_recent_5_avg =
        home_recent_5_avg_total !== null && away_recent_5_avg_total !== null
          ? Number(((home_recent_5_avg_total + away_recent_5_avg_total) / 2).toFixed(2))
          : null;
      const recent_gap =
        blended_recent_5_avg !== null && main_total !== null
          ? Number((blended_recent_5_avg - Number(main_total)).toFixed(2))
          : null;

      const ruleDTriggers =
        sufficient_recent_sample &&
        blended_recent_5_avg !== null &&
        main_total !== null &&
        blended_recent_5_avg <= Number(main_total) - 8;

      const recent_form_overlay_applied = ruleDTriggers && (main_lean === "PASS" || main_lean === "MAIN_TOTAL_OVER");
      const suppress_alt_over_recent_form = ruleDTriggers && main_lean === "PASS";
      const recent_form_warning_main_over = ruleDTriggers && main_lean === "MAIN_TOTAL_OVER";
      const recent_form_overlay_action = suppress_alt_over_recent_form
        ? "SUPPRESS_ALT_OVER"
        : recent_form_warning_main_over
        ? "WARN_MAIN_OVER"
        : "NONE";

      const overlay_warnings: string[] = [];
      if (!sufficient_recent_sample) overlay_warnings.push("insufficient_recent_sample_for_overlay");
      if (recent_form_warning_main_over) overlay_warnings.push("recent_form_conflicts_with_main_over");
      // -----------------------------------------------------------------------------

      // Alt bands — compute clearance for all, then apply market-near + odds filters.
      const alt_bands: any[] = [];
      const passingBandsForVenueCaution: Band[] = [];
      const eligibleAltBands: any[] = [];
      let alt_over_suppressed_due_main_under_lean = false;

      for (const band of [160, 170, 180] as Band[]) {
        const hr = bandRate(homeProfile, band);
        const ar = bandRate(awayProfile, band);
        const vr = bandRate(venueProfile, band);
        let clearance: number | null = null;
        if (hr !== null && ar !== null && vr !== null) {
          clearance = hr * 0.40 + ar * 0.40 + vr * 0.20;
        }
        const threshold = BAND_THRESHOLDS[band];
        const probability_pass = clearance !== null && clearance >= threshold;
        const min_acceptable_odds =
          probability_pass && clearance! - EDGE_BUFFER > 0
            ? Number((1 / (clearance! - EDGE_BUFFER)).toFixed(2))
            : null;

        const alt_gap = main_total !== null ? Number((Number(main_total) - band).toFixed(2)) : null;

        const reasons: string[] = [];
        let eligible = probability_pass;

        if (probability_pass) passingBandsForVenueCaution.push(band);

        if (eligible && main_lean === "MAIN_TOTAL_UNDER") {
          eligible = false;
          reasons.push("alt_over_suppressed_due_main_under_lean");
          alt_over_suppressed_due_main_under_lean = true;
        }
        if (eligible && suppress_alt_over_recent_form) {
          eligible = false;
          reasons.push("recent_form_suppresses_pass_alt_over");
        }
        if (eligible && alt_gap !== null) {
          if (band < Number(main_total) - ALT_GAP_LIMIT) {
            eligible = false;
            reasons.push("alt_line_too_far_below_main_total");
          } else if (band > Number(main_total) + ALT_GAP_LIMIT) {
            eligible = false;
            reasons.push("alt_line_too_far_above_main_total");
          }
        }
        if (eligible && min_acceptable_odds !== null) {
          if (min_acceptable_odds < MIN_ODDS_FLOOR) {
            eligible = false;
            reasons.push("min_odds_too_short_to_be_useful");
          } else if (min_acceptable_odds > MIN_ODDS_CEIL) {
            eligible = false;
            reasons.push("min_odds_too_long_for_model_confidence");
          }
        }

        const bandRow = {
          band,
          probability_source: "nearest_band_proxy",
          nearest_band_used: band,
          target_line: band,
          clearance: clearance !== null ? Number(clearance.toFixed(3)) : null,
          threshold,
          probability_pass,
          alt_gap,
          min_acceptable_odds,
          candidate: eligible, // back-compat: now means "actionable after filters"
          eligible,
          suppression_reasons: reasons,
        };
        alt_bands.push(bandRow);
        if (eligible) eligibleAltBands.push(bandRow);

        for (const r of reasons) {
          if (r === "recent_form_suppresses_pass_alt_over") continue; // bumped once per game below
          bumpReason(r);
        }
      }

      if (suppress_alt_over_recent_form) bumpReason("recent_form_suppresses_pass_alt_over");

      // Cascade — only over eligible market-near bands; cap at two
      let cascade: any = null;
      if (eligibleAltBands.length >= 1) {
        const sorted = [...eligibleAltBands].sort((a, b) => a.band - b.band);
        const anchor = sorted[0];
        const upside = sorted.length >= 2 ? sorted[sorted.length - 1] : null;
        cascade = {
          total_exposure_cap_u: 0.5,
          anchor: {
            band: anchor.band,
            target_line: anchor.target_line,
            stake_u: 0.30,
            min_acceptable_odds: anchor.min_acceptable_odds,
            note: `Anchor: Over ${anchor.target_line} if odds >= ${anchor.min_acceptable_odds} — 0.30u. Manual check required.`,
          },
          upside: upside
            ? {
                band: upside.band,
                target_line: upside.target_line,
                stake_u: 0.20,
                min_acceptable_odds: upside.min_acceptable_odds,
                note: `Upside: Over ${upside.target_line} if odds >= ${upside.min_acceptable_odds} — 0.20u. Manual check required.`,
              }
            : null,
        };
      }

      const venue_caution = venueCautionFlags(g.venue, main_lean, passingBandsForVenueCaution);

      // Actionability gate
      const mainActionable = main_stake_guidance_u > 0;
      const altActionable = eligibleAltBands.length > 0;
      const actionable = mainActionable || altActionable;

      const base = {
        ...out,
        estimated_total: Number(estimated_total.toFixed(2)),
        main_edge: Number(main_edge.toFixed(2)),
        main_lean,
        main_stake_guidance_u,
        alt_bands,
        cascade,
        venue_caution,
        alt_over_suppressed_due_main_under_lean,
        home_recent_5_avg_total,
        away_recent_5_avg_total,
        blended_recent_5_avg,
        recent_gap,
        recent_form_overlay_applied,
        recent_form_overlay_action,
        recent_form_sample: {
          home_games: homeRecentTotals.length,
          away_games: awayRecentTotals.length,
          sufficient: sufficient_recent_sample,
        },
        overlay_warnings,
      };

      if (!actionable) {
        const reason =
          suppress_alt_over_recent_form && main_lean === "PASS"
            ? "recent_form_suppresses_pass_alt_over"
            : main_lean === "PASS"
            ? "pass_no_actionable_alt_candidate"
            : main_lean === "MAIN_TOTAL_UNDER"
            ? "main_under_no_alt_candidate"
            : "no_actionable_recommendation";
        // Avoid double-counting recent_form_suppresses_pass_alt_over (already bumped once above)
        if (reason !== "recent_form_suppresses_pass_alt_over") bumpReason(reason);
        candidates.push({
          ...base,
          status: "SUPPRESSED",
          suppression_reason: reason,
        });
        continue;
      }

      candidates.push({
        ...base,
        status: "CANDIDATE",
        notes: [
          "Manual check only.",
          "No alternate-line ingestion — odds and target lines are guidance only.",
          "Only take an alternate over if the bookmaker line and price are at or above min_acceptable_odds.",
        ],
      });
    }

    const actionable_candidates = candidates.filter((c) => c.status === "CANDIDATE").length;
    const suppressed_count = candidates.filter((c) => c.status === "SUPPRESSED").length;

    return new Response(
      JSON.stringify({
        ok: true,
        system_code: "SYS_10A",
        live: false,
        test_mode: anyTestMode,
        generated_at: new Date().toISOString(),
        games_inspected: games.length,
        evaluated_games: games.length,
        actionable_candidates,
        suppressed_count,
        suppression_breakdown,
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
