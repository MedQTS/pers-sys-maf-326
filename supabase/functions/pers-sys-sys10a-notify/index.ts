// SYS_10A Manual Total Guide — notification pathway.
//
// Fully isolated from the ACTION NOW / T30 alerter.
// - Calls pers-sys-sys10a-report (read-only).
// - Sends a single Postmark email if at least one ACTIONABLE candidate exists.
// - No DB writes. No signals. No bet RPCs. No alert dedupe tables touched.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MANUAL_NOTICE =
  "SYS_10A filters alternate-over suggestions to lines plausibly near the current main total. It still does not ingest live alternate-total ladders. Only place manually if the listed line and odds are actually available.";

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
  cascade?: null | {
    total_exposure_cap_u: number;
    anchor: { band: number; target_line?: number; stake_u: number; min_acceptable_odds: number | null; note: string };
    upside: null | { band: number; target_line?: number; stake_u: number; min_acceptable_odds: number | null; note: string };
  };
  venue_caution?: string[];
  samples?: { home_home_games: number; away_away_games: number; venue_games: number };
  status: "CANDIDATE" | "SUPPRESSED";
  suppression_reason?: string | null;
  alt_over_suppressed_due_main_under_lean?: boolean;
  recent_form_overlay_applied?: boolean;
  recent_form_overlay_action?: string;
  overlay_warnings?: string[];
};

function hasRecentFormOverWarning(c: Candidate): boolean {
  return (
    c.main_lean === "MAIN_TOTAL_OVER" &&
    !!c.recent_form_overlay_applied &&
    (c.overlay_warnings ?? []).includes("recent_form_conflicts_with_main_over")
  );

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function eligibleAltBands(c: Candidate): AltBand[] {
  return (c.alt_bands ?? []).filter((b) => b.eligible === true);
}

function renderMainHtml(c: Candidate): string {
  const warn = hasRecentFormOverWarning(c)
    ? `<div style="margin-top:6px;padding:6px 8px;background:#fff7cc;border:1px solid #e0c200;">⚠ Recent 5-game scoring profile is below the current main total; manual caution required.</div>`
    : "";
  return `
    <div style="border:1px solid #ddd;padding:10px 12px;margin:10px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;">
      <div style="font-weight:bold;font-size:14px;">${esc(c.home)} vs ${esc(c.away)} — ${esc(c.venue)}</div>
      <div>Main total: <strong>${c.main_total ?? "—"}</strong> | Over ${c.over_price ?? "—"} / Under ${c.under_price ?? "—"}</div>
      <div>Estimated total: ${c.estimated_total ?? "—"} | Edge: ${c.main_edge ?? "—"} | Lean: <strong>${esc(c.main_lean)}</strong> | Main stake guidance: ${c.main_stake_guidance_u ?? 0}u</div>
      ${warn}
    </div>`;
}

function renderAltHtml(c: Candidate): string {
  const elig = eligibleAltBands(c);
  if (!elig.length) return "";
  const rows = elig
    .map((b) => `<li>Over ${b.target_line ?? b.band}: min acceptable odds <strong>${b.min_acceptable_odds ?? "—"}</strong> (gap ${b.alt_gap ?? "—"})</li>`)
    .join("");
  const cascade = c.cascade
    ? `<p style="margin:6px 0 0 0;"><strong>Cascade guide</strong> (cap ${c.cascade.total_exposure_cap_u}u):</p>
       <ul style="margin:4px 0 0 18px;padding:0;">
         <li>Anchor — Over ${c.cascade.anchor.target_line ?? c.cascade.anchor.band}: ${c.cascade.anchor.stake_u}u if odds &ge; ${c.cascade.anchor.min_acceptable_odds ?? "—"}</li>
         ${c.cascade.upside ? `<li>Upside — Over ${c.cascade.upside.target_line ?? c.cascade.upside.band}: ${c.cascade.upside.stake_u}u if odds &ge; ${c.cascade.upside.min_acceptable_odds ?? "—"}</li>` : ""}
       </ul>`
    : "";
  return `
    <div style="border:1px solid #ddd;padding:10px 12px;margin:10px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;">
      <div style="font-weight:bold;font-size:14px;">${esc(c.home)} vs ${esc(c.away)} — ${esc(c.venue)}</div>
      <div>Main total: <strong>${c.main_total ?? "—"}</strong> | Lean: <strong>${esc(c.main_lean)}</strong></div>
      <p style="margin:6px 0 0 0;"><strong>Market-near alt-over candidates:</strong></p>
      <ul style="margin:4px 0 0 18px;padding:0;">${rows}</ul>
      ${cascade}
    </div>`;
}

function renderMainText(c: Candidate): string {
  return [
    `${c.home} vs ${c.away} — ${c.venue}`,
    `  Main total: ${c.main_total} | Over ${c.over_price} / Under ${c.under_price}`,
    `  Est total: ${c.estimated_total} | Edge: ${c.main_edge} | Lean: ${c.main_lean} | Main stake: ${c.main_stake_guidance_u ?? 0}u`,
  ].join("\n");
}

function renderAltText(c: Candidate): string {
  const elig = eligibleAltBands(c);
  if (!elig.length) return "";
  const lines: string[] = [];
  lines.push(`${c.home} vs ${c.away} — ${c.venue}`);
  lines.push(`  Main total: ${c.main_total} | Lean: ${c.main_lean}`);
  lines.push(`  Market-near alt-over candidates:`);
  for (const b of elig) {
    lines.push(`    - Over ${b.target_line ?? b.band}: min odds ${b.min_acceptable_odds} (gap ${b.alt_gap})`);
  }
  if (c.cascade) {
    lines.push(`  Cascade (cap ${c.cascade.total_exposure_cap_u}u):`);
    lines.push(`    Anchor Over ${c.cascade.anchor.target_line ?? c.cascade.anchor.band}: ${c.cascade.anchor.stake_u}u if odds >= ${c.cascade.anchor.min_acceptable_odds}`);
    if (c.cascade.upside) {
      lines.push(`    Upside Over ${c.cascade.upside.target_line ?? c.cascade.upside.band}: ${c.cascade.upside.stake_u}u if odds >= ${c.cascade.upside.min_acceptable_odds}`);
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") ?? "";
    const toEmail = Deno.env.get("PERS_SYS_ALERT_TO_EMAIL") ?? "";
    const messageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "outbound";

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!postmarkToken || !fromEmail || !toEmail) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_email_secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const daysAhead = Number(body.days_ahead ?? 10);
    const dryRun = body.dry_run === true;

    const reportRes = await fetch(`${supabaseUrl}/functions/v1/pers-sys-sys10a-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ days_ahead: daysAhead }),
    });
    const reportJson = await reportRes.json().catch(() => null);

    if (!reportRes.ok || !reportJson?.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "sys10a_report_failed", status: reportRes.status, response: reportJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const all = (reportJson.candidates ?? []) as Candidate[];
    const candidates = all.filter((c) => c.status === "CANDIDATE");
    const suppressed = all.filter((c) => c.status === "SUPPRESSED");
    const suppression_breakdown = reportJson.suppression_breakdown ?? {};

    // Section A: main over/under with stake guidance > 0
    const mainSection = candidates.filter(
      (c) => (c.main_lean === "MAIN_TOTAL_OVER" || c.main_lean === "MAIN_TOTAL_UNDER") && (c.main_stake_guidance_u ?? 0) > 0,
    );
    // Section B: any eligible alt-over band (already filtered by report)
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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = `SYS_10A Manual Total Guide — ${candidates.length} actionable candidate(s)`;

    const suppressionSummaryHtml = Object.keys(suppression_breakdown).length
      ? `<ul style="margin:4px 0 0 18px;padding:0;">${Object.entries(suppression_breakdown)
          .map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`)
          .join("")}</ul>`
      : "<p style='margin:4px 0 0 0;color:#666;'>None.</p>";

    const htmlBody = `
      <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
        <h2 style="margin:0 0 8px 0;">SYS_10A Manual Total Guide</h2>
        <p style="margin:0 0 6px 0;background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;">
          <strong>MANUAL CHECK ONLY.</strong> No bet has been placed.
        </p>
        <p style="margin:8px 0;">${esc(MANUAL_NOTICE)}</p>
        <p style="margin:8px 0;color:#444;">Actionable: <strong>${candidates.length}</strong> · Suppressed: ${suppressed.length} · Generated: ${esc(reportJson.generated_at)}</p>

        <h3 style="margin:16px 0 4px 0;">A. Main Total Manual Checks</h3>
        ${mainSection.length ? mainSection.map(renderMainHtml).join("") : "<p style='color:#666;'>None.</p>"}

        <h3 style="margin:16px 0 4px 0;">B. Alt-Over Manual Checks</h3>
        ${altSection.length ? altSection.map(renderAltHtml).join("") : "<p style='color:#666;'>None.</p>"}

        <h3 style="margin:16px 0 4px 0;">C. Suppression Summary</h3>
        ${suppressionSummaryHtml}

        <p style="margin-top:16px;color:#666;font-size:12px;">
          SYS_10A is not a live system. It does not create ACTION NOW alerts and cannot accept bets.
        </p>
      </div>`;

    const textBody = [
      "SYS_10A Manual Total Guide",
      "MANUAL CHECK ONLY. No bet has been placed.",
      "",
      MANUAL_NOTICE,
      "",
      `Actionable: ${candidates.length} | Suppressed: ${suppressed.length} | Generated: ${reportJson.generated_at}`,
      "",
      "A. Main Total Manual Checks",
      mainSection.length ? mainSection.map(renderMainText).join("\n\n") : "  None.",
      "",
      "B. Alt-Over Manual Checks",
      altSection.length ? altSection.map(renderAltText).join("\n\n") : "  None.",
      "",
      "C. Suppression Summary",
      Object.keys(suppression_breakdown).length
        ? Object.entries(suppression_breakdown).map(([k, v]) => `  - ${k}: ${v}`).join("\n")
        : "  None.",
      "",
      "SYS_10A is not a live system. It does not create ACTION NOW alerts and cannot accept bets.",
    ].join("\n");

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          subject,
          actionable_candidates: candidates.length,
          suppressed_count: suppressed.length,
          suppression_breakdown,
          main_section_count: mainSection.length,
          alt_section_count: altSection.length,
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
    const pmParsed = (() => { try { return JSON.parse(pmText); } catch { return pmText; } })();

    if (!pm.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "postmark_send_failed", postmark_status: pm.status, postmark_response: pmParsed }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: true,
        actionable_candidates: candidates.length,
        suppressed_count: suppressed.length,
        suppression_breakdown,
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
