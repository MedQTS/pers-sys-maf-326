import RunnerLayout from "@/components/RunnerLayout";
import RunButton from "@/components/RunButton";

const currentSeason = new Date().getFullYear();

export default function Dashboard() {
  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">Runner Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Season {currentSeason} — Execute pipeline steps manually
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              1. Data Ingest
            </h3>
            <RunButton
              label="Pull Squiggle"
              functionName="pers-sys-pull-squiggle"
              body={{ season: currentSeason }}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              2. Features
            </h3>
            <RunButton
              label="Build Features"
              functionName="pers-sys-build-features"
              body={{ season: currentSeason }}
              variant="secondary"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              3. Odds
            </h3>
            <RunButton
              label="Pull OPEN Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "OPEN" }}
              variant="secondary"
            />
            <RunButton
              label="Pull CLOSE Snapshot"
              functionName="pers-sys-pull-odds-snapshot"
              body={{ snapshot_type: "CLOSE" }}
              variant="outline"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              4. Evaluate
            </h3>
            <RunButton
              label="Evaluate Systems"
              functionName="pers-sys-evaluate-systems"
              body={{ season: currentSeason }}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              5. Settle
            </h3>
            <RunButton
              label="Settle Bets"
              functionName="pers-sys-settle"
              variant="outline"
            />
          </div>
        </div>
      </div>
    </RunnerLayout>
  );
}
