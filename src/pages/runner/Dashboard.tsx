import { useMemo, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import RunButton from "@/components/RunButton";
import { supabase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const currentSeason = new Date().getFullYear();

export default function Dashboard() {
  const [runningWeekly, setRunningWeekly] = useState(false);

  const weeklyLabel = useMemo(() => {
    // A simple cue only (not scheduling). Keeps timezone explicit.
    return "Weekly: Sun ~11:00pm (AET)";
  }, []);

  async function runWeeklyPipeline() {
    if (runningWeekly) return;

    setRunningWeekly(true);
    const startedAt = new Date();

    try {
      toast.message("Weekly pipeline started", {
        description: "Running: Squiggle → Features → OPEN snapshot → Evaluate",
      });

      // 1) Pull Squiggle
      {
        const { error } = await supabase.functions.invoke("pers-sys-pull-squiggle", {
          body: { season: currentSeason },
        });
        if (error) throw new Error(`Pull Squiggle failed: ${error.message}`);
        toast.success("1/4 Pull Squiggle OK");
      }

      // 2) Build Features
      {
        const { error } = await supabase.functions.invoke("pers-sys-build-features", {
          body: { season: currentSeason },
        });
        if (error) throw new Error(`Build Features failed: ${error.message}`);
        toast.success("2/4 Build Features OK");
      }

      // 3) Pull OPEN Snapshot
      {
        const { error } = await supabase.functions.invoke("pers-sys-pull-odds-snapshot", {
          body: { snapshot_type: "OPEN" },
        });
        if (error) throw new Error(`Pull OPEN snapshot failed: ${error.message}`);
        toast.success("3/4 Pull OPEN Snapshot OK");
      }

      // 4) Evaluate Systems
      {
        const { error } = await supabase.functions.invoke("pers-sys-evaluate-systems", {
          body: { season: currentSeason },
        });
        if (error) throw new Error(`Evaluate Systems failed: ${error.message}`);
        toast.success("4/4 Evaluate Systems OK");
      }

      const secs = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));

      toast.success("Weekly pipeline complete", {
        description: `Finished in ~${secs}s. Next: check Week → Accept bets as needed.`,
      });
    } catch (err: any) {
      toast.error("Weekly pipeline failed", {
        description: String(err?.message || err),
      });
    } finally {
      setRunningWeekly(false);
    }
  }

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">Runner Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Season {currentSeason} — Execute pipeline steps manually</p>
        </div>

        {/* Weekly one-click runner */}
        <div className="runner-card space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Run pipeline</div>
              <div className="text-sm font-mono">{weeklyLabel}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Runs: Pull Squiggle → Build Features → Pull OPEN Snapshot → Evaluate Systems
              </div>
            </div>

            <Button onClick={runWeeklyPipeline} disabled={runningWeekly} className="font-mono text-xs">
              {runningWeekly ? "Running…" : "Run Weekly Pipeline"}
            </Button>
          </div>
        </div>

        {/* Manual steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">1. Data Ingest</h3>
            <RunButton label="Pull Squiggle" functionName="pers-sys-pull-squiggle" body={{ season: currentSeason }} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">2. Features</h3>
            <RunButton
              label="Build Features"
              functionName="pers-sys-build-features"
              body={{ season: currentSeason }}
              variant="secondary"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">3. Odds</h3>
            <RunButton
              label="Pull OPEN Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "OPEN" }}
              variant="secondary"
            />
            <RunButton
              label="Pull T60 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T60" }}
              variant="outline"
            />
            <RunButton
              label="Pull T30 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T30" }}
              variant="outline"
            />
            <RunButton
              label="Pull T10 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T10" }}
              variant="outline"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">4. Evaluate</h3>
            <RunButton
              label="Evaluate Systems"
              functionName="pers-sys-evaluate-systems"
              body={{ season: currentSeason }}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">5. Settle</h3>
            <RunButton label="Settle Bets" functionName="pers-sys-settle" variant="outline" />
          </div>
        </div>
      </div>
    </RunnerLayout>
  );
}
