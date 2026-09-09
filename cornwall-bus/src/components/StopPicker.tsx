"use client";

import { useCallback, useEffect, useState } from "react";
import type { BusStop } from "@/lib/types";
import { formatStopLabel } from "@/lib/stops";

interface StopPickerProps {
  label: string;
  value?: BusStop | null;
  onChange: (stop: BusStop) => void;
  placeholder?: string;
}

export function StopPicker({
  label,
  value,
  onChange,
  placeholder = "Search stops…",
}: StopPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusStop[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/stops?q=${encodeURIComponent(q)}&limit=12`);
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

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-600">
        {label}
      </label>
      {value && !open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm"
        >
          <span className="font-medium text-slate-900">{value.name}</span>
          {value.locality && (
            <span className="mt-0.5 block text-xs text-slate-500">
              {value.locality}
            </span>
          )}
        </button>
      ) : (
        <>
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
          {open && (query.length >= 2 || results.length > 0) && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {loading && (
                <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>
              )}
              {!loading && results.length === 0 && query.length >= 2 && (
                <li className="px-4 py-3 text-sm text-slate-400">No stops found</li>
              )}
              {results.map((stop) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-teal-50"
                    onClick={() => {
                      onChange(stop);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-medium">{formatStopLabel(stop)}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {stop.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
