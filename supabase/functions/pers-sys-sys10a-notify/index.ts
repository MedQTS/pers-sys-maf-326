// SYS_10A Manual Total Guide — notification pathway.
//
// Fully isolated from the ACTION NOW / T30 alerter.
// - Calls pers-sys-sys10a-report (read-only).
// - Sends a single Postmark email if at least one CANDIDATE exists.
// - No DB writes. No signals. No bet RPCs. No alert dedupe tables touched.
// - Does NOT modify pers_sys_signals_v2, pers_sys_systems_v2, enums, or schema.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MANUAL_NOTICE =
  "Manual check only. SYS_10A has not seen bookmaker alternate-total ladders. Only place an alternate-over manually if the bookmaker line and price are available at or above the listed minimum acceptable odds.";

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
  alt_bands?: Array<{ band: number; clearance: number | null; candidate: boolean; min_acceptable_odds: number | null }>;
  cascade?: null | {
    total_exposure_cap_u: number;
    anchor: { band: number; stake_u: number; min_acceptable_odds: number | null; note: string };
    upside: { band: number; stake_u: number; min_acceptable_odds: number | null; note: string };
  };
  venue_caution?: string[];
  samples?: { home_home_games: number; away_away_games: number; venue_games: number };
  status: "CANDIDATE" | "SUPPRESSED";
  suppression_reason?: string | null;
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCandidateHtml(c: Candidate): string {
  const altRows = (c.alt_bands ?? [])
    .filter((b) => b.candidate)
    .map(
      (b) =>
        `<li>Over ${b.band}: clearance ${b.clearance ?? "—"}, min acceptable odds <strong>${b.min_acceptable_odds ?? "—"}</strong></li>`,
    )
    .join("");

  const cascade = c.cascade
    ? `<p style="margin:6px 0 0 0;"><strong>Cascade guide</strong> (cap ${c.cascade.total_exposure_cap_u}u):</p>
       <ul style="margin:4px 0 0 18px;padding:0;">
         <li>Anchor — Over ${c.cascade.anchor.band}: ${c.cascade.anchor.stake_u}u if odds &ge; ${c.cascade.anchor.min_acceptable_odds ?? "—"}</li>
         <li>Upside — Over ${c.cascade.upside.band}: ${c.cascade.upside.stake_u}u if odds &ge; ${c.cascade.upside.min_acceptable_odds ?? "—"}</li>
       </ul>`
    : "";

  const cautions = (c.venue_caution ?? []).length
    ? `<p style="margin:6px 0 0 0;color:#a15c00;">Venue caution: ${esc((c.venue_caution ?? []).join(", "))}</p>`
    : "";

  return `
    <div style="border:1px solid #ddd;padding:10px 12px;margin:10px 0;font-family:ui-monospace,Menlo,monospace;font-size:13px;">
      <div style="font-weight:bold;font-size:14px;">${esc(c.home)} vs ${esc(c.away)} — ${esc(c.venue)}</div>
      <div>Main total: <strong>${c.main_total ?? "—"}</strong> | Over ${c.over_price ?? "—"} / Under ${c.under_price ?? "—"}</div>
      <div>Estimated total: ${c.estimated_total ?? "—"} | Edge: ${c.main_edge ?? "—"} | Lean: <strong>${esc(c.main_lean)}</strong> | Main stake guidance: ${c.main_stake_guidance_u ?? 0}u</div>
      ${altRows ? `<p style="margin:6px 0 0 0;"><strong>Passing alt bands:</strong></p><ul style="margin:4px 0 0 18px;padding:0;">${altRows}</ul>` : `<p style="margin:6px 0 0 0;color:#666;">No passing alt bands.</p>`}
      ${cascade}
      ${cautions}
      <div style="color:#666;margin-top:6px;">Samples: home(H) ${c.samples?.home_home_games ?? 0} · away(A) ${c.samples?.away_away_games ?? 0} · venue ${c.samples?.venue_games ?? 0}</div>
    </div>`;
}

function renderCandidateText(c: Candidate): string {
  const lines: string[] = [];
  lines.push(`${c.home} vs ${c.away} — ${c.venue}`);
  lines.push(`  Main total: ${c.main_total} | Over ${c.over_price} / Under ${c.under_price}`);
  lines.push(`  Est total: ${c.estimated_total} | Edge: ${c.main_edge} | Lean: ${c.main_lean} | Main stake: ${c.main_stake_guidance_u ?? 0}u`);
  const passing = (c.alt_bands ?? []).filter((b) => b.candidate);
  if (passing.length) {
    lines.push(`  Passing alt bands:`);
    for (const b of passing) {
      lines.push(`    - Over ${b.band}: clearance ${b.clearance}, min odds ${b.min_acceptable_odds}`);
    }
  } else {
    lines.push(`  No passing alt bands.`);
  }
  if (c.cascade) {
    lines.push(`  Cascade (cap ${c.cascade.total_exposure_cap_u}u):`);
    lines.push(`    Anchor Over ${c.cascade.anchor.band}: ${c.cascade.anchor.stake_u}u if odds >= ${c.cascade.anchor.min_acceptable_odds}`);
    lines.push(`    Upside Over ${c.cascade.upside.band}: ${c.cascade.upside.stake_u}u if odds >= ${c.cascade.upside.min_acceptable_odds}`);
  }
  if ((c.venue_caution ?? []).length) {
    lines.push(`  Venue caution: ${(c.venue_caution ?? []).join(", ")}`);
  }
  lines.push(`  Samples: home(H) ${c.samples?.home_home_games ?? 0} | away(A) ${c.samples?.away_away_games ?? 0} | venue ${c.samples?.venue_games ?? 0}`);
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

    // Call read-only report function
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

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "no_candidates",
          inspected: all.length,
          suppressed_count: suppressed.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = `SYS_10A Manual Total Guide — ${candidates.length} candidate(s)`;

    const htmlBody = `
      <div style="font-family:ui-monospace,Menlo,monospace;color:#111;">
        <h2 style="margin:0 0 8px 0;">SYS_10A Manual Total Guide</h2>
        <p style="margin:0 0 6px 0;background:#fff7cc;border:1px solid #e0c200;padding:8px 10px;">
          <strong>MANUAL CHECK ONLY.</strong> No bet has been placed. No alternate-line market has been ingested.
        </p>
        <p style="margin:8px 0;">${esc(MANUAL_NOTICE)}</p>
        <p style="margin:8px 0;color:#444;">Candidates: <strong>${candidates.length}</strong> · Suppressed: ${suppressed.length} · Generated: ${esc(reportJson.generated_at)}</p>
        ${candidates.map(renderCandidateHtml).join("")}
        <p style="margin-top:16px;color:#666;font-size:12px;">
          SYS_10A is not a live system. It does not create ACTION NOW alerts and cannot accept bets.
        </p>
      </div>`;

    const textBody = [
      "SYS_10A Manual Total Guide",
      "MANUAL CHECK ONLY. No bet has been placed. No alternate-line market has been ingested.",
      "",
      MANUAL_NOTICE,
      "",
      `Candidates: ${candidates.length} | Suppressed: ${suppressed.length} | Generated: ${reportJson.generated_at}`,
      "",
      candidates.map(renderCandidateText).join("\n\n"),
      "",
      "SYS_10A is not a live system. It does not create ACTION NOW alerts and cannot accept bets.",
    ].join("\n");

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, dry_run: true, subject, candidate_count: candidates.length, html: htmlBody, text: textBody }),
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
        candidate_count: candidates.length,
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
