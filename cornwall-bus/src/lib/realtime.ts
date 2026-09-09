import { fetchRealtimeFeed, type SiriVehicleActivity } from "./bods";
import type { LiveDeparture, ScoredRoute } from "./types";

/** In-memory cache for realtime data */
let cache: {
  activities: SiriVehicleActivity[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS = 30_000;

/** Cornwall Go South West realtime feed IDs (BODS) */
const CORNWALL_DATAFEED_IDS = ["23002", "17357", "20004"];

export async function getRealtimeActivities(): Promise<SiriVehicleActivity[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.activities;
  }

  const all: SiriVehicleActivity[] = [];
  for (const id of CORNWALL_DATAFEED_IDS) {
    const activities = await fetchRealtimeFeed(id);
    all.push(...activities);
  }

  // If BODS unavailable, use simulated delays for demo
  if (all.length === 0) {
    all.push(...getSimulatedActivities());
  }

  cache = { activities: all, fetchedAt: Date.now() };
  return all;
}

function getSimulatedActivities(): SiriVehicleActivity[] {
  const now = new Date();
  return [
    {
      lineRef: "U1",
      delayMinutes: 2,
      status: "on-time",
      recordedAtTime: now.toISOString(),
    },
    {
      lineRef: "U2",
      delayMinutes: 8,
      status: "delayed",
      recordedAtTime: now.toISOString(),
    },
    {
      lineRef: "34",
      delayMinutes: 0,
      status: "on-time",
      recordedAtTime: now.toISOString(),
    },
    {
      lineRef: "18",
      delayMinutes: -1,
      status: "on-time",
      recordedAtTime: now.toISOString(),
    },
    {
      lineRef: "U4",
      delayMinutes: 12,
      status: "delayed",
      recordedAtTime: now.toISOString(),
    },
  ];
}

export function getDelayForRoute(
  routeShortName: string | undefined,
  activities: SiriVehicleActivity[],
): number {
  if (!routeShortName) return 0;
  const match = activities.find(
    (a) => a.lineRef === routeShortName || a.lineRef?.includes(routeShortName),
  );
  return match?.delayMinutes ?? 0;
}

export function enrichRouteWithRealtime(
  route: ScoredRoute,
  activities: SiriVehicleActivity[],
): ScoredRoute {
  let maxDelay = 0;
  let atRisk = false;

  for (const leg of route.legs) {
    if (leg.mode !== "BUS") continue;
    const delay = getDelayForRoute(leg.routeShortName, activities);
    maxDelay = Math.max(maxDelay, delay);
    if (delay >= 5) atRisk = true;
  }

  return {
    ...route,
    delayMinutes: maxDelay,
    atRisk,
  };
}

export async function getLiveDepartures(
  stopId: string,
): Promise<LiveDeparture[]> {
  const activities = await getRealtimeActivities();
  const now = new Date();

  // Generate representative departures based on realtime delays
  return activities.slice(0, 5).map((a, i) => {
    const scheduled = new Date(now.getTime() + (i + 1) * 15 * 60 * 1000);
    const delay = a.delayMinutes ?? 0;
    const predicted = new Date(scheduled.getTime() + delay * 60 * 1000);

    return {
      stopId,
      routeName: a.lineRef ?? "—",
      destination: "Cornwall",
      scheduledTime: scheduled.toISOString(),
      predictedTime: predicted.toISOString(),
      delayMinutes: delay,
      status:
        delay > 5
          ? "delayed"
          : delay < -2
            ? "early"
            : ("on-time" as const),
    };
  });
}

export function getCacheAge(): number | null {
  if (!cache) return null;
  return Date.now() - cache.fetchedAt;
}
