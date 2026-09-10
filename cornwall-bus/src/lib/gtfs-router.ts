import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { RouteLeg, ScoredRoute } from "./types";
import { getAllStops, getStopById } from "./stops";
import { cornwallSecondsToIso, parseCornwallTime } from "./cornwall-time";
import { getTfcTimetableUrl } from "./timetable-links";

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
  departSec: number;
  arriveSec: number;
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
const MIN_TRANSFER_SEC = 2 * 60;
const MAX_PATHS = 25;
const END_OF_SERVICE_SEC = 30 * 3600; // GTFS trips can run past midnight

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

function getActiveServices(data: GtfsGraphData, date: string): Set<string> {
  const active = new Set<string>();
  const dateStr = date.replace(/-/g, "");
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();

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
    departSec: boardStop.dep,
    arriveSec: alightStop.arr,
  };
}

function legMeetsConstraint(
  path: TimedLeg[],
  mode: "arrive-by" | "depart-after",
  constraintSec: number,
): boolean {
  if (path.length === 0) return false;
  const arrival = path[path.length - 1].arriveSec;
  const departure = path[0].departSec;

  if (mode === "arrive-by") return arrival <= constraintSec;
  return departure >= constraintSec;
}

/** Scan departures from one stop for legs to targets or useful transfer points */
function scanDepartures(
  data: GtfsGraphData,
  activeServices: Set<string>,
  fromStopId: string,
  afterSec: number,
  mode: "arrive-by" | "depart-after",
  toIds: Set<string>,
  allowTransfers: boolean,
  maxDepartSec: number,
): TimedLeg[] {
  if (!departureBoards) return [];

  const board = departureBoards.get(fromStopId);
  if (!board?.length) return [];

  const legs: TimedLeg[] = [];
  const startIdx = lowerBoundDepartures(board, afterSec);

  for (let i = startIdx; i < board.length; i++) {
    const ref = board[i];
    if (ref.dep > maxDepartSec) break;

    const trip = data.trips[ref.tripId];
    if (!trip || !activeServices.has(trip.serviceId)) continue;

    const depSec = trip.stops[ref.stopIndex].dep;

    for (let j = ref.stopIndex + 1; j < trip.stops.length; j++) {
      const alightStop = trip.stops[j];
      const arrSec = alightStop.arr;
      const durationMin = (arrSec - depSec) / 60;

      if (mode === "arrive-by" && arrSec > maxDepartSec) continue;

      const isTarget = toIds.has(alightStop.stopId);
      if (!isTarget && durationMin < MIN_LEG_MINUTES) continue;
      if (!isTarget && !allowTransfers) continue;

      legs.push(makeLeg(trip, ref.tripId, fromStopId, ref.stopIndex, j));
    }
  }

  return legs;
}

function findPaths(
  data: GtfsGraphData,
  activeServices: Set<string>,
  fromIds: string[],
  toIds: Set<string>,
  date: string,
  mode: "arrive-by" | "depart-after",
  constraintSec: number,
  maxTransfers = 3,
): TimedLeg[][] {
  const paths: TimedLeg[][] = [];
  const seenPathKeys = new Set<string>();

  const windowStartSec =
    mode === "depart-after"
      ? constraintSec
      : Math.max(0, constraintSec - 5 * 3600);

  // arrive-by: cap arrivals at constraint; depart-after: no upper cap on first departure
  const firstLegMaxSec =
    mode === "arrive-by" ? constraintSec : END_OF_SERVICE_SEC;
  const transferArrivalMaxSec =
    mode === "arrive-by" ? constraintSec : END_OF_SERVICE_SEC;

  function addPath(path: TimedLeg[]) {
    if (paths.length >= MAX_PATHS) return;
    if (!legMeetsConstraint(path, mode, constraintSec)) return;

    const key = path
      .map((l) => `${l.tripId}:${l.fromId}->${l.toId}@${l.departSec}`)
      .join("|");
    if (seenPathKeys.has(key)) return;
    seenPathKeys.add(key);
    paths.push(path);
  }

  // Round 1: direct trips
  for (const fromId of fromIds) {
    const legs = scanDepartures(
      data,
      activeServices,
      fromId,
      windowStartSec,
      mode,
      toIds,
      false,
      firstLegMaxSec,
    );
    const directLegs = legs
      .filter((l) => toIds.has(l.toId))
      .sort((a, b) =>
        mode === "arrive-by" ? b.arriveSec - a.arriveSec : a.departSec - b.departSec,
      );
    for (const leg of directLegs) addPath([leg]);
  }

  function dfs(path: TimedLeg[]) {
    if (paths.length >= MAX_PATHS) return;
    if (path.length > maxTransfers + 1) return;

    const currentId = path[path.length - 1].toId;
    const earliestSec = path[path.length - 1].arriveSec + MIN_TRANSFER_SEC;

    const legOptions = scanDepartures(
      data,
      activeServices,
      currentId,
      earliestSec,
      mode,
      toIds,
      true,
      transferArrivalMaxSec,
    );

    const targets = legOptions.filter((l) => toIds.has(l.toId));
    const transfers = legOptions.filter((l) => !toIds.has(l.toId));
    const sorted =
      mode === "arrive-by"
        ? [
            ...targets.sort((a, b) => b.arriveSec - a.arriveSec),
            ...transfers
              .sort((a, b) => b.departSec - a.departSec)
              .slice(0, 12),
          ]
        : [
            ...targets.sort((a, b) => a.departSec - b.departSec),
            ...transfers
              .sort((a, b) => a.departSec - b.departSec)
              .slice(0, 12),
          ];

    for (const leg of sorted) {
      if (leg.departSec < earliestSec) continue;

      const next = [...path, leg];
      if (toIds.has(leg.toId)) {
        addPath(next);
      } else {
        dfs(next);
      }
    }
  }

  const firstHopLimit = mode === "depart-after" ? 20 : 10;

  for (const fromId of fromIds) {
    const firstLegs = scanDepartures(
      data,
      activeServices,
      fromId,
      windowStartSec,
      mode,
      toIds,
      true,
      firstLegMaxSec,
    );

    const targets = firstLegs.filter((l) => toIds.has(l.toId));
    const transfers = firstLegs.filter((l) => !toIds.has(l.toId));

    for (const leg of targets.sort((a, b) =>
      mode === "arrive-by" ? b.arriveSec - a.arriveSec : a.departSec - b.departSec,
    )) {
      addPath([leg]);
    }

    const transferCandidates =
      mode === "arrive-by"
        ? transfers.sort((a, b) => b.departSec - a.departSec).slice(0, firstHopLimit)
        : transfers.sort((a, b) => a.departSec - b.departSec).slice(0, firstHopLimit);

    for (const leg of transferCandidates) {
      dfs([leg]);
      if (paths.length >= MAX_PATHS) break;
    }

    if (paths.length >= MAX_PATHS) break;
  }

  return paths;
}

function legToRouteLeg(
  leg: TimedLeg,
  date: string,
  isTransfer: boolean,
): RouteLeg | null {
  const from = getStopById(leg.fromId);
  const to = getStopById(leg.toId);
  if (!from || !to) return null;

  const departureTime = cornwallSecondsToIso(date, leg.departSec);
  const arrivalTime = cornwallSecondsToIso(date, leg.arriveSec);

  return {
    mode: "BUS",
    fromStop: from,
    toStop: to,
    routeShortName: leg.route,
    routeLongName: leg.routeName,
    timetableUrl: getTfcTimetableUrl(leg.route),
    departureTime,
    arrivalTime,
    durationMinutes: Math.round((leg.arriveSec - leg.departSec) / 60),
    isTransfer,
  };
}

function pathToRoute(
  legs: TimedLeg[],
  date: string,
  index: number,
): Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags"> | null {
  const routeLegs: RouteLeg[] = [];
  for (let i = 0; i < legs.length; i++) {
    const rl = legToRouteLeg(legs[i], date, i > 0);
    if (!rl) return null;
    routeLegs.push(rl);
  }

  const transferStops = legs
    .slice(1)
    .map((l) => getStopById(l.fromId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return {
    id: `gtfs-${index}-${legs[0].departSec}`,
    legs: routeLegs,
    departureTime: cornwallSecondsToIso(date, legs[0].departSec),
    arrivalTime: cornwallSecondsToIso(date, legs[legs.length - 1].arriveSec),
    durationMinutes: Math.round(
      (legs[legs.length - 1].arriveSec - legs[0].departSec) / 60,
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
  time: string;
  date: string;
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
  const { mode, time: timeStr, date } = params;
  const { seconds: constraintSec } = parseCornwallTime(timeStr, date);
  const toSet = new Set(toStopIds);
  const activeServices = getActiveServices(data, date);

  if (activeServices.size === 0 || fromStopIds.length === 0) return [];

  const allPaths = findPaths(
    data,
    activeServices,
    fromStopIds,
    toSet,
    date,
    mode,
    constraintSec,
  );

  const seen = new Set<string>();
  const routes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[] = [];

  allPaths.sort((a, b) => {
    if (mode === "arrive-by") {
      const arrDiff = b[b.length - 1].arriveSec - a[a.length - 1].arriveSec;
      if (arrDiff !== 0) return arrDiff;
    } else {
      const depDiff = a[0].departSec - b[0].departSec;
      if (depDiff !== 0) return depDiff;
    }
    if (a.length !== b.length) return a.length - b.length;
    const aDur = a[a.length - 1].arriveSec - a[0].departSec;
    const bDur = b[b.length - 1].arriveSec - b[0].departSec;
    return aDur - bDur;
  });

  for (let i = 0; i < allPaths.length && routes.length < 8; i++) {
    const key = `${allPaths[i][allPaths[i].length - 1].arriveSec}|${allPaths[i].map((l) => l.route).join("+")}|${allPaths[i].length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const route = pathToRoute(allPaths[i], date, i);
    if (route) routes.push(route);
  }

  return routes;
}
