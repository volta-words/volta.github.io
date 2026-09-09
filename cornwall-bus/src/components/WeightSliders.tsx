"use client";

import type { WeightPreferences } from "@/lib/types";

interface WeightSlidersProps {
  weights: WeightPreferences;
  onChange: (weights: WeightPreferences) => void;
}

const LABELS: { key: keyof WeightPreferences; label: string; hint: string }[] =
  [
    { key: "speed", label: "Fastest", hint: "Prioritise shorter journeys" },
    {
      key: "changes",
      label: "Fewest changes",
      hint: "Prefer direct or single-change routes",
    },
    {
      key: "stops",
      label: "Best change locations",
      hint: "Avoid busy roads, prefer stations",
    },
  ];

export function WeightSliders({ weights, onChange }: WeightSlidersProps) {
  const total = weights.speed + weights.changes + weights.stops;

  function handleChange(key: keyof WeightPreferences, value: number) {
    onChange({ ...weights, [key]: value });
  }

  return (
    <div className="space-y-5">
      {LABELS.map(({ key, label, hint }) => {
        const pct = total > 0 ? Math.round((weights[key] / total) * 100) : 0;
        return (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-800">{label}</span>
              <span className="text-xs text-slate-500">{pct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-600"
            />
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        );
      })}
    </div>
  );
}
