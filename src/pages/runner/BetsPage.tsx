import { useEffect, useState } from "react";
import RunnerLayout from "@/components/RunnerLayout";
import { supabase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type BetFilter = "active" | "all";

export default function BetsPage() {
  const [bets, setBets] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<BetFilter>("active");

  // Form state
  const [formSystem, setFormSystem] = useState("");
  const [formGame, setFormGame] = useState("");
  const [formMarketType, setFormMarketType] = useState<"H2H" | "LINE">("H2H");
  const [formSide, setFormSide] = useState("HOME");
  const [formPrice, setFormPrice] = useState("");
  const [formUnits, setFormUnits] = useState("1");
  const [formLine, setFormLine] = useState("");
  const [formBook, setFormBook] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [betsRes, gamesRes, sysRes] = await Promise.all([
      supabase
        .from("pers_sys_bets")
        .select("*, game:pers_sys_games(*, home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name), away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name))")
        .order("placed_ts", { ascending: false })
        .limit(100),
      supabase
        .from("pers_sys_games")
        .select("id, round, home_team:pers_sys_teams!pers_sys_games_home_team_id_fkey(canonical_name), away_team:pers_sys_teams!pers_sys_games_away_team_id_fkey(canonical_name)")
        .eq("status", "SCHEDULED")
        .order("start_time_aet")
        .limit(50),
      supabase.from("pers_sys_systems").select("system_code, name").eq("active", true),
    ]);

    setBets(betsRes.data || []);
    setGames(gamesRes.data || []);
    setSystems(sysRes.data || []);
    setLoading(false);
  }

  async function submitBet() {
    if (!formSystem || !formGame || !formPrice || !formUnits) {
      toast.error("Fill all required fields");
      return;
    }

    if (formMarketType === "LINE" && !formLine) {
      toast.error("Line is required for LINE bets");
      return;
    }

    const { error } = await supabase.from("pers_sys_bets").insert({
      system_code: formSystem,
      game_id: formGame,
      leg_type: formMarketType,
      placed_ts: new Date().toISOString(),
      side: formSide,
      price: parseFloat(formPrice),
      units: parseFloat(formUnits),
      line_at_bet: formMarketType === "LINE" ? parseFloat(formLine) : null,
      book: formBook || null,
      notes: formNotes || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Bet logged");
      setShowForm(false);
      setFormPrice("");
      setFormBook("");
      setFormNotes("");
      loadData();
    }
  }

  async function voidBet(betId: string) {
    if (!window.confirm("Void this bet? It will be treated as cancelled.")) return;
    const { error } = await supabase.from("pers_sys_bets").update({ status: "VOID" }).eq("id", betId);
    if (error) {
      toast.error(`Void failed: ${error.message}`);
    } else {
      toast.success("Bet voided");
      loadData();
    }
  }

  const filteredBets = filter === "active"
    ? bets.filter((b) => b.status !== "VOID" && b.status !== "SETTLED")
    : bets;

  return (
    <RunnerLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-mono">Bets</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`text-xs font-mono px-3 py-1.5 rounded-md border transition-colors ${filter === "active" ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`}
              onClick={() => setFilter(filter === "active" ? "all" : "active")}
            >
              {filter === "active" ? "Active only" : "All bets"}
            </button>
            <Button onClick={() => setShowForm(!showForm)} variant="outline" className="font-mono text-xs">
              {showForm ? "Cancel" : "+ Log Bet"}
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="runner-card space-y-4">
            <h3 className="text-sm font-mono font-semibold">New Bet</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={formSystem} onValueChange={setFormSystem}>
                <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="System" /></SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.system_code} value={s.system_code}>{s.system_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={formGame} onValueChange={setFormGame}>
                <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Game" /></SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      R{g.round} {(g.home_team as any)?.canonical_name} v {(g.away_team as any)?.canonical_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={formMarketType} onValueChange={(v) => { setFormMarketType(v as "H2H" | "LINE"); if (v === "H2H") setFormLine(""); }}>
                <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="H2H">H2H</SelectItem>
                  <SelectItem value="LINE">LINE</SelectItem>
                </SelectContent>
              </Select>

              <Select value={formSide} onValueChange={setFormSide}>
                <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">HOME</SelectItem>
                  <SelectItem value="AWAY">AWAY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Price (e.g. 2.50)" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} className="font-mono text-xs" />
              <Input placeholder="Units" value={formUnits} onChange={(e) => setFormUnits(e.target.value)} className="font-mono text-xs" />
              {formMarketType === "LINE" ? (
                <Input placeholder="Line (e.g. -6.5 or +12.5)" value={formLine} onChange={(e) => setFormLine(e.target.value)} className="font-mono text-xs" />
              ) : (
                <Input placeholder="Line (N/A for H2H)" value="" disabled className="font-mono text-xs" />
              )}
              <Input placeholder="Book (optional)" value={formBook} onChange={(e) => setFormBook(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="font-mono text-xs" />
            </div>
            <Button onClick={submitBet} className="font-mono text-xs">Log Bet</Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : filteredBets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bets to show.</p>
        ) : (
          <div className="space-y-2">
            {filteredBets.map((b) => {
              const g = b.game as any;
              const home = g?.home_team?.canonical_name || "?";
              const away = g?.away_team?.canonical_name || "?";
              return (
                <div key={b.id} className="runner-card flex items-center justify-between">
                  <div className="text-xs font-mono space-y-0.5">
                    <div className="font-semibold">{b.system_code} — {b.leg_type}</div>
                    <div className="text-muted-foreground">
                      {`R${g?.round} ${home} v ${away} — ${b.leg_type} ${b.side}${b.leg_type === "LINE" && b.line_at_bet !== null && b.line_at_bet !== undefined ? ` ${Number(b.line_at_bet) > 0 ? "+" : ""}${b.line_at_bet}` : ""}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs font-mono space-y-0.5">
                      <div>{b.units}u @ ${b.price}</div>
                      {b.status === "VOID" ? (
                        <span className="text-muted-foreground line-through">VOID</span>
                      ) : b.result ? (
                        <span className={b.result === "WIN" ? "bet-win" : b.result === "LOSS" ? "bet-loss" : "bet-push"}>
                          {b.result} ({b.profit_units > 0 ? "+" : ""}{b.profit_units}u)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">PENDING</span>
                      )}
                    </div>
                    {b.status === "UNSETTLED" && (
                      <button
                        type="button"
                        className="text-[10px] font-mono px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => voidBet(b.id)}
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RunnerLayout>
  );
}
