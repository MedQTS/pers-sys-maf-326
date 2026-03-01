import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

export default function GameDetail() {
  const { id } = useParams();
  const [game, setGame] = useState<any>(null);
  const [teamStates, setTeamStates] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(gameId: string) {
    setLoading(true);
    const [gameRes, statesRes, snapsRes, sigRes, betsRes] = await Promise.all([
      supabase
        .from("pers_sys_games")
        .select(`
          *,
          home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name),
          away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)
        `)
        .eq("id", gameId)
        .single(),
      supabase.from("pers_sys_team_state").select("*, team:pers_sys_teams(canonical_name)").eq("game_id", gameId),
      supabase.from("pers_sys_market_snapshots").select("*").eq("game_id", gameId),
      supabase.from("pers_sys_signals").select("*").eq("game_id", gameId),
      supabase.from("pers_sys_bets").select("*").eq("game_id", gameId),
    ]);

    setGame(gameRes.data);
    setTeamStates(statesRes.data || []);
    setSnapshots(snapsRes.data || []);
    setSignals(sigRes.data || []);
    setBets(betsRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <RunnerLayout>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </RunnerLayout>
    );
  }

  if (!game) {
    return (
      <RunnerLayout>
        <p className="text-destructive text-sm">Game not found</p>
      </RunnerLayout>
    );
  }

  const homeTeam = (game.home_team as any)?.canonical_name || "?";
  const awayTeam = (game.away_team as any)?.canonical_name || "?";

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/runner/week" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono">
              {homeTeam} v {awayTeam}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              R{game.round} — {game.venue} — {new Date(game.start_time_aet).toLocaleString("en-AU")}
              <span className={`ml-2 status-badge ${game.status === "FT" ? "status-ft" : game.status === "LIVE" ? "status-live" : "status-scheduled"}`}>
                {game.status}
              </span>
            </p>
          </div>
        </div>

        {game.status === "FT" && (
          <div className="runner-card text-center">
            <span className="text-3xl font-mono font-bold">{game.home_score}</span>
            <span className="text-muted-foreground mx-3">–</span>
            <span className="text-3xl font-mono font-bold">{game.away_score}</span>
            <p className="text-xs text-muted-foreground mt-1">
              Margin: {game.margin_home > 0 ? "+" : ""}{game.margin_home} (Home)
            </p>
          </div>
        )}

        {/* Team State */}
        {teamStates.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Entering-Match State
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teamStates.map((ts) => (
                <div key={ts.id} className="runner-card">
                  <h3 className="font-medium text-sm mb-2">{(ts.team as any)?.canonical_name}</h3>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block">W-L-D</span>
                      {ts.wins}-{ts.losses}-{ts.draws}
                    </div>
                    <div>
                      <span className="text-muted-foreground block">%</span>
                      {Number(ts.percentage).toFixed(1)}
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Streak</span>
                      <span className={ts.streak > 0 ? "text-win" : ts.streak < 0 ? "text-loss" : ""}>
                        {ts.streak > 0 ? `W${ts.streak}` : ts.streak < 0 ? `L${Math.abs(ts.streak)}` : "–"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">PF/PA</span>
                      {ts.points_for}/{ts.points_against}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Snapshots */}
        {snapshots.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Market Snapshots
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {snapshots.map((s) => (
                <div key={s.id} className="runner-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 bg-secondary rounded">{s.snapshot_type}</span>
                    <span className="text-xs font-mono text-muted-foreground">{s.market_type}</span>
                  </div>
                  <div className="text-xs font-mono space-y-1">
                    {s.market_type === "H2H" ? (
                      <div className="flex justify-between">
                        <span>Home: <span className="text-foreground">${s.home_price?.toFixed(2)}</span></span>
                        <span>Away: <span className="text-foreground">${s.away_price?.toFixed(2)}</span></span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span>Home: {s.home_line > 0 ? "+" : ""}{s.home_line} @ ${s.home_line_price?.toFixed(2)}</span>
                        <span>Away: {s.away_line > 0 ? "+" : ""}{s.away_line} @ ${s.away_line_price?.toFixed(2)}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {s.agg_method} of {(s.books_used as string[])?.length || 0} books
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Signals
            </h2>
            <div className="space-y-2">
              {signals.map((s) => (
                <div key={s.id} className={`runner-card ${s.pass ? "border-primary/30" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold">{s.system_code}</span>
                    <span className={`text-xs font-mono font-semibold ${s.pass ? "signal-pass" : "signal-fail"}`}>
                      {s.pass ? "PASS ✓" : "FAIL ✗"}
                    </span>
                  </div>
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                    {JSON.stringify(s.reason, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bets */}
        {bets.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Logged Bets
            </h2>
            <div className="space-y-2">
              {bets.map((b) => (
                <div key={b.id} className="runner-card flex items-center justify-between">
                  <div className="text-xs font-mono space-y-0.5">
                    <div>{b.system_code} — {b.leg_type} — {b.side}</div>
                    <div className="text-muted-foreground">
                      {b.units}u @ ${b.price} {b.line_at_bet ? `(line ${b.line_at_bet})` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono">
                    {b.result ? (
                      <span className={b.result === "WIN" ? "bet-win" : b.result === "LOSS" ? "bet-loss" : "bet-push"}>
                        {b.result} {b.profit_units !== null && `(${b.profit_units > 0 ? "+" : ""}${b.profit_units}u)`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">PENDING</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </RunnerLayout>
  );
}
