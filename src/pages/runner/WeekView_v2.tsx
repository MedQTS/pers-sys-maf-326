import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";

type SignalV2Row = {
  id: string;
  game_id: string;
  system_code: string;
  model_snapshot: string | null;
  execution_snapshot: string | null;
  model_market: string | null;
  execution_market: string | null;
  pass: boolean;
  signal_status: "READY" | "PENDING" | "FAIL" | "BLOCKED" | "VOID" | null;
  leg_type: "H2H" | "LINE" | null;
  side: "HOME" | "AWAY" | null;
  line_at_bet: number | null;
  ref_price: number | null;
  exec_best_price: number | null;
  exec_best_book: string | null;
  recommended_units: number | null;
  reason_json: any;
  created_at: string;
};

type BetRow = {
  id: string;
  game_id: string;
  system_code: string;
  leg_type: string | null;
  side: string | null;
  line_at_bet: number | null;
  price: number | null;
  book: string | null;
  stake_amount: number | null;
  units: number | null;
  status: string | null;
  placed_ts: string | null;
  created_at: string;
};

function safeJson(x: any) {
  if (x == null) return null;
  if (typeof x === "object") return x;
  try { return JSON.parse(x); } catch { return null; }
}

function fmtLine(n: number | null) {
  if (n == null) return "";
  return `${n > 0 ? "+" : ""}${n}`;
}

function formatRoundLabel(round: any) {
  const n = Number(round);
  if (Number.isFinite(n) && n === 0) return "OR";
  if (Number.isFinite(n)) return `R${n}`;
  return "R?";
}

function formatLegFromRow(s: SignalV2Row) {
  const market = s.leg_type || s.execution_market || s.model_market || "?";
  const side = s.side || "?";
  const line = market === "LINE" ? fmtLine(s.line_at_bet ?? null) : "";
  const book = s.exec_best_book || "—";
  const price = s.exec_best_price ?? s.ref_price ?? null;
  return { market, side, line, book, price: price == null ? "—" : String(price) };
}

function pendingHintFromRow(s: SignalV2Row) {
  const r = safeJson(s.reason_json) || {};
  const needSnap =
    r?.overlay_child?.required_execution_snapshot ||
    r?.overlay?.depends_on ||
    s.execution_snapshot ||
    null;

  const why = r?.fail || r?.status || s.signal_status || "PENDING";

  return {
    needSnap: needSnap ? String(needSnap) : null,
    why: String(why),
  };
}

export default function WeekView_v2() {
  const [games, setGames] = useState<any[]>([]);
  const [signalsAll, setSignalsAll] = useState<SignalV2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [unsettledByGame, setUnsettledByGame] = useState<Record<string, boolean>>({});
  const [openBets, setOpenBets] = useState<BetRow[]>([]);
  const [showPending, setShowPending] = useState(true);

  useEffect(() => { loadData(); }, []);

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
        .select(`*, home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name), away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)`)
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
        setOpenBets([]);
        setLoading(false);
        return;
      }

      const gameIds = gamesData.map((g: any) => g.id);

      const { data: sigs, error: sigErr } = await supabase
        .from("pers_sys_signals_v2")
        .select(`id, game_id, system_code, model_snapshot, execution_snapshot, model_market, execution_market, pass, signal_status, leg_type, side, line_at_bet, ref_price, exec_best_price, exec_best_book, recommended_units, reason_json, created_at`)
        .in("game_id", gameIds);

      if (sigErr) throw sigErr;
      setSignalsAll((sigs as any) || []);

      const { data: betsData, error: betsErr } = await supabase
        .from("pers_sys_bets")
        .select("id,game_id,system_code,leg_type,side,line_at_bet,price,book,stake_amount,units,status,placed_ts,created_at")
        .in("game_id", gameIds)
        .not("status", "in", "(VOID,SETTLED)");

      if (betsErr) throw betsErr;

      const bets = (betsData as BetRow[]) || [];
      setOpenBets(bets);

      const ubg: Record<string, boolean> = {};
      for (const b of bets) {
        ubg[b.game_id] = true;
      }
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
    for (const gameId of Object.keys(out)) {
      const ready = out[gameId].ready || [];
      if (ready.some((x) => x.system_code === "SYS_7")) {
        out[gameId].ready = ready.filter((x) => x.system_code === "SYS_7");
      }
    }
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

  const betsByGame = useMemo(() => {
    const out: Record<string, BetRow[]> = {};
    for (const b of openBets) {
      if (!out[b.game_id]) out[b.game_id] = [];
      out[b.game_id].push(b);
    }
    return out;
  }, [openBets]);

  const readyGames = useMemo(() => {
    return games.filter((g) => (byGame[g.id]?.ready?.length || 0) > 0 && !unsettledByGame[g.id]);
  }, [games, byGame, unsettledByGame]);

  const placedGames = useMemo(() => {
    return games.filter((g) => !!unsettledByGame[g.id]);
  }, [games, unsettledByGame]);

  const otherGames = useMemo(() => {
    const readySet = new Set(readyGames.map((g) => g.id));
    const placedSet = new Set(placedGames.map((g) => g.id));
    return games.filter((g) => !readySet.has(g.id) && !placedSet.has(g.id));
  }, [games, readyGames, placedGames]);

  const pendingCount = useMemo(() => {
    let n = 0;
    for (const g of games) n += byGame[g.id]?.pending?.length || 0;
    return n;
  }, [games, byGame]);

  const refresh = () => loadData();

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono">This Week</h1>
            {!loading && (
              <div className="text-[11px] font-mono text-muted-foreground mt-1">
                games={games.length} ready={readyGames.length} placed={placedGames.length} pending_signals={pendingCount}
              </div>
            )}
            {err && <div className="text-[11px] font-mono text-destructive mt-1">{String(err?.message || err)}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={`text-xs font-mono px-3 py-1.5 rounded-md border transition-colors ${showPending ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`} onClick={() => setShowPending((v) => !v)}>
              Pending: {showPending ? "ON" : "OFF"}
            </button>
            <button type="button" className="text-xs font-mono px-3 py-1.5 rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors" onClick={() => loadData()}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            {/* Bets Ready */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full" />
                  Bets Ready ({readyGames.length})
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground">(Only shows actionable; hides failed)</span>
              </div>
              {readyGames.length === 0 ? (
                <div className="runner-card"><p className="text-sm text-muted-foreground text-center py-2">No bets ready right now.</p></div>
              ) : (
                <div className="space-y-2">
                  {readyGames.map((g) => (
                    <GameCard key={g.id} game={g} readySignals={byGame[g.id]?.ready || []} pendingSignals={byGame[g.id]?.pending || []} betPlaced={false} placedBets={[]} showPending={showPending} variant="ready" onRefresh={refresh} />
                  ))}
                </div>
              )}
            </div>

            {/* Bets Placed */}
            {placedGames.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-mono text-sky-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 bg-sky-500 rounded-full" />
                  Bets Placed ({placedGames.length})
                </h2>
                <div className="space-y-2">
                  {placedGames.map((g) => (
                    <GameCard key={g.id} game={g} readySignals={byGame[g.id]?.ready || []} pendingSignals={byGame[g.id]?.pending || []} betPlaced={true} placedBets={betsByGame[g.id] || []} showPending={showPending} variant="placed" onRefresh={refresh} />
                  ))}
                </div>
              </div>
            )}

            {/* Fixture */}
            <div className="space-y-3">
              <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Fixture ({otherGames.length})</h2>
              <div className="space-y-2">
                {otherGames.map((g) => (
                  <GameCard key={g.id} game={g} readySignals={byGame[g.id]?.ready || []} pendingSignals={byGame[g.id]?.pending || []} betPlaced={false} placedBets={[]} showPending={showPending} variant={g.status === "LIVE" ? "live" : "normal"} onRefresh={refresh} />
                ))}
              </div>
              {games.length === 0 && <p className="text-muted-foreground text-sm">No upcoming games. Run "Pull Squiggle" first.</p>}
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
  placedBets: BetRow[];
  showPending: boolean;
  variant: "ready" | "normal" | "live" | "placed";
  onRefresh: () => Promise<void> | void;
}) {
  const { game, readySignals, pendingSignals, betPlaced, placedBets, showPending, variant, onRefresh } = props;

  const date = new Date(game.start_time_aet);
  const homeTeam = (game.home_team as any)?.canonical_name || "?";
  const awayTeam = (game.away_team as any)?.canonical_name || "?";

  const borderClass =
    variant === "ready" ? "border-emerald-500/30 bg-emerald-500/5"
    : variant === "placed" ? "border-sky-500/30 bg-sky-500/5"
    : variant === "live" ? "border-slate-500/30 bg-slate-500/5"
    : "border-border";

  return (
    <Link to={`/runner/game/${game.id}`} className="block">
      <div className={`runner-card ${borderClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground font-mono w-16">{formatRoundLabel(game.round)}</div>
            <div className="font-medium text-sm">
              {homeTeam} <span className="text-muted-foreground mx-1">v</span> {awayTeam}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {game.status === "LIVE" && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">IN PLAY</span>
            )}
            {betPlaced && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">BET MADE</span>
            )}
            {!betPlaced && readySignals.map((s) => (
              <span key={s.id} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s.system_code}</span>
            ))}
{showPending && pendingSignals.length > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">pending: {pendingSignals.length}{betPlaced ? " (after bet)" : ""}</span>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              {date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}{" "}
              {date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Placed bet details */}
        {betPlaced && placedBets.length > 0 && (
          <div className="mt-2 space-y-1">
            {placedBets.map((b) => (
              <div key={b.id} className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-500">{b.system_code}</span>
                <span>{b.leg_type} {b.side}{b.leg_type === "LINE" ? " " + fmtLine(b.line_at_bet) : ""}</span>
                <span>·</span>
                <span>{b.book || "—"} @ {b.price ?? "—"}</span>
                <span>·</span>
                <span>units {b.units ?? "—"}</span>
                <span>·</span>
                <span>stake ${b.stake_amount ?? "—"}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ready legs with Accept */}
        {!betPlaced && readySignals.length > 0 && (
          <div className="mt-2 space-y-1">
            {readySignals.map((s) => {
              const f = formatLegFromRow(s);
              const r = safeJson(s.reason_json) || {};
              const unitsOverride = s.system_code === "SYS_7" ? (s.recommended_units ?? r?.recommended_units ?? null) : null;

              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground">{s.system_code}</span>
                    <span className="text-muted-foreground">{f.market} {f.side}{f.line}</span>
                    <span className="text-muted-foreground">exec: {f.book} @ {f.price}</span>
                  </div>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const msg = `Create bet for ${s.system_code} ${f.market} ${f.side}${f.line}?`;
                      if (!window.confirm(msg)) return;

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
                          p_snapshot_type: s.execution_snapshot ?? s.model_snapshot ?? null,
                        };
                        const { data, error } = await supabase.rpc("accept_leg_create_bet", payload);
                        if (error) { alert(`ACCEPT failed: ${error.message}`); return; }
                        const result = data as any;
                        if (result?.ok === false) {
                          alert(`ACCEPT rejected: ${result.error || JSON.stringify(result)}`);
                          return;
                        }
                        await onRefresh();
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

        {showPending && pendingSignals.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
            <div className="text-[10px] font-mono text-muted-foreground mb-1">
              Pending / Maybe (hidden by default){betPlaced ? " — shown even after bet so you can see overlays" : ""}
            </div>

            {pendingSignals.slice(0, 6).map((s) => {
              const f = formatLegFromRow(s);
              const hint = pendingHintFromRow(s);

              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-[11px] font-mono opacity-90">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                      {s.system_code}
                    </span>

                    <span className="text-muted-foreground">
                      {f.market} {f.side}
                      {f.line}
                    </span>

                    <span className="text-muted-foreground">
                      exec: {f.book} @ {f.price}
                    </span>

                    {hint.needSnap && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        needs {hint.needSnap}
                      </span>
                    )}

                    <span className="text-muted-foreground">
                      ({hint.why})
                    </span>
                  </div>

                  <span className="text-muted-foreground">
                    {s.model_snapshot || "—"}
                  </span>
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
