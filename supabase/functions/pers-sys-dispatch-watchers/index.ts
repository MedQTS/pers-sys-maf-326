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
type WindowStatus = "ON_TIME" | "DEGRADED_LATE" | "MISSED_WINDOW" | "TOO_EARLY";

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

function classifySingleWatchType(mins: number, wt: WatchType): ClassifiedWindow {
  if (wt === "T60") {
    if (mins > 65) return { watch_type: wt, window_status: "TOO_EARLY", window_note: `T60 too-early (${mins.toFixed(1)} min, window 55-65)` };
    if (mins >= 55 && mins <= 65) return { watch_type: wt, window_status: "ON_TIME", window_note: "T60 on-time (55-65 min)" };
    if (mins >= 25 && mins < 55) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T60 degraded-late (${mins.toFixed(1)} min)` };
    return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T60 missed (${mins.toFixed(1)} min)` };
  }
  if (wt === "T30") {
    if (mins > 35) return { watch_type: wt, window_status: "TOO_EARLY", window_note: `T30 too-early (${mins.toFixed(1)} min, window 25-35)` };
    if (mins >= 25 && mins <= 35) return { watch_type: wt, window_status: "ON_TIME", window_note: "T30 on-time (25-35 min)" };
    if (mins >= 12 && mins < 25) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T30 degraded-late (${mins.toFixed(1)} min)` };
    return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T30 missed (${mins.toFixed(1)} min)` };
  }
  // T10
  if (mins > 12) return { watch_type: wt, window_status: "TOO_EARLY", window_note: `T10 too-early (${mins.toFixed(1)} min, window 8-12)` };
  if (mins >= 8 && mins <= 12) return { watch_type: wt, window_status: "ON_TIME", window_note: "T10 on-time (8-12 min)" };
  if (mins >= 0 && mins < 8) return { watch_type: wt, window_status: "DEGRADED_LATE", window_note: `T10 degraded-late (${mins.toFixed(1)} min)` };
  return { watch_type: wt, window_status: "MISSED_WINDOW", window_note: `T10 missed (${mins.toFixed(1)} min)` };
}

/** Classify all applicable watch windows for a game at a given minutes-to-start. */
function classifyAllWindows(mins: number): ClassifiedWindow[] {
  const watchTypes: WatchType[] = ["T60", "T30", "T10"];
  return watchTypes.map((wt) => classifySingleWatchType(mins, wt));
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
      // Forced mode: fetch the game regardless of status/time
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
    const tooEarlyCandidates: DispatchItem[] = [];
    const missedCandidates: DispatchItem[] = [];

    for (const g of games) {
      const mins = minutesToStart(g.start_time_aet, nowMs);
      const minsRounded = Number(mins.toFixed(2));

      if (forceWatchType) {
        // Forced mode: classify but always dispatch
        const classified = classifySingleWatchType(mins, forceWatchType);
        dispatchItems.push({
          game_id: g.id,
          watch_type: classified.watch_type,
          minutes_to_start: minsRounded,
          window_status: classified.window_status,
          window_note: classified.window_note,
        });
      } else {
        // Normal mode: classify all windows and bucket by status
        const allWindows = classifyAllWindows(mins);
        for (const w of allWindows) {
          const item: DispatchItem = {
            game_id: g.id,
            watch_type: w.watch_type,
            minutes_to_start: minsRounded,
            window_status: w.window_status,
            window_note: w.window_note,
          };

          if (w.window_status === "ON_TIME" || w.window_status === "DEGRADED_LATE") {
            dispatchItems.push(item);
          } else if (w.window_status === "TOO_EARLY") {
            tooEarlyCandidates.push(item);
          } else {
            missedCandidates.push(item);
          }
        }
      }
    }

    const results: any[] = [];
    const isForced = !!forceWatchType;

    for (const item of dispatchItems) {
      const requestBody: Record<string, unknown> = {
        game_id: item.game_id,
        watch_type: item.watch_type,
        trigger_source: triggerSource,
        window_status: item.window_status,
        window_note: item.window_note,
      };

      if (isForced) {
        requestBody.force_run = true;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/pers-sys-run-watcher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await res.json().catch(() => null);

      const resultEntry: Record<string, unknown> = {
        game_id: item.game_id,
        watch_type: item.watch_type,
        minutes_to_start: item.minutes_to_start,
        window_status: item.window_status,
        window_note: item.window_note,
        http_status: res.status,
        result: payload,
      };

      if (isForced) {
        resultEntry.force_run = true;
      }

      results.push(resultEntry);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        now_iso: now.toISOString(),
        lookahead_minutes: lookaheadMinutes,
        force_watch_type: forceWatchType ?? undefined,
        scanned_games: games.length,
        dispatch_candidates: dispatchItems.length,
        too_early_candidates: tooEarlyCandidates,
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
