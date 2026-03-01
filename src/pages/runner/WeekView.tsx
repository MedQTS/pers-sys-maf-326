import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";

export default function WeekView() {
  const [games, setGames] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data: sigData } = await supabase
        .from("pers_sys_signals")
        .select("*")
        .in("game_id", gameIds)
        .eq("pass", true);
      setSignals(sigData || []);
    }
    setLoading(false);
  }

  const signalsByGame: Record<string, any[]> = {};
  for (const s of signals) {
    if (!signalsByGame[s.game_id]) signalsByGame[s.game_id] = [];
    signalsByGame[s.game_id].push(s);
  }

  const qualifiedGames = games.filter((g) => signalsByGame[g.id]?.length > 0);
  const otherGames = games.filter((g) => !signalsByGame[g.id]?.length);

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-mono">This Week</h1>

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
                    <GameRow key={g.id} game={g} signals={signalsByGame[g.id]} />
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
                  <GameRow key={g.id} game={g} signals={[]} />
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

function GameRow({ game, signals }: { game: any; signals: any[] }) {
  const date = new Date(game.start_time_aet);
  const homeTeam = (game.home_team as any)?.canonical_name || "?";
  const awayTeam = (game.away_team as any)?.canonical_name || "?";

  return (
    <Link to={`/runner/game/${game.id}`} className="block">
      <div className={`runner-card flex items-center justify-between ${signals.length > 0 ? "border-primary/30" : ""}`}>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground font-mono w-16">
            R{game.round}
          </div>
          <div className="font-medium text-sm">
            {homeTeam} <span className="text-muted-foreground mx-1">v</span> {awayTeam}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {signals.map((s) => (
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
    </Link>
  );
}
