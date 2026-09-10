import type {
  ScoredRoute,
  StopPreference,
  StopRating,
  WeightPreferences,
  BusStop,
} from "./types";

const DEFAULT_WEIGHTS: WeightPreferences = {
  speed: 50,
  changes: 25,
  stops: 25,
};

const STOP_COSTS: Record<StopRating, number> = {
  prefer: 0,
  neutral: 25,
  avoid: 100,
};

const CHANGE_PENALTY_MINUTES = 15;

export function normalizeWeights(weights?: WeightPreferences): WeightPreferences {
  const w = weights ?? DEFAULT_WEIGHTS;
  const total = w.speed + w.changes + w.stops;
  if (total === 0) return DEFAULT_WEIGHTS;
  return {
    speed: w.speed / total,
    changes: w.changes / total,
    stops: w.stops / total,
  };
}

function getStopRating(
  stopId: string,
  preferences: StopPreference[],
): StopRating {
  const pref = preferences.find((p) => p.stopId === stopId);
  return pref?.rating ?? "neutral";
}

function transferStopCost(
  stop: BusStop,
  preferences: StopPreference[],
): { cost: number; rating: StopRating } {
  const rating = getStopRating(stop.id, preferences);
  return { cost: STOP_COSTS[rating], rating };
}

export function scoreRoute(
  route: Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags">,
  preferences: StopPreference[],
  weights?: WeightPreferences,
): ScoredRoute {
  const w = normalizeWeights(weights);

  const timeCost = route.durationMinutes * w.speed;
  const changesCost = route.numTransfers * CHANGE_PENALTY_MINUTES * w.changes;

  let stopsCost = 0;
  const explanations: string[] = [];
  const transferDetails: { stop: BusStop; rating: StopRating; cost: number }[] =
    [];

  for (const stop of route.transferStops) {
    const { cost, rating } = transferStopCost(stop, preferences);
    stopsCost += cost * w.stops;
    transferDetails.push({ stop, rating, cost });
  }

  const score = timeCost + changesCost + stopsCost;

  // Build human-readable explanations
  const avoided = transferDetails.filter((t) => t.rating === "avoid");
  const preferred = transferDetails.filter((t) => t.rating === "prefer");

  if (avoided.length > 0) {
    explanations.push(
      `Changes at ${avoided.map((t) => t.stop.name).join(", ")} (avoided stop${avoided.length > 1 ? "s" : ""})`,
    );
  }
  if (preferred.length > 0) {
    explanations.push(
      `Uses preferred stop${preferred.length > 1 ? "s" : ""}: ${preferred.map((t) => t.stop.name).join(", ")}`,
    );
  }
  if (route.numTransfers === 0) {
    explanations.push("Direct route — no changes needed");
  } else if (route.numTransfers === 1) {
    explanations.push("Only one change");
  }

  const tags: string[] = [];
  if (route.numTransfers === 0) tags.push("Direct");
  if (avoided.length === 0 && preferred.length > 0) tags.push("Best stops");
  if (route.durationMinutes <= 45) tags.push("Fast");

  return {
    ...route,
    score,
    scoreBreakdown: { timeCost, changesCost, stopsCost },
    explanations,
    tags,
  };
}

export function rankRoutes(
  routes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[],
  preferences: StopPreference[],
  weights?: WeightPreferences,
  mode?: "arrive-by" | "depart-after",
): ScoredRoute[] {
  const scored = routes.map((r) => scoreRoute(r, preferences, weights));

  if (mode === "arrive-by") {
    // Latest valid arrival first — closest to "arrive by" deadline
    scored.sort((a, b) => {
      const arrDiff =
        new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime();
      if (arrDiff !== 0) return arrDiff;
      if (a.numTransfers !== b.numTransfers) return a.numTransfers - b.numTransfers;
      return a.score - b.score;
    });
  } else if (mode === "depart-after") {
    // Earliest departure first — closest to "leave after" time
    scored.sort((a, b) => {
      const depDiff =
        new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
      if (depDiff !== 0) return depDiff;
      if (a.numTransfers !== b.numTransfers) return a.numTransfers - b.numTransfers;
      return a.score - b.score;
    });
  } else {
    scored.sort((a, b) => a.score - b.score);
  }

  // Tag the best in each dimension
  if (scored.length > 0) {
    const fastest = [...scored].sort(
      (a, b) => a.durationMinutes - b.durationMinutes,
    )[0];
    const fewestChanges = [...scored].sort(
      (a, b) => a.numTransfers - b.numTransfers,
    )[0];
    const bestStops = [...scored].sort(
      (a, b) => a.scoreBreakdown.stopsCost - b.scoreBreakdown.stopsCost,
    )[0];

    for (const route of scored) {
      if (mode === "arrive-by" && route === scored[0]) {
        route.tags.unshift("Best time");
      } else if (mode === "depart-after" && route === scored[0]) {
        route.tags.unshift("Best time");
      }
      if (route.id === fastest.id && !route.tags.includes("Fastest"))
        route.tags.push("Fastest");
      if (route.id === fewestChanges.id && route.numTransfers <= 1)
        route.tags.push("Fewest changes");
      if (route.id === bestStops.id) route.tags.push("Best change points");
    }
  }

  return scored;
}
