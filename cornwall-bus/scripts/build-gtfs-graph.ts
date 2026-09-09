#!/usr/bin/env npx tsx
/**
 * Build a connection graph from Transport for Cornwall GTFS.
 * Source: https://www.transportforcornwall.co.uk/open-data
 *
 * Usage: npx tsx scripts/build-gtfs-graph.ts
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const GTFS_DIR = join(process.cwd(), "data", "gtfs", "extracted");
const OUT_PATH = join(process.cwd(), "data", "gtfs", "graph.json");

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

async function readCsv(path: string): Promise<string[][]> {
  const lines: string[][] = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      continue;
    }
    lines.push(cols);
  }
  return lines;
}

async function main() {
  console.log("Loading GTFS files from", GTFS_DIR);

  const routesRaw = await readCsv(join(GTFS_DIR, "routes.txt"));
  const routeMap = new Map<string, { short: string; long: string }>();
  for (const [id, , short, long] of routesRaw) {
    routeMap.set(id, { short: short || id, long: long || short || id });
  }

  const tripsRaw = await readCsv(join(GTFS_DIR, "trips.txt"));
  const tripRoute = new Map<string, string>();
  const tripService = new Map<string, string>();
  for (const [routeId, serviceId, tripId] of tripsRaw) {
    tripRoute.set(tripId, routeId);
    tripService.set(tripId, serviceId);
  }

  // Calendar services
  const calRaw = await readCsv(join(GTFS_DIR, "calendar.txt"));
  const calHeader = ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"];
  const calendars: Record<string, { days: number[]; start: string; end: string }> = {};
  for (const row of calRaw) {
    const [id, ...rest] = row;
    calendars[id] = {
      days: rest.slice(0, 7).map(Number),
      start: rest[7],
      end: rest[8],
    };
  }

  const calDatesRaw = await readCsv(join(GTFS_DIR, "calendar_dates.txt"));
  const calDates: Record<string, Record<string, number>> = {};
  for (const [serviceId, date, type] of calDatesRaw) {
    if (!calDates[serviceId]) calDates[serviceId] = {};
    calDates[serviceId][date] = parseInt(type);
  }

  // Group stop_times by trip
  console.log("Parsing stop_times…");
  const tripStops = new Map<string, { stopId: string; dep: number; arr: number; seq: number }[]>();

  const stRaw = await readFile(join(GTFS_DIR, "stop_times.txt"), "utf8");
  const stLines = stRaw.split("\n");
  const stHeader = parseCsvLine(stLines[0]);
  const tripIdx = stHeader.indexOf("trip_id");
  const arrIdx = stHeader.indexOf("arrival_time");
  const depIdx = stHeader.indexOf("departure_time");
  const stopIdx = stHeader.indexOf("stop_id");
  const seqIdx = stHeader.indexOf("stop_sequence");

  for (let i = 1; i < stLines.length; i++) {
    const line = stLines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const tripId = cols[tripIdx];
    const stopId = cols[stopIdx];
    const dep = timeToSeconds(cols[depIdx]);
    const arr = timeToSeconds(cols[arrIdx]);
    const seq = parseInt(cols[seqIdx]);

    if (!tripStops.has(tripId)) tripStops.set(tripId, []);
    tripStops.get(tripId)!.push({ stopId, dep, arr, seq });
  }

  console.log("Building trip index…");
  interface TripStop {
    stopId: string;
    dep: number;
    arr: number;
  }
  interface TripData {
    route: string;
    routeName: string;
    serviceId: string;
    stops: TripStop[];
  }
  const trips: Record<string, TripData> = {};

  for (const [tripId, stops] of tripStops) {
    stops.sort((a, b) => a.seq - b.seq);
    const routeId = tripRoute.get(tripId);
    const serviceId = tripService.get(tripId);
    if (!routeId || !serviceId) continue;

    const route = routeMap.get(routeId) ?? { short: routeId, long: routeId };

    trips[tripId] = {
      route: route.short,
      routeName: route.long,
      serviceId,
      stops: stops.map((s) => ({
        stopId: s.stopId,
        dep: s.dep,
        arr: s.arr,
      })),
    };
  }

  const output = {
    builtAt: new Date().toISOString(),
    source: "https://www.transportforcornwall.co.uk/open-data",
    tripCount: Object.keys(trips).length,
    calendars,
    calendarDates: calDates,
    trips,
  };

  await mkdir(join(process.cwd(), "data", "gtfs"), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output));

  const sizeMb = (JSON.stringify(output).length / 1024 / 1024).toFixed(1);
  console.log(`Wrote ${Object.keys(trips).length} trips (${sizeMb} MB)`);
  console.log(`Output: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
