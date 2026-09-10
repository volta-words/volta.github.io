import { planWithOtp, isOtpAvailable } from "./otp-client";
import { planWithFallback } from "./fallback-router";
import { planWithGtfs, isGtfsGraphAvailable } from "./gtfs-router";
import { rankRoutes } from "./scorer";
import type { JourneyRequest, ScoredRoute, StopPreference } from "./types";
import { getStopById } from "./stops";

function parseTime(timeStr: string, date?: string): Date {
  const baseDate = date ?? new Date().toISOString().slice(0, 10);

  if (timeStr.includes("T")) {
    return new Date(timeStr);
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(
    `${baseDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
  );
}

function resolveStopIds(primary: string[], fallback?: string): string[] {
  const ids = primary.length > 0 ? primary : fallback ? [fallback] : [];
  return [...new Set(ids.filter((id) => getStopById(id)))];
}

export async function planJourney(
  request: JourneyRequest,
  preferences: StopPreference[] = [],
): Promise<{ routes: ScoredRoute[]; source: "otp" | "gtfs" | "fallback" }> {
  const fromStopIds = resolveStopIds(
    request.fromStopIds ?? [],
    request.fromStopId,
  );
  const toStopIds = resolveStopIds(request.toStopIds ?? [], request.toStopId);

  if (fromStopIds.length === 0 || toStopIds.length === 0) {
    return { routes: [], source: "fallback" };
  }

  const time = parseTime(request.time, request.date);
  const date =
    request.date ?? time.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  let rawRoutes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[] = [];
  let source: "otp" | "gtfs" | "fallback" = "fallback";

  // Prefer Cornwall GTFS timetables — faster and more accurate than OTP for this region
  if (isGtfsGraphAvailable()) {
    rawRoutes = planWithGtfs({
      fromStopIds,
      toStopIds,
      mode: request.mode,
      time: request.time,
      date,
    });
    if (rawRoutes.length > 0) source = "gtfs";
  }

  if (rawRoutes.length === 0) {
    const otpUp = await isOtpAvailable();
    if (otpUp) {
      for (const fromId of fromStopIds) {
        for (const toId of toStopIds) {
          const from = getStopById(fromId);
          const to = getStopById(toId);
          if (!from || !to) continue;
          const routes = await planWithOtp({ from, to, mode: request.mode, time });
          rawRoutes.push(...routes);
        }
      }
      if (rawRoutes.length > 0) source = "otp";
    }
  }

  if (rawRoutes.length === 0) {
    for (const fromId of fromStopIds) {
      for (const toId of toStopIds) {
        rawRoutes.push(
          ...planWithFallback({
            fromStopId: fromId,
            toStopId: toId,
            mode: request.mode,
            time,
          }),
        );
      }
    }
    source = "fallback";
  }

  const routes = rankRoutes(rawRoutes, preferences, request.weights, request.mode);
  return { routes, source };
}
