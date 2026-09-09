import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { planJourney } from "@/lib/router";
import {
  enrichRouteWithRealtime,
  getRealtimeActivities,
} from "@/lib/realtime";
import type { StopPreference, WeightPreferences } from "@/lib/types";

const requestSchema = z.object({
  fromStopId: z.string().optional(),
  toStopId: z.string().optional(),
  fromStopIds: z.array(z.string()).optional(),
  toStopIds: z.array(z.string()).optional(),
  mode: z.enum(["arrive-by", "depart-after"]),
  time: z.string(),
  date: z.string().optional(),
  weights: z
    .object({
      speed: z.number(),
      changes: z.number(),
      stops: z.number(),
    })
    .optional(),
  stopPreferences: z
    .array(
      z.object({
        stopId: z.string(),
        rating: z.enum(["prefer", "neutral", "avoid"]),
        note: z.string().optional(),
      }),
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const preferences: StopPreference[] = data.stopPreferences ?? [];
    const weights: WeightPreferences | undefined = data.weights;

    const hasStops =
      (data.fromStopIds?.length ?? 0) > 0 ||
      (data.toStopIds?.length ?? 0) > 0 ||
      (data.fromStopId && data.toStopId);

    if (!hasStops) {
      return NextResponse.json(
        { error: "At least one origin and destination stop required" },
        { status: 400 },
      );
    }

    const { routes, source } = await planJourney(
      {
        fromStopId: data.fromStopId,
        toStopId: data.toStopId,
        fromStopIds: data.fromStopIds,
        toStopIds: data.toStopIds,
        mode: data.mode,
        time: data.time,
        date: data.date,
        weights,
        stopPreferences: preferences,
      },
      preferences,
    );

    const activities = await getRealtimeActivities();
    const enriched = routes.map((r) =>
      enrichRouteWithRealtime(r, activities),
    );

    return NextResponse.json({
      routes: enriched,
      source,
      count: enriched.length,
    });
  } catch (err) {
    console.error("Route planning error:", err);
    return NextResponse.json(
      { error: "Failed to plan route" },
      { status: 500 },
    );
  }
}
