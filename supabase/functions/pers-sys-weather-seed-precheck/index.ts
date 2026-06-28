// Phase 2C: Passive T30 weather seeding for upcoming evaluator-window games.
// Writes ONLY to pers_sys_weather_snapshots and pers_sys_weather_assessments
// by invoking the existing pers-sys-weather-fetch and pers-sys-weather-assess
// functions. Does not touch signals, audit, bets, alerts, or UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GameRow = { id: string; venue: string | null; start_time_aet: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode ?? "PRECHECK_ONLY";
    if (mode !== "PRECHECK_ONLY") {
      return new Response(
        JSON.stringify({ ok: false, error: "unsupported_mode", mode }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const onlyGameId: string | null =
      typeof body.game_id === "string" && body.game_id.trim() ? body.game_id.trim() : null;
    const horizonDays = Number(body.horizon_days ?? 10);
    const season = Number(body.season ?? new Date().getFullYear());
    const snapshotStage: string = typeof body.snapshot_stage === "string" && body.snapshot_stage.trim() ? body.snapshot_stage.trim() : "T30";
    const assessmentStage: string = typeof body.assessment_stage === "string" && body.assessment_stage.trim() ? body.assessment_stage.trim() : "T30";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) weather-enabled systems intersected with optional override
    const requestedCodes: string[] | null = Array.isArray(body.system_codes)
      ? body.system_codes.map((c: any) => String(c)).filter(Boolean)
      : null;

    const { data: systems, error: sysErr } = await supabase
      .from("pers_sys_systems_v2")
      .select("system_code, active, weather_enabled")
      .eq("active", true)
      .eq("weather_enabled", true);
    if (sysErr) throw sysErr;

    const systemCodes = (systems || [])
      .map((s: any) => s.system_code as string)
      .filter((c) => !requestedCodes || requestedCodes.includes(c));

    // 2) upcoming games window matching evaluator PRECHECK selection
    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
      .from("pers_sys_games")
      .select("id, venue, start_time_aet")
      .eq("season", season)
      .eq("status", "SCHEDULED");

    if (onlyGameId) {
      q = q.eq("id", onlyGameId);
    } else {
      q = q.gte("start_time_aet", startIso).lte("start_time_aet", endIso);
    }
    q = q.order("start_time_aet", { ascending: true }).limit(200);

    const { data: games, error: gamesErr } = await q;
    if (gamesErr) throw gamesErr;

    const counters = {
      games_checked: 0,
      snapshots_created_or_updated: 0,
      assessments_created_or_updated: 0,
      skipped_indoor: 0,
      skipped_no_venue: 0,
      errors: [] as Array<Record<string, unknown>>,
    };

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    };

    const callFn = async (fn: string, payload: unknown) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    };

    for (const g of (games || []) as GameRow[]) {
      counters.games_checked++;
      if (!g.venue) {
        counters.skipped_no_venue++;
        continue;
      }

      // One fetch per game; same snapshot reused by all systems
      const fetched = await callFn("pers-sys-weather-fetch", {
        game_id: g.id,
        snapshot_stage: snapshotStage,
      });
      if (fetched.status !== 200 || !(fetched.json as any)?.ok) {
        counters.errors.push({ stage: "fetch", game_id: g.id, response: fetched.json });
        continue;
      }
      counters.snapshots_created_or_updated++;
      const indoor = (fetched.json as any)?.snapshot?.is_outdoor === false;
      if (indoor) counters.skipped_indoor++; // informational; assessment still produced

      // Assess per weather-enabled system
      for (const code of systemCodes) {
        const assessed = await callFn("pers-sys-weather-assess", {
          game_id: g.id,
          system_code: code,
          assessment_stage: assessmentStage,
        });
        if (assessed.status !== 200 || !(assessed.json as any)?.ok) {
          counters.errors.push({
            stage: "assess",
            game_id: g.id,
            system_code: code,
            response: assessed.json,
          });
          continue;
        }
        counters.assessments_created_or_updated++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        season,
        horizon_days: horizonDays,
        systems: systemCodes,
        ...counters,
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
