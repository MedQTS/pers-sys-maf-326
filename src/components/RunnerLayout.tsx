import { Link, useLocation } from "react-router-dom";
import { Activity, Calendar, Crosshair, DollarSign, Layers, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/runner", label: "Dashboard", icon: Activity },
  { to: "/runner/week", label: "Week", icon: Calendar },
  { to: "/runner/bets", label: "Bets", icon: DollarSign },
  { to: "/runner/performance", label: "Performance", icon: TrendingUp },
  { to: "/runner/sys12-basket", label: "SYS_12", icon: Layers },
];

const formatAUD = (v: number | null | undefined) =>
  v == null ? "—" : `$${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RunnerLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [startingBankroll, setStartingBankroll] = useState<number | null>(null);

  useEffect(() => {
    const season = new Date().getFullYear();

    const fetchBankroll = async () => {
      const [balRes, ledgerRes] = await Promise.all([
        supabase
          .from("pers_sys_bankroll_summary")
          .select("total_equity")
          .eq("season_id", season)
          .maybeSingle(),
        supabase
          .from("pers_sys_ledger")
          .select("amount")
          .eq("season_id", season)
          .in("event_type", ["START", "DEPOSIT"]),
      ]);

      if (balRes.data) setCurrentBalance(balRes.data.total_equity);
      if (ledgerRes.data) {
        const total = ledgerRes.data.reduce((sum, r) => sum + Number(r.amount), 0);
        setStartingBankroll(total);
      }
    };

    fetchBankroll();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/runner" className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-sm tracking-wider text-foreground">
              PERS_SYS
            </span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto text-right">
            <div className="font-mono text-sm text-foreground">
              Current Balance: {formatAUD(currentBalance)}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              Starting Bankroll: {formatAUD(startingBankroll)}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
