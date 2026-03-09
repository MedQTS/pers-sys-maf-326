import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SignalRow = {
  id: string;
  game_id: string;
  system_code: string;
  model_snapshot: string | null;
  execution_snapshot: string | null;
  signal_status: string | null;
  pass: boolean | null;
  leg_type: string | null;
  side: string | null;
  line_at_bet: number | null;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  recommended_units: number | null;
  reason_json: unknown;
  created_at: string;
};

type BetRow = {
  id: string;
  game_id: string;
  system_code: string;
  leg_type: string | null;
  side: string | null;
  line_at_bet: number | null;
  price: number | null;
  book: string | null;
  stake_amount: number | null;
  units: number | null;
  status: string | null;
  created_at: string;
};

type AlertItemRow = {
  id: string;
  game_id: string;
  snapshot_type: string;
  bet_fingerprint: string;
  change_hash: string;
  system_code: string;
  leg_type: string;
  side: string;
  line_at_bet: number | null;
  book: string | null;
  price: number | null;
  stake_amount: number | null;
  status_label: string;
  created_at: string;
};

type GameRow = {
  id: string;
  venue: string | null;
  round: number | null;
  start_time_aet: string | null;
  home_team?: { canonical_name?: string | null } | null;
  away_team?: { canonical_name?: string | null } | null;
};

type PreviewResult = {
  ok: boolean;
  status?: string | null;
  price?: number | null;
  book?: string | null;
  units?: number | null;
  stake_amount?: number | null;
  bankroll_snapshot?: number | null;
  one_u_pct?: number | null;
  error?: string | null;
};

type CandidateRow = {
  signal: SignalRow;
  game: GameRow | null;
  preview: PreviewResult;
  betFingerprint: string;
  changeHash: string;
  statusLabel: "NEW" | "CHANGED" | "PREVIOUSLY_SENT";
  textLine: string;
};

function safeJson(x: unknown): Record<string, unknown> | null {
  if (x == null) return null;
  if (typeof x === "object") return x as Record<string, unknown>;
  try {
    return JSON.parse(String(x));
  } catch {
    return null;
  }
}

function fmtLine(n: number | null | undefined): string {
  if (n == null) return "";
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return `${v > 0 ? "+" : ""}${v}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function fmtStake(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

function gameLabel(game: GameRow | null): string {
  const home = game?.home_team?.canonical_name ?? "?";
  const away = game?.away_team?.canonical_name ?? "?";
  return `${home} v ${away}`;
}

function ruleSummary(signal: SignalRow): string {
  const r = safeJson(signal.reason_json) || {};

  const overlayChild = r["overlay_child"];
  if (overlayChild && typeof overlayChild === "object") {
    const oc = overlayChild as Record<string, unknown>;
    const market = oc["market"];
    const req = oc["required_execution_snapshot"];
    if (typeof market === "string" && market) {
      return req ? `Overlay ${market} requires ${String(req)}` : `Overlay ${market}`;
    }
  }

  const overlay = r["overlay"];
  if (overlay && typeof overlay === "object") {
    const ov = overlay as Record<string, unknown>;
    const type = ov["type"];
    const dep = ov["depends_on"];
    if (typeof type === "string" && type) {
      return dep ? `Overlay ${type} depends on ${String(dep)}` : `Overlay ${type}`;
    }
  }

  const clvMin = r["clv_min"] ?? r["clv_required_min"];
  if (clvMin != null && Number.isFinite(Number(clvMin))) {
    return `CLV > ${Number(clvMin)}`;
  }

  return "T30 READY";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stableBetFingerprint(signal: SignalRow): string {
  const legType = String(signal.leg_type ?? "").toUpperCase();
  const side = String(signal.side ?? "").toUpperCase();
  const line = signal.line_at_bet == null ? "" : String(Number(signal.line_at_bet));
  return [
    signal.game_id,
    signal.system_code,
    legType,
    side,
    line,
  ].join("|");
}

async function changeHashForRow(signal: SignalRow, preview: PreviewResult): Promise<string> {
  const payload = [
    signal.game_id,
    signal.system_code,
    String(signal.leg_type ?? "").toUpperCase(),
    String(signal.side ?? "").toUpperCase(),
    signal.line_at_bet == null ? "" : String(Number(signal.line_at_bet)),
    preview.book ?? "",
    preview.price == null ? "" : String(Number(preview.price)),
    preview.stake_amount == null ? "" : String(Number(preview.stake_amount)),
  ].join("|");

  return await sha256Hex(payload);
}

function betMatchesLogged(signal: SignalRow, bet: BetRow): boolean {
  if (signal.game_id !== bet.game_id) return false;
  if (signal.system_code !== bet.system_code) return false;
  if (String(signal.leg_type ?? "").toUpperCase() !== String(bet.leg_type ?? "").toUpperCase()) return false;
  if (String(signal.side ?? "").toUpperCase() !== String(bet.side ?? "").toUpperCase()) return false;

  const legType = String(signal.leg_type ?? "").toUpperCase();
  if (legType === "LINE") {
    return Number(signal.line_at_bet ?? 0) === Number(bet.line_at_bet ?? 0);
  }

  return true;
}

function buildTextLine(row: CandidateRow): string {
  const signal = row.signal;
  const game = row.game;
  const preview = row.preview;

  const gameText = gameLabel(game);
  const venue = game?.venue ?? "—";
  const market = String(signal.leg_type ?? "?").toUpperCase();
  const side = String(signal.side ?? "?").toUpperCase();
  const line = market === "LINE" ? ` ${fmtLine(signal.line_at_bet)}` : "";
  const price = fmtPrice(preview.price ?? signal.exec_best_price ?? signal.ref_price ?? null);
  const stake = fmtStake(preview.stake_amount ?? null);
  const book = preview.book ?? signal.exec_best_book ?? "—";
  const rule = ruleSummary(signal);

  return `[${row.statusLabel}] ${gameText} | ${venue} | ${signal.system_code} | ${market} ${side}${line} | @${price} | $${stake} | ${book} | Rule: ${rule}`;
}

function sortCandidates(a: CandidateRow, b: CandidateRow): number {
  const ta = a.game?.start_time_aet ? new Date(a.game.start_time_aet).getTime() : 0;
  const tb = b.game?.start_time_aet ? new Date(b.game.start_time_aet).getTime() : 0;
  if (ta !== tb) return ta - tb;
  if (a.signal.system_code !== b.signal.system_code) return a.signal.system_code.localeCompare(b.signal.system_code);
  return a.textLine.localeCompare(b.textLine);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") ?? "";
    const toEmail = Deno.env.get("PERS_SYS_ALERT_TO_EMAIL") ?? "";
    const messageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "outbound";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!postmarkToken || !fromEmail || !toEmail) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_email_secrets",
          has_POSTMARK_SERVER_TOKEN: Boolean(postmarkToken),
          has_POSTMARK_FROM_EMAIL: Boolean(fromEmail),
          has_PERS_SYS_ALERT_TO_EMAIL: Boolean(toEmail),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const snapshotType = "T30";
    const dryRun = body["dry_run"] === true;
    const onlyGameId = typeof body["game_id"] === "string" && body["game_id"].trim()
      ? body["game_id"].trim()
      : null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let signalsQuery = supabase
      .from("pers_sys_signals_v2")
      .select("id,game_id,system_code,model_snapshot,execution_snapshot,signal_status,pass,leg_type,side,line_at_bet,ref_price,exec_best_price,exec_best_book,recommended_units,reason_json,created_at")
      .eq("execution_snapshot", snapshotType)
      .eq("signal_status", "READY")
      .order("created_at", { ascending: false });

    if (onlyGameId) {
      signalsQuery = signalsQuery.eq("game_id", onlyGameId);
    }

    const { data: signalsData, error: signalsErr } = await signalsQuery;
    if (signalsErr) throw signalsErr;

    const signals = (signalsData ?? []) as SignalRow[];
    if (signals.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: dryRun,
          snapshot_type: snapshotType,
          sent: false,
          skipped_reason: "no_ready_t30_signals",
          counts: { ready_signals: 0, action_now: 0, previously_sent: 0, logged_excluded: 0 },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gameIds = Array.from(new Set(signals.map((s) => s.game_id)));

    const { data: gamesData, error: gamesErr } = await supabase
      .from("pers_sys_games")
      .select(`
        id,
        venue,
        round,
        start_time_aet,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)
      `)
      .in("id", gameIds);

    if (gamesErr) throw gamesErr;

    const gamesById = new Map<string, GameRow>(
      ((gamesData ?? []) as GameRow[]).map((g) => [g.id, g]),
    );

    const { data: betsData, error: betsErr } = await supabase
      .from("pers_sys_bets")
      .select("id,game_id,system_code,leg_type,side,line_at_bet,price,book,stake_amount,units,status,created_at")
      .in("game_id", gameIds)
      .eq("status", "UNSETTLED");

    if (betsErr) throw betsErr;

    const unsettledBets = (betsData ?? []) as BetRow[];

    const { data: priorItemsData, error: priorItemsErr } = await supabase
      .from("pers_sys_email_alert_items")
      .select("id,game_id,snapshot_type,bet_fingerprint,change_hash,system_code,leg_type,side,line_at_bet,book,price,stake_amount,status_label,created_at")
      .in("game_id", gameIds)
      .eq("snapshot_type", snapshotType)
      .order("created_at", { ascending: false });

    if (priorItemsErr) throw priorItemsErr;

    const priorItems = (priorItemsData ?? []) as AlertItemRow[];
    const latestByFingerprint = new Map<string, AlertItemRow>();
    for (const item of priorItems) {
      if (!latestByFingerprint.has(item.bet_fingerprint)) {
        latestByFingerprint.set(item.bet_fingerprint, item);
      }
    }

    const loggedExcluded: SignalRow[] = [];
    const candidateSignals = signals.filter((signal) => {
      const matched = unsettledBets.some((bet) => betMatchesLogged(signal, bet));
      if (matched) loggedExcluded.push(signal);
      return !matched;
    });

    const candidateRows: CandidateRow[] = [];
    for (const signal of candidateSignals) {
      const previewUnits =
        signal.system_code === "SYS_7"
          ? (signal.recommended_units ?? Number(safeJson(signal.reason_json)?.["recommended_units"] ?? null))
          : null;

      const { data: previewData, error: previewErr } = await supabase.rpc("preview_leg_stake", {
        p_game_id: signal.game_id,
        p_system_code: signal.system_code,
        p_leg_type: signal.leg_type,
        p_side: signal.side,
        p_line_at_bet: signal.line_at_bet ?? null,
        p_exec_best_price: signal.exec_best_price ?? null,
        p_exec_best_book: signal.exec_best_book ?? null,
        p_ref_price: signal.ref_price ?? null,
        p_units: Number.isFinite(Number(previewUnits)) ? Number(previewUnits) : null,
        p_snapshot_type: signal.execution_snapshot ?? signal.model_snapshot ?? null,
      });

      if (previewErr) {
        continue;
      }

      const preview = (previewData ?? null) as PreviewResult | null;
      if (!preview?.ok || preview.stake_amount == null) {
        continue;
      }

      const betFingerprint = stableBetFingerprint(signal);
      const changeHash = await changeHashForRow(signal, preview);
      const prior = latestByFingerprint.get(betFingerprint);

      let statusLabel: "NEW" | "CHANGED" | "PREVIOUSLY_SENT" = "NEW";
      if (prior) {
        statusLabel = prior.change_hash === changeHash ? "PREVIOUSLY_SENT" : "CHANGED";
      }

      const row: CandidateRow = {
        signal,
        game: gamesById.get(signal.game_id) ?? null,
        preview,
        betFingerprint,
        changeHash,
        statusLabel,
        textLine: "",
      };
      row.textLine = buildTextLine(row);
      candidateRows.push(row);
    }

    candidateRows.sort(sortCandidates);

    const actionRows = candidateRows.filter((r) => r.statusLabel === "NEW" || r.statusLabel === "CHANGED");
    const previousRows = candidateRows.filter((r) => r.statusLabel === "PREVIOUSLY_SENT");

    if (actionRows.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: dryRun,
          snapshot_type: snapshotType,
          sent: false,
          skipped_reason: "no_actionable_rows",
          counts: {
            ready_signals: signals.length,
            candidates_after_logged_filter: candidateRows.length,
            action_now: actionRows.length,
            previously_sent: previousRows.length,
            logged_excluded: loggedExcluded.length,
          },
          preview: {
            action_now: actionRows.map((r) => r.textLine),
            previously_sent: previousRows.map((r) => r.textLine),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const actionSection = [
      "ACTION NOW",
      "----------",
      ...actionRows.map((r) => r.textLine),
    ];

    const previousSection = previousRows.length > 0
      ? [
          "",
          "PREVIOUSLY SENT — BET NOT LOGGED",
          "--------------------------------",
          ...previousRows.map((r) => r.textLine),
        ]
      : [];

    const footer = [
      "",
      `Snapshot: ${snapshotType}`,
      `Action count: ${actionRows.length}`,
      `Previously sent count: ${previousRows.length}`,
      `Logged excluded: ${loggedExcluded.length}`,
    ];

    const emailText = [...actionSection, ...previousSection, ...footer].join("\n");
    const alertHash = await sha256Hex(
      JSON.stringify({
        snapshot_type: snapshotType,
        action: actionRows.map((r) => ({
          game_id: r.signal.game_id,
          bet_fingerprint: r.betFingerprint,
          change_hash: r.changeHash,
        })),
        previous: previousRows.map((r) => ({
          game_id: r.signal.game_id,
          bet_fingerprint: r.betFingerprint,
          change_hash: r.changeHash,
        })),
      }),
    );

    const subjectDate = new Date().toISOString().slice(0, 10);
    const subject = `Pers-Sys T30 Alert — ${subjectDate} — ${actionRows.length} action`;

    if (dryRun) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          sent: false,
          snapshot_type: snapshotType,
          subject,
          counts: {
            ready_signals: signals.length,
            candidates_after_logged_filter: candidateRows.length,
            action_now: actionRows.length,
            previously_sent: previousRows.length,
            logged_excluded: loggedExcluded.length,
          },
          alert_hash: alertHash,
          email_text: emailText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const runGameId = actionRows[0]?.signal.game_id ?? previousRows[0]?.signal.game_id ?? gameIds[0];

    const { data: insertedRun, error: runInsertErr } = await supabase
      .from("pers_sys_email_alert_runs")
      .insert({
        game_id: runGameId,
        snapshot_type: snapshotType,
        alert_hash: alertHash,
      })
      .select("id")
      .single();

    if (runInsertErr) {
      const code = (runInsertErr as { code?: string }).code ?? "";
      if (code === "23505") {
        return new Response(
          JSON.stringify({
            ok: true,
            dry_run: false,
            sent: false,
            skipped_reason: "duplicate_alert_run",
            snapshot_type: snapshotType,
            alert_hash: alertHash,
            counts: {
              ready_signals: signals.length,
              candidates_after_logged_filter: candidateRows.length,
              action_now: actionRows.length,
              previously_sent: previousRows.length,
              logged_excluded: loggedExcluded.length,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw runInsertErr;
    }

    const runId = (insertedRun as { id?: string } | null)?.id ?? null;

    try {
      const postmarkPayload = {
        From: fromEmail,
        To: toEmail,
        Subject: subject,
        TextBody: emailText,
        MessageStream: messageStream,
      };

      const postmarkRes = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": postmarkToken,
        },
        body: JSON.stringify(postmarkPayload),
      });

      const rawText = await postmarkRes.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }

      if (!postmarkRes.ok) {
        if (runId) {
          await supabase.from("email_alert_runs").delete().eq("id", runId);
        }
        return new Response(
          JSON.stringify({
            ok: false,
            error: "postmark_send_failed",
            postmark_status: postmarkRes.status,
            postmark_response: parsed,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const itemRows = actionRows.map((r) => ({
        game_id: r.signal.game_id,
        snapshot_type: snapshotType,
        bet_fingerprint: r.betFingerprint,
        change_hash: r.changeHash,
        system_code: r.signal.system_code,
        leg_type: String(r.signal.leg_type ?? "").toUpperCase(),
        side: String(r.signal.side ?? "").toUpperCase(),
        line_at_bet: r.signal.line_at_bet ?? null,
        book: r.preview.book ?? r.signal.exec_best_book ?? null,
        price: r.preview.price ?? r.signal.exec_best_price ?? r.signal.ref_price ?? null,
        stake_amount: r.preview.stake_amount ?? null,
        status_label: r.statusLabel,
      }));

      if (itemRows.length > 0) {
        const { error: itemInsertErr } = await supabase
          .from("email_alert_items")
          .insert(itemRows);

        if (itemInsertErr) {
          const code = (itemInsertErr as { code?: string }).code ?? "";
          if (code !== "23505") {
            throw itemInsertErr;
          }
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: false,
          sent: true,
          snapshot_type: snapshotType,
          subject,
          from: fromEmail,
          to: toEmail,
          alert_hash: alertHash,
          counts: {
            ready_signals: signals.length,
            candidates_after_logged_filter: candidateRows.length,
            action_now: actionRows.length,
            previously_sent: previousRows.length,
            logged_excluded: loggedExcluded.length,
          },
          postmark_response: parsed,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (sendErr) {
      if (runId) {
        await supabase.from("email_alert_runs").delete().eq("id", runId);
      }
      throw sendErr;
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unexpected_error",
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
