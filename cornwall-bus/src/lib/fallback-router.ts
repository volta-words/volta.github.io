/**
 * Built-in router used when OpenTripPlanner is unavailable.
 * Uses a simplified timetable graph for common Cornwall college routes.
 */
import { addMinutes, format, parse, setHours, setMinutes } from "date-fns";
import type { RouteLeg, ScoredRoute } from "./types";
import { getStopById } from "./stops";

interface TimetableConnection {
  fromId: string;
  toId: string;
  route: string;
  routeName: string;
  departOffset: number; // minutes from service start
  duration: number;
  /** Minutes past the hour when services run */
  headway: number;
  startHour: number;
  endHour: number;
}

/** Representative Cornwall U91/U1 corridor: Falmouth ↔ Penryn ↔ campus */
const CONNECTIONS: TimetableConnection[] = [
  {
    fromId: "0800COC30686",
    toId: "0800COZ06428",
    route: "U1",
    routeName: "U1 Falmouth - Penryn Campus",
    departOffset: 0,
    duration: 12,
    headway: 20,
    startHour: 7,
    endHour: 22,
  },
  {
    fromId: "0800COZ06428",
    toId: "0800COC30686",
    route: "U1",
    routeName: "U1 Penryn Campus - Falmouth",
    departOffset: 0,
    duration: 12,
    headway: 20,
    startHour: 7,
    endHour: 22,
  },
  {
    fromId: "0800FWX38703",
    toId: "0800COC30643",
    route: "U2",
    routeName: "U2 Penryn - Falmouth",
    departOffset: 5,
    duration: 8,
    headway: 15,
    startHour: 7,
    endHour: 21,
  },
  {
    fromId: "0800COC30643",
    toId: "0800FWX38714",
    route: "U2",
    routeName: "U2 Falmouth - Penryn",
    departOffset: 5,
    duration: 8,
    headway: 15,
    startHour: 7,
    endHour: 21,
  },
  // Via Sainsbury's (busy road) — sometimes suggested by other apps
  {
    fromId: "0800FWX38703",
    toId: "0800FWV38516",
    route: "34",
    routeName: "34 Penryn via Sainsbury's",
    departOffset: 3,
    duration: 8,
    headway: 30,
    startHour: 7,
    endHour: 20,
  },
  {
    fromId: "0800FWV38516",
    toId: "0800COZ06428",
    route: "34",
    routeName: "34 Sainsbury's - Campus",
    departOffset: 5,
    duration: 14,
    headway: 30,
    startHour: 7,
    endHour: 20,
  },
  {
    fromId: "0800COZ06428",
    toId: "0800FWV38516",
    route: "34",
    routeName: "34 Campus - Sainsbury's",
    departOffset: 5,
    duration: 14,
    headway: 30,
    startHour: 7,
    endHour: 20,
  },
  {
    fromId: "0800FWV38516",
    toId: "0800FWX38703",
    route: "34",
    routeName: "34 Sainsbury's - Penryn",
    departOffset: 3,
    duration: 8,
    headway: 30,
    startHour: 7,
    endHour: 20,
  },
  // Via Penryn station (simpler interchange)
  {
    fromId: "0800FWX38703",
    toId: "0800COD41054",
    route: "18",
    routeName: "18 Penryn - Station",
    departOffset: 0,
    duration: 5,
    headway: 20,
    startHour: 7,
    endHour: 21,
  },
  {
    fromId: "0800COD41054",
    toId: "0800COZ06428",
    route: "U4",
    routeName: "U4 Station - Campus",
    departOffset: 8,
    duration: 8,
    headway: 20,
    startHour: 7,
    endHour: 20,
  },
  {
    fromId: "0800COZ06428",
    toId: "0800COD41054",
    route: "U4",
    routeName: "U4 Campus - Station",
    departOffset: 8,
    duration: 8,
    headway: 20,
    startHour: 7,
    endHour: 20,
  },
  {
    fromId: "0800COD41054",
    toId: "0800FWX38703",
    route: "18",
    routeName: "18 Station - Penryn",
    departOffset: 0,
    duration: 5,
    headway: 20,
    startHour: 7,
    endHour: 21,
  },
];

interface GraphEdge {
  conn: TimetableConnection;
  depart: Date;
  arrive: Date;
}

function buildDepartures(
  conn: TimetableConnection,
  date: Date,
  after: Date,
  before?: Date,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let h = conn.startHour; h <= conn.endHour; h++) {
    for (let m = conn.departOffset; m < 60; m += conn.headway) {
      const depart = setMinutes(setHours(date, h), m);
      if (depart < after) continue;
      if (before && depart > before) continue;
      const arrive = addMinutes(depart, conn.duration);
      edges.push({ conn, depart, arrive });
    }
  }

  return edges;
}

function edgeToLeg(edge: GraphEdge, isTransfer: boolean): RouteLeg {
  const from = getStopById(edge.conn.fromId)!;
  const to = getStopById(edge.conn.toId)!;
  return {
    mode: "BUS",
    fromStop: from,
    toStop: to,
    routeShortName: edge.conn.route,
    routeLongName: edge.conn.routeName,
    departureTime: edge.depart.toISOString(),
    arrivalTime: edge.arrive.toISOString(),
    durationMinutes: edge.conn.duration,
    isTransfer,
  };
}

function pathToRoute(
  edges: GraphEdge[],
  index: number,
): Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags"> {
  const legs = edges.map((e, i) => edgeToLeg(e, i > 0));
  const transferStops = edges.slice(1).map((e) => getStopById(e.conn.fromId)!);

  return {
    id: `fallback-${index}-${edges[0].depart.getTime()}`,
    legs,
    departureTime: edges[0].depart.toISOString(),
    arrivalTime: edges[edges.length - 1].arrive.toISOString(),
    durationMinutes: Math.round(
      (edges[edges.length - 1].arrive.getTime() - edges[0].depart.getTime()) /
        60000,
    ),
    numTransfers: edges.length - 1,
    transferStops,
  };
}

function findPaths(
  fromId: string,
  toId: string,
  date: Date,
  constraint: { mode: "arrive-by" | "depart-after"; time: Date },
  maxTransfers = 2,
): GraphEdge[][] {
  const paths: GraphEdge[][] = [];
  const MIN_TRANSFER = 3 * 60 * 1000; // 3 min

  function dfs(
    currentId: string,
    path: GraphEdge[],
    earliestDepart: Date,
  ) {
    if (paths.length >= 50) return;
    if (path.length > maxTransfers + 1) return;

    if (currentId === toId && path.length > 0) {
      const arrival = path[path.length - 1].arrive;
      const departure = path[0].depart;

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

    for (const conn of CONNECTIONS.filter((c) => c.fromId === currentId)) {
      const departures = buildDepartures(conn, date, earliestDepart);

      for (const edge of departures) {
        if (path.length > 0) {
          const lastArrive = path[path.length - 1].arrive.getTime();
          if (edge.depart.getTime() - lastArrive < MIN_TRANSFER) continue;
        }

        if (constraint.mode === "depart-after" && path.length === 0) {
          if (edge.depart < constraint.time) continue;
        }

        path.push(edge);
        dfs(conn.toId, path, edge.arrive);
        path.pop();
      }
    }
  }

  const startAfter =
    constraint.mode === "depart-after"
      ? constraint.time
      : addMinutes(constraint.time, -180); // search up to 3h before arrive-by

  dfs(fromId, [], startAfter);
  return paths;
}

export function planWithFallback(params: {
  fromStopId: string;
  toStopId: string;
  mode: "arrive-by" | "depart-after";
  time: Date;
}): Omit<
  ScoredRoute,
  "score" | "scoreBreakdown" | "explanations" | "tags"
>[] {
  const { fromStopId, toStopId, mode, time } = params;

  if (!getStopById(fromStopId) || !getStopById(toStopId)) return [];

  const date = parse(format(time, "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
  const paths = findPaths(fromStopId, toStopId, date, { mode, time });

  // Dedupe by route sequence and sort: prefer fewer legs, then best time fit
  const seen = new Set<string>();
  const unique: GraphEdge[][] = [];
  for (const p of paths) {
    const key = p.map((e) => `${e.conn.route}@${e.depart.getTime()}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  unique.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    if (mode === "arrive-by") {
      return (
        b[b.length - 1].arrive.getTime() - a[a.length - 1].arrive.getTime()
      );
    }
    return a[0].depart.getTime() - b[0].depart.getTime();
  });

  return unique.slice(0, 8).map((p, i) => pathToRoute(p, i));
}

export function getFallbackConnections(): TimetableConnection[] {
  return CONNECTIONS;
}
