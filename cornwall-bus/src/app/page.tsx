"use client";

import { useCallback, useEffect, useState } from "react"; // useEffect for fetchRoutes on profile
import { format } from "date-fns";
import { RouteCard } from "@/components/RouteCard";
import { BottomNav } from "@/components/BottomNav";
import type { ScoredRoute, StopPreference, WeightPreferences } from "@/lib/types";
import {
  buildUserProfile,
  getLocalProfile,
  getLocalStopPreferences,
  getLocalWeights,
  getDefaultStopPreferences,
} from "@/lib/profile-store";
import { formatStopLabel } from "@/lib/stops";
import Link from "next/link";

export default function TodayPage() {
  const [arriveBy, setArriveBy] = useState(
    () => getLocalProfile()?.arriveBy ?? "09:00",
  );
  const [leaveAfter, setLeaveAfter] = useState(
    () => getLocalProfile()?.leaveAfter ?? "17:00",
  );
  const [outbound, setOutbound] = useState<ScoredRoute[]>([]);
  const [inbound, setInbound] = useState<ScoredRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [liveAge, setLiveAge] = useState<number | null>(null);
  const [profile] = useState(() => buildUserProfile());

  const fetchRoutes = useCallback(async () => {
    const p = buildUserProfile();
    if (!p) {
      setError("Please set up your home and college stops first.");
      return;
    }

    setLoading(true);
    setError(null);

    const weights: WeightPreferences = getLocalWeights();
    const stopPreferences: StopPreference[] =
      getLocalStopPreferences().length > 0
        ? getLocalStopPreferences()
        : getDefaultStopPreferences();

    const date = format(new Date(), "yyyy-MM-dd");

    try {
      const [outRes, inRes, liveRes] = await Promise.all([
        fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromStopIds: p.homeStopIds,
            toStopIds: p.collegeStopIds,
            mode: "arrive-by",
            time: arriveBy,
            date,
            weights,
            stopPreferences,
          }),
        }),
        fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromStopIds: p.collegeStopIds,
            toStopIds: p.homeStopIds,
            mode: "depart-after",
            time: leaveAfter,
            date,
            weights,
            stopPreferences,
          }),
        }),
        fetch("/api/live"),
      ]);

      const outData = await outRes.json();
      const inData = await inRes.json();
      const liveData = await liveRes.json();

      if (!outRes.ok) throw new Error(outData.error ?? "Failed to plan outbound");
      if (!inRes.ok) throw new Error(inData.error ?? "Failed to plan return");

      setOutbound(outData.routes ?? []);
      setInbound(inData.routes ?? []);
      setSource(outData.source ?? "fallback");
      setRouteHint(outData.hint ?? inData.hint ?? null);
      setLiveAge(liveData.cacheAgeMs ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [arriveBy, leaveAfter]);

  /* eslint-disable react-hooks/set-state-in-effect -- data fetch on mount */
  useEffect(() => {
    if (profile) void fetchRoutes();
  }, [profile, fetchRoutes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-teal-50 to-slate-50 pb-20">
        <header className="px-4 pt-8 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Cornwall Bus</h1>
          <p className="mt-1 text-sm text-slate-600">
            Smart routes for your college commute
          </p>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-slate-600">
            Set your home and college stops to get started.
          </p>
          <Link
            href="/setup"
            className="mt-6 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-lg hover:bg-teal-700"
          >
            Set up journey
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-teal-100/80 bg-teal-50/90 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-slate-900">Today&apos;s plan</h1>
        <p className="text-xs text-slate-600">
          {profile.displayName ??
            `${profile.homeStops!.length} home stop${profile.homeStops!.length > 1 ? "s" : ""} → ${profile.collegeStops!.length} college stop${profile.collegeStops!.length > 1 ? "s" : ""}`}
        </p>
        {liveAge !== null && (
          <p className="mt-1 text-xs text-teal-700">
            Live data updated {Math.round(liveAge / 1000)}s ago
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Your day</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-slate-500">Arrive by</span>
              <input
                type="time"
                value={arriveBy}
                onChange={(e) => setArriveBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Leave after</span>
              <input
                type="time"
                value={leaveAfter}
                onChange={(e) => setLeaveAfter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={fetchRoutes}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Finding routes…" : "Refresh routes"}
          </button>
          {source && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Routing via{" "}
              {source === "otp"
                ? "OpenTripPlanner"
                : source === "gtfs"
                  ? "Transport for Cornwall timetables"
                  : "built-in timetable"}
            </p>
          )}
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {routeHint && outbound.length === 0 && inbound.length === 0 && !loading && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {routeHint}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Outbound — to college
          </h2>
          {loading && outbound.length === 0 ? (
            <p className="text-sm text-slate-500">Loading routes…</p>
          ) : outbound.length === 0 ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">No outbound routes found.</p>
              <p className="mt-1 text-xs">
                Try adding more nearby stops in{" "}
                <Link href="/setup" className="underline">
                  Setup
                </Link>{" "}
                — e.g. all campus stands or both sides of the road.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {outbound.map((route, i) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  rank={i + 1}
                  expanded={expandedId === route.id}
                  onToggle={() =>
                    setExpandedId(expandedId === route.id ? null : route.id)
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Return — home
          </h2>
          {loading && inbound.length === 0 ? (
            <p className="text-sm text-slate-500">Loading routes…</p>
          ) : inbound.length === 0 ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">No return routes found.</p>
              <p className="mt-1 text-xs">
                Add more nearby college or home stops in Setup, or check the
                time is within service hours.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inbound.map((route, i) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  rank={i + 1}
                  expanded={expandedId === `in-${route.id}`}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === `in-${route.id}` ? null : `in-${route.id}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
