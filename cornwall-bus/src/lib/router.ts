import { planWithOtp, isOtpAvailable } from "./otp-client";
import { planWithFallback } from "./fallback-router";
import { rankRoutes } from "./scorer";
import type { JourneyRequest, ScoredRoute, StopPreference } from "./types";
import { getStopById } from "./stops";

function parseTime(timeStr: string, date?: string): Date {
  const baseDate = date ?? new Date().toISOString().slice(0, 10);

  if (timeStr.includes("T")) {
    return new Date(timeStr);
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date(`${baseDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  return d;
}

export async function planJourney(
  request: JourneyRequest,
  preferences: StopPreference[] = [],
): Promise<{ routes: ScoredRoute[]; source: "otp" | "fallback" }> {
  const from = getStopById(request.fromStopId);
  const to = getStopById(request.toStopId);

  if (!from || !to) {
    return { routes: [], source: "fallback" };
  }

  const time = parseTime(request.time, request.date);
  let rawRoutes: Omit<
    ScoredRoute,
    "score" | "scoreBreakdown" | "explanations" | "tags"
  >[] = [];

  const otpUp = await isOtpAvailable();
  if (otpUp) {
    rawRoutes = await planWithOtp({
      from,
      to,
      mode: request.mode,
      time,
    });
  }

  if (rawRoutes.length === 0) {
    rawRoutes = planWithFallback({
      fromStopId: request.fromStopId,
      toStopId: request.toStopId,
      mode: request.mode,
      time,
    });
  }

  const routes = rankRoutes(rawRoutes, preferences, request.weights);
  return { routes, source: otpUp && rawRoutes.length > 0 ? "otp" : "fallback" };
}
