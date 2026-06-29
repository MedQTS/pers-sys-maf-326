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
  const [sys12Audit, setSys12Audit] = useState<any | null>(null);
  const [showSys12Raw, setShowSys12Raw] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(gameId: string) {
    setLoading(true);
    const [gameRes, statesRes, snapsRes, sigRes, betsRes, sys12Res] = await Promise.all([
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
      supabase.from("pers_sys_signals_v2").select("*").eq("game_id", gameId),
      supabase.from("pers_sys_bets").select("*").eq("game_id", gameId).neq("status", "VOID"),
      supabase
        .from("pers_sys_signal_audit_v2")
        .select("id, system_code, audit_status, fail_code, reason_json, created_at")
        .eq("game_id", gameId)
        .eq("system_code", "SYS_12")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setGame(gameRes.data);
    setTeamStates(statesRes.data || []);
    setSnapshots(snapsRes.data || []);
    setSignals(sigRes.data || []);
    setBets(betsRes.data || []);
    setSys12Audit(sys12Res.data || null);
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

        {/* SYS_12 — Bottom-2/3 Fade Multi Candidate (Phase 1A audit-only) */}
        {sys12Audit && (() => {
          const r = (sys12Audit.reason_json ?? {}) as any;
          const status = sys12Audit.audit_status as string | null;
          const failCode = sys12Audit.fail_code as string | null;
          const isFail = status === "FAIL";
          const isTier3 = failCode === "tier3_team_involved";

          const tierLabel = (t: string | null | undefined) => {
            if (t === "T1_GOLDEN") return "Tier 1 / Golden";
            if (t === "T2_NERVOUS") return "Tier 2 / Nervous — reduced exposure";
            return t ? String(t) : null;
          };
          const failLabel = (c: string | null | undefined) => {
            switch (c) {
              case "tier3_team_involved": return "Tier 3 team involved — game excluded";
              case "no_bottom_2_3_fade_target": return "No Bottom-2/3 fade target in this game";
              case "favourite_not_identified": return "Favourite not identified";
              case "missing_team_data": return "Missing team data";
              default: return c ? String(c) : "Unknown fail";
            }
          };

          const selTier = r?.selection_tier as string | undefined;
          const warns: string[] = Array.isArray(r?.warning_codes) ? r.warning_codes : [];
          const hasT2Warn = warns.includes("tier2_reduced_exposure");

          return (
            <div className="space-y-2">
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                SYS_12 — Bottom-2/3 Fade Multi Candidate
              </h2>
              <div className={`runner-card ${isFail ? (isTier3 ? "border-destructive/40" : "border-border") : "border-primary/30"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold">SYS_12</span>
                  {isFail ? (
                    isTier3 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        Tier 3 / Excluded
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {status}
                      </span>
                    )
                  ) : selTier === "T1_GOLDEN" ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {tierLabel(selTier)}
                    </span>
                  ) : selTier === "T2_NERVOUS" ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                      {tierLabel(selTier)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {tierLabel(selTier) ?? status ?? "—"}
                    </span>
                  )}
                </div>

                {!isFail && (
                  <div className="text-xs font-mono space-y-1">
                    <div>
                      Selected: <span className="text-foreground">{r?.selection_team ?? "—"}</span>
                    </div>
                    <div>
                      Fade target: <span className="text-foreground">{r?.fade_target_team ?? "—"}</span>
                    </div>
                    {warns.length > 0 && (
                      <div className="text-muted-foreground">
                        Warnings: {warns.join(", ")}
                      </div>
                    )}
                    {hasT2Warn && (
                      <div className="mt-2 text-[11px] font-mono text-amber-500">
                        Tier 2 caution: reduced exposure candidate. This is not an exclusion.
                      </div>
                    )}
                  </div>
                )}

                {isFail && (
                  <div className="text-xs font-mono space-y-1">
                    <div>
                      Status: <span className="text-foreground">{status}</span>
                    </div>
                    <div>
                      Fail: <span className="text-foreground">{failLabel(failCode)}</span>
                      {failCode && (
                        <span className="text-muted-foreground"> ({failCode})</span>
                      )}
                    </div>
                    {(r?.home_team || r?.away_team) && (
                      <div className="text-muted-foreground">
                        {r?.home_team ?? "?"} v {r?.away_team ?? "?"}
                      </div>
                    )}
                    {r?.selection_team && (
                      <div>Selected: <span className="text-foreground">{r.selection_team}</span></div>
                    )}
                    {r?.fade_target_team && (
                      <div>Fade target: <span className="text-foreground">{r.fade_target_team}</span></div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-muted-foreground">
                  SYS_12 Phase 1 — candidate only. No basket/staking created yet.
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowSys12Raw((v) => !v)}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground underline"
                  >
                    {showSys12Raw ? "Hide" : "Show"} raw reason_json
                  </button>
                  {showSys12Raw && (
                    <pre className="mt-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                      {JSON.stringify(sys12Audit.reason_json, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          );
        })()}


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
                    {JSON.stringify(s.reason_json ?? s.reason, null, 2)}
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
