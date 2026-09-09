"use client";

import { useState } from "react";
import { WeightSliders } from "@/components/WeightSliders";
import { StopPreferenceEditor } from "@/components/StopPreferenceEditor";
import { BottomNav } from "@/components/BottomNav";
import type { StopPreference, WeightPreferences } from "@/lib/types";
import {
  getLocalStopPreferences,
  getLocalWeights,
  saveLocalStopPreferences,
  saveLocalWeights,
  getDefaultStopPreferences,
} from "@/lib/profile-store";

export default function PreferencesPage() {
  const [weights, setWeights] = useState<WeightPreferences>(() =>
    getLocalWeights(),
  );
  const [preferences, setPreferences] = useState<StopPreference[]>(() => {
    const prefs = getLocalStopPreferences();
    return prefs.length > 0 ? prefs : getDefaultStopPreferences();
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveLocalWeights(weights);
    saveLocalStopPreferences(preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 pb-24">
      <header className="px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">Preferences</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tune what matters most for your routes
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            Route priorities
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Adjust how routes are ranked. Higher weight = more important.
          </p>
          <div className="mt-4">
            <WeightSliders weights={weights} onChange={setWeights} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            Change-point stops
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Mark stops you prefer or want to avoid when changing buses. For
            example, avoid a busy roadside Sainsbury&apos;s and prefer a
            station with shelter.
          </p>
          <div className="mt-4">
            <StopPreferenceEditor
              preferences={preferences}
              onChange={setPreferences}
            />
          </div>
        </section>

        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-lg hover:bg-teal-700"
        >
          {saved ? "Saved!" : "Save preferences"}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
