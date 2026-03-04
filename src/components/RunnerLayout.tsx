import { Link, useLocation } from "react-router-dom";
import { Activity, Calendar, Crosshair, DollarSign, TrendingUp } from "lucide-react";

const navItems = [
  { to: "/runner", label: "Dashboard", icon: Activity },
  { to: "/runner/week-v2", label: "Week", icon: Calendar },
  { to: "/runner/bets", label: "Bets", icon: DollarSign },
  { to: "/runner/performance", label: "Performance", icon: TrendingUp },
];

export default function RunnerLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

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
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
