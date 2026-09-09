"use client";

import { useEffect, useState } from "react";
import type { BusStop, StopPreference, StopRating } from "@/lib/types";
import { StopPicker } from "./StopPicker";
import { formatStopLabel } from "@/lib/stops";

interface StopPreferenceEditorProps {
  preferences: StopPreference[];
  onChange: (prefs: StopPreference[]) => void;
}

const RATING_OPTIONS: { value: StopRating; label: string; color: string }[] = [
  { value: "prefer", label: "Prefer", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "neutral", label: "Neutral", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "avoid", label: "Avoid", color: "bg-red-100 text-red-800 border-red-300" },
];

export function StopPreferenceEditor({
  preferences,
  onChange,
}: StopPreferenceEditorProps) {
  const [adding, setAdding] = useState(false);

  function addPreference(stop: BusStop) {
    if (preferences.some((p) => p.stopId === stop.id)) return;
    onChange([
      ...preferences,
      { stopId: stop.id, rating: "neutral", note: "" },
    ]);
    setAdding(false);
  }

  function updateRating(stopId: string, rating: StopRating) {
    onChange(
      preferences.map((p) => (p.stopId === stopId ? { ...p, rating } : p)),
    );
  }

  function updateNote(stopId: string, note: string) {
    onChange(
      preferences.map((p) => (p.stopId === stopId ? { ...p, note } : p)),
    );
  }

  function remove(stopId: string) {
    onChange(preferences.filter((p) => p.stopId !== stopId));
  }

  return (
    <div className="space-y-4">
      {preferences.map((pref) => (
        <PreferenceRow
          key={pref.stopId}
          pref={pref}
          onRatingChange={updateRating}
          onNoteChange={updateNote}
          onRemove={remove}
        />
      ))}

      {adding ? (
        <StopPicker
          label="Add stop preference"
          onChange={addPreference}
          placeholder="Search e.g. Sainsbury's, Station…"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700"
        >
          + Add stop preference
        </button>
      )}
    </div>
  );
}

function PreferenceRow({
  pref,
  onRatingChange,
  onNoteChange,
  onRemove,
}: {
  pref: StopPreference;
  onRatingChange: (id: string, r: StopRating) => void;
  onNoteChange: (id: string, n: string) => void;
  onRemove: (id: string) => void;
}) {
  const [stopName, setStopName] = useState<string>(pref.stopId);

  useEffect(() => {
    fetch(`/api/stops?id=${pref.stopId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.stop) setStopName(formatStopLabel(d.stop));
      });
  }, [pref.stopId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{stopName}</p>
        <button
          type="button"
          onClick={() => onRemove(pref.stopId)}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {RATING_OPTIONS.map(({ value, label, color }) => (
          <button
            key={value}
            type="button"
            onClick={() => onRatingChange(pref.stopId, value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              pref.rating === value ? color : "border-slate-200 text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={pref.note ?? ""}
        onChange={(e) => onNoteChange(pref.stopId, e.target.value)}
        placeholder="Why? e.g. busy road, no shelter"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
      />
    </div>
  );
}
