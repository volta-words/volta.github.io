"use client";

import { useEffect, useState } from "react";
import type { BusStop } from "@/lib/types";
import {
  googleMapsUrl,
  googleStreetViewUrl,
  openStreetMapEmbedUrl,
  openStreetMapUrl,
  stopMapLabel,
} from "@/lib/map-links";

interface StopMapPreviewProps {
  stop: BusStop;
  /** e.g. "Change here" */
  context?: string;
  compact?: boolean;
}

interface StreetViewInfo {
  available: boolean;
  imageUrl: string | null;
  streetViewUrl: string;
  mapsUrl: string;
}

export function StopMapPreview({
  stop,
  context = "Change here",
  compact = false,
}: StopMapPreviewProps) {
  const [streetView, setStreetView] = useState<StreetViewInfo | null>(null);
  const [imageError, setImageError] = useState(false);

  const label = stopMapLabel(stop);
  const mapEmbed = openStreetMapEmbedUrl(stop.lat, stop.lng);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/streetview?lat=${stop.lat}&lng=${stop.lng}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as StreetViewInfo;
        if (!cancelled) setStreetView(data);
      } catch {
        /* fallback links only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stop.lat, stop.lng]);

  const streetViewLink =
    streetView?.streetViewUrl ?? googleStreetViewUrl(stop.lat, stop.lng);
  const mapsLink = streetView?.mapsUrl ?? googleMapsUrl(stop.lat, stop.lng, label);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          {context}
        </p>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>

      <div className="relative bg-slate-200">
        <iframe
          title={`Map of ${stop.name}`}
          src={mapEmbed}
          className={`w-full border-0 ${compact ? "h-28" : "h-40"}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-white"
          aria-label={`See ${label} on map`}
        >
          See on map ↗
        </a>
      </div>

      {streetView?.imageUrl && !imageError ? (
        <a
          href={streetViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block border-t border-slate-200"
          aria-label={`Street View of ${label}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={streetView.imageUrl}
            alt={`Street View near ${stop.name}`}
            className="h-auto w-full bg-slate-200"
            loading="lazy"
            onError={() => setImageError(true)}
          />
          <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white">
            Street View ↗
          </span>
        </a>
      ) : (
        <div className="border-t border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 px-3 py-4">
          <p className="text-xs text-slate-600">
            Preview the stop before you travel — check where the bus stand is
            and which direction to walk for your connection.
          </p>
          <a
            href={streetViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <span aria-hidden>🚶</span>
            Open Street View ↗
          </a>
        </div>
      )}

      <div className="flex gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Google Maps
        </a>
        <a
          href={openStreetMapUrl(stop.lat, stop.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          OpenStreetMap
        </a>
        <a
          href={streetViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-teal-200 bg-teal-50 py-2 text-center text-xs font-semibold text-teal-800 hover:bg-teal-100"
        >
          Street View
        </a>
      </div>
    </div>
  );
}
