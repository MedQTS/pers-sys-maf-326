import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/['".,()]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(fc|football|club|afl|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("PERS_SYS_ODDS_API_KEY");

    if (!url || !serviceKey || !apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_env",
          details: {
            has_url: !!url,
            has_service_role_key: !!serviceKey,
            has_odds_api_key: !!apiKey,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(url, serviceKey);

    // Pull participants (cheap: cost 1)
    const partUrl = `https://api.the-odds-api.com/v4/sports/aussierules_afl/participants?apiKey=${apiKey}`;
    const partResp = await fetch(partUrl);
    if (!partResp.ok) {
      const t = await partResp.text();
      throw new Error(`OddsAPI participants ${partResp.status}: ${t}`);
    }
    const participants = await partResp.json();

    const participantNames: string[] = (participants || [])
      .map((p: any) => String(p.full_name || "").trim())
      .filter(Boolean);

    const participantNormToFull = new Map<string, string[]>();
    for (const full of participantNames) {
      const n = normName(full);
      const arr = participantNormToFull.get(n) || [];
      arr.push(full);
      participantNormToFull.set(n, arr);
    }

    // Load teams
    const { data: teams, error: teamsErr } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name, oddsapi_name");

    if (teamsErr) throw new Error(`teams_select_failed: ${teamsErr.message}`);

    // Build team norms and reverse index
    const teamNormToIds = new Map<string, string[]>();
    const teamById: Record<
      string,
      { canonical: string; oddsapi: string | null; norms: Set<string> }
    > = {};

    for (const t of teams || []) {
      const norms = new Set<string>();
      norms.add(normName(t.canonical_name));
      if (t.oddsapi_name) norms.add(normName(t.oddsapi_name));

      teamById[t.id] = {
        canonical: t.canonical_name,
        oddsapi: t.oddsapi_name ?? null,
        norms,
      };

      for (const nn of norms) {
        if (!nn) continue;
        const arr = teamNormToIds.get(nn) || [];
        arr.push(t.id);
        teamNormToIds.set(nn, arr);
      }
    }

    // Report: participant names not mapping uniquely to a team
    const unmapped_participants: Array<{
      participant_full_name: string;
      participant_norm: string;
      reason: "no_match" | "ambiguous";
      matching_team_ids?: string[];
    }> = [];

    for (const full of participantNames) {
      const n = normName(full);
      const ids = teamNormToIds.get(n) || [];
      if (ids.length === 0) {
        unmapped_participants.push({
          participant_full_name: full,
          participant_norm: n,
          reason: "no_match",
        });
      } else if (ids.length > 1) {
        unmapped_participants.push({
          participant_full_name: full,
          participant_norm: n,
          reason: "ambiguous",
          matching_team_ids: ids,
        });
      }
    }

    // Report: teams whose oddsapi_name is missing or not matching any participant
    const teams_needing_attention: Array<{
      team_id: string;
      canonical_name: string;
      oddsapi_name: string | null;
      issue: "missing_oddsapi_name" | "oddsapi_name_not_in_participants";
      suggested_full_name?: string;
    }> = [];

    for (const t of teams || []) {
      const canonicalNorm = normName(t.canonical_name);
      const oddsapiNorm = t.oddsapi_name ? normName(t.oddsapi_name) : null;

      if (!t.oddsapi_name) {
        const sug = participantNormToFull.get(canonicalNorm);
        if (sug && sug.length === 1) {
          teams_needing_attention.push({
            team_id: t.id,
            canonical_name: t.canonical_name,
            oddsapi_name: null,
            issue: "missing_oddsapi_name",
            suggested_full_name: sug[0],
          });
        } else {
          teams_needing_attention.push({
            team_id: t.id,
            canonical_name: t.canonical_name,
            oddsapi_name: null,
            issue: "missing_oddsapi_name",
          });
        }
      } else if (oddsapiNorm && !participantNormToFull.has(oddsapiNorm)) {
        teams_needing_attention.push({
          team_id: t.id,
          canonical_name: t.canonical_name,
          oddsapi_name: t.oddsapi_name,
          issue: "oddsapi_name_not_in_participants",
        });
      }
    }

    // Optional: apply safe auto-fills
    let updated = 0;
    const updates: Array<{ team_id: string; new_oddsapi_name: string }> = [];

    if (apply) {
      for (const row of teams_needing_attention) {
        if (row.issue === "missing_oddsapi_name" && row.suggested_full_name) {
          const { error: updErr } = await supabase
            .from("pers_sys_teams")
            .update({ oddsapi_name: row.suggested_full_name })
            .eq("id", row.team_id);

          if (!updErr) {
            updated += 1;
            updates.push({
              team_id: row.team_id,
              new_oddsapi_name: row.suggested_full_name,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        apply,
        participants_seen: participantNames.length,
        unmapped_participants,
        teams_needing_attention,
        updates_applied: updated,
        updates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
