// Diagnostic-only harness for the weather shadow mapping.
// Mirrors computeWeatherShadow() in pers-sys-evaluate-systems-v2.
// MUST NOT write to any database table. Read-only, in-memory only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function computeWeatherShadow(payload: Record<string, any>): Record<string, any> {
  const weather_enabled = Boolean(payload.weather_enabled);
  const status = payload.weather_status;
  const outcome = payload.weather_outcome;
  const reason = payload.weather_reason_code;

  let shadow_action = "NO_WEATHER_ACTION";
  let shadow_reason: string | null = reason ?? null;
  let would_suppress = false;
  let would_halve = false;
  let would_keep_full = false;

  if (status === "NOT_ENABLED" || !weather_enabled) {
    shadow_action = "WEATHER_NOT_ENABLED";
    shadow_reason = "system_weather_not_enabled";
  } else if (status === "ERROR") {
    shadow_action = "WEATHER_ERROR";
    shadow_reason = reason ?? "weather_read_error";
  } else if (status === "NOT_FOUND") {
    shadow_action = "WEATHER_NOT_FOUND";
    shadow_reason = "missing_t30_weather_assessment";
  } else if (status === "NOT_APPLICABLE" || outcome === "NOT_APPLICABLE") {
    shadow_action = "NO_WEATHER_ACTION";
    shadow_reason = reason ?? "indoor_venue";
  } else if (status === "FOUND") {
    if (outcome === "PASS") {
      shadow_action = "WOULD_SUPPRESS_SIGNAL";
      would_suppress = true;
    } else if (outcome === "HALF_STAKE") {
      shadow_action = "WOULD_HALF_STAKE";
      would_halve = true;
    } else if (outcome === "FULL_STAKE") {
      shadow_action = "WOULD_KEEP_FULL_STAKE";
      would_keep_full = true;
    }
    shadow_reason = reason ?? null;
  }

  return {
    ...payload,
    weather_shadow_enabled: weather_enabled,
    weather_shadow_action: shadow_action,
    weather_shadow_reason: shadow_reason,
    weather_shadow_would_suppress: would_suppress,
    weather_shadow_would_halve_stake: would_halve,
    weather_shadow_would_keep_full_stake: would_keep_full,
    weather_shadow_applied: false,
  };
}

const CASES: Array<{ name: string; payload: Record<string, any> }> = [
  { name: "PASS", payload: { weather_enabled: true, weather_status: "FOUND", weather_outcome: "PASS", weather_reason_code: "gust_ge_35" } },
  { name: "HALF_STAKE", payload: { weather_enabled: true, weather_status: "FOUND", weather_outcome: "HALF_STAKE", weather_reason_code: "wind_ge_30" } },
  { name: "FULL_STAKE", payload: { weather_enabled: true, weather_status: "FOUND", weather_outcome: "FULL_STAKE" } },
  { name: "NOT_APPLICABLE", payload: { weather_enabled: true, weather_status: "NOT_APPLICABLE", weather_outcome: "NOT_APPLICABLE", weather_reason_code: "indoor_venue" } },
  { name: "NOT_FOUND", payload: { weather_enabled: true, weather_status: "NOT_FOUND" } },
  { name: "NOT_ENABLED", payload: { weather_enabled: false, weather_status: "NOT_ENABLED" } },
  { name: "ERROR", payload: { weather_enabled: true, weather_status: "ERROR", weather_reason_code: "read_error" } },
];

const EXPECTED: Record<string, { action: string; suppress: boolean; halve: boolean; full: boolean; reason?: string }> = {
  PASS:           { action: "WOULD_SUPPRESS_SIGNAL", suppress: true,  halve: false, full: false },
  HALF_STAKE:     { action: "WOULD_HALF_STAKE",      suppress: false, halve: true,  full: false },
  FULL_STAKE:     { action: "WOULD_KEEP_FULL_STAKE", suppress: false, halve: false, full: true  },
  NOT_APPLICABLE: { action: "NO_WEATHER_ACTION",     suppress: false, halve: false, full: false },
  NOT_FOUND:      { action: "WEATHER_NOT_FOUND",     suppress: false, halve: false, full: false, reason: "missing_t30_weather_assessment" },
  NOT_ENABLED:    { action: "WEATHER_NOT_ENABLED",   suppress: false, halve: false, full: false, reason: "system_weather_not_enabled" },
  ERROR:          { action: "WEATHER_ERROR",         suppress: false, halve: false, full: false, reason: "read_error" },
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results = CASES.map(({ name, payload }) => {
    const out = computeWeatherShadow(payload);
    const exp = EXPECTED[name];
    const pass =
      out.weather_shadow_action === exp.action &&
      out.weather_shadow_would_suppress === exp.suppress &&
      out.weather_shadow_would_halve_stake === exp.halve &&
      out.weather_shadow_would_keep_full_stake === exp.full &&
      out.weather_shadow_applied === false &&
      (!exp.reason || out.weather_shadow_reason === exp.reason);
    return { case: name, pass, expected: exp, actual: out };
  });

  const all_pass = results.every((r) => r.pass);

  return new Response(
    JSON.stringify({
      ok: true,
      diagnostic_only: true,
      db_writes: false,
      all_pass,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
