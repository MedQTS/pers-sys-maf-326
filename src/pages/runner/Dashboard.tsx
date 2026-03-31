import { useEffect, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import RunButton from "@/components/RunButton";
import { supabase } from "@/lib/api";
import { formatAET } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const currentSeason = new Date().getFullYear();

type TruthRow = {
  step_key: string;
  step_label: string;
  schedule_text: string | null;
  schedule_authoritative: boolean | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: string | null;
  last_trigger_source: string | null;
  status_authoritative: boolean | null;
  telemetry_source: string | null;
  details: string | null;
};

function fmtTs(iso: string | null | undefined) {
  return formatAET(iso, "datetime");
}

function StepCard({
  label,
  stepKey,
  functionName,
  body,
  variant,
  explainer,
  truth,
}: {
  label: string;
  stepKey: string;
  functionName: string;
  body?: Record<string, unknown>;
  variant?: "default" | "outline" | "secondary";
  explainer: string;
  truth?: TruthRow | null;
}) {
  const scheduleText = truth?.schedule_text ?? "UNKNOWN schedule (no backend truth row)";
  const effectiveLastRun = truth?.last_finished_at ?? truth?.last_started_at ?? null;
  const status = truth?.last_status ?? "UNKNOWN";
  const statusAuthoritative = truth?.status_authoritative === true;
  const scheduleAuthoritative = truth?.schedule_authoritative === true;

  return (
    <div className="space-y-2">
      <RunButton label={label} functionName={functionName} body={body} variant={variant} />
      <div className="px-1 space-y-1">
        <p className="text-[11px] text-muted-foreground">{explainer}</p>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{scheduleText}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Last run: {fmtTs(effectiveLastRun)}</span>
          <Badge
            variant="secondary"
            className="text-[9px] px-1.5 py-0"
          >
            {status}
          </Badge>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {statusAuthoritative ? "authoritative" : "non-authoritative"}
          </Badge>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {scheduleAuthoritative ? "schedule: authoritative" : "schedule: advisory"}
          </Badge>
        </div>
        {truth?.details && <p className="text-[10px] text-muted-foreground">{truth.details}</p>}
        {!truth && (
          <p className="text-[10px] text-muted-foreground">
            No RPC row for step key <span className="font-mono">{stepKey}</span>.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [runningWeekly, setRunningWeekly] = useState(false);
  const [truthByStep, setTruthByStep] = useState<Record<string, TruthRow>>({});

  async function fetchOperationalTruth() {
    const map: Record<string, TruthRow> = {};
    try {
      const { data } = await (supabase.rpc("get_runner_operational_truth" as any) as Promise<{ data: TruthRow[] | null }>);
      for (const row of data || []) {
        map[row.step_key] = row;
      }
    } catch {
      // silently ignore — cards will show UNKNOWN/non-authoritative fallback text.
    }
    setTruthByStep(map);
    return map;
  }

  async function pollStepTruth(key: string, attempts = 5, delayMs = 700) {
    for (let i = 0; i < attempts; i++) {
      const res = await fetchOperationalTruth();
      if (res[key]?.last_started_at || res[key]?.last_finished_at || res[key]?.last_status) return;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  useEffect(() => {
    fetchOperationalTruth();
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
        await pollStepTruth("pull_squiggle");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-build-features", { body: { season: currentSeason } });
        if (error) throw new Error(`Build Features failed: ${error.message}`);
        toast.success("2/4 Build Features OK");
        await pollStepTruth("build_features");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-pull-odds-snapshot", { body: { snapshot_type: "OPEN" } });
        if (error) throw new Error(`Pull OPEN snapshot failed: ${error.message}`);
        toast.success("3/4 Pull OPEN Snapshot OK");
        await pollStepTruth("pull_open");
      }
      {
        const { error } = await supabase.functions.invoke("pers-sys-evaluate-systems-v2", { body: { season: currentSeason } });
        if (error) throw new Error(`Evaluate Systems failed: ${error.message}`);
        toast.success("4/4 Evaluate Systems OK");
        await pollStepTruth("evaluate");
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
              <div className="text-sm font-mono">
                {truthByStep.pull_squiggle?.schedule_text ?? "Operational schedule unavailable from backend truth source."}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Source: backend operational truth RPC
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
              stepKey="pull_squiggle"
              functionName="pers-sys-pull-squiggle"
              body={{ season: currentSeason }}
              explainer="Loads fixtures/results from Squiggle and updates games."
              truth={truthByStep.pull_squiggle}
            />

            <StepCard
              label="Build Features"
              stepKey="build_features"
              functionName="pers-sys-build-features"
              body={{ season: currentSeason }}
              variant="secondary"
              explainer="Computes team/game features used by system rules."
              truth={truthByStep.build_features}
            />

            <StepCard
              label="Evaluate Systems"
              stepKey="evaluate"
              functionName="pers-sys-evaluate-systems-v2"
              body={{ season: currentSeason }}
              explainer="Evaluates systems and writes PASS/FAIL signals for upcoming games."
              truth={truthByStep.evaluate}
            />

            <StepCard
              label="Settle Bets"
              stepKey="settle"
              functionName="pers-sys-settle"
              variant="outline"
              explainer="Settles UNSETTLED bets once games are FT."
              truth={truthByStep.settle}
            />
          </div>

          {/* RIGHT: Odds Snapshots */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Odds snapshots</h3>

            <StepCard
              label="Pull OPEN Snapshot"
              stepKey="pull_open"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "OPEN" }}
              variant="secondary"
              explainer="Pulls opening odds snapshot and stores market lines/prices."
              truth={truthByStep.pull_open}
            />

            <StepCard
              label="Pull CURRENT Snapshot"
              stepKey="pull_current"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "CURRENT" }}
              variant="outline"
              explainer="Pulls the latest odds snapshot for monitoring (UI drift). Safe to rerun."
              truth={truthByStep.pull_current}
            />

            <StepCard
              label="Pull T60 Snapshot"
              stepKey="pull_t60"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T60" }}
              variant="outline"
              explainer="Captures price/line ~60 minutes pre-bounce."
              truth={truthByStep.pull_t60}
            />

            <StepCard
              label="Pull T30 Snapshot"
              stepKey="pull_t30"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T30" }}
              variant="outline"
              explainer="Captures price/line ~30 minutes pre-bounce."
              truth={truthByStep.pull_t30}
            />

            <StepCard
              label="Pull T10 Snapshot"
              stepKey="pull_t10"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "T10" }}
              variant="outline"
              explainer="Captures price/line ~10 minutes pre-bounce."
              truth={truthByStep.pull_t10}
            />
          </div>
        </div>
      </div>
    </RunnerLayout>
  );
}
