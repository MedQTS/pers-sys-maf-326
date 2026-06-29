// SYS_12 Phase 3B — Early Basket Preview ALERT (DRY-RUN ONLY).
//
// Read-only renderer. Calls pers-sys-sys12-basket-preview (Phase 2A) over HTTP,
// evaluates Phase 3A preconditions, applies Phase 2C-style relative stake
// preview when a budget is supplied, and returns HTML+text email previews.
//
// HARD GUARANTEES (enforced by absence of code paths):
// - No Postmark calls.
// - No DB writes of any kind (no .insert / .update / .upsert / .delete / .rpc).
// - No bet, signal, alert, or dedupe row creation.
// - No SYS_10A inclusion. No weather references. No T30 trigger.
// - dry_run defaults to true. dry_run:false is refused with a safe status.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHASE_2A_FUNCTION = "pers-sys-sys12-basket-preview";

const BANNER =
  "SYS_12 alert is informational only. No bet has been created or logged. Track manually in spreadsheet if placed.";
const T2_CAUTION =
  "CAUTION — contains Tier 2 reduced-exposure leg. Manual approval required.";
const NO_BUDGET_COPY = "No preview budget supplied; stake suggestions omitted.";
const STATUS_TEXT =
  "SYS_12 Phase 3B dry-run alert preview only. No email, bet, signal, log, or alert record created.";

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

function renderOptionHtml(r: RenderedOption, budgetSupplied: boolean): string {
  const o = r.opt;
  const legs = o.legs.map((l) =>
    `<li>${esc(l.selection_team)} <span style="color:#666;">(fade ${esc(l.fade_target_team ?? "—")}, ${esc(tierLabel(l.selection_tier))}, ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "no price"})</span></li>`,
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

function renderOptionText(r: RenderedOption, budgetSupplied: boolean): string {
  const o = r.opt;
  const head = `[${o.option_type}] ${o.leg_count} legs · Combined: ${o.combined_decimal_odds != null ? `$${o.combined_decimal_odds.toFixed(2)}` : "—"}`;
  const legs = o.legs.map((l) =>
    `    - ${l.selection_team} (fade ${l.fade_target_team ?? "—"}, ${tierLabel(l.selection_tier)}, ${l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "no price"})`,
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
    const budgetRaw = body.budget;
    const budgetNum = budgetRaw != null && Number.isFinite(Number(budgetRaw)) ? Number(budgetRaw) : null;
    const budget = budgetNum != null && budgetNum > 0 ? budgetNum : null;
    const budgetSupplied = budget != null;

    if (!dryRun) {
      return new Response(
        JSON.stringify({
          ok: false,
          mode: "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY",
          system_code: "SYS_12",
          dry_run: false,
          refused: true,
          reason: "phase_3b_is_dry_run_only",
          status_text: "SYS_12 Phase 3B does not send alerts. Re-invoke with dry_run:true (default) to receive a preview.",
          side_effects: { emails_sent: 0, db_writes: 0, signals_created: 0, bets_created: 0, alerts_logged: 0 },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Phase 2A read-only.
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
          mode: "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY",
          system_code: "SYS_12",
          dry_run: true,
          error: "phase_2a_call_failed",
          upstream_status: upstream.status,
          upstream_response: preview,
          side_effects: { emails_sent: 0, db_writes: 0, signals_created: 0, bets_created: 0, alerts_logged: 0 },
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
    const tier3InBasket = false; // Phase 2A excludes Tier 3 upstream; basket_options never contain Tier 3.

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

    const sideEffects = { emails_sent: 0, db_writes: 0, signals_created: 0, bets_created: 0, alerts_logged: 0 };
    const generatedAt = new Date().toISOString();

    // Short-circuit when preconditions fail: return a "no alert" preview.
    if (!preconditionsPassed) {
      const failingKeys = Object.entries(preconditions).filter(([, v]) => !v).map(([k]) => k);
      const subject = `SYS_12 Early Basket Preview — ${candidateCount} candidate leg(s), ${viableBasketCount} viable basket(s)`;
      const noHtml = `
        <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
          <p style="background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;margin:0 0 8px 0;"><strong>${esc(BANNER)}</strong></p>
          <p>No SYS_12 early alert would be issued. Preconditions not met: ${esc(failingKeys.join(", "))}.</p>
          <p style="color:#666;">Scope: season ${esc(scope.season)} round ${esc(scope.round)} · generated ${esc(generatedAt)} · dry_run=true</p>
          <p style="color:#666;">${esc(STATUS_TEXT)}</p>
        </div>`;
      const noText = [
        BANNER,
        "",
        `No SYS_12 early alert would be issued. Preconditions not met: ${failingKeys.join(", ")}.`,
        `Scope: season ${scope.season} round ${scope.round} · generated ${generatedAt} · dry_run=true`,
        STATUS_TEXT,
      ].join("\n");

      return new Response(
        JSON.stringify({
          ok: true,
          mode: "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY",
          system_code: "SYS_12",
          dry_run: true,
          skipped: true,
          reason: "preconditions_failed",
          subject,
          html_preview: noHtml,
          text_preview: noText,
          decision,
          source_preview,
          side_effects: sideEffects,
          status_text: STATUS_TEXT,
          generated_at: generatedAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build the full dry-run preview.
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
          Preview-only · season ${esc(scope.season)} · round ${esc(scope.round)} · generated ${esc(generatedAt)} · dry_run=true
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
          <li>No alert has been sent in Phase 3B dry-run mode.</li>
        </ul>
        <p style="margin-top:10px;color:#666;font-size:12px;">${esc(STATUS_TEXT)}</p>
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
      `  Preview-only · season ${scope.season} · round ${scope.round} · generated ${generatedAt} · dry_run=true`,
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
      "  - No alert has been sent in Phase 3B dry-run mode.",
      "",
      STATUS_TEXT,
    ].join("\n");

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "SYS_12_PHASE_3B_DRY_RUN_ALERT_ONLY",
        system_code: "SYS_12",
        dry_run: true,
        skipped: false,
        reason: null,
        subject,
        html_preview: htmlPreview,
        text_preview: textPreview,
        decision,
        source_preview,
        side_effects: sideEffects,
        status_text: STATUS_TEXT,
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
