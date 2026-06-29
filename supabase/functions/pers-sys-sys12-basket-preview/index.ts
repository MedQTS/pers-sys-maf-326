// SYS_12 Phase 2A — Basket Preview (read-only)
//
// Read-only edge function. Returns JSON only.
// - Does NOT write to pers_sys_signals_v2.
// - Does NOT write to pers_sys_bets.
// - Does NOT write to pers_sys_signal_audit_v2.
// - Does NOT call staking or bet-acceptance RPCs.
// - Does NOT create alerts, baskets, or any side effects.
// - Phase 2A: preview-only basket/treble options for operator manual review.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "T1_GOLDEN" | "T2_NERVOUS" | string;

interface CandidateLeg {
  game_id: string;
  season: number | null;
  round: number | null;
  home_team: string | null;
  away_team: string | null;
  selection_team: string | null;
  fade_target_team: string | null;
  selection_side: string | null;
  fade_target_side: string | null;
  selection_tier: Tier | null;
  selection_tier_label: string | null;
  warning_codes: string[];
  market: string | null;
  leg_type: string | null;
  selected_price: number | null;
  price_status: "available" | "missing";
  audit_id: string;
  audit_created_at: string;
}

interface ExcludedGame {
  game_id: string;
  home_team: string | null;
  away_team: string | null;
  fail_code: string | null;
  audit_status: string;
  round: number | null;
  season: number | null;
}

function comb<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const n = arr.length;
  if (k > n || k <= 0) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

function buildBasketOption(legs: CandidateLeg[], optionType: string) {
  const containsTier2 = legs.some((l) => l.selection_tier === "T2_NERVOUS");
  const anyMissingPrice = legs.some((l) => l.price_status === "missing" || l.selected_price == null);
  const warnings: string[] = [];
  if (containsTier2) warnings.push("contains_tier2_reduced_exposure");
  if (anyMissingPrice) warnings.push("combined_odds_unavailable_price_missing");

  const combinedOdds = anyMissingPrice
    ? null
    : Number(
        legs
          .reduce((acc, l) => acc * (l.selected_price as number), 1)
          .toFixed(4),
      );

  return {
    option_type: optionType,
    leg_count: legs.length,
    legs: legs.map((l) => ({
      game_id: l.game_id,
      home_team: l.home_team,
      away_team: l.away_team,
      selection_team: l.selection_team,
      selection_tier: l.selection_tier,
      selection_tier_label: l.selection_tier_label,
      selected_price: l.selected_price,
      price_status: l.price_status,
      warning_codes: l.warning_codes,
    })),
    contains_tier2: containsTier2,
    warnings,
    combined_decimal_odds: combinedOdds,
    preview_only: true,
    manual_approval_required: true,
    display_caution_text: containsTier2
      ? "CAUTION — contains Tier 2 reduced-exposure leg. Manual approval required."
      : null,
    status_text: "Preview only — no bet, stake, alert, or signal created.",
  };
}

function rankLegs(legs: CandidateLeg[]): CandidateLeg[] {
  // T1 first, then T2; within tier, prefer legs with available price, then most recent audit
  return [...legs].sort((a, b) => {
    const tierRank = (t: string | null) => (t === "T1_GOLDEN" ? 0 : t === "T2_NERVOUS" ? 1 : 2);
    const tr = tierRank(a.selection_tier) - tierRank(b.selection_tier);
    if (tr !== 0) return tr;
    const pr = (a.price_status === "available" ? 0 : 1) - (b.price_status === "available" ? 0 : 1);
    if (pr !== 0) return pr;
    return b.audit_created_at.localeCompare(a.audit_created_at);
  });
}

function generateBasketGroup(
  pool: CandidateLeg[],
  k: number,
  optionType: string,
  maxOptions = 20,
) {
  if (pool.length < k) return [];
  const t1 = pool.filter((l) => l.selection_tier === "T1_GOLDEN");
  const t2 = pool.filter((l) => l.selection_tier === "T2_NERVOUS");

  const options: ReturnType<typeof buildBasketOption>[] = [];

  // T1-only first
  if (t1.length >= k) {
    for (const c of comb(t1, k)) options.push(buildBasketOption(c, optionType));
  }
  // Mixed T1/T2 next (combinations from full pool that contain at least one T2)
  if (pool.length >= k && t2.length > 0) {
    for (const c of comb(pool, k)) {
      if (c.some((l) => l.selection_tier === "T2_NERVOUS")) {
        options.push(buildBasketOption(c, optionType));
      }
    }
  }

  return options.slice(0, maxOptions);
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
    const seasonIn = body.season ?? url.searchParams.get("season");
    const roundIn = body.round ?? url.searchParams.get("round");
    const gameIdIn: string | null = body.game_id ?? url.searchParams.get("game_id");
    const limitIn = Number(body.limit ?? url.searchParams.get("limit") ?? 0);
    const includeFail = Boolean(
      body.include_fail_diagnostics ??
        (url.searchParams.get("include_fail_diagnostics") === "true"),
    );

    const warnings: string[] = [];

    // Resolve scope: upcoming round if not given
    let season: number | null = seasonIn ? Number(seasonIn) : null;
    let round: number | null = roundIn ? Number(roundIn) : null;

    if (gameIdIn) {
      const { data: g } = await supabase
        .from("pers_sys_games")
        .select("season, round")
        .eq("id", gameIdIn)
        .maybeSingle();
      if (g) {
        season = g.season ?? season;
        round = g.round ?? round;
      }
    }

    if (season == null || round == null) {
      const nowIso = new Date().toISOString();
      const { data: nextGame } = await supabase
        .from("pers_sys_games")
        .select("season, round, start_time_aet")
        .gte("start_time_aet", nowIso)
        .order("start_time_aet", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextGame) {
        season = season ?? nextGame.season;
        round = round ?? nextGame.round;
      }
    }

    if (season == null || round == null) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "scope_not_resolved",
          mode: "SYS_12_PHASE_2A_PREVIEW_ONLY",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull all SYS_12 audit rows for the scope
    let q = supabase
      .from("pers_sys_signal_audit_v2")
      .select(
        "id, system_code, game_id, season, round, audit_status, fail_code, reason_json, created_at, evaluated_at",
      )
      .eq("system_code", "SYS_12")
      .eq("season", season)
      .eq("round", round)
      .order("created_at", { ascending: false });
    if (gameIdIn) q = q.eq("game_id", gameIdIn);
    const { data: auditRows, error: auditErr } = await q;
    if (auditErr) {
      return new Response(
        JSON.stringify({ ok: false, error: "audit_query_failed", detail: auditErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Latest per game_id
    const latestByGame = new Map<string, any>();
    for (const row of auditRows ?? []) {
      if (!latestByGame.has(row.game_id)) latestByGame.set(row.game_id, row);
    }
    const latestRows = [...latestByGame.values()];

    const pendingRows = latestRows.filter((r) => r.audit_status === "PENDING");
    const failRows = latestRows.filter((r) => r.audit_status !== "PENDING");

    // Build candidate legs with price lookup
    const candidateLegs: CandidateLeg[] = [];
    for (const r of pendingRows) {
      const reason = (r.reason_json ?? {}) as any;
      const tier: string | null = reason.selection_tier ?? null;
      // Tier 3 / unknown tier are not basket-eligible
      if (tier !== "T1_GOLDEN" && tier !== "T2_NERVOUS") continue;

      // Look up latest H2H snapshot to get selection price
      const { data: snaps } = await supabase
        .from("pers_sys_market_snapshots")
        .select("home_price, away_price, snapshot_ts, snapshot_type")
        .eq("game_id", r.game_id)
        .eq("market_type", "H2H")
        .order("snapshot_ts", { ascending: false })
        .limit(1);
      const snap = snaps?.[0];
      let selectedPrice: number | null = null;
      const side: string | null = reason.selection_side ?? null;
      if (snap) {
        if (side === "HOME" && snap.home_price != null) selectedPrice = Number(snap.home_price);
        else if (side === "AWAY" && snap.away_price != null) selectedPrice = Number(snap.away_price);
      }

      candidateLegs.push({
        game_id: r.game_id,
        season: r.season,
        round: r.round,
        home_team: reason.home_team ?? null,
        away_team: reason.away_team ?? null,
        selection_team: reason.selection_team ?? null,
        fade_target_team: reason.fade_target_team ?? null,
        selection_side: side,
        fade_target_side: reason.fade_target_side ?? null,
        selection_tier: tier,
        selection_tier_label: reason.selection_tier_label ?? null,
        warning_codes: Array.isArray(reason.warning_codes) ? reason.warning_codes : [],
        market: reason.market ?? null,
        leg_type: reason.leg_type ?? null,
        selected_price: selectedPrice,
        price_status: selectedPrice == null ? "missing" : "available",
        audit_id: r.id,
        audit_created_at: r.created_at,
      });
    }

    if (candidateLegs.some((l) => l.price_status === "missing")) {
      warnings.push("market_price_missing");
    }

    // Excluded / diagnostic games (only included when explicitly requested)
    const excludedGames: ExcludedGame[] = includeFail
      ? failRows.map((r) => {
          const reason = (r.reason_json ?? {}) as any;
          return {
            game_id: r.game_id,
            home_team: reason.home_team ?? null,
            away_team: reason.away_team ?? null,
            fail_code: r.fail_code ?? null,
            audit_status: r.audit_status,
            round: r.round,
            season: r.season,
          };
        })
      : [];

    // Ranked pool for basket construction
    const rankedPool = rankLegs(candidateLegs);
    const effectivePool = limitIn > 0 ? rankedPool.slice(0, limitIn) : rankedPool;

    const twoLeg = generateBasketGroup(effectivePool, 2, "two_leg");
    const threeLeg = generateBasketGroup(effectivePool, 3, "three_leg");

    // trebles_from_four — best 4 candidates, all C(4,3)=4 trebles
    let treblesFromFour: ReturnType<typeof buildBasketOption>[] = [];
    if (effectivePool.length >= 4) {
      const bestFour = effectivePool.slice(0, 4);
      treblesFromFour = comb(bestFour, 3).map((c) => buildBasketOption(c, "treble_from_four"));
    }

    const responseBody = {
      ok: true,
      mode: "SYS_12_PHASE_2A_PREVIEW_ONLY",
      system_code: "SYS_12",
      scope: {
        season,
        round,
        game_id: gameIdIn ?? null,
      },
      candidate_legs: candidateLegs,
      excluded_games: excludedGames,
      basket_options: {
        two_leg: twoLeg,
        three_leg: threeLeg,
        trebles_from_four: treblesFromFour,
      },
      counts: {
        candidate_legs: candidateLegs.length,
        excluded_games: excludedGames.length,
        two_leg_options: twoLeg.length,
        three_leg_options: threeLeg.length,
        trebles_from_four_options: treblesFromFour.length,
      },
      stake_model: "none_phase2a_preview_only",
      round_budget_context: 200,
      stake_required: false,
      manual_stake_only: true,
      warnings,
      side_effects: {
        db_writes: 0,
        signals_created: 0,
        bets_created: 0,
        alerts_created: 0,
      },
      status_text: "SYS_12 Phase 2A preview only. No basket/staking/bet created.",
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unhandled_exception",
        detail: e instanceof Error ? e.message : String(e),
        mode: "SYS_12_PHASE_2A_PREVIEW_ONLY",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
