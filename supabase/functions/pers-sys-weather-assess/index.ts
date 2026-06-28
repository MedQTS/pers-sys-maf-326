import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback policy map for systems not present in pers_sys_systems_v2 (e.g. SYS_10A is report-only).
const POLICY_FALLBACK: Record<string, string> = {
  SYS_4: "WX_SYS4_STD",
  SYS_8: "WX_SYS8_TOTALS_OVER_STD",
  SYS_10A: "WX_SYS10A_ALT_TOTAL_OVER_STD",
};

const KNOWN_POLICIES = new Set([
  "WX_SYS4_STD",
  "WX_SYS8_TOTALS_OVER_STD",
  "WX_SYS10A_ALT_TOTAL_OVER_STD",
]);

type Verdict = {
  outcome: "FULL_STAKE" | "HALF_STAKE" | "PASS" | "NOT_APPLICABLE";
  reason_code: string;
};

function assessOutdoor(
  wind: number | null,
  gust: number | null,
  rain: number | null,
): Verdict {
  const w = wind ?? 0;
  const g = gust ?? 0;
  const r = rain ?? 0;

  if (g >= 35) return { outcome: "PASS", reason_code: "gust_ge_35" };
  if (w >= 30) return { outcome: "PASS", reason_code: "wind_ge_30" };
  if (r >= 5) return { outcome: "PASS", reason_code: "rain_ge_5" };
  if (w >= 25 && r >= 2) return { outcome: "PASS", reason_code: "wind_ge_25_and_rain_ge_2" };
  if (w >= 25) return { outcome: "HALF_STAKE", reason_code: "wind_ge_25" };
  if (r >= 3) return { outcome: "HALF_STAKE", reason_code: "rain_ge_3" };
  return { outcome: "FULL_STAKE", reason_code: "clear" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gameId: string | null = body.game_id ?? null;
    const systemCode: string | null = body.system_code ?? null;
    const assessmentStage: "T30" | "T10" =
      body.assessment_stage === "T10" ? "T10" : "T30";

    if (!gameId || !systemCode) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_game_id_or_system_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Resolve policy code: systems_v2 row first, then fallback map
    let policyCode: string | null = null;
    const { data: sysRow } = await supabase
      .from("pers_sys_systems_v2")
      .select("system_code, weather_enabled, weather_policy_code")
      .eq("system_code", systemCode)
      .maybeSingle();

    if (sysRow) {
      if (sysRow.weather_enabled !== true) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "weather_disabled_for_system",
            system_code: systemCode,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      policyCode = sysRow.weather_policy_code ?? POLICY_FALLBACK[systemCode] ?? null;
    } else {
      policyCode = POLICY_FALLBACK[systemCode] ?? null;
    }

    if (!policyCode || !KNOWN_POLICIES.has(policyCode)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "unknown_or_missing_policy_code",
          system_code: systemCode,
          policy_code: policyCode,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Read latest weather snapshot for this stage
    const { data: snap, error: snapErr } = await supabase
      .from("pers_sys_weather_snapshots")
      .select("*")
      .eq("game_id", gameId)
      .eq("snapshot_stage", assessmentStage)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapErr) throw snapErr;
    if (!snap) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "no_weather_snapshot",
          game_id: gameId,
          assessment_stage: assessmentStage,
          hint: "Run pers-sys-weather-fetch first.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Apply policy
    // v1: all three policy codes share the same threshold ladder. Dispatch by code
    // is preserved so future divergence is a one-line change.
    let verdict: Verdict;
    if (snap.is_outdoor === false) {
      verdict = { outcome: "NOT_APPLICABLE", reason_code: "indoor_venue" };
    } else {
      switch (policyCode) {
        case "WX_SYS4_STD":
        case "WX_SYS8_TOTALS_OVER_STD":
        case "WX_SYS10A_ALT_TOTAL_OVER_STD":
          verdict = assessOutdoor(snap.wind_kmh_max, snap.gust_kmh_max, snap.rain_mm_total);
          break;
        default:
          verdict = { outcome: "NOT_APPLICABLE", reason_code: "unknown_policy" };
      }
    }

    // 4) Upsert assessment
    const { data: upserted, error: upsertErr } = await supabase
      .from("pers_sys_weather_assessments")
      .upsert(
        {
          game_id: gameId,
          system_code: systemCode,
          policy_code: policyCode,
          assessment_stage: assessmentStage,
          outcome: verdict.outcome,
          reason_code: verdict.reason_code,
          wind_kmh_max: snap.wind_kmh_max,
          gust_kmh_max: snap.gust_kmh_max,
          rain_mm_total: snap.rain_mm_total,
          weather_snapshot_id: snap.id,
          assessed_at: new Date().toISOString(),
        },
        { onConflict: "game_id,system_code,assessment_stage" },
      )
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ ok: true, assessment: upserted }),
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
