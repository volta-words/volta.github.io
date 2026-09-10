"use client";

import type { ScoredRoute } from "@/lib/types";
import { formatStopLabel } from "@/lib/stops";
import { formatCornwallTime } from "@/lib/cornwall-time";
import { StopMapPreview } from "@/components/StopMapPreview";
import { googleMapsUrl } from "@/lib/map-links";

interface RouteCardProps {
  route: ScoredRoute;
  rank: number;
  expanded?: boolean;
  onToggle?: () => void;
}

function formatTime(iso: string): string {
  return formatCornwallTime(iso);
}

function TimetableLinks({ route }: { route: ScoredRoute }) {
  const links = route.legs
    .filter((l) => l.mode === "BUS" && l.routeShortName && l.timetableUrl)
    .reduce<{ route: string; url: string }[]>((acc, leg) => {
      if (!acc.some((x) => x.route === leg.routeShortName)) {
        acc.push({ route: leg.routeShortName!, url: leg.timetableUrl! });
      }
      return acc;
    }, []);

  if (links.length === 0) return null;

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-slate-500">Go Cornwall timetables:</span>
      {links.map(({ route: r, url }) => (
        <a
          key={r}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-700 underline hover:text-teal-900"
        >
          {r} ↗
        </a>
      ))}
    </div>
  );
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
              {route.transferStops.length > 0 && (
                <>
                  {" at "}
                  {route.transferStops.map((s) => s.name).join(", ")}
                </>
              )}
            </p>
            {route.transferStops.length > 0 && !expanded && (
              <p className="mt-1 text-xs text-teal-700">
                Tap to see where to change on the map
              </p>
            )}
            <TimetableLinks route={route} />
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
          <ol className="space-y-4">
            {route.legs.map((leg, i) => (
              <li key={i}>
                {leg.isTransfer && leg.mode === "BUS" && (
                  <div className="mb-3">
                    <StopMapPreview
                      stop={leg.fromStop}
                      context={
                        route.transferStops.length > 1
                          ? `Change ${route.transferStops.findIndex((s) => s.id === leg.fromStop.id) + 1} of ${route.transferStops.length}`
                          : "Change here"
                      }
                    />
                  </div>
                )}

                <div className="flex gap-3 text-sm">
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
                        {leg.timetableUrl && (
                          <a
                            href={leg.timetableUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs font-medium text-teal-800 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Timetable ↗
                          </a>
                        )}
                        {leg.routeLongName && (
                          <span className="ml-2 text-xs opacity-75">
                            {leg.routeLongName}
                          </span>
                        )}
                        <p className="mt-1 text-xs">
                          {formatStopLabel(leg.fromStop)} →{" "}
                          {formatStopLabel(leg.toStop)}
                        </p>
                        {!leg.isTransfer && i === 0 && (
                          <a
                            href={googleMapsUrl(
                              leg.fromStop.lat,
                              leg.fromStop.lng,
                              formatStopLabel(leg.fromStop),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs font-medium text-teal-700 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            See boarding stop on map ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <span>Walk to {formatStopLabel(leg.toStop)}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Timetables from{" "}
            <a
              href="https://www.transportforcornwall.co.uk/services"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-700 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Transport for Cornwall ↗
            </a>
            {" "}(Go Cornwall Bus network)
          </p>
        </div>
      )}
    </article>
  );
}
