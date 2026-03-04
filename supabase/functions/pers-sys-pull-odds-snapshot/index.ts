import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Stage 3: Reference vs Execution book split
const REFERENCE_BOOKS = [
  "tab",
  "pointsbetau",
  "neds",
  "unibet",
  "betr_au",
  "sportsbet",
  "ladbrokes_au",
] as const;

const EXECUTION_BOOKS = ["tab", "pointsbetau", "neds", "unibet", "betr_au"] as const;

const referenceSet = new Set<string>(REFERENCE_BOOKS as unknown as string[]);
const executionSet = new Set<string>(EXECUTION_BOOKS as unknown as string[]);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Stage 3 Step 2: Best-exec selection helpers
const execPriority = new Map<string, number>(
  (EXECUTION_BOOKS as unknown as string[]).map((k, i) => [k, i])
);

type LineCandidate = { book: string; point: number; price: number };

function pickBestLineAtAnchor(
  candidates: LineCandidate[],
  anchorLine: number | null
): LineCandidate | null {
  if (!Number.isFinite(anchorLine as number)) return null;
  if (!candidates || candidates.length === 0) return null;

  let best: LineCandidate | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    if (!Number.isFinite(c.point) || !Number.isFinite(c.price)) continue;

    const dist = Math.abs(c.point - (anchorLine as number));
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
      continue;
    }
    if (dist === bestDist && best) {
      // Tie-break 1: higher price
      if (c.price > best.price) {
        best = c;
        continue;
      }
      // Tie-break 2: earlier in EXECUTION_BOOKS list
      if (c.price === best.price) {
        const p1 = execPriority.get(c.book) ?? 9999;
        const p2 = execPriority.get(best.book) ?? 9999;
        if (p1 < p2) best = c;
      }
    }
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawSnapshotType = String(body.snapshot_type || "OPEN").toUpperCase();
    const allowedSnapshotTypes = new Set(["OPEN", "T60", "T30", "T10"]);
    if (!allowedSnapshotTypes.has(rawSnapshotType)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid snapshot_type",
          received: rawSnapshotType,
          allowed: Array.from(allowedSnapshotTypes),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const snapshotType: "OPEN" | "T60" | "T30" | "T10" = rawSnapshotType as
      | "OPEN"
      | "T60"
      | "T30"
      | "T10";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("PERS_SYS_ODDS_API_KEY");
    if (!apiKey) throw new Error("PERS_SYS_ODDS_API_KEY not set");

    const bufferMinutes = 60;
    const lookaheadDays = 7;
    const now = new Date();

    const cutoffStart = new Date(now.getTime() + bufferMinutes * 60 * 1000);
    const cutoffEnd = new Date(
      now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000
    );

    const { data: eligibleGames } = await supabase
      .from("pers_sys_games")
      .select("id, start_time_aet, home_team_id, away_team_id, oddsapi_event_id")
      .eq("status", "SCHEDULED")
      .gte("start_time_aet", cutoffStart.toISOString())
      .lte("start_time_aet", cutoffEnd.toISOString());

    if (!eligibleGames || eligibleGames.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          snapshot_type: snapshotType,
          eligible: 0,
          snapshots_stored: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: teams } = await supabase
      .from("pers_sys_teams")
      .select("id, canonical_name, oddsapi_name");

    function normName(s: string): string {
      return String(s || "")
        .toLowerCase()
        .trim()
        .replace(/&/g, "and")
        .replace(/['".,()]/g, "")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b(fc|football|club|afl|the)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normSet(names: Array<string | null | undefined>): Set<string> {
      const out = new Set<string>();
      for (const n of names) {
        const nn = normName(String(n || ""));
        if (nn) out.add(nn);
      }
      return out;
    }

    type TeamInfo = {
      canonical_name: string;
      oddsapi_name: string | null;
      norm_names: Set<string>;
    };

    const teamById: Record<string, TeamInfo> = {};
    for (const t of teams || []) {
      teamById[t.id] = {
        canonical_name: t.canonical_name,
        oddsapi_name: t.oddsapi_name ?? null,
        norm_names: normSet([t.canonical_name, t.oddsapi_name]),
      };
    }

    const oddsUrl = `https://api.the-odds-api.com/v4/sports/aussierules_afl/odds/?apiKey=${apiKey}&regions=au&markets=h2h,spreads&oddsFormat=decimal`;
    const oddsResp = await fetch(oddsUrl);
    if (!oddsResp.ok) {
      const errText = await oddsResp.text();
      throw new Error(`Odds API ${oddsResp.status}: ${errText}`);
    }
    const oddsEvents = await oddsResp.json();

    // Fast path: exact id match if game.oddsapi_event_id already known
    const oddsEventById = new Map<string, any>();
    if (Array.isArray(oddsEvents)) {
      for (const ev of oddsEvents) {
        const id = String(ev?.id || "").trim();
        if (id) oddsEventById.set(id, ev);
      }
    }

    const snapshotTs = now.toISOString();
    let snapshotsStored = 0;
    const observedBookKeys = new Set<string>();
    const usedReferenceKeys = new Set<string>();
    const usedExecutionKeys = new Set<string>();

    // Diagnostic counters
    let skipped_no_team_map = 0;
    let skipped_no_event_match = 0;
    let skipped_no_ref_h2h = 0;
    let skipped_no_ref_line = 0;
    let skipped_no_exec_books = 0;

    const TOL_MS = 6 * 60 * 60 * 1000;

    for (const game of eligibleGames) {
      const expectedHome = teamById[game.home_team_id];
      const expectedAway = teamById[game.away_team_id];
      if (!expectedHome || !expectedAway) { skipped_no_team_map++; continue; }

      const gameTs = new Date(game.start_time_aet).getTime();

      // 1) Prefer exact id match (most reliable)
      let matchedEvent: any | undefined = undefined;

      const existingEventId = String(game.oddsapi_event_id || "").trim();
      if (existingEventId) {
        matchedEvent = oddsEventById.get(existingEventId);
      }

      // 2) Fallback to name + time tolerance match
      if (!matchedEvent) {
        matchedEvent = (oddsEvents as any[]).find((ev: any) => {
          const home = normName(String(ev.home_team || ""));
          const away = normName(String(ev.away_team || ""));
          if (!home || !away) return false;

          const homeOk = expectedHome.norm_names.has(home);
          const awayOk = expectedAway.norm_names.has(away);
          if (!homeOk || !awayOk) return false;

          const evTs = new Date(ev.commence_time).getTime();
          if (Number.isNaN(evTs) || Number.isNaN(gameTs)) return false;

          return Math.abs(evTs - gameTs) <= TOL_MS;
        });
      }

      if (!matchedEvent) { skipped_no_event_match++; continue; }

      if (!game.oddsapi_event_id && matchedEvent.id) {
        await supabase
          .from("pers_sys_games")
          .update({ oddsapi_event_id: matchedEvent.id })
          .eq("id", game.id);
      }

      const bookmakers = matchedEvent.bookmakers || [];

      // Stage 3 Step 2: split reference median vs best-exec

      // Reference (median) arrays
      const refH2hBooks = new Set<string>();
      const refHomePrices: number[] = [];
      const refAwayPrices: number[] = [];

      const refLineBooks = new Set<string>();
      const refHomeLines: number[] = [];
      const refAwayLines: number[] = [];
      const refHomeLinePrices: number[] = [];
      const refAwayLinePrices: number[] = [];

      // Execution (best-exec) picks/candidates
      const execH2hBooks = new Set<string>();
      let execBestHomePrice: number | null = null;
      let execBestHomeBook: string | null = null;
      let execBestAwayPrice: number | null = null;
      let execBestAwayBook: string | null = null;

      const execLineBooks = new Set<string>();
      const execHomeLineCandidates: LineCandidate[] = [];
      const execAwayLineCandidates: LineCandidate[] = [];

      for (const bk of bookmakers) {
        const bmKey = String(bk.key || "").trim();
        const isRef = bmKey ? referenceSet.has(bmKey) : false;
        const isExec = bmKey ? executionSet.has(bmKey) : false;

        if (bmKey) {
          observedBookKeys.add(bmKey);
          if (isRef) usedReferenceKeys.add(bmKey);
          if (isExec) usedExecutionKeys.add(bmKey);
        }

        for (const m of bk.markets || []) {
          if (m.key === "h2h") {
            for (const o of m.outcomes || []) {
              const price = Number(o.price);
              if (!Number.isFinite(price)) continue;

              const outcomeNorm = normName(String(o.name || ""));
              const isHome = expectedHome.norm_names.has(outcomeNorm);
              const isAway = expectedAway.norm_names.has(outcomeNorm);

              if (isHome && bmKey) {
                if (isRef) { refH2hBooks.add(bmKey); refHomePrices.push(price); }
                if (isExec) {
                  execH2hBooks.add(bmKey);
                  if (execBestHomePrice === null || price > execBestHomePrice ||
                      (price === execBestHomePrice && (execPriority.get(bmKey) ?? 9999) < (execPriority.get(execBestHomeBook!) ?? 9999))) {
                    execBestHomePrice = price;
                    execBestHomeBook = bmKey;
                  }
                }
              }
              if (isAway && bmKey) {
                if (isRef) { refH2hBooks.add(bmKey); refAwayPrices.push(price); }
                if (isExec) {
                  execH2hBooks.add(bmKey);
                  if (execBestAwayPrice === null || price > execBestAwayPrice ||
                      (price === execBestAwayPrice && (execPriority.get(bmKey) ?? 9999) < (execPriority.get(execBestAwayBook!) ?? 9999))) {
                    execBestAwayPrice = price;
                    execBestAwayBook = bmKey;
                  }
                }
              }
            }
          }
          if (m.key === "spreads") {
            for (const o of m.outcomes || []) {
              const point = Number(o.point);
              const price = Number(o.price);
              if (!Number.isFinite(point) || !Number.isFinite(price)) continue;

              const outcomeNorm = normName(String(o.name || ""));
              const isHome = expectedHome.norm_names.has(outcomeNorm);
              const isAway = expectedAway.norm_names.has(outcomeNorm);

              if (isHome && bmKey) {
                if (isRef) {
                  refLineBooks.add(bmKey);
                  refHomeLines.push(point);
                  refHomeLinePrices.push(price);
                }
                if (isExec) {
                  execLineBooks.add(bmKey);
                  execHomeLineCandidates.push({ book: bmKey, point, price });
                }
              }
              if (isAway && bmKey) {
                if (isRef) {
                  refLineBooks.add(bmKey);
                  refAwayLines.push(point);
                  refAwayLinePrices.push(price);
                }
                if (isExec) {
                  execLineBooks.add(bmKey);
                  execAwayLineCandidates.push({ book: bmKey, point, price });
                }
              }
            }
          }
        }
      }

      const homeH2hMedian = median(refHomePrices);
      const awayH2hMedian = median(refAwayPrices);

      // Store H2H snapshot (reference medians + best-exec)
      if (
        refHomePrices.length > 0 &&
        refAwayPrices.length > 0 &&
        Number.isFinite(homeH2hMedian) &&
        Number.isFinite(awayH2hMedian) &&
        homeH2hMedian > 0 &&
        awayH2hMedian > 0
      ) {
        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            market_type: "H2H",
            agg_method: "median",
            books_used: Array.from(refH2hBooks),
            ref_books_observed: Array.from(refH2hBooks),
            exec_books_observed: Array.from(execH2hBooks),
            home_price: Number(homeH2hMedian.toFixed(3)),
            away_price: Number(awayH2hMedian.toFixed(3)),
            exec_best_home_price: execBestHomePrice,
            exec_best_home_book: execBestHomeBook,
            exec_best_away_price: execBestAwayPrice,
            exec_best_away_book: execBestAwayBook,
            snapshot_ts: snapshotTs,
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored += 1;
      } else {
        skipped_no_ref_h2h++;
      }

      // Store LINE snapshot (reference medians + best-exec anchored to reference median line)
      if (
        refHomeLines.length > 0 &&
        refAwayLines.length > 0 &&
        refHomeLinePrices.length > 0 &&
        refAwayLinePrices.length > 0
      ) {
        const refHomeLineMed = median(refHomeLines);
        const refAwayLineMed = median(refAwayLines);

        const bestHomeLine = pickBestLineAtAnchor(execHomeLineCandidates, Number.isFinite(refHomeLineMed) ? refHomeLineMed : null);
        const bestAwayLine = pickBestLineAtAnchor(execAwayLineCandidates, Number.isFinite(refAwayLineMed) ? refAwayLineMed : null);

        const { error } = await supabase.from("pers_sys_market_snapshots").upsert(
          {
            game_id: game.id,
            snapshot_type: snapshotType,
            market_type: "LINE",
            agg_method: "median",
            books_used: Array.from(refLineBooks),
            ref_books_observed: Array.from(refLineBooks),
            exec_books_observed: Array.from(execLineBooks),
            home_line: Number(refHomeLineMed.toFixed(3)),
            away_line: Number(refAwayLineMed.toFixed(3)),
            home_line_price: Number(median(refHomeLinePrices).toFixed(3)),
            away_line_price: Number(median(refAwayLinePrices).toFixed(3)),
            exec_best_home_line: bestHomeLine ? bestHomeLine.point : null,
            exec_best_home_line_price: bestHomeLine ? bestHomeLine.price : null,
            exec_best_home_line_book: bestHomeLine ? bestHomeLine.book : null,
            exec_best_away_line: bestAwayLine ? bestAwayLine.point : null,
            exec_best_away_line_price: bestAwayLine ? bestAwayLine.price : null,
            exec_best_away_line_book: bestAwayLine ? bestAwayLine.book : null,
            snapshot_ts: snapshotTs,
          },
          { onConflict: "game_id,snapshot_type,market_type,agg_method" }
        );
        if (!error) snapshotsStored += 1;
      } else {
        skipped_no_ref_line++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot_type: snapshotType,
        eligible: eligibleGames.length,
        snapshots_stored: snapshotsStored,
        observed_bookmaker_keys: Array.from(observedBookKeys).sort(),
        reference_books_used: Array.from(usedReferenceKeys).sort(),
        execution_books_used: Array.from(usedExecutionKeys).sort(),
        skipped_no_team_map,
        skipped_no_event_match,
        skipped_no_ref_h2h,
        skipped_no_ref_line,
        skipped_no_exec_books,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
