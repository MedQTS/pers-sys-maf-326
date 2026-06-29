import { useEffect, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/integrations/supabase/client";

const PHASE_2A_FUNCTION = "pers-sys-sys12-basket-preview";

type Tier = "T1_GOLDEN" | "T2_NERVOUS" | string;

interface Leg {
  game_id: string;
  home_team: string | null;
  away_team: string | null;
  selection_team: string | null;
  fade_target_team?: string | null;
  selection_side?: string | null;
  selection_tier: Tier | null;
  selection_tier_label?: string | null;
  warning_codes?: string[];
  selected_price: number | null;
  price_status: "available" | "missing" | string;
}

interface BasketOption {
  option_type: string;
  leg_count: number;
  legs: Leg[];
  contains_tier2: boolean;
  warnings: string[];
  combined_decimal_odds: number | null;
  preview_only: boolean;
  manual_approval_required: boolean;
  display_caution_text: string | null;
  status_text: string;
}

interface PreviewResponse {
  ok: boolean;
  mode?: string;
  system_code?: string;
  scope?: { season: number | null; round: number | null; game_id: string | null };
  candidate_legs?: Leg[];
  excluded_games?: Array<{
    game_id: string;
    home_team: string | null;
    away_team: string | null;
    fail_code: string | null;
    audit_status: string;
    round: number | null;
    season: number | null;
  }>;
  basket_options?: {
    two_leg: BasketOption[];
    three_leg: BasketOption[];
    trebles_from_four: BasketOption[];
  };
  counts?: Record<string, number>;
  side_effects?: { db_writes: number; signals_created: number; bets_created: number; alerts_created: number };
  warnings?: string[];
  status_text?: string;
  error?: string;
}

const tierLabel = (t: Tier | null | undefined) => {
  if (t === "T1_GOLDEN") return "Tier 1 / Golden";
  if (t === "T2_NERVOUS") return "Tier 2 / Nervous — reduced exposure";
  return t ? String(t) : "—";
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

const PERMANENT_BANNER =
  "Preview only — no bet, stake, alert, signal, or basket placement is created.";

export default function Sys12Basket() {
  const [season, setSeason] = useState<string>("");
  const [round, setRound] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<PreviewResponse | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { include_fail_diagnostics: true };
      if (season) body.season = Number(season);
      if (round) body.round = Number(round);
      const { data, error } = await supabase.functions.invoke(PHASE_2A_FUNCTION, { body });
      if (error) {
        setErr(error.message ?? "invoke_failed");
        setResp(null);
      } else {
        setResp(data as PreviewResponse);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = resp?.counts ?? {};
  const se = resp?.side_effects;
  const candidates = resp?.candidate_legs ?? [];
  const excluded = resp?.excluded_games ?? [];
  const opts = resp?.basket_options ?? { two_leg: [], three_leg: [], trebles_from_four: [] };

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold font-mono">SYS_12 Basket Preview</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Bottom-2/3 Fade Multi — candidate preview only (Phase 2A).
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Season</label>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="auto"
                className="w-20 px-2 py-1 text-xs font-mono bg-secondary border border-border rounded"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Round</label>
              <input
                value={round}
                onChange={(e) => setRound(e.target.value)}
                placeholder="auto"
                className="w-20 px-2 py-1 text-xs font-mono bg-secondary border border-border rounded"
              />
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-mono rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh preview"}
            </button>
          </div>
        </div>

        <div className="runner-card border-primary/40">
          <p className="text-xs font-mono text-primary">{PERMANENT_BANNER}</p>
        </div>

        {err && (
          <div className="runner-card border-destructive/40">
            <p className="text-xs font-mono text-destructive">Error: {err}</p>
          </div>
        )}

        {/* Summary */}
        {resp && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              ["Candidates", counts.candidate_legs ?? candidates.length],
              ["Excluded", counts.excluded_games ?? excluded.length],
              ["2-leg opts", counts.two_leg_options ?? opts.two_leg.length],
              ["3-leg opts", counts.three_leg_options ?? opts.three_leg.length],
              ["Trebles/4", counts.trebles_from_four_options ?? opts.trebles_from_four.length],
              ["Scope", resp.scope ? `S${resp.scope.season ?? "?"} R${resp.scope.round ?? "?"}` : "—"],
            ].map(([label, val]) => (
              <div key={String(label)} className="runner-card">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">{label}</div>
                <div className="text-sm font-mono font-semibold">{String(val)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Side-effect proof */}
        {se && (
          <div className="runner-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Side effects (read-only proof)</div>
            <div className="text-xs font-mono grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>db_writes: <span className="text-foreground">{se.db_writes}</span></div>
              <div>signals_created: <span className="text-foreground">{se.signals_created}</span></div>
              <div>bets_created: <span className="text-foreground">{se.bets_created}</span></div>
              <div>alerts_created: <span className="text-foreground">{se.alerts_created}</span></div>
            </div>
          </div>
        )}

        {/* Candidate legs */}
        <section className="space-y-2">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Candidate legs</h2>
          {candidates.length === 0 ? (
            <div className="runner-card">
              <p className="text-xs font-mono text-muted-foreground">
                No SYS_12 basket candidates available for this round.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {candidates.map((l) => {
                const isT2 = l.selection_tier === "T2_NERVOUS";
                const t2warn = (l.warning_codes ?? []).includes("tier2_reduced_exposure");
                return (
                  <div
                    key={l.game_id}
                    className={`runner-card ${isT2 ? "border-amber-500/40" : "border-primary/30"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-semibold">
                        {l.home_team ?? "?"} v {l.away_team ?? "?"}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isT2
                            ? "bg-amber-500/10 text-amber-500"
                            : l.selection_tier === "T1_GOLDEN"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {tierLabel(l.selection_tier)}
                      </span>
                    </div>
                    <div className="text-xs font-mono space-y-0.5">
                      <div>Selected: <span className="text-foreground">{l.selection_team ?? "—"}</span> ({l.selection_side ?? "—"})</div>
                      <div>Fade target: <span className="text-foreground">{l.fade_target_team ?? "—"}</span></div>
                      <div>
                        Price:{" "}
                        <span className="text-foreground">
                          {l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "—"}
                        </span>{" "}
                        <span className="text-muted-foreground">[{l.price_status}]</span>
                      </div>
                      {(l.warning_codes ?? []).length > 0 && (
                        <div className="text-muted-foreground">
                          Warnings: {l.warning_codes!.join(", ")}
                        </div>
                      )}
                      {t2warn && (
                        <div className="mt-1 text-[11px] font-mono text-amber-500">
                          Tier 2 caution: reduced exposure candidate. Manual approval required.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Excluded diagnostics */}
        {excluded.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Excluded diagnostics (never basket-eligible)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {excluded.map((g) => (
                <div key={g.game_id} className="runner-card border-destructive/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-semibold">
                      {g.home_team ?? "?"} v {g.away_team ?? "?"}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      {g.audit_status}
                    </span>
                  </div>
                  <div className="text-xs font-mono space-y-0.5">
                    <div>Reason: <span className="text-foreground">{failLabel(g.fail_code)}</span></div>
                    {g.fail_code && (
                      <div className="text-muted-foreground">Code: {g.fail_code}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Basket option sections */}
        <BasketSection title="2-leg previews" options={opts.two_leg} emptyMsg="Insufficient SYS_12 candidates for this preview type." />
        <BasketSection title="3-leg previews" options={opts.three_leg} emptyMsg="Insufficient SYS_12 candidates for this preview type." />
        <BasketSection title="Trebles from four" options={opts.trebles_from_four} emptyMsg="Insufficient SYS_12 candidates for this preview type." />

        {/* Raw diagnostics */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline"
          >
            {showRaw ? "Hide" : "Show"} raw JSON response
          </button>
          {showRaw && (
            <pre className="runner-card text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-96 overflow-auto">
              {JSON.stringify(resp, null, 2)}
            </pre>
          )}
        </section>

        <p className="text-[10px] font-mono text-muted-foreground">{PERMANENT_BANNER}</p>
      </div>
    </RunnerLayout>
  );
}

function BasketSection({
  title,
  options,
  emptyMsg,
}: {
  title: string;
  options: BasketOption[];
  emptyMsg: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{title}</h2>
      {options.length === 0 ? (
        <div className="runner-card">
          <p className="text-xs font-mono text-muted-foreground">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((o, i) => {
            const missingPrice = (o.warnings ?? []).includes("combined_odds_unavailable_price_missing");
            return (
              <div
                key={`${o.option_type}-${i}`}
                className={`runner-card ${o.contains_tier2 ? "border-amber-500/40" : "border-primary/30"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold">
                    {o.option_type} · {o.leg_count} legs
                  </span>
                  <span className="text-xs font-mono">
                    {o.combined_decimal_odds != null
                      ? <>Combined: <span className="text-foreground">${o.combined_decimal_odds.toFixed(2)}</span></>
                      : <span className="text-muted-foreground">Combined: —</span>}
                  </span>
                </div>
                <ul className="text-xs font-mono space-y-0.5 mb-2">
                  {o.legs.map((l) => (
                    <li key={l.game_id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {l.selection_team} <span className="text-muted-foreground">(fade {l.fade_target_team ?? "—"})</span>{" "}
                        <span className="text-muted-foreground">[{tierLabel(l.selection_tier)}]</span>
                      </span>
                      <span className="text-muted-foreground">
                        {l.selected_price != null ? `$${Number(l.selected_price).toFixed(2)}` : "no price"}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.contains_tier2 && (
                  <div className="text-[11px] font-mono text-amber-500 mb-1">
                    CAUTION — contains Tier 2 reduced-exposure leg. Manual approval required.
                  </div>
                )}
                {missingPrice && (
                  <div className="text-[11px] font-mono text-destructive mb-1">
                    Combined odds unavailable — missing market price.
                  </div>
                )}
                {(o.warnings ?? []).length > 0 && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Warnings: {o.warnings.join(", ")}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-border text-[10px] font-mono text-muted-foreground">
                  Preview only — manual review required. No bet has been created.
                  {" "}preview_only={String(o.preview_only)} · manual_approval_required={String(o.manual_approval_required)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
