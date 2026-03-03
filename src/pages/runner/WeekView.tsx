import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";

export default function WeekView() {
  const [games, setGames] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sigError, setSigError] = useState<any>(null);
  const [debug, setDebug] = useState<{ passTrue: number; passAll: number }>({ passTrue: 0, passAll: 0 });
  const [unsettledByGame, setUnsettledByGame] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const season = new Date().getFullYear();
    const now = new Date();
    const end = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const endIso = end.toISOString();

    const { data: gamesData } = await supabase
      .from("pers_sys_games")
      .select(`
        *,
        home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name),
        away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)
      `)
      .eq("season", season)
      .gte("start_time_aet", nowIso)
      .lte("start_time_aet", endIso)
      .in("status", ["SCHEDULED", "LIVE"])
      .order("start_time_aet", { ascending: true })
      .limit(60);

    setGames(gamesData || []);

    if (gamesData && gamesData.length > 0) {
      const gameIds = gamesData.map((g) => g.id);
      const { data: sigPass, error: sigPassErr } = await supabase
        .from("pers_sys_signals")
        .select("*")
        .in("game_id", gameIds)
        .eq("pass", true);

      const { data: sigAll, error: sigAllErr } = await supabase
        .from("pers_sys_signals")
        .select("id,game_id,pass,system_code")
        .in("game_id", gameIds);

      setSignals(sigPass || []);
      setDebug({ passTrue: (sigPass || []).length, passAll: (sigAll || []).length });

      const { data: openBets, error: openBetsErr } = await supabase
        .from("pers_sys_bets")
        .select("game_id,status")
        .in("game_id", gameIds)
        .eq("status", "UNSETTLED");

      const ubg: Record<string, boolean> = {};
      for (const b of openBets || []) ubg[b.game_id] = true;
      setUnsettledByGame(ubg);

      setSigError(sigPassErr || sigAllErr || openBetsErr || null);
    }
    setLoading(false);
  }

  const signalsByGame: Record<string, any[]> = {};
  for (const s of signals) {
    if (!signalsByGame[s.game_id]) signalsByGame[s.game_id] = [];
    signalsByGame[s.game_id].push(s);
  }

  // Primary rule: SYS_7 dominance per game
  for (const gameId of Object.keys(signalsByGame)) {
    const arr = signalsByGame[gameId] || [];
    if (arr.some((x) => x.system_code === "SYS_7")) {
      signalsByGame[gameId] = arr.filter((x) => x.system_code === "SYS_7");
    }
  }

  // Secondary rule: existing real bet suppresses candidates
  const qualifiedGames = games.filter((g) => {
    if (unsettledByGame[g.id]) return false;
    return (signalsByGame[g.id]?.length || 0) > 0;
  });

  const otherGames = games.filter((g) => !qualifiedGames.some((q) => q.id === g.id));

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-mono">This Week</h1>

        {!loading && (
          <div className="text-[11px] font-mono text-muted-foreground">
            <div>debug: games={games.length} pass_true_signals={debug.passTrue} all_signals={debug.passAll} qualified_games={qualifiedGames.length}</div>
            {sigError && <div className="text-destructive">signals_error: {JSON.stringify(sigError)}</div>}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            {qualifiedGames.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full" />
                  Bet Queue ({qualifiedGames.length})
                </h2>
                <div className="space-y-2">
                  {qualifiedGames.map((g) => (
                    <GameRow key={g.id} game={g} signals={signalsByGame[g.id]} betPlaced={!!unsettledByGame[g.id]} />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                Other Games ({otherGames.length})
              </h2>
              <div className="space-y-2">
                {otherGames.map((g) => (
                  <GameRow key={g.id} game={g} signals={[]} betPlaced={!!unsettledByGame[g.id]} />
                ))}
              </div>
            </div>

            {games.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No upcoming games. Run "Pull Squiggle" first.
              </p>
            )}
          </>
        )}
      </div>
    </RunnerLayout>
  );
}

function formatLeg(leg: any) {
  const market = leg.leg_type || "?";
  const side = leg.side || "?";
  const line =
    market === "LINE" && leg.line_at_bet !== null && leg.line_at_bet !== undefined
      ? `${Number(leg.line_at_bet) > 0 ? "+" : ""}${leg.line_at_bet}`
      : "";
  const book = leg.exec_best_book || "—";
  const price = leg.exec_best_price || "—";
  return { market, side, line, book, price };
}

function GameRow({ game, signals, betPlaced }: { game: any; signals: any[]; betPlaced: boolean }) {
  const date = new Date(game.start_time_aet);
  const homeTeam = (game.home_team as any)?.canonical_name || "?";
  const awayTeam = (game.away_team as any)?.canonical_name || "?";

  return (
    <Link to={`/runner/game/${game.id}`} className="block">
      <div className={`runner-card ${signals.length > 0 ? "border-primary/30" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground font-mono w-16">
              R{game.round}
            </div>
            <div className="font-medium text-sm">
              {homeTeam} <span className="text-muted-foreground mx-1">v</span> {awayTeam}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {betPlaced && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                BET PLACED
              </span>
            )}
            {!betPlaced && signals.map((s) => (
              <span key={s.id} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {s.system_code}
              </span>
            ))}
            <span className="text-xs text-muted-foreground font-mono">
              {date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
              {" "}
              {date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {!betPlaced && signals.length > 0 && (
          <div className="mt-2 space-y-1">
            {signals.flatMap((s) => {
              const legs = (s?.reason && (s.reason as any).legs) ? (s.reason as any).legs : [];
              if (!Array.isArray(legs) || legs.length === 0) return [];
              return legs.map((leg: any, idx: number) => {
                const key = `${s.id || s.system_code || "sig"}_${idx}`;
                const f = formatLeg(leg);
                return (
                  <div key={key} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground">
                        {s.system_code}
                      </span>
                      <span className="text-muted-foreground">
                        {f.market} {f.side}{f.line}
                      </span>
                      <span className="text-muted-foreground">
                        exec: {f.book} @ {f.price}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const unitsOverride =
                            s.system_code === "SYS_7"
                              ? (s?.reason as any)?.recommended_units ?? null
                              : null;
                          const payload = {
                            p_game_id: game.id,
                            p_system_code: s.system_code,
                            p_leg_type: leg.leg_type,
                            p_side: leg.side,
                            p_line_at_bet: leg.line_at_bet ?? null,
                            p_exec_best_price: leg.exec_best_price ?? null,
                            p_exec_best_book: leg.exec_best_book ?? null,
                            p_ref_price: leg.ref_price ?? null,
                            p_units: unitsOverride,
                            p_snapshot_type: leg.snapshot_type ?? null,
                          };
                          const { data, error } = await supabase.rpc("accept_leg_create_bet", payload);
                          if (error) {
                            alert(`ACCEPT failed: ${error.message}`);
                            return;
                          }
                          alert(`ACCEPT result:\n${JSON.stringify(data, null, 2)}`);
                          window.location.reload();
                        } catch (err: any) {
                          alert(`ACCEPT failed: ${String(err)}`);
                        }
                      }}
                    >
                      Accept
                    </button>
                  </div>
                );
              });
            })}
          </div>
        )}
      </div>
    </Link>
  );
}
