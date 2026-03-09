import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_WINDOW_STATUSES = ["ON_TIME", "DEGRADED_LATE", "MISSED_WINDOW"] as const;
type WindowStatus = typeof VALID_WINDOW_STATUSES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const gameId = body.game_id ?? null;
    const watchType = body.watch_type ?? null;
    const triggerSource = body.trigger_source ?? "manual";
    const windowStatus: WindowStatus | null =
      typeof body.window_status === "string" && VALID_WINDOW_STATUSES.includes(body.window_status)
        ? (body.window_status as WindowStatus)
        : null;
    const windowNote: string | null =
      typeof body.window_note === "string" ? body.window_note : null;
    const forceRun: boolean = body.force_run === true;

    if (!watchType) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_watch_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dedupeKey = `${watchType}:${gameId ?? "GLOBAL"}:${windowStatus ?? "UNSPECIFIED"}`;

    // check for existing run
    const { data: existing } = await supabase
      .from("pers_sys_watcher_runs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "duplicate_run",
          dedupe_key: dedupeKey,
          window_status: windowStatus,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine initial run_status based on window_status
    let initialRunStatus = "STARTED";
    if (windowStatus === "DEGRADED_LATE") initialRunStatus = "DEGRADED_LATE";
    if (windowStatus === "MISSED_WINDOW") initialRunStatus = "MISSED_WINDOW";

    const noteJson = JSON.stringify({
      window_status: windowStatus ?? "UNSPECIFIED",
      window_note: windowNote ?? null,
    });

    // create run record
    const { data: runRow, error: runErr } = await supabase
      .from("pers_sys_watcher_runs")
      .insert({
        game_id: gameId,
        watch_type: watchType,
        trigger_source: triggerSource,
        run_status: initialRunStatus,
        dedupe_key: dedupeKey,
        note: noteJson,
      })
      .select()
      .single();

    if (runErr) throw runErr;

    const runId = runRow.id;

    // If MISSED_WINDOW and not force_run, skip downstream
    if (windowStatus === "MISSED_WINDOW" && !forceRun) {
      await supabase
        .from("pers_sys_watcher_runs")
        .update({
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "missed_window",
          run_id: runId,
          window_status: windowStatus,
          window_note: windowNote,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let downstreamResult: any = null;

    // Downstream action: T30 alert
    if (watchType === "T30" && gameId) {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/pers-sys-send-t30-alert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ game_id: gameId }),
        }
      );

      downstreamResult = await res.json().catch(() => null);
    }

    const finalNote = JSON.stringify({
      window_status: windowStatus ?? "UNSPECIFIED",
      window_note: windowNote ?? null,
      downstream: downstreamResult ?? {},
    });

    await supabase
      .from("pers_sys_watcher_runs")
      .update({
        run_status: "SUCCESS",
        finished_at: new Date().toISOString(),
        note: finalNote,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        watch_type: watchType,
        game_id: gameId,
        window_status: windowStatus,
        window_note: windowNote,
        downstream: downstreamResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
