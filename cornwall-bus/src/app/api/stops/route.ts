import { NextRequest, NextResponse } from "next/server";
import {
  searchStops,
  searchStopsExpanded,
  getStopById,
  getRelatedStops,
} from "@/lib/stops";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const id = request.nextUrl.searchParams.get("id");
  const relatedId = request.nextUrl.searchParams.get("related");
  const expanded = request.nextUrl.searchParams.get("expanded") === "1";

  if (relatedId) {
    const stop = getStopById(relatedId);
    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }
    return NextResponse.json({ related: getRelatedStops(stop) });
  }

  if (id) {
    const stop = getStopById(id);
    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }
    return NextResponse.json({ stop });
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ stops: [] });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const stops = expanded
    ? searchStopsExpanded(q, limit)
    : searchStops(q, limit);
  return NextResponse.json({ stops });
}
