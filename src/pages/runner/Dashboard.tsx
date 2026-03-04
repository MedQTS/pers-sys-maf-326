import { useEffect, useMemo, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import RunButton from "@/components/RunButton";
import { supabase } from "@/lib/api";
import { formatAET } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const currentSeason = new Date().getFullYear();

type LastRunMap = Record<string, string | null>;

function fmtTs(iso: string | null | undefined) {
  return formatAET(iso, "datetime");
}

function StepCard({
  label,
  functionName,
  body,
  variant,
  explainer,
  whenToRun,
  lastRun,
}: {
  label: string;
  functionName: string;
  body?: Record<string, unknown>;
  variant?: "default" | "outline" | "secondary";
  explainer: string;
  whenToRun: string;
  lastRun: string | null | undefined;
}) {
  return (
    <div className="space-y-2">
      <RunButton label={label} functionName={functionName} body={body} variant={variant} />
      <div className="px-1 space-y-1">
        <p className="text-[11px] text-muted-foreground">{explainer}</p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{whenToRun}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Last run: {fmtTs(lastRun)}</span>
          <Badge
            variant={lastRun ? "default" : "secondary"}
            className="text-[9px] px-1.5 py-0"
          >
            {lastRun ? "OK" : "NO DATA"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [runningWeekly, setRunningWeekly] = useState(false);
  const [lastRun, setLastRun] = useState<LastRunMap>({});

  const weeklyLabel = useMemo(() => "Weekly: Sun ~11:00pm (Australia/Melbourne)", []);

  async function fetchLastRuns() {
    const results: LastRunMap = {};
    try {
      const [games, features, signals, settledBets, snapOpen, snapT60, snapT30, snapT10] =
        await Promise.all([
          supabase.from("pers_sys_games").select("updated_at").order("updated_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_team_state").select("updated_at").order("updated_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_signals").select("created_at").order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_bets").select("created_at").eq("status", "SETTLED").order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_market_snapshots").select("created_at").eq("snapshot_type", "OPEN").order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_market_snapshots").select("created_at").eq("snapshot_type", "T60").order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_market_snapshots").select("created_at").eq("snapshot_type", "T30").order("created_at", { ascending: false }).limit(1).single(),
          supabase.from("pers_sys_market_snapshots").select("created_at").eq("snapshot_type", "T10").order("created_at", { ascending: false }).limit(1).single(),
        ]);

      results.pull_squiggle = games.data?.updated_at ?? null;
      results.build_features = features.data?.updated_at ?? null;
      results.evaluate = signals.data?.created_at ?? null;
      results.settle = settledBets.data?.created_at ?? null;
      results.pull_open = snapOpen.data?.created_at ?? null;
      results.pull_t60 = snapT60.data?.created_at ?? null;
      results.pull_t30 = snapT30.data?.created_at ?? null;
      results.pull_t10 = snapT10.data?.created_at ?? null;
    } catch {
      // silently ignore — timestamps just show "—"
    }
    setLastRun(results);
    return results;
  }

  async function pollLastRun(key: keyof LastRunMap, attempts = 5, delayMs = 700) {
    for (let i = 0; i < attempts; i++) {
      const res = await fetchLastRuns();
      if (res[key]) return;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  useEffect(() => {
    fetchLastRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runWeeklyPipeline() {
    if (runningWeekly) return;
    setRunningWeekly(true);
    const startedAt = new Date();

    try {
      toast.message("Weekly pipeline started", {
        description: "Running: Squiggle → Features → OPEN snapshot → Evaluate",
      });

      {
        const { error } = await supabase.functions.invoke("pers-sys-pull-squiggle", { body: { season: currentSeason } });
        if (error) throw new Error(`Pull Squiggle failed: ${error.message}`);
        toast.success("1/4 Pull Squiggle OK");
        await pollLastRun("pull_squiggle");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-build-features", { body: { season: currentSeason } });
        if (error) throw new Error(`Build Features failed: ${error.message}`);
        toast.success("2/4 Build Features OK");
        await pollLastRun("build_features");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-pull-odds-snapshot", { body: { snapshot_type: "OPEN" } });
        if (error) throw new Error(`Pull OPEN snapshot failed: ${error.message}`);
        toast.success("3/4 Pull OPEN Snapshot OK");
        await pollLastRun("pull_open");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-evaluate-systems", { body: { season: currentSeason } });
        if (error) throw new Error(`Evaluate Systems failed: ${error.message}`);
        toast.success("4/4 Evaluate Systems OK");
        await pollLastRun("evaluate");
      }

      const secs = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
      toast.success("Weekly pipeline complete", {
        description: `Finished in ~${secs}s. Next: check Week → Accept bets as needed.`,
      });
    } catch (err: any) {
      toast.error("Weekly pipeline failed", { description: String(err?.message || err) });
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

        {/* Two vertical columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Pipeline Steps */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pipeline steps (run in order)</h3>

            <StepCard
              label="Pull Squiggle"
              functionName="pers-sys-pull-squiggle"
              body={{ season: currentSeason }}
              explainer="Loads fixtures/results from Squiggle and updates games."
              whenToRun="Weekly: Sun ~11:00pm (Australia/Melbourne)."
              lastRun={lastRun.pull_squiggle}
            />

            <StepCard
              label="Build Features"
              functionName="pers-sys-build-features"
              body={{ season: currentSeason }}
              variant="secondary"
              explainer="Computes team/game features used by system rules."
              whenToRun="After Pull Squiggle; rerun if fixtures/results change."
              lastRun={lastRun.build_features}
            />

            <StepCard
              label="Evaluate Systems"
              functionName="pers-sys-evaluate-systems"
              body={{ season: currentSeason }}
              explainer="Evaluates systems and writes PASS/FAIL signals for upcoming games."
              whenToRun="After your latest snapshot pull (OPEN or T-snap)."
              lastRun={lastRun.evaluate}
            />

            <StepCard
              label="Settle Bets"
              functionName="pers-sys-settle"
              variant="outline"
              explainer="Settles UNSETTLED bets once games are FT."
              whenToRun="Post-match: after FT (or next morning)."
              lastRun={lastRun.settle}
            />
          </div>

          {/* RIGHT: Odds Snapshots */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Odds snapshots</h3>

            <StepCard
              label="Pull OPEN Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "OPEN" }}
              variant="secondary"
              explainer="Pulls opening odds snapshot and stores market lines/prices."
              whenToRun="Weekly: Sun ~11:00pm (Australia/Melbourne), after Pull Squiggle."
              lastRun={lastRun.pull_open}
            />

            <StepCard
              label="Pull T60 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T60" }}
              variant="outline"
              explainer="Captures price/line ~60 minutes pre-bounce."
              whenToRun="Matchday: ~60 min pre-bounce."
              lastRun={lastRun.pull_t60}
            />

            <StepCard
              label="Pull T30 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T30" }}
              variant="outline"
              explainer="Captures price/line ~30 minutes pre-bounce."
              whenToRun="Matchday: ~30 min pre-bounce."
              lastRun={lastRun.pull_t30}
            />

            <StepCard
              label="Pull T10 Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T10" }}
              variant="outline"
              explainer="Captures price/line ~10 minutes pre-bounce."
              whenToRun="Matchday: ~10 min pre-bounce."
              lastRun={lastRun.pull_t10}
            />
          </div>
        </div>
      </div>
    </RunnerLayout>
  );
}
