"use client";

import { useCallback, useEffect, useState } from "react";
import type { BusStop } from "@/lib/types";
import { formatStopLabel } from "@/lib/stops";

interface MultiStopPickerProps {
  label: string;
  selected: BusStop[];
  onChange: (stops: BusStop[]) => void;
  placeholder?: string;
}

export function MultiStopPicker({
  label,
  selected,
  onChange,
  placeholder = "Search stops…",
}: MultiStopPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusStop[]>([]);
  const [related, setRelated] = useState<BusStop[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedIds = new Set(selected.map((s) => s.id));

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stops?q=${encodeURIComponent(q)}&limit=15&expanded=1`,
      );
      const data = await res.json();
      setResults(data.stops ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  async function fetchRelated(stop: BusStop) {
    const res = await fetch(`/api/stops?related=${stop.id}`);
    const data = await res.json();
    setRelated(data.related ?? []);
  }

  function toggleStop(stop: BusStop) {
    if (selectedIds.has(stop.id)) {
      onChange(selected.filter((s) => s.id !== stop.id));
    } else {
      onChange([...selected, stop]);
      void fetchRelated(stop);
    }
    setOpen(false);
    setQuery("");
  }

  function addRelated(stop: BusStop) {
    if (!selectedIds.has(stop.id)) {
      onChange([...selected, stop]);
    }
  }

  function addAllRelated() {
    const toAdd = related.filter((s) => !selectedIds.has(s.id));
    if (toAdd.length > 0) onChange([...selected, ...toAdd]);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">
        {label}
        {selected.length > 0 && (
          <span className="ml-2 font-normal text-slate-400">
            ({selected.length} stop{selected.length > 1 ? "s" : ""})
          </span>
        )}
      </label>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((stop) => (
            <span
              key={stop.id}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-900"
            >
              {formatStopLabel(stop)}
              <button
                type="button"
                onClick={() => toggleStop(stop)}
                className="ml-0.5 text-teal-600 hover:text-red-600"
                aria-label={`Remove ${stop.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        {open && query.length >= 2 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {loading && (
              <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">No stops found</li>
            )}
            {results.map((stop) => (
              <li key={stop.id}>
                <button
                  type="button"
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-teal-50 ${
                    selectedIds.has(stop.id) ? "bg-teal-50 font-medium" : ""
                  }`}
                  onClick={() => toggleStop(stop)}
                >
                  <span>{formatStopLabel(stop)}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {stop.id}
                    {selectedIds.has(stop.id) ? " · selected" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {related.length > 1 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">
            Nearby stops at the same location — add all for better routes
          </p>
          <ul className="mt-2 space-y-1">
            {related
              .filter((s) => !selectedIds.has(s.id))
              .slice(0, 6)
              .map((stop) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    onClick={() => addRelated(stop)}
                    className="text-xs text-amber-800 underline hover:text-amber-950"
                  >
                    + {formatStopLabel(stop)}
                  </button>
                </li>
              ))}
          </ul>
          {related.filter((s) => !selectedIds.has(s.id)).length > 1 && (
            <button
              type="button"
              onClick={addAllRelated}
              className="mt-2 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300"
            >
              Add all {related.filter((s) => !selectedIds.has(s.id)).length}{" "}
              nearby stops
            </button>
          )}
        </div>
      )}

      <p className="mt-1.5 text-xs text-slate-500">
        Select every stop you could use — e.g. all campus stands or both sides of
        the road.
      </p>
    </div>
  );
}
