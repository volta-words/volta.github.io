import type { BusStop, RouteLeg, ScoredRoute } from "./types";
import { getStopById } from "./stops";

const OTP_URL = process.env.OTP_URL ?? "http://localhost:8080";

interface OtpItinerary {
  duration: number;
  startTime: number;
  endTime: number;
  transfers: number;
  legs: OtpLeg[];
}

interface OtpLeg {
  mode: string;
  startTime: number;
  endTime: number;
  duration: number;
  from: { name: string; lat: number; lon: number; stop?: { id?: string } };
  to: { name: string; lat: number; lon: number; stop?: { id?: string } };
  routeShortName?: string;
  routeLongName?: string;
}

interface OtpPlanResponse {
  plan?: {
    itineraries?: OtpItinerary[];
  };
  error?: { msg: string };
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function resolveStop(
  name: string,
  lat: number,
  lon: number,
  stopId?: string,
): BusStop {
  if (stopId) {
    const found = getStopById(stopId);
    if (found) return found;
  }
  return {
    id: stopId ?? `coord:${lat.toFixed(5)},${lon.toFixed(5)}`,
    name,
    lat,
    lng: lon,
  };
}

function itineraryToRoute(itinerary: OtpItinerary, index: number): Omit<
  ScoredRoute,
  "score" | "scoreBreakdown" | "explanations" | "tags"
> {
  const legs: RouteLeg[] = [];
  const transferStops: BusStop[] = [];

  for (let i = 0; i < itinerary.legs.length; i++) {
    const leg = itinerary.legs[i];
    const fromStop = resolveStop(
      leg.from.name,
      leg.from.lat,
      leg.from.lon,
      leg.from.stop?.id,
    );
    const toStop = resolveStop(
      leg.to.name,
      leg.to.lat,
      leg.to.lon,
      leg.to.stop?.id,
    );

    const isBus = leg.mode === "BUS" || leg.mode === "TRANSIT";

    if (isBus && i > 0) {
      const prevLeg = itinerary.legs[i - 1];
      if (prevLeg.mode === "WALK" || prevLeg.mode === "BUS") {
        transferStops.push(fromStop);
      }
    }

    legs.push({
      mode: isBus ? "BUS" : "WALK",
      fromStop,
      toStop,
      routeShortName: leg.routeShortName,
      routeLongName: leg.routeLongName,
      departureTime: msToIso(leg.startTime),
      arrivalTime: msToIso(leg.endTime),
      durationMinutes: Math.round(leg.duration / 60),
      isTransfer: transferStops.some((s) => s.id === fromStop.id),
    });
  }

  return {
    id: `otp-${index}-${itinerary.startTime}`,
    legs,
    departureTime: msToIso(itinerary.startTime),
    arrivalTime: msToIso(itinerary.endTime),
    durationMinutes: Math.round(itinerary.duration / 60),
    numTransfers: itinerary.transfers,
    transferStops,
  };
}

export async function planWithOtp(params: {
  from: BusStop;
  to: BusStop;
  mode: "arrive-by" | "depart-after";
  time: Date;
}): Promise<
  Omit<ScoredRoute, "score" | "scoreBreakdown" | "explanations" | "tags">[]
> {
  const { from, to, mode, time } = params;

  const query = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    mode: "TRANSIT,WALK",
    numItineraries: "5",
    maxWalkDistance: "1500",
  });

  if (mode === "arrive-by") {
    query.set("arriveBy", time.toISOString());
  } else {
    query.set("time", time.toISOString());
  }

  const url = `${OTP_URL}/otp/routers/default/plan?${query}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const data: OtpPlanResponse = await res.json();
    if (data.error || !data.plan?.itineraries) return [];

    return data.plan.itineraries.map((it, i) => itineraryToRoute(it, i));
  } catch {
    return [];
  }
}

export async function isOtpAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OTP_URL}/otp/routers/default`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
