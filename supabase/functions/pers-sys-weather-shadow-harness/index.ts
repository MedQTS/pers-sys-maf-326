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

// Phase 4A: mirror of computeWeatherActiveDecision in pers-sys-evaluate-systems-v2.
function computeWeatherActiveDecision(
  payload: Record<string, any>,
  active_enabled: boolean,
): Record<string, any> {
  if (!active_enabled) {
    return {
      ...payload,
      weather_active_decisioning_enabled: false,
      weather_active_action: "DISABLED",
      weather_active_reason: "weather_active_decisioning_disabled",
      weather_active_applied: false,
      weather_active_would_change_signal: false,
      weather_active_would_change_stake: false,
    };
  }
  const status = payload.weather_status;
  const outcome = payload.weather_outcome;
  const reason = payload.weather_reason_code;
  let action = "ACTIVE_NO_ACTION";
  let action_reason: string | null = reason ?? null;
  let would_change_signal = false;
  let would_change_stake = false;
  if (status === "NOT_ENABLED") {
    action = "ACTIVE_NOT_ENABLED";
    action_reason = "system_weather_not_enabled";
  } else if (status === "ERROR") {
    action = "ACTIVE_WEATHER_ERROR";
    action_reason = reason ?? "weather_read_error";
  } else if (status === "NOT_FOUND") {
    action = "ACTIVE_WEATHER_NOT_FOUND";
    action_reason = "missing_t30_weather_assessment";
  } else if (status === "NOT_APPLICABLE" || outcome === "NOT_APPLICABLE") {
    action = "ACTIVE_NO_ACTION";
    action_reason = reason ?? "indoor_venue";
  } else if (status === "FOUND") {
    if (outcome === "PASS") {
      action = "WOULD_ACTIVE_SUPPRESS";
      action_reason = "active_weather_pass";
      would_change_signal = true;
    } else if (outcome === "HALF_STAKE") {
      action = "WOULD_ACTIVE_HALF_STAKE";
      action_reason = "active_weather_half_stake";
      would_change_stake = true;
    } else if (outcome === "FULL_STAKE") {
      action = "WOULD_ACTIVE_KEEP_FULL_STAKE";
    }
  }
  return {
    ...payload,
    weather_active_decisioning_enabled: true,
    weather_active_action: action,
    weather_active_reason: action_reason,
    weather_active_applied: false,
    weather_active_would_change_signal: would_change_signal,
    weather_active_would_change_stake: would_change_stake,
  };
}

const ACTIVE_EXPECTED: Record<string, string> = {
  PASS: "WOULD_ACTIVE_SUPPRESS",
  HALF_STAKE: "WOULD_ACTIVE_HALF_STAKE",
  FULL_STAKE: "WOULD_ACTIVE_KEEP_FULL_STAKE",
  NOT_APPLICABLE: "ACTIVE_NO_ACTION",
  NOT_FOUND: "ACTIVE_WEATHER_NOT_FOUND",
  NOT_ENABLED: "ACTIVE_NOT_ENABLED",
  ERROR: "ACTIVE_WEATHER_ERROR",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let mode = "shadow";
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.mode === "string") mode = body.mode;
    } else {
      const url = new URL(req.url);
      mode = url.searchParams.get("mode") ?? "shadow";
    }
  } catch (_e) { /* ignore */ }

  const shadowResults = CASES.map(({ name, payload }) => {
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

  const activeDisabled = CASES.map(({ name, payload }) => {
    const s = computeWeatherShadow(payload);
    const out = computeWeatherActiveDecision(s, false);
    const pass =
      out.weather_active_decisioning_enabled === false &&
      out.weather_active_action === "DISABLED" &&
      out.weather_active_applied === false &&
      out.weather_active_would_change_signal === false &&
      out.weather_active_would_change_stake === false;
    return { case: name, pass, actual_action: out.weather_active_action };
  });

  const activeEnabled = CASES.map(({ name, payload }) => {
    const s = computeWeatherShadow(payload);
    const out = computeWeatherActiveDecision(s, true);
    const pass = out.weather_active_action === ACTIVE_EXPECTED[name] &&
      out.weather_active_applied === false;
    return { case: name, pass, expected_action: ACTIVE_EXPECTED[name], actual_action: out.weather_active_action, would_change_signal: out.weather_active_would_change_signal, would_change_stake: out.weather_active_would_change_stake };
  });

  const all_pass =
    shadowResults.every((r) => r.pass) &&
    activeDisabled.every((r) => r.pass) &&
    activeEnabled.every((r) => r.pass);

  return new Response(
    JSON.stringify({
      ok: true,
      diagnostic_only: true,
      db_writes: false,
      mode,
      all_pass,
      shadow: shadowResults,
      active_disabled: activeDisabled,
      active_enabled: activeEnabled,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

