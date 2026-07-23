// SYS_10A Manual Total Guide — notification pathway.
//
// Fully isolated from the ACTION NOW / T30 alerter.
// - Calls pers-sys-sys10a-report for guide generation.
// - Sends a single Postmark email if at least one ACTIONABLE candidate exists.
// - No signals. No bets. No alert dedupe writes.
// - May perform non-fatal weather-only seed writes to
//   pers_sys_weather_snapshots / pers_sys_weather_assessments before rendering.
// - Wording/layout only: weather is NOT included in SYS_10A email decisioning.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AltBand = {
  band: number;
  target_line?: number;
  clearance: number | null;
  min_acceptable_odds: number | null;
  alt_gap?: number | null;
  eligible?: boolean;
  candidate?: boolean;
  probability_source?: string;
  nearest_band_used?: number;
};

// W1 display-only weather block emitted by pers-sys-sys10a-report.
type WeatherBlockDisplay = {
  display_only: true;
  assessment_stage: string;
  requested_system_code: "SYS_10A";
  source_system_code: "SYS_10A" | "SYS_8" | null;
  fallback_used: boolean;
  outcome: string | null;
  reason_code: string | null;
  policy_code: string | null;
  no_data: boolean;
};

type WeatherSeedResult = {
  attempted: boolean;
  game_ids: string[];
  errors: Array<{
    game_id: string;
    status?: number;
    response?: unknown;
    error?: string;
  }>;
};

function uniqueGuideGameIds(candidates: Candidate[]): string[] {
  return Array.from(
    new Set(
      candidates
        .filter((c) => !isRoofedVenue(c.venue))
        .map((c) => c.game_id)
        .filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        ),
    ),
  );
}

async function seedSys10aWeatherForGuideGames(
  supabaseUrl: string,
  anonKey: string,
  gameIds: string[],
): Promise<WeatherSeedResult> {
  const result: WeatherSeedResult = {
    attempted: gameIds.length > 0,
    game_ids: gameIds,
    errors: [],
  };
  for (const gameId of gameIds) {
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/pers-sys-weather-seed-precheck`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            mode: "PRECHECK_ONLY",
            game_id: gameId,
            snapshot_stage: "T30",
            assessment_stage: "T30",
            system_codes: ["SYS_10A"],
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !(json as any)?.ok) {
        result.errors.push({
          game_id: gameId,
          status: res.status,
          response: json,
        });
      }
    } catch (err) {
      result.errors.push({
        game_id: gameId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

type Candidate = {
  game_id: string;
  home: string | null;
  away: string | null;
  venue: string | null;
  start_time_aet?: string;
  main_total: number | null;
  over_price: number | null;
  under_price: number | null;
  estimated_total?: number;
  main_edge?: number;
  main_lean?: string;
  main_stake_guidance_u?: number;
  alt_bands?: AltBand[];
  // Warning/conflict metadata (added by report; safe/absent by default)
  display_status?: string;
  conflict_warning_active?: boolean;
  conflict_warning_type?: "manual_tactical" | "recent_form" | null;
  conflict_warning_reasons?: string[];
  conflict_warning_note?: string | null;
  execution_default_units?: number;
  include_in_best_bets?: boolean;
  include_in_multis?: boolean;
  recent_form_warning_against_main_over?: boolean;
  cascade?: null | {
    total_exposure_cap_u: number;
    anchor: {
      band: number;
      target_line?: number;
      stake_u: number;
      min_acceptable_odds: number | null;
      note: string;
    };
    upside: null | {
      band: number;
      target_line?: number;
      stake_u: number;
      min_acceptable_odds: number | null;
      note: string;
    };
  };
  venue_caution?: string[];
  samples?: {
    home_home_games: number;
    away_away_games: number;
    venue_games: number;
  };
  status: "CANDIDATE" | "SUPPRESSED";
  suppression_reason?: string | null;
  alt_over_suppressed_due_main_under_lean?: boolean;
  recent_form_overlay_applied?: boolean;
  recent_form_overlay_action?: string;
  overlay_warnings?: string[];
  weather?: WeatherBlockDisplay;
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function eligibleAltBands(c: Candidate): AltBand[] {
  return (c.alt_bands ?? []).filter((b) => b.eligible === true);
}

function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(dp);
}

function fmtSigned(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(dp);
}

// Reliable roof/indoor detection: Marvel Stadium / Docklands only.
function isRoofedVenue(venue: string | null | undefined): boolean {
  if (!venue) return false;
  const v = venue.toLowerCase();
  return v.includes("marvel") || v.includes("docklands");
}

// W1 display-only weather renderer. Uses the weather block from the report
// payload; falls back to venue-based roof detection only when the block is
// absent entirely. Does NOT affect stake or pick logic.
function weatherStatus(c: Candidate): {
  weather: string;
  status: string;
  roofed: boolean;
} {
  const w = c.weather;
  const venue = c.venue;
  if (!w) {
    if (isRoofedVenue(venue)) {
      return {
        weather: "ROOF / INDOOR",
        status: "PRICE CHECK ONLY",
        roofed: true,
      };
    }
    return {
      weather: "CHECK WEATHER FIRST",
      status: "no weather block",
      roofed: false,
    };
  }
  if (w.no_data) {
    if (isRoofedVenue(venue)) {
      return {
        weather: "ROOF / INDOOR",
        status: "PRICE CHECK ONLY",
        roofed: true,
      };
    }
    return {
      weather: "CHECK WEATHER FIRST",
      status: "no weather assessment found",
      roofed: false,
    };
  }
  const src = w.source_system_code ?? "?";
  const fbTag = w.fallback_used ? " (fallback SYS_8)" : "";
  const outcome = String(w.outcome ?? "").toUpperCase();
  switch (outcome) {
    case "FULL_STAKE":
      return {
        weather: "Weather OK (clear)",
        status: `shadow · source ${src}${fbTag}`,
        roofed: false,
      };
    case "HALF_STAKE":
      return {
        weather: "Weather caution — half-stake shadow",
        status: `shadow · source ${src}${fbTag}`,
        roofed: false,
      };
    case "PASS":
      return {
        weather: "Weather red — would suppress (shadow)",
        status: `shadow · source ${src}${fbTag}`,
        roofed: false,
      };
    case "NOT_APPLICABLE":
      return {
        weather: "Roof / indoor — weather not applicable",
        status: `shadow · source ${src}${fbTag}`,
        roofed: true,
      };
    default:
      if (isRoofedVenue(venue)) {
        return {
          weather: "ROOF / INDOOR",
          status: "PRICE CHECK ONLY",
          roofed: true,
        };
      }
      return {
        weather: "CHECK WEATHER FIRST",
        status: `unknown outcome${outcome ? `: ${outcome}` : ""}`,
        roofed: false,
      };
  }
}

function readableLean(lean: string | undefined): string {
  switch (lean) {
    case "MAIN_TOTAL_OVER":
      return "Over";
    case "MAIN_TOTAL_UNDER":
      return "Under";
    case "PASS":
      return "No main-total bet";
    default:
      return "No main-total bet";
  }
}

const READABLE_SUPPRESSION: Record<string, string> = {
  alt_line_too_far_below_main_total: "Alt line too far below main total",
  pass_no_actionable_alt_candidate: "No usable alt candidate",
  missing_main_total: "Missing main total",
};
function readableSuppression(code: string): string {
  return READABLE_SUPPRESSION[code] ?? code.replace(/_/g, " ");
}

// ---------- Warning helpers ----------
type WarningInfo = {
  active: true;
  type: "manual_tactical" | "recent_form";
  headline: string;
  statusText: string;
  reasonText: string;
  reasonCodes: string[];
};

function warningInfo(c: Candidate): WarningInfo | null {
  if (!c.conflict_warning_active) return null;
  const t = c.conflict_warning_type;
  if (t === "manual_tactical") {
    const codes = (c.conflict_warning_reasons ?? []).map(String);
    const note = (c.conflict_warning_note ?? "").trim();
    const reasonText = note
      ? note
      : codes.length
        ? `Recognised reason(s): ${codes.join(", ")}.`
        : "Recent tactical under profile conflicts with SYS_10A Over.";
    return {
      active: true,
      type: "manual_tactical",
      headline: "CONFLICT WARNING — PASS PREFERRED",
      statusText: c.display_status ?? "CONFLICT PASS / PRICE CHECK ONLY",
      reasonText,
      reasonCodes: codes,
    };
  }
  if (t === "recent_form") {
    return {
      active: true,
      type: "recent_form",
      headline: "WARNING: Recent-form conflict",
      statusText: c.display_status ?? "RECENT FORM WARNING / PRICE CHECK ONLY",
      reasonText:
        "SYS_10A model remains Over, but recent scoring profile is below market.",
      reasonCodes: c.conflict_warning_reasons ?? [],
    };
  }
  return null;
}

const EXECUTION_LINES = [
  "0u default",
  "Pass preferred",
  "Do not include in best bets",
  "Do not include in multis unless manually overridden",
];

function warningBlockHtml(w: WarningInfo): string {
  return `
      <div style="border:2px solid #b00020;background:#fff4f4;padding:8px 10px;margin:6px 0 10px 0;">
        <div style="font-weight:bold;color:#b00020;">${esc(w.headline)}</div>
        <div style="margin-top:4px;">${esc(w.reasonText)}</div>
        <div style="margin-top:4px;">Status: <strong>${esc(w.statusText)}</strong></div>
        <div style="margin-top:4px;">Execution:</div>
        <ul style="margin:2px 0 0 18px;padding:0;">
          ${EXECUTION_LINES.map((l) => `<li>${esc(l)}</li>`).join("")}
        </ul>
      </div>`;
}

function warningBlockText(w: WarningInfo, indent = "  "): string {
  const lines = [
    `${indent}${w.headline}`,
    `${indent}Reason: ${w.reasonText}`,
    `${indent}Status: ${w.statusText}`,
    `${indent}Execution:`,
    ...EXECUTION_LINES.map((l) => `${indent}  - ${l}`),
  ];
  return lines.join("\n");
}

// ---------- Main-total card ----------
function renderMainHtml(c: Candidate): string {
  const w = weatherStatus(c);
  const warn = warningInfo(c);
  const stakeLine = warn
    ? `Stake guide: 0u default (model output ${fmt(c.main_stake_guidance_u ?? 0, 1)}u retained for reference)`
    : w.roofed
      ? `Stake guide: ${fmt(c.main_stake_guidance_u ?? 0, 1)}u`
      : `Stake guide: ${fmt(c.main_stake_guidance_u ?? 0, 1)}u only if weather passes`;
  const statusText = warn ? warn.statusText : w.status;
  return `
    <div style="border:1px solid #ddd;padding:10px 12px;margin:10px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;">
      <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${esc(c.home)} v ${esc(c.away)} — ${esc(c.venue)}</div>
      ${warn ? warningBlockHtml(warn) : ""}
      <div>Base model side: Over ${fmt(c.main_total, 1)}</div>
      <div>Estimated total: ${fmt(c.estimated_total, 1)}</div>
      <div>Base edge: ${fmtSigned(c.main_edge, 2)} pts</div>
      <div>Price: ${fmt(c.over_price, 2)}</div>
      <div>Weather: ${esc(w.weather)}</div>
      <div>Status: ${esc(statusText)}</div>
      <div>${esc(stakeLine)}</div>
    </div>`;
}

function renderMainText(c: Candidate): string {
  const w = weatherStatus(c);
  const warn = warningInfo(c);
  const stakeLine = warn
    ? `  Stake guide: 0u default (model output ${fmt(c.main_stake_guidance_u ?? 0, 1)}u retained for reference)`
    : w.roofed
      ? `  Stake guide: ${fmt(c.main_stake_guidance_u ?? 0, 1)}u`
      : `  Stake guide: ${fmt(c.main_stake_guidance_u ?? 0, 1)}u only if weather passes`;
  const statusText = warn ? warn.statusText : w.status;
  const lines = [
    `${c.home} v ${c.away} — ${c.venue}`,
    `  Base model side: Over ${fmt(c.main_total, 1)}`,
    `  Estimated total: ${fmt(c.estimated_total, 1)}`,
    `  Base edge: ${fmtSigned(c.main_edge, 2)} pts`,
    `  Price: ${fmt(c.over_price, 2)}`,
    `  Weather: ${w.weather}`,
    `  Status: ${statusText}`,
  ];
  if (warn) lines.push(warningBlockText(warn));
  lines.push(stakeLine);
  return lines.join("\n");
}

// ---------- Alt-over card ----------
function renderAltHtml(c: Candidate): string {
  const elig = eligibleAltBands(c);
  if (!elig.length) return "";
  const w = weatherStatus(c);
  const warn = warningInfo(c);
  const side = readableLean(c.main_lean);

  const checks: string[] = [];
  if (warn) {
    // Downgraded execution: show bands as technically eligible only.
    for (const b of elig) {
      checks.push(
        `Over ${fmt(b.target_line ?? b.band, 1)} — technically eligible (min acceptable odds ${fmt(b.min_acceptable_odds, 2)})`,
      );
    }
  } else if (c.cascade) {
    const a = c.cascade.anchor;
    checks.push(
      `Anchor: Over ${fmt(a.target_line ?? a.band, 1)} — ${fmt(a.stake_u, 1)}u if odds &ge; ${fmt(a.min_acceptable_odds, 2)}`,
    );
    if (c.cascade.upside) {
      const u = c.cascade.upside;
      checks.push(
        `Upside: Over ${fmt(u.target_line ?? u.band, 1)} — ${fmt(u.stake_u, 1)}u if odds &ge; ${fmt(u.min_acceptable_odds, 2)}`,
      );
    }
    checks.push(`Cap: ${fmt(c.cascade.total_exposure_cap_u, 1)}u`);
  } else {
    for (const b of elig) {
      checks.push(
        `Over ${fmt(b.target_line ?? b.band, 1)} — min acceptable odds ${fmt(b.min_acceptable_odds, 2)}`,
      );
    }
  }

  const weatherNote =
    warn || w.roofed
      ? ""
      : `<div style="margin-top:6px;font-style:italic;">Stake guide applies only if weather passes.</div>`;
  const statusText = warn ? warn.statusText : w.status;

  return `
    <div style="border:1px solid #ddd;padding:10px 12px;margin:10px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55;">
      <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${esc(c.home)} v ${esc(c.away)} — ${esc(c.venue)}</div>
      ${warn ? warningBlockHtml(warn) : ""}
      <div>Main total: ${fmt(c.main_total, 1)}</div>
      <div>Base model side: ${esc(side)}</div>
      <div>Weather: ${esc(w.weather)}</div>
      <div>Status: ${esc(statusText)}</div>
      <div style="margin-top:6px;">Model output:</div>
      <ul style="margin:2px 0 0 18px;padding:0;">
        ${checks.map((c) => `<li>${c}</li>`).join("")}
      </ul>
      ${weatherNote}
    </div>`;
}

function renderAltText(c: Candidate): string {
  const elig = eligibleAltBands(c);
  if (!elig.length) return "";
  const w = weatherStatus(c);
  const warn = warningInfo(c);
  const side = readableLean(c.main_lean);
  const statusText = warn ? warn.statusText : w.status;
  const lines: string[] = [];
  lines.push(`${c.home} v ${c.away} — ${c.venue}`);
  lines.push(`  Main total: ${fmt(c.main_total, 1)}`);
  lines.push(`  Base model side: ${side}`);
  lines.push(`  Weather: ${w.weather}`);
  lines.push(`  Status: ${statusText}`);
  if (warn) lines.push(warningBlockText(warn));
  lines.push(`  Model output:`);
  if (warn) {
    for (const b of elig) {
      lines.push(
        `    - Over ${fmt(b.target_line ?? b.band, 1)}: technically eligible (min odds ${fmt(b.min_acceptable_odds, 2)})`,
      );
    }
  } else if (c.cascade) {
    const a = c.cascade.anchor;
    lines.push(
      `    - Anchor: Over ${fmt(a.target_line ?? a.band, 1)} — ${fmt(a.stake_u, 1)}u if odds >= ${fmt(a.min_acceptable_odds, 2)}`,
    );
    if (c.cascade.upside) {
      const u = c.cascade.upside;
      lines.push(
        `    - Upside: Over ${fmt(u.target_line ?? u.band, 1)} — ${fmt(u.stake_u, 1)}u if odds >= ${fmt(u.min_acceptable_odds, 2)}`,
      );
    }
    lines.push(`    - Cap: ${fmt(c.cascade.total_exposure_cap_u, 1)}u`);
  } else {
    for (const b of elig) {
      lines.push(
        `    - Over ${fmt(b.target_line ?? b.band, 1)}: min odds ${fmt(b.min_acceptable_odds, 2)}`,
      );
    }
  }
  if (!warn && !w.roofed)
    lines.push(`  Stake guide applies only if weather passes.`);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") ?? "";
    const toEmail = Deno.env.get("PERS_SYS_ALERT_TO_EMAIL") ?? "";
    const messageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "outbound";

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_supabase_env" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!postmarkToken || !fromEmail || !toEmail) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_email_secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const daysAhead = Number(body.days_ahead ?? 10);
    const dryRun = body.dry_run === true;
    const seedWeather = dryRun
      ? body.seed_weather === true
      : body.seed_weather !== false;

    const loadReport = async () => {
      const reportRes = await fetch(
        `${supabaseUrl}/functions/v1/pers-sys-sys10a-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ days_ahead: daysAhead }),
        },
      );
      const reportJson = await reportRes.json().catch(() => null);
      if (!reportRes.ok || !reportJson?.ok) {
        throw { status: reportRes.status, response: reportJson };
      }
      return reportJson;
    };

    let reportJson: any;
    let weatherSeed: WeatherSeedResult = {
      attempted: false,
      game_ids: [],
      errors: [],
    };
    try {
      const initialReportJson = await loadReport();
      reportJson = initialReportJson;
      if (seedWeather) {
        const seedGameIds = uniqueGuideGameIds(
          (initialReportJson.candidates ?? []) as Candidate[],
        );
        weatherSeed = await seedSys10aWeatherForGuideGames(
          supabaseUrl,
          anonKey,
          seedGameIds,
        );
        // Reload the read-only report so the email renders the assessments just seeded.
        reportJson = await loadReport();
      }
    } catch (err) {
      const e = err as { status?: number; response?: unknown };
      return new Response(
        JSON.stringify({
          ok: false,
          error: "sys10a_report_failed",
          status: e.status,
          response: e.response ?? err,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const all = (reportJson.candidates ?? []) as Candidate[];
    const candidates = all.filter((c) => c.status === "CANDIDATE");
    const suppressed = all.filter((c) => c.status === "SUPPRESSED");
    const suppression_breakdown = reportJson.suppression_breakdown ?? {};

    const mainSection = candidates.filter(
      (c) =>
        (c.main_lean === "MAIN_TOTAL_OVER" ||
          c.main_lean === "MAIN_TOTAL_UNDER") &&
        (c.main_stake_guidance_u ?? 0) > 0,
    );
    const altSection = candidates.filter((c) => eligibleAltBands(c).length > 0);

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "no_actionable_candidates",
          evaluated: all.length,
          suppressed_count: suppressed.length,
          suppression_breakdown,
          weather_seed: weatherSeed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = `SYS_10A Total Guide — ${candidates.length} check(s)`;

    const suppressionEntries = Object.entries(suppression_breakdown);
    const suppressionFooterHtml = suppressionEntries.length
      ? `<ul style="margin:4px 0 0 18px;padding:0;">${suppressionEntries
          .map(([k, v]) => `<li>${esc(readableSuppression(k))}: ${esc(v)}</li>`)
          .join("")}</ul>`
      : "<p style='margin:4px 0 0 0;color:#666;'>None.</p>";

    const htmlBody = `
      <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
        <h2 style="margin:0 0 10px 0;">SYS_10A Total Guide</h2>
        <p style="margin:0 0 10px 0;padding:6px 8px;border:1px dashed #999;color:#333;font-size:12px;">
          Weather is displayed for information only; SYS_10A stake and pick logic are unchanged in W1.
        </p>

        <h3 style="margin:16px 0 4px 0;">Main Total Checks</h3>
        ${mainSection.length ? mainSection.map(renderMainHtml).join("") : "<p style='color:#666;'>None.</p>"}

        <h3 style="margin:20px 0 4px 0;">Alt-Over Checks</h3>
        ${altSection.length ? altSection.map(renderAltHtml).join("") : "<p style='color:#666;'>None.</p>"}

        <h3 style="margin:24px 0 4px 0;">NO-ACTION NOTES</h3>
        ${suppressionFooterHtml}

        <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
        <p style="margin:6px 0;color:#666;font-size:12px;">
          Generated: ${esc(reportJson.generated_at)} · Actionable checks: ${candidates.length} · Suppressed: ${suppressed.length} · Weather seed errors: ${weatherSeed.errors.length}
        </p>
        <p style="margin:6px 0;color:#666;font-size:12px;">
          SYS_10A is a manual guide only. It does not place bets or create ACTION NOW alerts.
        </p>
      </div>`;

    const textBody = [
      "SYS_10A Total Guide",
      "",
      "Weather is displayed for information only; SYS_10A stake and pick logic are unchanged in W1.",
      "",
      "Main Total Checks",
      mainSection.length
        ? mainSection.map(renderMainText).join("\n\n")
        : "  None.",
      "",
      "Alt-Over Checks",
      altSection.length
        ? altSection.map(renderAltText).join("\n\n")
        : "  None.",
      "",
      "NO-ACTION NOTES",
      suppressionEntries.length
        ? suppressionEntries
            .map(([k, v]) => `  - ${readableSuppression(k)}: ${v}`)
            .join("\n")
        : "  None.",
      "",
      "---",
      `Generated: ${reportJson.generated_at} | Actionable checks: ${candidates.length} | Suppressed: ${suppressed.length} | Weather seed errors: ${weatherSeed.errors.length}`,
      "SYS_10A is a manual guide only. It does not place bets or create ACTION NOW alerts.",
    ].join("\n");

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          seed_weather: seedWeather,
          dry_run_weather_seed_writes_possible: seedWeather,
          subject,
          actionable_candidates: candidates.length,
          suppressed_count: suppressed.length,
          suppression_breakdown,
          main_section_count: mainSection.length,
          alt_section_count: altSection.length,
          weather_seed: weatherSeed,
          html: htmlBody,
          text: textBody,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const postmarkPayload = {
      From: fromEmail,
      To: toEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: messageStream,
      Tag: "sys10a-manual-guide",
    };

    const pm = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": postmarkToken,
      },
      body: JSON.stringify(postmarkPayload),
    });
    const pmText = await pm.text();
    const pmParsed = (() => {
      try {
        return JSON.parse(pmText);
      } catch {
        return pmText;
      }
    })();

    if (!pm.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "postmark_send_failed",
          postmark_status: pm.status,
          postmark_response: pmParsed,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: true,
        actionable_candidates: candidates.length,
        suppressed_count: suppressed.length,
        suppression_breakdown,
        weather_seed: weatherSeed,
        subject,
        postmark_response: pmParsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sys10a-notify error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
