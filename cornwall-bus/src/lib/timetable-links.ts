import { existsSync, readFileSync } from "fs";
import { join } from "path";

const TFC_BASE = "https://www.transportforcornwall.co.uk/services";
const TFC_SERVICES = "https://www.transportforcornwall.co.uk/services";
const TFC_PLANNER = "https://www.transportforcornwall.co.uk/plan-your-journey";

/** route short name → GTFS agency id (TFCN, DTCO, OTSS, …) */
let routeAgencyMap: Map<string, string> | null = null;

function loadRouteAgencyMap(): Map<string, string> {
  if (routeAgencyMap) return routeAgencyMap;

  routeAgencyMap = new Map();
  const paths = [
    join(process.cwd(), "data", "gtfs", "extracted", "routes.txt"),
    join(process.cwd(), "cornwall-bus", "data", "gtfs", "extracted", "routes.txt"),
  ];

  for (const p of paths) {
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [routeId, , shortName] = line.split(",");
      if (!routeId || !shortName) continue;
      const agency = routeId.split(":")[0];
      if (agency) routeAgencyMap.set(shortName, agency);
    }
    break;
  }

  return routeAgencyMap;
}

function guessAgency(routeShortName: string): string {
  if (routeShortName.startsWith("PR")) return "DTCO";
  if (/^69/.test(routeShortName)) return "OTSS";
  return "TFCN";
}

/** Official Transport for Cornwall timetable page for a bus route (Go Cornwall Bus network). */
export function getTfcTimetableUrl(routeShortName: string): string {
  const map = loadRouteAgencyMap();
  const agency = map.get(routeShortName) ?? guessAgency(routeShortName);
  return `${TFC_BASE}/${agency}/${encodeURIComponent(routeShortName)}`;
}

export function getTfcServicesUrl(): string {
  return TFC_SERVICES;
}

export function getTfcPlannerUrl(): string {
  return TFC_PLANNER;
}

/** Unique timetable links for all bus routes on a journey. */
export function getRouteTimetableLinks(
  routeShortNames: string[],
): { route: string; url: string }[] {
  const seen = new Set<string>();
  const links: { route: string; url: string }[] = [];

  for (const route of routeShortNames) {
    if (!route || seen.has(route)) continue;
    seen.add(route);
    links.push({ route, url: getTfcTimetableUrl(route) });
  }

  return links;
}
