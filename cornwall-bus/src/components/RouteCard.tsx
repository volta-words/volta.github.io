"use client";

import type { ScoredRoute } from "@/lib/types";
import { formatStopLabel } from "@/lib/stops";
import { formatCornwallTime } from "@/lib/cornwall-time";

interface RouteCardProps {
  route: ScoredRoute;
  rank: number;
  expanded?: boolean;
  onToggle?: () => void;
}

function formatTime(iso: string): string {
  return formatCornwallTime(iso);
}

export function RouteCard({ route, rank, expanded, onToggle }: RouteCardProps) {
  return (
    <article
      className={`rounded-2xl border bg-white shadow-sm transition-shadow ${
        rank === 1
          ? "border-teal-300 ring-2 ring-teal-500/20"
          : "border-slate-200"
      } ${route.atRisk ? "border-amber-300" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {rank === 1 && (
                <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                  Best match
                </span>
              )}
              {route.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
              {route.atRisk && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Connection at risk
                </span>
              )}
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {formatTime(route.departureTime)} → {formatTime(route.arrivalTime)}
              <span className="ml-2 text-sm font-normal text-slate-500">
                {route.durationMinutes} min
              </span>
            </p>
            <p className="text-sm text-slate-600">
              {route.numTransfers === 0
                ? "Direct"
                : `${route.numTransfers} change${route.numTransfers > 1 ? "s" : ""}`}
              {route.transferStops.length > 0 &&
                ` at ${route.transferStops.map((s) => s.name).join(", ")}`}
            </p>
          </div>
          {route.delayMinutes !== undefined && route.delayMinutes !== 0 && (
            <span
              className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
                route.delayMinutes > 5
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {route.delayMinutes > 0 ? `+${route.delayMinutes}` : route.delayMinutes}{" "}
              min
            </span>
          )}
        </div>

        {route.explanations.length > 0 && (
          <ul className="mt-3 space-y-1">
            {route.explanations.slice(0, expanded ? undefined : 2).map((ex) => (
              <li key={ex} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 text-teal-600">•</span>
                {ex}
              </li>
            ))}
          </ul>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          <ol className="space-y-3">
            {route.legs.map((leg, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="flex w-14 shrink-0 flex-col text-xs text-slate-500">
                  <span>{formatTime(leg.departureTime)}</span>
                  <span>{leg.durationMinutes}m</span>
                </div>
                <div
                  className={`flex-1 rounded-lg px-3 py-2 ${
                    leg.mode === "WALK"
                      ? "bg-slate-50 text-slate-600"
                      : "bg-teal-50 text-teal-900"
                  }`}
                >
                  {leg.mode === "BUS" ? (
                    <>
                      <span className="font-semibold">{leg.routeShortName}</span>
                      {leg.routeLongName && (
                        <span className="ml-2 text-xs opacity-75">
                          {leg.routeLongName}
                        </span>
                      )}
                      <p className="mt-1 text-xs">
                        {formatStopLabel(leg.fromStop)} →{" "}
                        {formatStopLabel(leg.toStop)}
                      </p>
                    </>
                  ) : (
                    <span>
                      Walk to {formatStopLabel(leg.toStop)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
