import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";

type SignalV2Row = {
  id: string;
  game_id: string;
  system_code: string;

  // v2 fields
  model_snapshot: string | null;
  execution_snapshot: string | null;
  model_market: string | null;
  execution_market: string | null;

  pass: boolean;
  signal_status: "READY" | "PENDING" | "FAIL" | "BLOCKED" | "VOID" | null;

  // single-leg fields (preferred for UI)
  leg_type: "H2H" | "LINE" | null;
  side: "HOME" | "AWAY" | null;
  line_at_bet: number | null;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  recommended_units: number | null;

  // json payload (still useful for debugging)
  reason_json: any;

  created_at: string;
};

function safeJson(x: any) {
  if (x == null) return null;
  if (typeof x === "object") return x;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

function fmtLine(n: number | null) {
  if (n == null) return "";
  return `${n > 0 ? "+" : ""}${n}`;
}

function formatLegFromRow(s: SignalV2Row) {
  const market = s.leg_type || s.execution_market || s.model_market || "?";
  const side = s.side || "?";
  const line = market === "LINE" ? fmtLine(s.line_at_bet ?? null) : "";
  const book = s.exec_best_book || "—";
  const price = s.exec_best_price ?? null;

  return {
    market,
    side,
    line,
    book,
    price: price == null ? "—" : String(price),
  };
}

export default function WeekView_v2() {
  const [games, setGames] = useState<any[]>([]);
  const [signalsAll, setSignalsAll] = useState<SignalV2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [unsettledByGame, setUnsettledByGame] = useState<Record<string, boolean>>({});
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErr(null);

    const season = new Date().getFullYear();
    const now = new Date();
    const end = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const nowIso = now.toISOString();
    const endIso = end.toISOString();

    try {
      const { data: gamesData, error: gamesErr } = await supabase
        .from("pers_sys_games")
        .select(
          `
          *,
          home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name),
          away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)
        `,
        )
        .eq("season", season)
        .gte("start_time_aet", nowIso)
        .lte("start_time_aet", endIso)
        .in("status", ["SCHEDULED", "LIVE"])
        .order("start_time_aet", { ascending: true })
        .limit(80);

      if (gamesErr) throw gamesErr;
      setGames(gamesData || []);

      if (!gamesData || gamesData.length === 0) {
        setSignalsAll([]);
        setUnsettledByGame({});
        setLoading(false);
        return;
      }

      const gameIds = gamesData.map((g: any) => g.id);

      // IMPORTANT: read v2 columns, not legacy ones
      const { data: sigs, error: sigErr } = await supabase
        .from("pers_sys_signals_v2")
        .select(
          `
          id, game_id, system_code,
          model_snapshot, execution_snapshot,
          model_market, execution_market,
          pass, signal_status,
          leg_type, side, line_at_bet, ref_price,
          exec_best_price, exec_best_book,
          recommended_units,
          reason_json,
          created_at
        `,
        )
        .in("game_id", gameIds);

      if (sigErr) throw sigErr;
      setSignalsAll((sigs as any) || []);

      const { data: openBets, error: openBetsErr } = await supabase
        .from("pers_sys_bets")
        .select("game_id,status")
        .in("game_id", gameIds)
        .eq("status", "UNSETTLED");

      if (openBetsErr) throw openBetsErr;

      const ubg: Record<string, boolean> = {};
      for (const b of openBets || []) ubg[b.game_id] = true;
      setUnsettledByGame(ubg);

      setLoading(false);
    } catch (e: any) {
      setErr(e);
      setLoading(false);
    }
  }

  const byGame = useMemo(() => {
    const out: Record<string, { ready: SignalV2Row[]; pending: SignalV2Row[]; fail: SignalV2Row[] }> = {};

    for (const g of games) out[g.id] = { ready: [], pending: [], fail: [] };

    for (const s of signalsAll) {
      if (!out[s.game_id]) out[s.game_id] = { ready: [], pending: [], fail: [] };

      const st = s.signal_status || (s.pass ? "READY" : "FAIL");

      if (st === "READY") out[s.game_id].ready.push(s);
      else if (st === "PENDING") out[s.game_id].pending.push(s);
      else out[s.game_id].fail.push(s);
    }

    // SYS_7 dominance per game (READY only)
    for (const gameId of Object.keys(out)) {
      const ready = out[gameId].ready || [];
      if (ready.some((x) => x.system_code === "SYS_7")) {
        out[gameId].ready = ready.filter((x) => x.system_code === "SYS_7");
      }
    }

    // optional: stable ordering (priority inside reason_json if present)
    for (const gameId of Object.keys(out)) {
      out[gameId].ready.sort((a, b) => {
        const pa = Number(safeJson(a.reason_json)?.system_priority ?? 999);
        const pb = Number(safeJson(b.reason_json)?.system_priority ?? 999);
        return pa - pb;
      });
      out[gameId].pending.sort((a, b) => {
        const pa = Number(safeJson(a.reason_json)?.system_priority ?? 999);
        const pb = Number(safeJson(b.reason_json)?.system_priority ?? 999);
        return pa - pb;
      });
    }

    return out;
  }, [signalsAll, games]);

  const readyGames = useMemo(() => {
    return games.filter((g) => {
      if (unsettledByGame[g.id]) return false;
      return (byGame[g.id]?.ready?.length || 0) > 0;
    });
  }, [games, unsettledByGame, byGame]);

  const otherGames = useMemo(() => {
    const readySet = new Set(readyGames.map((g) => g.id));
    return games.filter((g) => !readySet.has(g.id));
  }, [games, readyGames]);

  const pendingCount = useMemo(() => {
    let n = 0;
    for (const g of games) n += byGame[g.id]?.pending?.length || 0;
    return n;
  }, [games, byGame]);

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono">This Week</h1>
            {!loading && (
              <div className="text-[11px] font-mono text-muted-foreground mt-1">
                games={games.length} ready_games={readyGames.length} pending_signals={pendingCount}
              </div>
            )}
            {err && <div className="text-[11px] font-mono text-destructive mt-1">{String(err?.message || err)}</div>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`text-xs font-mono px-3 py-1.5 rounded-md border transition-colors ${
                showPending
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
              onClick={() => setShowPending((v) => !v)}
            >
              Explode: {showPending ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              className="text-xs font-mono px-3 py-1.5 rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => loadData()}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            {/* BETS READY */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full" />
                  Bets Ready ({readyGames.length})
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground">
                  (Only shows actionable; hides failed)
                </span>
              </div>

              {readyGames.length === 0 ? (
                <div className="runner-card">
                  <p className="text-sm text-muted-foreground text-center py-2">No bets ready right now.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {readyGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      readySignals={byGame[g.id]?.ready || []}
                      pendingSignals={byGame[g.id]?.pending || []}
                      betPlaced={!!unsettledByGame[g.id]}
                      showPending={showPending}
                      variant="ready"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* FIXTURE */}
            <div className="space-y-3">
              <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                Fixture ({otherGames.length})
              </h2>
              <div className="space-y-2">
                {otherGames.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    readySignals={byGame[g.id]?.ready || []}
                    pendingSignals={byGame[g.id]?.pending || []}
                    betPlaced={!!unsettledByGame[g.id]}
                    showPending={showPending}
                    variant={g.status === "LIVE" ? "live" : "normal"}
                  />
                ))}
              </div>

              {games.length === 0 && (
                <p className="text-muted-foreground text-sm">No upcoming games. Run "Pull Squiggle" first.</p>
              )}
            </div>
          </>
        )}
      </div>
    </RunnerLayout>
  );
}

function GameCard(props: {
  game: any;
  readySignals: SignalV2Row[];
  pendingSignals: SignalV2Row[];
  betPlaced: boolean;
  showPending: boolean;
  variant: "ready" | "normal" | "live";
}) {
  const { game, readySignals, pendingSignals, betPlaced, showPending, variant } = props;

  const date = new Date(game.start_time_aet);
  const homeTeam = (game.home_team as any)?.canonical_name || "?";
  const awayTeam = (game.away_team as any)?.canonical_name || "?";

  const borderClass =
    variant === "ready"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : variant === "live"
        ? "border-slate-500/30 bg-slate-500/5"
        : "border-border";

  return (
    <Link to={`/runner/game/${game.id}`} className="block">
      <div className={`runner-card ${borderClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground font-mono w-16">R{game.round}</div>
            <div className="font-medium text-sm">
              {homeTeam} <span className="text-muted-foreground mx-1">v</span> {awayTeam}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {game.status === "LIVE" && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                IN PLAY
              </span>
            )}

            {betPlaced && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                BET MADE
              </span>
            )}

            {!betPlaced &&
              readySignals.map((s) => (
                <span key={s.id} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {s.system_code}
                </span>
              ))}

            {showPending && !betPlaced && pendingSignals.length > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                pending: {pendingSignals.length}
              </span>
            )}

            <span className="text-xs text-muted-foreground font-mono">
              {date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}{" "}
              {date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* READY LEGS */}
        {!betPlaced && readySignals.length > 0 && (
          <div className="mt-2 space-y-1">
            {readySignals.map((s) => {
              const f = formatLegFromRow(s);
              const r = safeJson(s.reason_json) || {};
              const unitsOverride =
                s.system_code === "SYS_7" ? (s.recommended_units ?? r?.recommended_units ?? null) : null;

              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground">{s.system_code}</span>
                    <span className="text-muted-foreground">
                      {f.market} {f.side}
                      {f.line}
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
                        const payload = {
                          p_game_id: s.game_id,
                          p_system_code: s.system_code,
                          p_leg_type: s.leg_type,
                          p_side: s.side,
                          p_line_at_bet: s.line_at_bet ?? null,
                          p_exec_best_price: s.exec_best_price ?? null,
                          p_exec_best_book: s.exec_best_book ?? null,
                          p_ref_price: s.ref_price ?? null,
                          p_units: unitsOverride,
                          // use execution snapshot for what you’re actually placing
                          p_snapshot_type: s.execution_snapshot ?? s.model_snapshot ?? null,
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
            })}
          </div>
        )}

        {/* PENDING (explode) */}
        {showPending && !betPlaced && pendingSignals.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
            <div className="text-[10px] font-mono text-muted-foreground mb-1">Pending / Maybe (hidden by default)</div>
            {pendingSignals.slice(0, 6).map((s) => {
              const r = safeJson(s.reason_json) || {};
              const why = r?.fail || r?.status || "pending";
              return (
                <div key={s.id} className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">{s.system_code}</span>
                    <span className="text-muted-foreground">waiting: {String(why)}</span>
                  </div>
                  <span className="text-muted-foreground">{s.model_snapshot || "—"}</span>
                </div>
              );
            })}
            {pendingSignals.length > 6 && (
              <div className="text-[10px] font-mono text-muted-foreground">
                +{pendingSignals.length - 6} more pending…
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
