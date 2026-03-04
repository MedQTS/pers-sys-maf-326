import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/runner/Dashboard";
import WeekView from "./pages/runner/WeekView";
import WeekView_v2 from "./pages/runner/WeekView_v2";
import GameDetail from "./pages/runner/GameDetail";
import BetsPage from "./pages/runner/BetsPage";
import PerformancePage from "./pages/runner/PerformancePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/runner" replace />} />
          <Route path="/runner" element={<Dashboard />} />
          <Route path="/runner/week" element={<WeekView />} />
          <Route path="/runner/week-v2" element={<WeekView_v2 />} />
          <Route path="/runner/game/:id" element={<GameDetail />} />
          <Route path="/runner/bets" element={<BetsPage />} />
          <Route path="/runner/performance" element={<PerformancePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
