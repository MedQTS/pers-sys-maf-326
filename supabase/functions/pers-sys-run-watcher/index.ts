import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_WINDOW_STATUSES = ["ON_TIME", "DEGRADED_LATE", "MISSED_WINDOW"] as const;
type WindowStatus = typeof VALID_WINDOW_STATUSES[number];

type StepResult = {
  ok: boolean;
  status: number;
  function_name: string;
  payload: Record<string, unknown>;
  response: unknown;
};

async function callEdgeFunction(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  functionName: string;
  payload: Record<string, unknown>;
}): Promise<StepResult> {
  const res = await fetch(`${args.supabaseUrl}/functions/v1/${args.functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.serviceRoleKey}`,
    },
    body: JSON.stringify(args.payload),
  });

  const json = await res.json().catch(() => null);

  return {
    ok: res.ok,
    status: res.status,
    function_name: args.functionName,
    payload: args.payload,
    response: json,
  };
}

function buildDownstreamSteps(watchType: string, gameId: string | null): Array<{ functionName: string; payload: Record<string, unknown> }> {
  if (!gameId) return [];

  if (watchType === "T60") {
    return [
      { functionName: "pers-sys-pull-odds-snapshot", payload: { game_id: gameId, snapshot_type: "T60" } },
      { functionName: "pers-sys-evaluate-systems-v2", payload: { game_id: gameId } },
    ];
  }
  if (watchType === "T30") {
    return [
      { functionName: "pers-sys-pull-odds-snapshot", payload: { game_id: gameId, snapshot_type: "T30" } },
      { functionName: "pers-sys-evaluate-systems-v2", payload: { game_id: gameId } },
      { functionName: "pers-sys-send-t30-alert", payload: { game_id: gameId } },
    ];
  }
  if (watchType === "T10") {
    return [
      { functionName: "pers-sys-pull-odds-snapshot", payload: { game_id: gameId, snapshot_type: "T10" } },
      { functionName: "pers-sys-evaluate-systems-v2", payload: { game_id: gameId } },
    ];
  }
  return [];
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    // Ordered downstream orchestration
    const steps = buildDownstreamSteps(watchType, gameId);
    const downstreamSteps: StepResult[] = [];

    for (const step of steps) {
      const result = await callEdgeFunction({
        supabaseUrl,
        serviceRoleKey,
        functionName: step.functionName,
        payload: step.payload,
      });
      downstreamSteps.push(result);

      if (!result.ok) {
        // Step failed — mark run as FAILED and return 502
        const failNote = JSON.stringify({
          window_status: windowStatus ?? "UNSPECIFIED",
          window_note: windowNote ?? null,
          downstream_steps: downstreamSteps,
          failed_step: result.function_name,
        });

        await supabase
          .from("pers_sys_watcher_runs")
          .update({
            run_status: "FAILED",
            finished_at: new Date().toISOString(),
            note: failNote,
          })
          .eq("id", runId);

        return new Response(
          JSON.stringify({
            ok: false,
            error: "downstream_step_failed",
            run_id: runId,
            failed_step: result.function_name,
            downstream_steps: downstreamSteps,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // All steps succeeded
    const finalNote = JSON.stringify({
      window_status: windowStatus ?? "UNSPECIFIED",
      window_note: windowNote ?? null,
      downstream_steps: downstreamSteps,
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
        downstream_steps: downstreamSteps,
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
