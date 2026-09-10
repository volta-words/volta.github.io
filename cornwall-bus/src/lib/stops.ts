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

export function getStopsByIds(ids: string[]): BusStop[] {
  return ids.map((id) => getStopById(id)).filter((s): s is BusStop => !!s);
}

/** Haversine distance in metres */
function distanceM(a: BusStop, b: BusStop): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Find nearby stops — same name/locality or within radius.
 * Used to multi-select equivalent stops (e.g. campus Stand A/B/C/D).
 */
export function getRelatedStops(
  stop: BusStop,
  radiusM = 500,
): BusStop[] {
  const stops = loadStops();
  const related: BusStop[] = [stop];
  const seen = new Set<string>([stop.id]);

  for (const other of stops) {
    if (seen.has(other.id)) continue;

    const samePlace =
      other.name.toLowerCase() === stop.name.toLowerCase() &&
      (other.locality ?? "").toLowerCase() === (stop.locality ?? "").toLowerCase();

    const nearby = distanceM(stop, other) <= radiusM;

    // Same campus/location name prefix (e.g. "Falmouth Uni Penryn Campus")
    const sameCampus =
      stop.name.length > 8 &&
      other.name.length > 8 &&
      stop.name.toLowerCase().slice(0, 12) === other.name.toLowerCase().slice(0, 12) &&
      (other.locality ?? "").toLowerCase() === (stop.locality ?? "").toLowerCase();

    // e.g. "Truro College", "Truro College Main Entrance" within 800m
    const stopPrefix = stop.name.toLowerCase().replace(/\s+(main entrance|opp|w-bound).*$/i, "").slice(0, 14);
    const otherPrefix = other.name.toLowerCase().replace(/\s+(main entrance|opp|w-bound).*$/i, "").slice(0, 14);
    const sharedName =
      stopPrefix.length > 6 &&
      otherPrefix.length > 6 &&
      distanceM(stop, other) <= 800 &&
      (stopPrefix === otherPrefix ||
        other.name.toLowerCase().includes(stopPrefix) ||
        stop.name.toLowerCase().includes(otherPrefix));

    if (samePlace || nearby || sameCampus || sharedName) {
      related.push(other);
      seen.add(other.id);
    }
  }

  return related.sort(
    (a, b) => distanceM(stop, a) - distanceM(stop, b),
  );
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

/** Search returning all matching stops including duplicates at same location */
export function searchStopsExpanded(query: string, limit = 30): BusStop[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const stops = loadStops();
  const scored: { stop: BusStop; score: number }[] = [];

  for (const stop of stops) {
    const haystack = `${stop.name} ${stop.locality ?? ""} ${stop.indicator ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) continue;

    let score = 0;
    if (stop.name.toLowerCase().startsWith(q)) score += 10;
    else if (stop.name.toLowerCase().includes(q)) score += 5;
    if ((stop.locality ?? "").toLowerCase().includes(q)) score += 3;

    scored.push({ stop, score });
  }

  scored.sort((a, b) => b.score - a.score || a.stop.name.localeCompare(b.stop.name));
  return scored.slice(0, limit).map((s) => s.stop);
}

export function formatStopLabel(stop: BusStop): string {
  const parts = [stop.name];
  if (stop.indicator) parts.push(`(${stop.indicator})`);
  if (stop.locality) parts.push(`— ${stop.locality}`);
  return parts.join(" ");
}
