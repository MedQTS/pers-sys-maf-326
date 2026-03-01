import { useEffect, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";

export default function PerformancePage() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("pers_sys_bets")
      .select("*")
      .not("result", "is", null)
      .order("placed_ts");
    setBets(data || []);
    setLoading(false);
  }

  // Compute stats by system
  const statsBySystem: Record<string, {
    bets: number;
    wins: number;
    losses: number;
    pushes: number;
    totalUnits: number;
    profitUnits: number;
    maxLosing: number;
  }> = {};

  for (const b of bets) {
    if (!statsBySystem[b.system_code]) {
      statsBySystem[b.system_code] = {
        bets: 0, wins: 0, losses: 0, pushes: 0,
        totalUnits: 0, profitUnits: 0, maxLosing: 0,
      };
    }
    const s = statsBySystem[b.system_code];
    s.bets++;
    s.totalUnits += b.units;
    s.profitUnits += b.profit_units || 0;
    if (b.result === "WIN") s.wins++;
    else if (b.result === "LOSS") s.losses++;
    else s.pushes++;
  }

  // Calculate max losing streak per system
  for (const sys of Object.keys(statsBySystem)) {
    const sysBets = bets.filter((b) => b.system_code === sys);
    let currentStreak = 0;
    let maxStreak = 0;
    for (const b of sysBets) {
      if (b.result === "LOSS") {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    statsBySystem[sys].maxLosing = maxStreak;
  }

  // Overall
  const totalProfit = bets.reduce((sum, b) => sum + (b.profit_units || 0), 0);
  const totalStaked = bets.reduce((sum, b) => sum + b.units, 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-mono">Performance</h1>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : bets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No settled bets yet.</p>
        ) : (
          <>
            {/* Overall summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Bets" value={String(bets.length)} />
              <StatCard
                label="Profit"
                value={`${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}u`}
                color={totalProfit >= 0 ? "text-win" : "text-loss"}
              />
              <StatCard
                label="ROI"
                value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
                color={roi >= 0 ? "text-win" : "text-loss"}
              />
              <StatCard label="Staked" value={`${totalStaked.toFixed(1)}u`} />
            </div>

            {/* Per-system breakdown */}
            <div className="space-y-3">
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                By System
              </h2>
              {Object.entries(statsBySystem).map(([sys, s]) => {
                const sysRoi = s.totalUnits > 0 ? (s.profitUnits / s.totalUnits) * 100 : 0;
                return (
                  <div key={sys} className="runner-card">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-semibold text-sm">{sys}</span>
                      <span className={`font-mono text-sm font-bold ${s.profitUnits >= 0 ? "text-win" : "text-loss"}`}>
                        {s.profitUnits >= 0 ? "+" : ""}{s.profitUnits.toFixed(2)}u
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground block">Bets</span>
                        {s.bets}
                      </div>
                      <div>
                        <span className="text-muted-foreground block">W/L/P</span>
                        {s.wins}/{s.losses}/{s.pushes}
                      </div>
                      <div>
                        <span className="text-muted-foreground block">ROI</span>
                        <span className={sysRoi >= 0 ? "text-win" : "text-loss"}>
                          {sysRoi >= 0 ? "+" : ""}{sysRoi.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Staked</span>
                        {s.totalUnits.toFixed(1)}u
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Max L</span>
                        {s.maxLosing}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </RunnerLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="runner-card text-center">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-mono font-bold mt-1 ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}
