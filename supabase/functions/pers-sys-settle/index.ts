import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get unsettled bets (no result yet) with their game data
    const { data: unsettledBets } = await supabase
      .from("pers_sys_bets")
      .select("*, game:pers_sys_games!pers_sys_bets_game_id_fkey(*)")
      .eq("status", "UNSETTLED");

    if (!unsettledBets || unsettledBets.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, settled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let settled = 0;

    for (const bet of unsettledBets) {
      const game = bet.game as any;
      if (!game || game.status !== "FT") continue;

      const marginHome = game.margin_home;
      if (marginHome === null || marginHome === undefined) continue;

      let result: "WIN" | "LOSS" | "PUSH" = "LOSS";
      let profitUnits = -bet.units;

      if (bet.leg_type === "H2H") {
        if (game.is_draw) {
          result = "PUSH";
          profitUnits = 0;
        } else if (bet.side === "HOME" && marginHome > 0) {
          result = "WIN";
          profitUnits = bet.units * (bet.price - 1);
        } else if (bet.side === "AWAY" && marginHome < 0) {
          result = "WIN";
          profitUnits = bet.units * (bet.price - 1);
        }
      } else if (bet.leg_type === "LINE") {
        const line = bet.line_at_bet ?? 0;
        const teamMargin = bet.side === "HOME" ? marginHome : -marginHome;
        const adjustedMargin = teamMargin + line;

        if (adjustedMargin === 0) {
          result = "PUSH";
          profitUnits = 0;
        } else if (adjustedMargin > 0) {
          result = "WIN";
          profitUnits = bet.units * (bet.price - 1);
        }
      }

      profitUnits = Number(profitUnits.toFixed(3));

      const { error } = await supabase
        .from("pers_sys_bets")
        .update({ result, profit_units: profitUnits, status: "SETTLED" })
        .eq("id", bet.id);

      if (!error) settled++;
    }

    return new Response(
      JSON.stringify({ ok: true, settled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
