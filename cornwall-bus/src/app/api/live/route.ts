import { NextRequest, NextResponse } from "next/server";
import {
  getLiveDepartures,
  getRealtimeActivities,
  getCacheAge,
} from "@/lib/realtime";

export async function GET(request: NextRequest) {
  const stopId = request.nextUrl.searchParams.get("stopId");

  try {
    const activities = await getRealtimeActivities();
    const cacheAgeMs = getCacheAge();

    if (stopId) {
      const departures = await getLiveDepartures(stopId);
      return NextResponse.json({
        stopId,
        departures,
        cacheAgeMs,
        vehicleCount: activities.length,
      });
    }

    return NextResponse.json({
      activities: activities.slice(0, 50),
      cacheAgeMs,
      vehicleCount: activities.length,
      dataFreshness: cacheAgeMs
        ? new Date(Date.now() - cacheAgeMs).toISOString()
        : null,
    });
  } catch (err) {
    console.error("Live data error:", err);
    return NextResponse.json(
      { error: "Failed to fetch live data" },
      { status: 500 },
    );
  }
}
