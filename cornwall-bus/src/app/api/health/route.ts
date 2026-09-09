import { NextResponse } from "next/server";
import { isGtfsGraphAvailable } from "@/lib/gtfs-router";
import { existsSync } from "fs";
import { join } from "path";

export async function GET() {
  const graphPath = join(process.cwd(), "data", "gtfs", "graph.json");
  const graphExists = existsSync(graphPath);

  return NextResponse.json({
    gtfsLoaded: isGtfsGraphAvailable(),
    graphFileExists: graphExists,
    hint: !graphExists
      ? "Run: npm run prepare-data"
      : !isGtfsGraphAvailable()
        ? "Graph file exists but failed to load"
        : "OK",
  });
}
