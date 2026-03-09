import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const gameId = body.game_id ?? null;
    const watchType = body.watch_type ?? null;
    const triggerSource = body.trigger_source ?? "manual";

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

    const dedupeKey = `${watchType}:${gameId ?? "GLOBAL"}`;

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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // create run record
    const { data: runRow, error: runErr } = await supabase
      .from("pers_sys_watcher_runs")
      .insert({
        game_id: gameId,
        watch_type: watchType,
        trigger_source: triggerSource,
        run_status: "STARTED",
        dedupe_key: dedupeKey,
      })
      .select()
      .single();

    if (runErr) throw runErr;

    const runId = runRow.id;

    let downstreamResult: any = null;

    // Example watcher action: T30 alert
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

    await supabase
      .from("pers_sys_watcher_runs")
      .update({
        run_status: "SUCCESS",
        finished_at: new Date().toISOString(),
        note: JSON.stringify(downstreamResult ?? {}),
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        watch_type: watchType,
        game_id: gameId,
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
