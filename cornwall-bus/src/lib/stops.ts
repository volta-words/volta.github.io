import type { BusStop } from "./types";
import cornwallStops from "../../data/cornwall-stops.json";

let stopsCache: BusStop[] | null = null;

function loadStops(): BusStop[] {
  if (stopsCache) return stopsCache;
  stopsCache = (cornwallStops as BusStop[]).map((s) => ({
    id: s.id,
    name: s.name,
    locality: s.locality,
    lat: s.lat,
    lng: s.lng,
    indicator: s.indicator,
  }));
  return stopsCache;
}

export function getAllStops(): BusStop[] {
  return loadStops();
}

export function getStopById(id: string): BusStop | undefined {
  return loadStops().find((s) => s.id === id);
}

export function searchStops(query: string, limit = 20): BusStop[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const stops = loadStops();
  const scored: { stop: BusStop; score: number }[] = [];

  for (const stop of stops) {
    const name = stop.name.toLowerCase();
    const locality = (stop.locality ?? "").toLowerCase();
    const indicator = (stop.indicator ?? "").toLowerCase();
    const haystack = `${name} ${locality} ${indicator}`;

    if (!haystack.includes(q)) continue;

    let score = 0;
    if (name.startsWith(q)) score += 10;
    else if (name.includes(q)) score += 5;
    if (locality.includes(q)) score += 3;
    if (indicator.includes(q)) score += 1;

    scored.push({ stop, score });
  }

  scored.sort((a, b) => b.score - a.score || a.stop.name.localeCompare(b.stop.name));

  // Deduplicate by name+locality (keep highest scored)
  const seen = new Set<string>();
  const results: BusStop[] = [];
  for (const { stop } of scored) {
    const key = `${stop.name}|${stop.locality ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(stop);
    if (results.length >= limit) break;
  }

  return results;
}

export function formatStopLabel(stop: BusStop): string {
  const parts = [stop.name];
  if (stop.indicator) parts.push(`(${stop.indicator})`);
  if (stop.locality) parts.push(`— ${stop.locality}`);
  return parts.join(" ");
}
