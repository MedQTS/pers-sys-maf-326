import { useEffect, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import RunButton from "@/components/RunButton";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, Info } from "lucide-react";

const currentSeason = new Date().getFullYear();

interface StepConfig {
  key: string;
  label: string;
  functionName: string;
  body?: Record<string, unknown>;
  variant?: "default" | "outline" | "secondary";
  explainer: string;
  whenToRun: string;
}

const pipelineSteps: StepConfig[] = [
  {
    key: "pull_squiggle",
    label: "Pull Squiggle",
    functionName: "pers-sys-pull-squiggle",
    body: { season: currentSeason },
    explainer: "Loads fixtures/results from Squiggle and updates games.",
    whenToRun: "Weekly: Sun ~11:00pm (AET).",
  },
  {
    key: "build_features",
    label: "Build Features",
    functionName: "pers-sys-build-features",
    body: { season: currentSeason },
    variant: "secondary",
    explainer: "Computes team/game features used by system rules.",
    whenToRun: "After Pull Squiggle; rerun if fixtures/results change.",
  },
  {
    key: "evaluate",
    label: "Evaluate Systems",
    functionName: "pers-sys-evaluate-systems",
    body: { season: currentSeason },
    explainer: "Evaluates systems and writes PASS/FAIL signals for upcoming games.",
    whenToRun: "After your latest snapshot pull (OPEN or T-snap).",
  },
  {
    key: "settle",
    label: "Settle Bets",
    functionName: "pers-sys-settle",
    variant: "outline",
    explainer: "Settles UNSETTLED bets once games are FT.",
    whenToRun: "Post-match: after FT (or next morning).",
  },
];

const oddsSteps: StepConfig[] = [
  {
    key: "snap_OPEN",
    label: "Pull OPEN Snapshot",
    functionName: "pers-sys-pull-odds-snapshot",
    body: { snapshot_type: "OPEN" },
    variant: "secondary",
    explainer: "Pulls opening odds snapshot and stores market lines/prices.",
    whenToRun: "Weekly: Sun ~11:00pm (AET), after Pull Squiggle.",
  },
  {
    key: "snap_T60",
    label: "Pull T60 Snapshot",
    functionName: "pers-sys-pull-odds-snapshot",
    body: { snapshot_type: "T60" },
    variant: "outline",
    explainer: "Captures price/line ~60 minutes pre-bounce.",
    whenToRun: "Matchday: ~60 min pre-bounce.",
  },
  {
    key: "snap_T30",
    label: "Pull T30 Snapshot",
    functionName: "pers-sys-pull-odds-snapshot",
    body: { snapshot_type: "T30" },
    variant: "outline",
    explainer: "Captures price/line ~30 minutes pre-bounce.",
    whenToRun: "Matchday: ~30 min pre-bounce.",
  },
  {
    key: "snap_T10",
    label: "Pull T10 Snapshot",
    functionName: "pers-sys-pull-odds-snapshot",
    body: { snapshot_type: "T10" },
    variant: "outline",
    explainer: "Captures price/line ~10 minutes pre-bounce.",
    whenToRun: "Matchday: ~10 min pre-bounce.",
  },
];

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
}

function StepCard({
  step,
  lastRun,
}: {
  step: StepConfig;
  lastRun: string | null;
}) {
  const hasData = lastRun !== null;

  return (
    <div className="runner-card space-y-2">
      <RunButton
        label={step.label}
        functionName={step.functionName}
        body={step.body}
        variant={step.variant}
      />
      <p className="text-xs text-muted-foreground leading-snug">{step.explainer}</p>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
        <Clock className="h-3 w-3 shrink-0" />
        <span>{step.whenToRun}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-muted-foreground">
          Last run: {formatTs(lastRun)}
        </span>
        <Badge
          variant={hasData ? "default" : "secondary"}
          className={`text-[10px] px-1.5 py-0 ${hasData ? "bg-primary/15 text-primary border-primary/20" : ""}`}
        >
          {hasData ? "OK" : "NO DATA"}
        </Badge>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [lastRun, setLastRun] = useState<Record<string, string | null>>({
    pull_squiggle: null,
    build_features: null,
    evaluate: null,
    settle: null,
    snap_OPEN: null,
    snap_T60: null,
    snap_T30: null,
    snap_T10: null,
  });

  useEffect(() => {
    async function fetchLastRuns() {
      const results: Record<string, string | null> = { ...lastRun };

      const [games, features, signals, settledBets, snapOpen, snapT60, snapT30, snapT10] =
        await Promise.all([
          supabase
            .from("pers_sys_games")
            .select("updated_at")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_team_state")
            .select("updated_at")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_signals")
            .select("created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_bets")
            .select("created_at")
            .eq("status", "SETTLED")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_market_snapshots")
            .select("created_at")
            .eq("snapshot_type", "OPEN")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_market_snapshots")
            .select("created_at")
            .eq("snapshot_type", "T60")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_market_snapshots")
            .select("created_at")
            .eq("snapshot_type", "T30")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("pers_sys_market_snapshots")
            .select("created_at")
            .eq("snapshot_type", "T10")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
        ]);

      results.pull_squiggle = games.data?.updated_at ?? null;
      results.build_features = features.data?.updated_at ?? null;
      results.evaluate = signals.data?.created_at ?? null;
      results.settle = settledBets.data?.created_at ?? null;
      results.snap_OPEN = snapOpen.data?.created_at ?? null;
      results.snap_T60 = snapT60.data?.created_at ?? null;
      results.snap_T30 = snapT30.data?.created_at ?? null;
      results.snap_T10 = snapT10.data?.created_at ?? null;

      setLastRun(results);
    }

    fetchLastRuns();
  }, []);

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">Runner Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Season {currentSeason} — Execute pipeline steps manually
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Pipeline */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Pipeline Steps
            </h2>
            {pipelineSteps.map((step) => (
              <StepCard key={step.key} step={step} lastRun={lastRun[step.key]} />
            ))}
          </div>

          {/* Right column: Odds */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Odds Snapshots
            </h2>
            {oddsSteps.map((step) => (
              <StepCard key={step.key} step={step} lastRun={lastRun[step.key]} />
            ))}
          </div>
        </div>
      </div>
    </RunnerLayout>
  );
}
