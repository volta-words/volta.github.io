import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { addSeconds, format, parse } from "date-fns";
import type { RouteLeg, ScoredRoute } from "./types";
import { getAllStops, getStopById } from "./stops";

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

interface GtfsGraphData {
  calendars: Record<string, { days: number[]; start: string; end: string }>;
  calendarDates: Record<string, Record<string, number>>;
  trips: Record<string, TripData>;
}

interface TimedLeg {
  tripId: string;
  route: string;
  routeName: string;
  serviceId: string;
  fromId: string;
  toId: string;
  depart: Date;
  arrive: Date;
}

interface DepartureRef {
  tripId: string;
  stopIndex: number;
  dep: number;
}

let graphCache: GtfsGraphData | null = null;
let departureBoards: Map<string, DepartureRef[]> | null = null;
let stopsWithService: Set<string> | null = null;

const MIN_LEG_MINUTES = 4;
const MIN_TRANSFER_MS = 2 * 60 * 1000;
const MAX_PATHS = 25;

function loadGraph(): GtfsGraphData | null {
  if (graphCache) return graphCache;

  const paths = [
    join(process.cwd(), "data", "gtfs", "graph.json"),
    join(process.cwd(), "cornwall-bus", "data", "gtfs", "graph.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, "utf8")) as GtfsGraphData & {
        graph?: unknown;
      };
      if (raw.trips) {
        graphCache = raw;
        buildIndexes(raw);
        return graphCache;
      }
    }
  }
  return null;
}

function buildIndexes(data: GtfsGraphData): void {
  const boards = new Map<string, DepartureRef[]>();
  const served = new Set<string>();

  for (const [tripId, trip] of Object.entries(data.trips)) {
    trip.stops.forEach((stop, stopIndex) => {
      served.add(stop.stopId);
      if (!boards.has(stop.stopId)) boards.set(stop.stopId, []);
      boards.get(stop.stopId)!.push({ tripId, stopIndex, dep: stop.dep });
    });
  }

  for (const board of boards.values()) {
    board.sort((a, b) => a.dep - b.dep || a.tripId.localeCompare(b.tripId));
  }

  departureBoards = boards;
  stopsWithService = served;
}

function dateToGtfs(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getActiveServices(data: GtfsGraphData, date: Date): Set<string> {
  const active = new Set<string>();
  const dateStr = dateToGtfs(date).replace(/-/g, "");
  const dow = date.getDay();

  for (const [serviceId, cal] of Object.entries(data.calendars)) {
    const exceptions = data.calendarDates[serviceId] ?? {};
    if (exceptions[dateStr] === 1) {
      active.add(serviceId);
      continue;
    }
    if (exceptions[dateStr] === 2) continue;

    if (dateStr >= cal.start && dateStr <= cal.end && cal.days[dow]) {
      active.add(serviceId);
    }
  }

  return active;
}

function secondsToDate(baseDate: Date, seconds: number): Date {
  const dayStart = parse(format(baseDate, "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
  return addSeconds(dayStart, seconds);
}

function lowerBoundDepartures(board: DepartureRef[], afterSeconds: number): number {
  let lo = 0;
  let hi = board.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (board[mid].dep < afterSeconds) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function makeLeg(
  trip: TripData,
  tripId: string,
  fromStopId: string,
  fromIndex: number,
  toIndex: number,
  baseDate: Date,
): TimedLeg {
  const boardStop = trip.stops[fromIndex];
  const alightStop = trip.stops[toIndex];
  return {
    tripId,
    route: trip.route,
    routeName: trip.routeName,
    serviceId: trip.serviceId,
    fromId: fromStopId,
    toId: alightStop.stopId,
    depart: secondsToDate(baseDate, boardStop.dep),
    arrive: secondsToDate(baseDate, alightStop.arr),
  };
}

function legMeetsConstraint(
  path: TimedLeg[],
  constraint: { mode: "arrive-by" | "depart-after"; time: Date },
): boolean {
  if (path.length === 0) return false;
  const arrival = path[path.length - 1].arrive;
  const departure = path[0].depart;

  if (constraint.mode === "arrive-by") return arrival <= constraint.time;
  return departure >= constraint.time;
}

/** Scan departures from one stop for legs to targets or useful transfer points */
function scanDepartures(
  data: GtfsGraphData,
  activeServices: Set<string>,
  fromStopId: string,
  baseDate: Date,
  afterSeconds: number,
  windowEndMs: number,
  mode: "arrive-by" | "depart-after",
  toIds: Set<string>,
  allowTransfers: boolean,
): TimedLeg[] {
  if (!departureBoards) return [];

  const board = departureBoards.get(fromStopId);
  if (!board?.length) return [];

  const legs: TimedLeg[] = [];
  const startIdx = lowerBoundDepartures(board, afterSeconds);

  for (let i = startIdx; i < board.length; i++) {
    const ref = board[i];
    const trip = data.trips[ref.tripId];
    if (!trip || !activeServices.has(trip.serviceId)) continue;

    const boardStop = trip.stops[ref.stopIndex];
    const depart = secondsToDate(baseDate, boardStop.dep);
    const depMs = depart.getTime();

    if (mode === "depart-after" && depMs > windowEndMs) break;

    for (let j = ref.stopIndex + 1; j < trip.stops.length; j++) {
      const alightStop = trip.stops[j];
      const arrive = secondsToDate(baseDate, alightStop.arr);
      const arrMs = arrive.getTime();
      const durationMin = (arrMs - depMs) / 60000;

      if (mode === "arrive-by" && arrMs > windowEndMs) continue;

      const isTarget = toIds.has(alightStop.stopId);
      if (!isTarget && durationMin < MIN_LEG_MINUTES) continue;
      if (!isTarget && !allowTransfers) continue;

      legs.push(makeLeg(trip, ref.tripId, fromStopId, ref.stopIndex, j, baseDate));
    }
  }

  return legs;
}

function findPaths(
  data: GtfsGraphData,
  activeServices: Set<string>,
  fromIds: string[],
  toIds: Set<string>,
  baseDate: Date,
  constraint: { mode: "arrive-by" | "depart-after"; time: Date },
  maxTransfers = 3,
): TimedLeg[][] {
  const paths: TimedLeg[][] = [];
  const seenPathKeys = new Set<string>();

  const windowStartMs =
    constraint.mode === "depart-after"
      ? constraint.time.getTime()
      : constraint.time.getTime() - 5 * 3600 * 1000;
  const windowEndMs =
    constraint.mode === "arrive-by"
      ? constraint.time.getTime()
      : constraint.time.getTime() + 4 * 3600 * 1000;

  const dayStartMs = parse(
    format(baseDate, "yyyy-MM-dd"),
    "yyyy-MM-dd",
    new Date(),
  ).getTime();
  const startAfterSeconds = Math.floor(
    (constraint.mode === "depart-after"
      ? constraint.time.getTime()
      : windowStartMs - dayStartMs) / 1000,
  );

  function addPath(path: TimedLeg[]) {
    if (paths.length >= MAX_PATHS) return;
    if (!legMeetsConstraint(path, constraint)) return;

    const key = path
      .map((l) => `${l.tripId}:${l.fromId}->${l.toId}@${l.depart.getTime()}`)
      .join("|");
    if (seenPathKeys.has(key)) return;
    seenPathKeys.add(key);
    paths.push(path);
  }

  // Round 1: direct trips (fast — one scan per origin stop)
  for (const fromId of fromIds) {
    const legs = scanDepartures(
      data,
      activeServices,
      fromId,
      baseDate,
      startAfterSeconds,
      windowEndMs,
      constraint.mode,
      toIds,
      false,
    );
    for (const leg of legs) {
      if (toIds.has(leg.toId)) addPath([leg]);
    }
  }

  if (paths.length >= 8) return paths;

  // Round 2+: transfers via DFS, but only from promising first legs
  function dfs(path: TimedLeg[]) {
    if (paths.length >= MAX_PATHS) return;
    if (path.length > maxTransfers + 1) return;

    const currentId = path[path.length - 1].toId;
    const earliest = path[path.length - 1].arrive;
    const afterSeconds = Math.floor((earliest.getTime() - dayStartMs) / 1000);

    const legOptions = scanDepartures(
      data,
      activeServices,
      currentId,
      baseDate,
      afterSeconds,
      windowEndMs,
      constraint.mode,
      toIds,
      true,
    );

    // Prefer legs that reach destination, then earliest departures
    const targets = legOptions.filter((l) => toIds.has(l.toId));
    const transfers = legOptions.filter((l) => !toIds.has(l.toId));
    const sorted =
      constraint.mode === "arrive-by"
        ? [...targets.sort((a, b) => b.arrive.getTime() - a.arrive.getTime()),
           ...transfers.sort((a, b) => a.depart.getTime() - b.depart.getTime()).slice(0, 8)]
        : [...targets.sort((a, b) => a.depart.getTime() - b.depart.getTime()),
           ...transfers.sort((a, b) => a.depart.getTime() - b.depart.getTime()).slice(0, 8)];

    for (const leg of sorted) {
      if (leg.depart.getTime() - earliest.getTime() < MIN_TRANSFER_MS) continue;

      const next = [...path, leg];
      if (toIds.has(leg.toId)) {
        addPath(next);
      } else {
        dfs(next);
      }
    }
  }

  for (const fromId of fromIds) {
    const firstLegs = scanDepartures(
      data,
      activeServices,
      fromId,
      baseDate,
      startAfterSeconds,
      windowEndMs,
      constraint.mode,
      toIds,
      true,
    );

    const targets = firstLegs.filter((l) => toIds.has(l.toId));
    const transfers = firstLegs.filter((l) => !toIds.has(l.toId));

    for (const leg of targets) addPath([leg]);

    const transferCandidates =
      constraint.mode === "arrive-by"
        ? transfers.sort((a, b) => a.depart.getTime() - b.depart.getTime()).slice(0, 6)
        : transfers.sort((a, b) => a.depart.getTime() - b.depart.getTime()).slice(0, 6);

    for (const leg of transferCandidates) {
      dfs([leg]);
      if (paths.length >= MAX_PATHS) break;
    }

    if (paths.length >= MAX_PATHS) break;
  }

  return paths;
}

function legToRouteLeg(leg: TimedLeg, isTransfer: boolean): RouteLeg | null {
  const from = getStopById(leg.fromId);
  const to = getStopById(leg.toId);
  if (!from || !to) return null;

  return {
    mode: "BUS",
    fromStop: from,
    toStop: to,
    routeShortName: leg.route,
    routeLongName: leg.routeName,
    departureTime: leg.depart.toISOString(),
    arrivalTime: leg.arrive.toISOString(),
    durationMinutes: Math.round(
      (leg.arrive.getTime() - leg.depart.getTime()) / 60000,
    ),
    isTransfer,
  };
}

function pathToRoute(
  legs: TimedLeg[],
  index: number,
): Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags"> | null {
  const routeLegs: RouteLeg[] = [];
  for (let i = 0; i < legs.length; i++) {
    const rl = legToRouteLeg(legs[i], i > 0);
    if (!rl) return null;
    routeLegs.push(rl);
  }

  const transferStops = legs
    .slice(1)
    .map((l) => getStopById(l.fromId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return {
    id: `gtfs-${index}-${legs[0].depart.getTime()}`,
    legs: routeLegs,
    departureTime: legs[0].depart.toISOString(),
    arrivalTime: legs[legs.length - 1].arrive.toISOString(),
    durationMinutes: Math.round(
      (legs[legs.length - 1].arrive.getTime() - legs[0].depart.getTime()) /
        60000,
    ),
    numTransfers: legs.length - 1,
    transferStops,
  };
}

/** Haversine distance in metres */
function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
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

export function isStopInGtfs(stopId: string): boolean {
  loadGraph();
  return stopsWithService?.has(stopId) ?? false;
}

/**
 * Expand stop IDs to include nearby stops that actually have bus service in GTFS.
 * NaPTAN lists more stops than appear in the timetable (e.g. campus Stand B).
 */
export function expandGtfsStopIds(stopIds: string[], radiusM = 350): string[] {
  loadGraph();
  if (!stopsWithService) return stopIds;

  const expanded = new Set<string>();
  const allStops = getAllStops();

  for (const id of stopIds) {
    expanded.add(id);
    if (stopsWithService.has(id)) continue;

    const stop = getStopById(id);
    if (!stop) continue;

    const nearby = allStops
      .filter(
        (other) =>
          other.id !== id &&
          stopsWithService!.has(other.id) &&
          distanceM(stop, other) <= radiusM,
      )
      .sort((a, b) => distanceM(stop, a) - distanceM(stop, b));

    for (const n of nearby.slice(0, 4)) {
      expanded.add(n.id);
    }
  }

  return [...expanded];
}

export function isGtfsGraphAvailable(): boolean {
  const data = loadGraph();
  return data !== null && !!data.trips && Object.keys(data.trips).length > 0;
}

export function planWithGtfs(params: {
  fromStopIds: string[];
  toStopIds: string[];
  mode: "arrive-by" | "depart-after";
  time: Date;
}): Omit<
  ScoredRoute,
  "score" | "scoreBreakdown" | "explanations" | "tags"
>[] {
  const data = loadGraph();
  if (!data?.trips || !departureBoards) return [];

  const fromStopIds = expandGtfsStopIds(params.fromStopIds).filter((id) =>
    departureBoards!.has(id),
  );
  const toStopIds = expandGtfsStopIds(params.toStopIds);
  const { mode, time } = params;
  const toSet = new Set(toStopIds);
  const baseDate = parse(format(time, "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
  const activeServices = getActiveServices(data, baseDate);

  if (activeServices.size === 0 || fromStopIds.length === 0) return [];

  const allPaths = findPaths(
    data,
    activeServices,
    fromStopIds,
    toSet,
    baseDate,
    { mode, time },
  );

  const seen = new Set<string>();
  const routes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[] = [];

  allPaths.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const aDur = a[a.length - 1].arrive.getTime() - a[0].depart.getTime();
    const bDur = b[b.length - 1].arrive.getTime() - b[0].depart.getTime();
    return aDur - bDur;
  });

  for (let i = 0; i < allPaths.length && routes.length < 8; i++) {
    const key = allPaths[i]
      .map((l) => `${l.route}@${l.depart.getTime()}->${l.toId}`)
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const route = pathToRoute(allPaths[i], i);
    if (route) routes.push(route);
  }

  return routes;
}
