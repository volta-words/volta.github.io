import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { addSeconds, format, parse } from "date-fns";
import type { RouteLeg, ScoredRoute } from "./types";
import { getStopById } from "./stops";

interface RawConnection {
  to: string;
  dep: number;
  arr: number;
  route: string;
  routeName: string;
  serviceId: string;
}

interface GtfsGraphData {
  calendars: Record<string, { days: number[]; start: string; end: string }>;
  calendarDates: Record<string, Record<string, number>>;
  graph: Record<string, RawConnection[]>;
}

interface TimedEdge {
  conn: RawConnection;
  depart: Date;
  arrive: Date;
}

type PathEdge = { fromId: string; edge: TimedEdge };

let graphCache: GtfsGraphData | null = null;

function loadGraph(): GtfsGraphData | null {
  if (graphCache) return graphCache;

  const paths = [
    join(process.cwd(), "data", "gtfs", "graph.json"),
    join(process.cwd(), "cornwall-bus", "data", "gtfs", "graph.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      graphCache = JSON.parse(readFileSync(p, "utf8")) as GtfsGraphData;
      return graphCache;
    }
  }
  return null;
}

function dateToGtfs(d: Date): string {
  return format(d, "yyyyMMdd");
}

function getActiveServices(data: GtfsGraphData, date: Date): Set<string> {
  const active = new Set<string>();
  const dateStr = dateToGtfs(date);
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

function buildLeg(fromId: string, edge: TimedEdge, isTransfer: boolean): RouteLeg | null {
  const from = getStopById(fromId);
  const to = getStopById(edge.conn.to);
  if (!from || !to) return null;

  return {
    mode: "BUS",
    fromStop: from,
    toStop: to,
    routeShortName: edge.conn.route,
    routeLongName: edge.conn.routeName,
    departureTime: edge.depart.toISOString(),
    arrivalTime: edge.arrive.toISOString(),
    durationMinutes: Math.round(
      (edge.arrive.getTime() - edge.depart.getTime()) / 60000,
    ),
    isTransfer,
  };
}

function pathToRoute(
  edges: PathEdge[],
  index: number,
): Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags"> | null {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < edges.length; i++) {
    const leg = buildLeg(edges[i].fromId, edges[i].edge, i > 0);
    if (!leg) return null;
    legs.push(leg);
  }

  const transferStops = edges
    .slice(1)
    .map((e) => getStopById(e.fromId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return {
    id: `gtfs-${index}-${edges[0].edge.depart.getTime()}`,
    legs,
    departureTime: edges[0].edge.depart.toISOString(),
    arrivalTime: edges[edges.length - 1].edge.arrive.toISOString(),
    durationMinutes: Math.round(
      (edges[edges.length - 1].edge.arrive.getTime() -
        edges[0].edge.depart.getTime()) /
        60000,
    ),
    numTransfers: edges.length - 1,
    transferStops,
  };
}

function findPaths(
  data: GtfsGraphData,
  activeServices: Set<string>,
  fromId: string,
  toIds: Set<string>,
  baseDate: Date,
  constraint: { mode: "arrive-by" | "depart-after"; time: Date },
  maxTransfers = 3,
): PathEdge[][] {
  const paths: PathEdge[][] = [];
  const MIN_TRANSFER_MS = 2 * 60 * 1000;

  const windowStart =
    constraint.mode === "depart-after"
      ? constraint.time.getTime()
      : constraint.time.getTime() - 4 * 3600 * 1000;
  const windowEnd =
    constraint.mode === "arrive-by"
      ? constraint.time.getTime()
      : constraint.time.getTime() + 3 * 3600 * 1000;

  function getDepartures(fromStopId: string, after: Date): TimedEdge[] {
    const conns = data.graph[fromStopId];
    if (!conns) return [];

    const afterMs = Math.max(after.getTime(), windowStart);
    const edges: TimedEdge[] = [];

    for (const conn of conns) {
      if (!activeServices.has(conn.serviceId)) continue;
      const depart = secondsToDate(baseDate, conn.dep);
      const arrive = secondsToDate(baseDate, conn.arr);
      const depMs = depart.getTime();
      const arrMs = arrive.getTime();

      if (depMs < afterMs) continue;
      if (constraint.mode === "arrive-by" && arrMs > windowEnd) continue;
      if (constraint.mode === "depart-after" && depMs > windowEnd) continue;

      edges.push({ conn, depart, arrive });
    }

    edges.sort((a, b) => a.depart.getTime() - b.depart.getTime());
    return edges.slice(0, 40);
  }

  function dfs(currentId: string, path: PathEdge[], earliestDepart: Date) {
    if (paths.length >= 30) return;
    if (path.length > maxTransfers + 1) return;

    if (toIds.has(currentId) && path.length > 0) {
      const arrival = path[path.length - 1].edge.arrive;
      const departure = path[0].edge.depart;

      if (constraint.mode === "arrive-by" && arrival <= constraint.time) {
        paths.push([...path]);
      } else if (
        constraint.mode === "depart-after" &&
        departure >= constraint.time
      ) {
        paths.push([...path]);
      }
      return;
    }

    for (const edge of getDepartures(currentId, earliestDepart)) {
      if (path.length > 0) {
        const lastArrive = path[path.length - 1].edge.arrive.getTime();
        if (edge.depart.getTime() - lastArrive < MIN_TRANSFER_MS) continue;
      }

      if (constraint.mode === "depart-after" && path.length === 0) {
        if (edge.depart < constraint.time) continue;
      }

      path.push({ fromId: currentId, edge });
      dfs(edge.conn.to, path, edge.arrive);
      path.pop();
    }
  }

  const startAfter = new Date(
    constraint.mode === "depart-after"
      ? constraint.time.getTime()
      : windowStart,
  );

  dfs(fromId, [], startAfter);
  return paths;
}

export function isGtfsGraphAvailable(): boolean {
  return loadGraph() !== null;
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
  if (!data) return [];

  const { fromStopIds, toStopIds, mode, time } = params;
  const toSet = new Set(toStopIds);
  const baseDate = parse(format(time, "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
  const activeServices = getActiveServices(data, baseDate);

  const allPaths: PathEdge[][] = [];

  for (const fromId of fromStopIds) {
    if (!data.graph[fromId]) continue;
    const paths = findPaths(
      data,
      activeServices,
      fromId,
      toSet,
      baseDate,
      { mode, time },
    );
    allPaths.push(...paths);
  }

  const seen = new Set<string>();
  const routes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[] = [];

  allPaths.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    if (mode === "arrive-by") {
      return (
        b[b.length - 1].edge.arrive.getTime() -
        a[a.length - 1].edge.arrive.getTime()
      );
    }
    return a[0].edge.depart.getTime() - b[0].edge.depart.getTime();
  });

  for (let i = 0; i < allPaths.length && routes.length < 8; i++) {
    const key = allPaths[i]
      .map((e) => `${e.edge.conn.route}@${e.edge.depart.getTime()}`)
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const route = pathToRoute(allPaths[i], i);
    if (route) routes.push(route);
  }

  return routes;
}
