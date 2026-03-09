import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GameRow = {
  id: string;
  start_time_aet: string;
  status: string;
  round: number | null;
  venue: string | null;
};

type DispatchItem = {
  game_id: string;
  watch_type: "T60" | "T30" | "T10";
  minutes_to_start: number;
};

function minutesToStart(startIso: string, nowMs: number): number {
  return (new Date(startIso).getTime() - nowMs) / 60000;
}

function classifyWatchWindows(mins: number): ("T60" | "T30" | "T10")[] {
  const out: ("T60" | "T30" | "T10")[] = [];
  if (mins >= 55 && mins <= 65) out.push("T60");
  if (mins >= 25 && mins <= 35) out.push("T30");
  if (mins >= 8 && mins <= 12) out.push("T10");
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_supabase_env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const nowMs = now.getTime();

    const lookaheadMinutes = Number(body.lookahead_minutes ?? 70);
    const triggerSource = typeof body.trigger_source === "string" && body.trigger_source.trim()
      ? body.trigger_source.trim()
      : "dispatcher";

    const onlyGameId =
      typeof body.game_id === "string" && body.game_id.trim() ? body.game_id.trim() : null;

    const startIso = now.toISOString();
    const endIso = new Date(nowMs + lookaheadMinutes * 60 * 1000).toISOString();

    let gamesQuery = supabase
      .from("pers_sys_games")
      .select("id,start_time_aet,status,round,venue")
      .eq("status", "SCHEDULED")
      .gte("start_time_aet", startIso)
      .lte("start_time_aet", endIso)
      .order("start_time_aet", { ascending: true });

    if (onlyGameId) {
      gamesQuery = gamesQuery.eq("id", onlyGameId);
    }

    const { data: gamesData, error: gamesErr } = await gamesQuery;
    if (gamesErr) throw gamesErr;

    const games = (gamesData ?? []) as GameRow[];

    const dispatchItems: DispatchItem[] = [];
    for (const g of games) {
      const mins = minutesToStart(g.start_time_aet, nowMs);
      const watches = classifyWatchWindows(mins);
      for (const watch of watches) {
        dispatchItems.push({
          game_id: g.id,
          watch_type: watch,
          minutes_to_start: Number(mins.toFixed(2)),
        });
      }
    }

    const results: any[] = [];

    for (const item of dispatchItems) {
      const res = await fetch(`${supabaseUrl}/functions/v1/pers-sys-run-watcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          game_id: item.game_id,
          watch_type: item.watch_type,
          trigger_source: triggerSource,
        }),
      });

      const payload = await res.json().catch(() => null);

      results.push({
        game_id: item.game_id,
        watch_type: item.watch_type,
        minutes_to_start: item.minutes_to_start,
        http_status: res.status,
        result: payload,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        now_iso: now.toISOString(),
        lookahead_minutes: lookaheadMinutes,
        scanned_games: games.length,
        dispatch_candidates: dispatchItems.length,
        dispatched: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unexpected_error",
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
