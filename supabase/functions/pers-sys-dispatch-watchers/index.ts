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

type WatchType = "T60" | "T30" | "T10";
type WindowStatus = "ON_TIME" | "DEGRADED_LATE" | "MISSED_WINDOW";

type ClassifiedWindow = {
  watch_type: WatchType;
  window_status: WindowStatus;
  window_note: string;
};

type DispatchItem = {
  game_id: string;
  watch_type: WatchType;
  minutes_to_start: number;
  window_status: WindowStatus;
  window_note: string;
};

function minutesToStart(startIso: string, nowMs: number): number {
  return (new Date(startIso).getTime() - nowMs) / 60000;
}

function classifyWatchWindows(mins: number): ClassifiedWindow[] {
  const out: ClassifiedWindow[] = [];

  // T60
  if (mins >= 55 && mins <= 65) {
    out.push({ watch_type: "T60", window_status: "ON_TIME", window_note: "T60 on-time (55-65 min)" });
  } else if (mins >= 25 && mins < 55) {
    out.push({ watch_type: "T60", window_status: "DEGRADED_LATE", window_note: `T60 degraded-late (${mins.toFixed(1)} min, expected 55-65)` });
  }
  // T60 missed (mins < 25) is not pushed — handled separately if needed

  // T30
  if (mins >= 25 && mins <= 35) {
    out.push({ watch_type: "T30", window_status: "ON_TIME", window_note: "T30 on-time (25-35 min)" });
  } else if (mins >= 12 && mins < 25) {
    out.push({ watch_type: "T30", window_status: "DEGRADED_LATE", window_note: `T30 degraded-late (${mins.toFixed(1)} min, expected 25-35)` });
  }

  // T10
  if (mins >= 8 && mins <= 12) {
    out.push({ watch_type: "T10", window_status: "ON_TIME", window_note: "T10 on-time (8-12 min)" });
  } else if (mins >= 0 && mins < 8) {
    out.push({ watch_type: "T10", window_status: "DEGRADED_LATE", window_note: `T10 degraded-late (${mins.toFixed(1)} min, expected 8-12)` });
  }

  return out;
}

function classifyMissedWindows(mins: number): ClassifiedWindow[] {
  const out: ClassifiedWindow[] = [];
  if (mins < 25) {
    out.push({ watch_type: "T60", window_status: "MISSED_WINDOW", window_note: `T60 missed (${mins.toFixed(1)} min, needed >=25)` });
  }
  if (mins < 12) {
    out.push({ watch_type: "T30", window_status: "MISSED_WINDOW", window_note: `T30 missed (${mins.toFixed(1)} min, needed >=12)` });
  }
  if (mins < 0) {
    out.push({ watch_type: "T10", window_status: "MISSED_WINDOW", window_note: `T10 missed (${mins.toFixed(1)} min, needed >=0)` });
  }
  return out;
}

function classifySingleWatchType(mins: number, wt: WatchType): ClassifiedWindow {
  if (wt === "T60") {
    if (mins >= 55 && mins <= 65) return { watch_type: wt, window_status: "ON_TIME", window_note: "T60 on-time (55-65 min)" };
    if (mins >= 25 && mins < 55) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T60 degraded-late (${mins.toFixed(1)} min)` };
    return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T60 missed (${mins.toFixed(1)} min)` };
  }
  if (wt === "T30") {
    if (mins >= 25 && mins <= 35) return { watch_type: wt, window_status: "ON_TIME", window_note: "T30 on-time (25-35 min)" };
    if (mins >= 12 && mins < 25) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T30 degraded-late (${mins.toFixed(1)} min)` };
    return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T30 missed (${mins.toFixed(1)} min)` };
  }
  // T10
  if (mins >= 8 && mins <= 12) return { watch_type: wt, window_status: "ON_TIME", window_note: "T10 on-time (8-12 min)" };
  if (mins >= 0 && mins < 8) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T10 degraded-late (${mins.toFixed(1)} min)` };
  return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T10 missed (${mins.toFixed(1)} min)` };
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

    const forceWatchType: WatchType | null =
      typeof body.force_watch_type === "string" && ["T60", "T30", "T10"].includes(body.force_watch_type)
        ? (body.force_watch_type as WatchType)
        : null;

    if (forceWatchType && !onlyGameId) {
      return new Response(
        JSON.stringify({ ok: false, error: "force_watch_type_requires_game_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let games: GameRow[];

    if (forceWatchType && onlyGameId) {
      const { data: gamesData, error: gamesErr } = await supabase
        .from("pers_sys_games")
        .select("id,start_time_aet,status,round,venue")
        .eq("id", onlyGameId)
        .limit(1);

      if (gamesErr) throw gamesErr;
      games = (gamesData ?? []) as GameRow[];
    } else {
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
      games = (gamesData ?? []) as GameRow[];
    }

    const dispatchItems: DispatchItem[] = [];
    const missedCandidates: DispatchItem[] = [];

    for (const g of games) {
      const mins = minutesToStart(g.start_time_aet, nowMs);
      const minsRounded = Number(mins.toFixed(2));

      if (forceWatchType) {
        const classified = classifySingleWatchType(mins, forceWatchType);
        dispatchItems.push({
          game_id: g.id,
          watch_type: classified.watch_type,
          minutes_to_start: minsRounded,
          window_status: classified.window_status,
          window_note: classified.window_note,
        });
      } else {
        // Dispatchable windows (ON_TIME + DEGRADED_LATE)
        const windows = classifyWatchWindows(mins);
        for (const w of windows) {
          dispatchItems.push({
            game_id: g.id,
            watch_type: w.watch_type,
            minutes_to_start: minsRounded,
            window_status: w.window_status,
            window_note: w.window_note,
          });
        }

        // Missed windows
        const missed = classifyMissedWindows(mins);
        for (const m of missed) {
          missedCandidates.push({
            game_id: g.id,
            watch_type: m.watch_type,
            minutes_to_start: minsRounded,
            window_status: m.window_status,
            window_note: m.window_note,
          });
        }
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
          window_status: item.window_status,
          window_note: item.window_note,
        }),
      });

      const payload = await res.json().catch(() => null);

      results.push({
        game_id: item.game_id,
        watch_type: item.watch_type,
        minutes_to_start: item.minutes_to_start,
        window_status: item.window_status,
        window_note: item.window_note,
        http_status: res.status,
        result: payload,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        now_iso: now.toISOString(),
        lookahead_minutes: lookaheadMinutes,
        force_watch_type: forceWatchType ?? undefined,
        scanned_games: games.length,
        dispatch_candidates: dispatchItems.length,
        missed_candidates: missedCandidates,
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