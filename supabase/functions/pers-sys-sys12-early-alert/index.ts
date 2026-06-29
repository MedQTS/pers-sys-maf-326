// SYS_12 Phase 3B + 3C — Early Basket Preview Alert.
//
// Default mode: dry-run renderer (Phase 3B). Calls pers-sys-sys12-basket-preview
// (Phase 2A) over HTTP, evaluates preconditions, applies Phase 2C-style relative
// stake preview when a budget is supplied, returns HTML+text email previews.
//
// Manual-send mode (Phase 3C): opt-in only.
//   - dry_run === false AND send_confirm === "SYS_12_MANUAL_SEND".
//   - Sends ONE Postmark email via the SYS_10A/T30 transport pattern.
//   - Inserts ONE row into pers_sys_email_alert_runs for dedupe.
//   - Rolls back the run row on Postmark failure.
//
// SYS_12 does NOT use weather. SYS_12 does NOT include SYS_10A legs.
// No scheduler/cron/watcher/T30 hook. No bet/signal/stake/bet-log writes.
// No accept/place/confirm flow. The ONLY DB write path is the dedupe row in
// pers_sys_email_alert_runs (Phase 3C confirmed send only).
//
// HARD GUARANTEES enforced by absence of code paths:
// - No writes to pers_sys_email_alert_items
// - No writes to pers_sys_bets
// - No writes to pers_sys_signals_v2
// - No writes to pers_sys_signal_audit_v2
// - No calls to preview_leg_stake or accept_leg_create_bet
// - No weather-* function calls or SYS_10A inclusion

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHASE_2A_FUNCTION = "pers-sys-sys12-basket-preview";
const DEDUPE_SNAPSHOT_TYPE = "SYS12_EARLY";
const MANUAL_SEND_CONFIRMATION = "SYS_12_MANUAL_SEND";
const POSTMARK_TAG = "sys12_early_basket";

const BANNER =
  "SYS_12 alert is informational only. No bet has been created or logged. Track manually in spreadsheet if placed.";
const T2_CAUTION =
  "CAUTION — contains Tier 2 reduced-exposure leg. Manual approval required.";
const NO_BUDGET_COPY = "No preview budget supplied; stake suggestions omitted.";
const STATUS_TEXT_DRY =
  "SYS_12 Phase 3B dry-run alert preview only. No email, bet, signal, log, or alert record created.";
const STATUS_TEXT_SENT =
  "SYS_12 Phase 3C manual-send alert only. No bet, signal, stake record, or app bet log created.";

const FOOTER_DRY_LINE = "No alert has been sent in Phase 3B dry-run mode.";
const FOOTER_SENT_LINE = "This SYS_12 alert was manually sent by explicit request.";
const FOOTER_NO_AUTO = "No automatic bet placement has occurred.";

type Tier = "T1_GOLDEN" | "T2_NERVOUS" | string;

interface Leg {
  game_id: string;
  home_team: string | null;
  away_team: string | null;
  selection_team: string | null;
  fade_target_team?: string | null;
  selection_side?: string | null;
  selection_tier: Tier | null;
  selection_tier_label?: string | null;
  warning_codes?: string[];
  selected_price: number | null;
  price_status: "available" | "missing" | string;
}

interface BasketOption {
  option_type: string;
  leg_count: number;
  legs: Leg[];
  contains_tier2: boolean;
  warnings: string[];
  combined_decimal_odds: number | null;
  preview_only: boolean;
  manual_approval_required: boolean;
  display_caution_text: string | null;
  status_text: string;
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

interface PreviewResponse {
  ok: boolean;
  scope?: { season: number | null; round: number | null; game_id: string | null };
  candidate_legs?: Leg[];
  excluded_games?: ExcludedGame[];
  basket_options?: {
    two_leg: BasketOption[];
    three_leg: BasketOption[];
    trebles_from_four: BasketOption[];
  };
  counts?: Record<string, number>;
  warnings?: string[];
  error?: string;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tierLabel(t: Tier | null | undefined): string {
  if (t === "T1_GOLDEN") return "Tier 1 / Golden";
  if (t === "T2_NERVOUS") return "Tier 2 / Nervous — reduced exposure";
  return t ? String(t) : "—";
}

function failLabel(c: string | null | undefined): string {
  switch (c) {
    case "tier3_team_involved": return "Tier 3 team involved — game excluded";
    case "no_bottom_2_3_fade_target": return "No Bottom-2/3 fade target in this game";
    case "favourite_not_identified": return "Favourite not identified";
    case "missing_team_data": return "Missing team data";
    default: return c ? String(c) : "Unknown fail";
  }
}

function baseWeight(legCount: number): number {
  if (legCount === 3) return 3.0;
  if (legCount === 2) return 2.0;
  return 1.0;
}

function tierFactor(o: BasketOption): number {
  if (!o.legs || o.legs.length === 0) return 0;
  if (o.legs.some((l) => l.price_status !== "available")) return 0;
  const tiers = o.legs.map((l) => l.selection_tier);
  const allT1 = tiers.every((t) => t === "T1_GOLDEN");
  const allT2 = tiers.every((t) => t === "T2_NERVOUS");
  const hasT1 = tiers.some((t) => t === "T1_GOLDEN");
  const hasT2 = tiers.some((t) => t === "T2_NERVOUS");
  if (allT1) return 1.0;
  if (allT2) return 0.0;
  if (hasT1 && hasT2) return 0.5;
  return 0.0;
}

function computeWeight(o: BasketOption): number {
  return baseWeight(o.leg_count) * tierFactor(o);
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

interface StakeInfo {
  weight: number;
  suggested: number | null;
}

interface RenderedOption {
  section: string;
  index: number;
  opt: BasketOption;
  weight: number;
  suggested: number | null;
}

function buildStakeMap(
  opts: PreviewResponse["basket_options"],
  budget: number | null,
): { map: Map<string, StakeInfo>; totalWeight: number } {
  const map = new Map<string, StakeInfo>();
  const sections: Array<[string, BasketOption[]]> = [
    ["two_leg", opts?.two_leg ?? []],
    ["three_leg", opts?.three_leg ?? []],
    ["trebles_from_four", opts?.trebles_from_four ?? []],
  ];
  let totalWeight = 0;
  const tmp: Array<{ key: string; weight: number }> = [];
  for (const [section, list] of sections) {
    list.forEach((o, i) => {
      const w = computeWeight(o);
      tmp.push({ key: `${section}-${i}`, weight: w });
      totalWeight += w;
    });
  }
  for (const { key, weight } of tmp) {
    let suggested: number | null = null;
    if (budget != null && budget > 0 && totalWeight > 0 && weight > 0) {
      suggested = roundTo5(budget * (weight / totalWeight));
    }
    map.set(key, { weight, suggested });
  }
  return { map, totalWeight };
}

function renderLegHtml(l: Leg): string {
  const isT2 = l.selection_tier === "T2_NERVOUS";
  const warn = (l.warning_codes ?? []).length ? ` <em>(${esc((l.warning_codes ?? []).join(", "))})</em>` : "";
  return `
    <li style="margin:2px 0;">
      <strong>${esc(l.home_team)} v ${esc(l.away_team)}</strong> —
      Select <strong>${esc(l.selection_team)}</strong>
      (fade ${esc(l.fade_target_team ?? "—")}) ·
      ${esc(tierLabel(l.selection_tier))} ·
      Price: ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "—"} [${esc(l.price_status)}]${isT2 ? " · <span style='color:#a86200;'>T2 caution</span>" : ""}${warn}
    </li>`;
}

function renderLegText(l: Leg): string {
  const isT2 = l.selection_tier === "T2_NERVOUS";
  const warn = (l.warning_codes ?? []).length ? ` (warnings: ${(l.warning_codes ?? []).join(", ")})` : "";
  return `  - ${l.home_team} v ${l.away_team} — Select ${l.selection_team} (fade ${l.fade_target_team ?? "—"}) · ${tierLabel(l.selection_tier)} · Price: ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "—"} [${l.price_status}]${isT2 ? " · T2 caution" : ""}${warn}`;
}

// Phase 3C.1 fix: basket option legs from Phase 2A do not carry fade_target_team.
// Resolve the fade target by looking up the matching candidate leg (keyed by
// game_id + selection_team, with game_id-only fallback) so basket lines mirror
// the candidate-leg fade target instead of rendering "—".
function buildFadeLookup(candidates: Leg[]): {
  byGameAndTeam: Map<string, string>;
  byGame: Map<string, string>;
} {
  const byGameAndTeam = new Map<string, string>();
  const byGame = new Map<string, string>();
  for (const c of candidates) {
    const fade = c.fade_target_team ?? null;
    if (!fade) continue;
    if (c.game_id) {
      if (c.selection_team) {
        byGameAndTeam.set(`${c.game_id}|${c.selection_team}`, fade);
      }
      if (!byGame.has(c.game_id)) byGame.set(c.game_id, fade);
    }
  }
  return { byGameAndTeam, byGame };
}

function resolveFadeTarget(
  l: Leg,
  lookup: { byGameAndTeam: Map<string, string>; byGame: Map<string, string> },
): string {
  if (l.fade_target_team) return l.fade_target_team;
  if (l.game_id && l.selection_team) {
    const hit = lookup.byGameAndTeam.get(`${l.game_id}|${l.selection_team}`);
    if (hit) return hit;
  }
  if (l.game_id) {
    const hit = lookup.byGame.get(l.game_id);
    if (hit) return hit;
  }
  return "—";
}

function renderOptionHtml(
  r: RenderedOption,
  budgetSupplied: boolean,
  fadeLookup: { byGameAndTeam: Map<string, string>; byGame: Map<string, string> },
): string {
  const o = r.opt;
  const legs = o.legs.map((l) =>
    `<li>${esc(l.selection_team)} <span style="color:#666;">(fade ${esc(resolveFadeTarget(l, fadeLookup))}, ${esc(tierLabel(l.selection_tier))}, ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "no price"})</span></li>`,
  ).join("");
  const combined = o.combined_decimal_odds != null ? `$${o.combined_decimal_odds.toFixed(2)}` : "—";
  const stakeLine = budgetSupplied
    ? `<div>Relative weight: <strong>${r.weight.toFixed(2)}</strong> · Suggested preview stake: ${r.suggested != null && r.suggested > 0 ? `<strong>$${r.suggested}</strong>` : "<em>manual review only</em>"}</div>`
    : `<div>Relative weight: <strong>${r.weight.toFixed(2)}</strong></div>`;
  const cautionBlock = o.contains_tier2
    ? `<div style="margin-top:4px;padding:4px 6px;background:#fff7cc;border:1px solid #e0c200;">${esc(T2_CAUTION)}</div>`
    : "";
  const warnings = (o.warnings ?? []).length
    ? `<div style="color:#666;font-size:12px;">Warnings: ${esc((o.warnings ?? []).join(", "))}</div>`
    : "";
  return `
    <div style="border:1px solid #ddd;padding:8px 10px;margin:8px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;">
      <div style="font-weight:bold;">${esc(o.option_type)} · ${o.leg_count} legs · Combined: ${combined}</div>
      <ul style="margin:4px 0 4px 18px;padding:0;">${legs}</ul>
      ${stakeLine}
      <div style="color:#666;font-size:12px;">preview_only=${String(o.preview_only)} · manual_approval_required=${String(o.manual_approval_required)}</div>
      ${warnings}
      ${cautionBlock}
    </div>`;
}

function renderOptionText(
  r: RenderedOption,
  budgetSupplied: boolean,
  fadeLookup: { byGameAndTeam: Map<string, string>; byGame: Map<string, string> },
): string {
  const o = r.opt;
  const head = `[${o.option_type}] ${o.leg_count} legs · Combined: ${o.combined_decimal_odds != null ? `$${o.combined_decimal_odds.toFixed(2)}` : "—"}`;
  const legs = o.legs.map((l) =>
    `    - ${l.selection_team} (fade ${resolveFadeTarget(l, fadeLookup)}, ${tierLabel(l.selection_tier)}, ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "no price"})`,
  ).join("\n");
  const stakeLine = budgetSupplied
    ? `    weight=${r.weight.toFixed(2)} · suggested=${r.suggested != null && r.suggested > 0 ? `$${r.suggested}` : "manual review only"}`
    : `    weight=${r.weight.toFixed(2)}`;
  const warn = (o.warnings ?? []).length ? `\n    warnings: ${(o.warnings ?? []).join(", ")}` : "";
  const caution = o.contains_tier2 ? `\n    ${T2_CAUTION}` : "";
  const meta = `    preview_only=${o.preview_only} · manual_approval_required=${o.manual_approval_required}`;
  return `${head}\n${legs}\n${stakeLine}\n${meta}${warn}${caution}`;
}

function renderExcludedHtml(exs: ExcludedGame[]): string {
  if (!exs.length) return "<p style='color:#666;'>None.</p>";
  return `<ul style="margin:4px 0 0 18px;padding:0;">${exs.map((g) =>
    `<li>${esc(g.home_team)} v ${esc(g.away_team)} — ${esc(failLabel(g.fail_code))} <span style="color:#666;">[${esc(g.audit_status)}]</span></li>`,
  ).join("")}</ul>`;
}

function renderExcludedText(exs: ExcludedGame[]): string {
  if (!exs.length) return "  None.";
  return exs.map((g) => `  - ${g.home_team} v ${g.away_team} — ${failLabel(g.fail_code)} [${g.audit_status}]`).join("\n");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalAlertPayload(args: {
  scope: { season: number | null; round: number | null };
  candidates: Leg[];
  rendered: RenderedOption[];
  budget: number | null;
}): string {
  const { scope, candidates, rendered, budget } = args;
  const candSorted = [...candidates]
    .map((l) => ({
      game_id: l.game_id ?? "",
      selection_team: l.selection_team ?? "",
      fade_target_team: l.fade_target_team ?? "",
      tier: l.selection_tier ?? "",
      price: l.selected_price != null ? Number(l.selected_price).toFixed(2) : "",
    }))
    .sort((a, b) => a.game_id.localeCompare(b.game_id) || a.selection_team.localeCompare(b.selection_team));

  const optsSorted = [...rendered]
    .map((r) => ({
      key: `${r.section}-${r.index}`,
      combined: r.opt.combined_decimal_odds != null ? Number(r.opt.combined_decimal_odds).toFixed(2) : "",
      legs: r.opt.legs.map((l) => `${l.game_id}:${l.selection_team}:${l.selection_tier}:${l.selected_price != null ? Number(l.selected_price).toFixed(2) : ""}`).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return JSON.stringify({
    system_code: "SYS_12",
    season: scope.season,
    round: scope.round,
    candidates: candSorted,
    options: optsSorted,
    budget: budget ?? null,
  });
}

function pickDedupeGameId(candidates: Leg[]): string | null {
  const ids = candidates.map((l) => l.game_id).filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return null;
  return ids.slice().sort()[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const season = body.season != null ? Number(body.season) : null;
    const round = body.round != null ? Number(body.round) : null;
    const includeFail = body.include_fail_diagnostics !== false; // default true
    const dryRun = body.dry_run === undefined ? true : body.dry_run === true;
    const sendConfirm = typeof body.send_confirm === "string" ? body.send_confirm : "";
    const budgetRaw = body.budget;
    const budgetNum = budgetRaw != null && Number.isFinite(Number(budgetRaw)) ? Number(budgetRaw) : null;
    const budget = budgetNum != null && budgetNum > 0 ? budgetNum : null;
    const budgetSupplied = budget != null;

    const zeroSE = { emails_sent: 0, db_writes: 0, signals_created: 0, bets_created: 0, alerts_logged: 0 };

    // Phase 3C gate: dry_run=false requires explicit confirmation string.
    if (!dryRun && sendConfirm !== MANUAL_SEND_CONFIRMATION) {
      return new Response(
        JSON.stringify({
          ok: false,
          mode: "SYS_12_PHASE_3C_MANUAL_SEND_ONLY",
          system_code: "SYS_12",
          dry_run: false,
          refused: true,
          reason: "manual_send_confirmation_required",
          status_text: `SYS_12 Phase 3C manual send requires send_confirm:"${MANUAL_SEND_CONFIRMATION}".`,
          side_effects: zeroSE,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sendMode = !dryRun; // Phase 3C confirmed manual send.
    const responseMode = sendMode ? "SYS_12_PHASE_3C_MANUAL_SEND_ONLY" : "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY";
    const statusText = sendMode ? STATUS_TEXT_SENT : STATUS_TEXT_DRY;
    const footerLine = sendMode ? FOOTER_SENT_LINE : FOOTER_DRY_LINE;

    // Call Phase 2A read-only (always, for both modes).
    const reqBody: Record<string, unknown> = { include_fail_diagnostics: includeFail };
    if (season != null && Number.isFinite(season)) reqBody.season = season;
    if (round != null && Number.isFinite(round)) reqBody.round = round;

    const upstream = await fetch(`${supabaseUrl}/functions/v1/${PHASE_2A_FUNCTION}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(reqBody),
    });
    const preview = (await upstream.json().catch(() => null)) as PreviewResponse | null;

    if (!upstream.ok || !preview?.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: !sendMode,
          error: "phase_2a_call_failed",
          upstream_status: upstream.status,
          upstream_response: preview,
          side_effects: zeroSE,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidates = preview.candidate_legs ?? [];
    const excluded = preview.excluded_games ?? [];
    const opts = preview.basket_options ?? { two_leg: [], three_leg: [], trebles_from_four: [] };
    const scope = preview.scope ?? { season: null, round: null, game_id: null };

    const { map: stakeMap } = buildStakeMap(opts, budget);

    const rendered: RenderedOption[] = [];
    (["two_leg", "three_leg", "trebles_from_four"] as const).forEach((section) => {
      (opts[section] ?? []).forEach((o, i) => {
        const info = stakeMap.get(`${section}-${i}`) ?? { weight: 0, suggested: null };
        rendered.push({ section, index: i, opt: o, weight: info.weight, suggested: info.suggested });
      });
    });

    const viable2or3 = rendered.filter((r) => (r.section === "two_leg" || r.section === "three_leg"));
    const anyAllPriceAvailable = rendered.some((r) => r.opt.legs.length > 0 && r.opt.legs.every((l) => l.price_status === "available"));
    const weightedOptions = rendered.filter((r) => r.weight > 0);
    const containsTier2 = rendered.some((r) => r.opt.contains_tier2);
    const allOptionsT2OrZero = rendered.length > 0 && rendered.every((r) => r.weight === 0);
    const tier3InBasket = false;

    const preconditions = {
      at_least_two_candidates: candidates.length >= 2,
      at_least_one_2_or_3_leg_option: viable2or3.length >= 1,
      at_least_one_option_with_all_prices: anyAllPriceAvailable,
      no_tier3_in_basket_options: !tier3InBasket,
      at_least_one_weighted_option: weightedOptions.length >= 1,
      not_all_options_t2_or_zero: !allOptionsT2OrZero,
    };
    const preconditionsPassed = Object.values(preconditions).every(Boolean);

    const candidateCount = candidates.length;
    const viableBasketCount = rendered.filter((r) =>
      r.opt.legs.length > 0 && r.opt.legs.every((l) => l.price_status === "available"),
    ).length;
    const twoLegCount = (opts.two_leg ?? []).length;
    const threeLegCount = (opts.three_leg ?? []).length;
    const treblesCount = (opts.trebles_from_four ?? []).length;

    const decision = {
      candidate_count: candidateCount,
      viable_basket_count: viableBasketCount,
      two_leg_count: twoLegCount,
      three_leg_count: threeLegCount,
      trebles_from_four_count: treblesCount,
      contains_tier2: containsTier2,
      budget_supplied: budgetSupplied,
      weighted_option_count: weightedOptions.length,
      preconditions_passed: preconditionsPassed,
      preconditions,
    };

    const source_preview = {
      scope,
      counts: preview.counts ?? {},
      candidate_legs_summary: candidates.map((l) => ({
        game_id: l.game_id,
        matchup: `${l.home_team} v ${l.away_team}`,
        selection_team: l.selection_team,
        fade_target_team: l.fade_target_team ?? null,
        tier: l.selection_tier,
        price: l.selected_price,
        price_status: l.price_status,
      })),
      excluded_games_summary: excluded.map((g) => ({
        game_id: g.game_id,
        matchup: `${g.home_team} v ${g.away_team}`,
        fail_code: g.fail_code,
        audit_status: g.audit_status,
      })),
      upstream_warnings: preview.warnings ?? [],
    };

    const generatedAt = new Date().toISOString();

    // Short-circuit when preconditions fail.
    if (!preconditionsPassed) {
      const failingKeys = Object.entries(preconditions).filter(([, v]) => !v).map(([k]) => k);
      const subject = `SYS_12 Early Basket Preview — ${candidateCount} candidate leg(s), ${viableBasketCount} viable basket(s)`;
      const noHtml = `
        <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
          <p style="background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;margin:0 0 8px 0;"><strong>${esc(BANNER)}</strong></p>
          <p>No SYS_12 early alert would be issued. Preconditions not met: ${esc(failingKeys.join(", "))}.</p>
          <p style="color:#666;">Scope: season ${esc(scope.season)} round ${esc(scope.round)} · generated ${esc(generatedAt)} · dry_run=${String(!sendMode)}</p>
          <p style="color:#666;">${esc(statusText)}</p>
        </div>`;
      const noText = [
        BANNER,
        "",
        `No SYS_12 early alert would be issued. Preconditions not met: ${failingKeys.join(", ")}.`,
        `Scope: season ${scope.season} round ${scope.round} · generated ${generatedAt} · dry_run=${String(!sendMode)}`,
        statusText,
      ].join("\n");

      return new Response(
        JSON.stringify({
          ok: true,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: !sendMode,
          sent: false,
          skipped: true,
          duplicate: false,
          reason: "preconditions_failed",
          subject,
          html_preview: noHtml,
          text_preview: noText,
          decision,
          source_preview,
          side_effects: zeroSE,
          status_text: statusText,
          generated_at: generatedAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build content (used by both dry-run and confirmed send).
    const subject = `SYS_12 Early Basket Preview — ${candidateCount} candidate leg(s), ${viableBasketCount} viable basket(s)`;

    const renderedTwo = rendered.filter((r) => r.section === "two_leg");
    const renderedThree = rendered.filter((r) => r.section === "three_leg");
    const renderedTrebles = rendered.filter((r) => r.section === "trebles_from_four");

    const candidateLegsHtml = candidates.length
      ? `<ul style="margin:4px 0 0 18px;padding:0;">${candidates.map(renderLegHtml).join("")}</ul>`
      : "<p style='color:#666;'>None.</p>";

    const optsHtml = (label: string, list: RenderedOption[]) =>
      list.length
        ? `<h3 style="margin:14px 0 4px 0;">${esc(label)}</h3>${list.map((r) => renderOptionHtml(r, budgetSupplied)).join("")}`
        : `<h3 style="margin:14px 0 4px 0;">${esc(label)}</h3><p style='color:#666;'>None.</p>`;

    const budgetBlockHtml = budgetSupplied
      ? `<p style="margin:6px 0;">Preview budget: <strong>$${budget}</strong>. Suggestions are preview-only (Phase 2C formula).</p>`
      : `<p style="margin:6px 0;color:#666;">${esc(NO_BUDGET_COPY)}</p>`;

    const htmlPreview = `
      <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
        <h2 style="margin:0 0 8px 0;">SYS_12 Early Basket Preview</h2>
        <p style="background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;margin:0 0 8px 0;"><strong>${esc(BANNER)}</strong></p>

        <h3 style="margin:12px 0 4px 0;">1. Status</h3>
        <p style="margin:4px 0;">
          Preview-only · season ${esc(scope.season)} · round ${esc(scope.round)} · generated ${esc(generatedAt)} · dry_run=${String(!sendMode)}
        </p>
        ${budgetBlockHtml}

        <h3 style="margin:14px 0 4px 0;">2. Candidate legs (${candidates.length})</h3>
        ${candidateLegsHtml}

        <h3 style="margin:14px 0 4px 0;">3. Basket options</h3>
        ${optsHtml("Two-leg options", renderedTwo)}
        ${optsHtml("Three-leg options", renderedThree)}
        ${renderedTrebles.length ? optsHtml("Trebles from four", renderedTrebles) : ""}

        <h3 style="margin:14px 0 4px 0;">4. Excluded diagnostics (never enter basket options)</h3>
        ${renderExcludedHtml(excluded)}

        <hr style="margin:14px 0;border:none;border-top:1px solid #ddd;" />
        <p style="background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;margin:8px 0;"><strong>${esc(BANNER)}</strong></p>
        <ul style="margin:4px 0 0 18px;padding:0;color:#444;">
          <li>Place manually only if you choose.</li>
          <li>No app bet log has been created.</li>
          <li>${esc(FOOTER_NO_AUTO)}</li>
          <li>${esc(footerLine)}</li>
        </ul>
        <p style="margin-top:10px;color:#666;font-size:12px;">${esc(statusText)}</p>
      </div>`;

    const textOptsBlock = (label: string, list: RenderedOption[]) =>
      list.length
        ? `${label}:\n${list.map((r) => renderOptionText(r, budgetSupplied)).join("\n\n")}`
        : `${label}:\n  None.`;

    const textPreview = [
      "SYS_12 Early Basket Preview",
      BANNER,
      "",
      "1. Status",
      `  Preview-only · season ${scope.season} · round ${scope.round} · generated ${generatedAt} · dry_run=${String(!sendMode)}`,
      budgetSupplied ? `  Preview budget: $${budget} (Phase 2C suggestions included)` : `  ${NO_BUDGET_COPY}`,
      "",
      `2. Candidate legs (${candidates.length})`,
      candidates.length ? candidates.map(renderLegText).join("\n") : "  None.",
      "",
      "3. Basket options",
      textOptsBlock("  Two-leg options", renderedTwo),
      "",
      textOptsBlock("  Three-leg options", renderedThree),
      ...(renderedTrebles.length ? ["", textOptsBlock("  Trebles from four", renderedTrebles)] : []),
      "",
      "4. Excluded diagnostics (never enter basket options)",
      renderExcludedText(excluded),
      "",
      "---",
      BANNER,
      "  - Place manually only if you choose.",
      "  - No app bet log has been created.",
      `  - ${FOOTER_NO_AUTO}`,
      `  - ${footerLine}`,
      "",
      statusText,
    ].join("\n");

    // Dry-run response (Phase 3B default).
    if (!sendMode) {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: true,
          sent: false,
          skipped: false,
          duplicate: false,
          reason: null,
          subject,
          html_preview: htmlPreview,
          text_preview: textPreview,
          decision,
          source_preview,
          side_effects: zeroSE,
          status_text: statusText,
          generated_at: generatedAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Phase 3C confirmed manual send path ---
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") ?? "";
    const toEmail = Deno.env.get("PERS_SYS_ALERT_TO_EMAIL") ?? "";
    const messageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "";

    if (!serviceRoleKey || !postmarkToken || !fromEmail || !toEmail || !messageStream) {
      return new Response(
        JSON.stringify({
          ok: false,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: false,
          sent: false,
          skipped: true,
          duplicate: false,
          reason: "missing_send_env",
          missing: {
            SUPABASE_SERVICE_ROLE_KEY: !serviceRoleKey,
            POSTMARK_SERVER_TOKEN: !postmarkToken,
            POSTMARK_FROM_EMAIL: !fromEmail,
            PERS_SYS_ALERT_TO_EMAIL: !toEmail,
            POSTMARK_MESSAGE_STREAM: !messageStream,
          },
          side_effects: zeroSE,
          status_text: statusText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dedupeGameId = pickDedupeGameId(candidates);
    if (!dedupeGameId) {
      return new Response(
        JSON.stringify({
          ok: false,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: false,
          sent: false,
          skipped: true,
          duplicate: false,
          reason: "no_candidate_game_id_for_dedupe",
          side_effects: zeroSE,
          status_text: statusText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const canonical = canonicalAlertPayload({
      scope: { season: scope.season, round: scope.round },
      candidates,
      rendered,
      budget,
    });
    const alertHash = await sha256Hex(canonical);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pre-insert dedupe row (matches pers-sys-send-t30-alert pattern).
    const { data: insertedRun, error: runInsertErr } = await supabase
      .from("pers_sys_email_alert_runs")
      .insert({
        game_id: dedupeGameId,
        snapshot_type: DEDUPE_SNAPSHOT_TYPE,
        alert_hash: alertHash,
      })
      .select("id")
      .maybeSingle();

    if (runInsertErr) {
      const code = (runInsertErr as { code?: string }).code ?? "";
      if (code === "23505") {
        return new Response(
          JSON.stringify({
            ok: true,
            mode: responseMode,
            system_code: "SYS_12",
            dry_run: false,
            sent: false,
            skipped: true,
            duplicate: true,
            reason: "duplicate_alert_run",
            subject,
            decision,
            dedupe: {
              alert_hash: alertHash,
              dedupe_game_id: dedupeGameId,
              snapshot_type: DEDUPE_SNAPSHOT_TYPE,
              inserted: false,
              rolled_back: false,
              duplicate: true,
            },
            side_effects: zeroSE,
            status_text: statusText,
            generated_at: generatedAt,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: false,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: false,
          sent: false,
          skipped: true,
          duplicate: false,
          reason: "dedupe_insert_failed",
          error: String(runInsertErr.message ?? runInsertErr),
          side_effects: zeroSE,
          status_text: statusText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const runId = (insertedRun as { id?: string } | null)?.id ?? null;

    // Postmark send (one email only).
    let postmarkStatus = 0;
    let postmarkParsed: unknown = null;
    let postmarkOk = false;
    try {
      const postmarkRes = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": postmarkToken,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: toEmail,
          Subject: subject,
          HtmlBody: htmlPreview,
          TextBody: textPreview,
          MessageStream: messageStream,
          Tag: POSTMARK_TAG,
        }),
      });
      postmarkStatus = postmarkRes.status;
      const rawText = await postmarkRes.text();
      try { postmarkParsed = JSON.parse(rawText); } catch { postmarkParsed = { raw: rawText }; }
      postmarkOk = postmarkRes.ok;
    } catch (e) {
      postmarkOk = false;
      postmarkParsed = { error: String(e) };
    }

    if (!postmarkOk) {
      // Rollback dedupe row so the ledger remains truthful.
      let rolledBack = false;
      if (runId) {
        const { error: delErr } = await supabase
          .from("pers_sys_email_alert_runs")
          .delete()
          .eq("id", runId);
        rolledBack = !delErr;
      }
      // Strip any potential token field defensively (Postmark never echoes it).
      const safePostmark = { status: postmarkStatus, response: postmarkParsed };
      return new Response(
        JSON.stringify({
          ok: false,
          mode: responseMode,
          system_code: "SYS_12",
          dry_run: false,
          sent: false,
          skipped: true,
          duplicate: false,
          reason: "postmark_send_failed",
          subject,
          decision,
          postmark: safePostmark,
          dedupe: {
            alert_hash: alertHash,
            dedupe_game_id: dedupeGameId,
            snapshot_type: DEDUPE_SNAPSHOT_TYPE,
            inserted: Boolean(runId),
            rolled_back: rolledBack,
            duplicate: false,
          },
          side_effects: { ...zeroSE },
          status_text: statusText,
          generated_at: generatedAt,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: responseMode,
        system_code: "SYS_12",
        dry_run: false,
        sent: true,
        skipped: false,
        duplicate: false,
        reason: null,
        subject,
        decision,
        postmark: {
          status: postmarkStatus,
          response: postmarkParsed,
          tag: POSTMARK_TAG,
          message_stream: messageStream,
        },
        dedupe: {
          alert_hash: alertHash,
          dedupe_game_id: dedupeGameId,
          snapshot_type: DEDUPE_SNAPSHOT_TYPE,
          inserted: true,
          rolled_back: false,
          duplicate: false,
        },
        side_effects: {
          emails_sent: 1,
          db_writes: 1,
          signals_created: 0,
          bets_created: 0,
          alerts_logged: 1,
        },
        status_text: statusText,
        generated_at: generatedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sys12-early-alert error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        mode: "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY",
        system_code: "SYS_12",
        dry_run: true,
        error: String(err),
        side_effects: { emails_sent: 0, db_writes: 0, signals_created: 0, bets_created: 0, alerts_logged: 0 },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
