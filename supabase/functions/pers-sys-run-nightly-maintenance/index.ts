import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function callEdgeFunction(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  functionName: string;
  payload: Record<string, unknown>;
}) {
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

    const triggerSource =
      typeof body.trigger_source === "string" && body.trigger_source.trim()
        ? body.trigger_source.trim()
        : "nightly_maintenance";

    const season = Number(body.season ?? new Date().getFullYear());

    const now = new Date();
    const batchDate = now.toISOString().slice(0, 10);
    const dedupeKey = `NIGHTLY_MAINTENANCE:${batchDate}`;

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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const initialNote = {
      batch_type: "NIGHTLY_MAINTENANCE",
      batch_date: batchDate,
      trigger_source: triggerSource,
      season,
    };

    const { data: runRow, error: runErr } = await supabase
      .from("pers_sys_watcher_runs")
      .insert({
        game_id: null,
        watch_type: "DAILY_SQUIGGLE",
        trigger_source: triggerSource,
        run_status: "STARTED",
        dedupe_key: dedupeKey,
        note: JSON.stringify(initialNote),
      })
      .select()
      .single();

    if (runErr) throw runErr;

    const runId = runRow.id;
    const downstreamSteps: any[] = [];

    const step1 = await callEdgeFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "pers-sys-pull-squiggle",
      payload: {},
    });
    downstreamSteps.push(step1);

    if (!step1.ok) {
      await supabase
        .from("pers_sys_watcher_runs")
        .update({
          run_status: "FAILED",
          finished_at: new Date().toISOString(),
          note: JSON.stringify({
            ...initialNote,
            downstream_steps: downstreamSteps,
            failed_step: step1.function_name,
          }),
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "downstream_step_failed",
          failed_step: step1.function_name,
          downstream_steps: downstreamSteps,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const step2 = await callEdgeFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "pers-sys-build-features",
      payload: { season },
    });
    downstreamSteps.push(step2);

    if (!step2.ok) {
      await supabase
        .from("pers_sys_watcher_runs")
        .update({
          run_status: "FAILED",
          finished_at: new Date().toISOString(),
          note: JSON.stringify({
            ...initialNote,
            downstream_steps: downstreamSteps,
            failed_step: step2.function_name,
          }),
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "downstream_step_failed",
          failed_step: step2.function_name,
          downstream_steps: downstreamSteps,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const step3 = await callEdgeFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "pers-sys-settle",
      payload: { season },
    });
    downstreamSteps.push(step3);

    if (!step3.ok) {
      await supabase
        .from("pers_sys_watcher_runs")
        .update({
          run_status: "FAILED",
          finished_at: new Date().toISOString(),
          note: JSON.stringify({
            ...initialNote,
            downstream_steps: downstreamSteps,
            failed_step: step3.function_name,
          }),
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "downstream_step_failed",
          failed_step: step3.function_name,
          downstream_steps: downstreamSteps,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const step4 = await callEdgeFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "pers-sys-evaluate-systems-v2",
      payload: { season },
    });
    downstreamSteps.push(step4);

    if (!step4.ok) {
      await supabase
        .from("pers_sys_watcher_runs")
        .update({
          run_status: "FAILED",
          finished_at: new Date().toISOString(),
          note: JSON.stringify({
            ...initialNote,
            downstream_steps: downstreamSteps,
            failed_step: step4.function_name,
          }),
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "downstream_step_failed",
          failed_step: step4.function_name,
          downstream_steps: downstreamSteps,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("pers_sys_watcher_runs")
      .update({
        run_status: "SUCCESS",
        finished_at: new Date().toISOString(),
        note: JSON.stringify({
          ...initialNote,
          downstream_steps: downstreamSteps,
        }),
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        batch_date: batchDate,
        dedupe_key: dedupeKey,
        downstream_steps: downstreamSteps,
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
