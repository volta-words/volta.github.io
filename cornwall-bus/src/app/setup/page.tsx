"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiStopPicker } from "@/components/MultiStopPicker";
import { BottomNav } from "@/components/BottomNav";
import type { BusStop } from "@/lib/types";
import {
  getLocalProfile,
  saveLocalProfile,
  type LocalProfile,
} from "@/lib/profile-store";
import { getStopsByIds, getRelatedStops } from "@/lib/stops";

function loadInitialSetup() {
  const local = getLocalProfile();
  return {
    home: local ? getStopsByIds(local.homeStopIds) : [],
    college: local ? getStopsByIds(local.collegeStopIds) : [],
    displayName: local?.displayName ?? "",
    arriveBy: local?.arriveBy ?? "09:00",
    leaveAfter: local?.leaveAfter ?? "17:00",
  };
}

/** When first stop added, auto-include nearby equivalents */
function withNearbyDefaults(stops: BusStop[]): BusStop[] {
  if (stops.length !== 1) return stops;
  const related = getRelatedStops(stops[0]);
  return related.slice(0, 6);
}

export default function SetupPage() {
  const router = useRouter();
  const [home, setHome] = useState<BusStop[]>([]);
  const [college, setCollege] = useState<BusStop[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [arriveBy, setArriveBy] = useState("09:00");
  const [leaveAfter, setLeaveAfter] = useState("17:00");
  const [saved, setSaved] = useState(false);

  // Load saved profile after mount — localStorage is unavailable during SSR
  useEffect(() => {
    const initial = loadInitialSetup();
    setHome(initial.home);
    setCollege(initial.college);
    setDisplayName(initial.displayName);
    setArriveBy(initial.arriveBy);
    setLeaveAfter(initial.leaveAfter);
  }, []);

  function handleHomeChange(stops: BusStop[]) {
    setHome(stops.length === 1 ? withNearbyDefaults(stops) : stops);
  }

  function handleCollegeChange(stops: BusStop[]) {
    setCollege(stops.length === 1 ? withNearbyDefaults(stops) : stops);
  }

  function handleSave() {
    if (home.length === 0 || college.length === 0) return;

    const profile: LocalProfile = {
      homeStopIds: home.map((s) => s.id),
      collegeStopIds: college.map((s) => s.id),
      displayName: displayName || undefined,
      arriveBy,
      leaveAfter,
    };

    saveLocalProfile(profile);
    setSaved(true);
    setTimeout(() => router.push("/"), 800);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 pb-24">
      <header className="px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">Journey setup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose all nearby stops you might use at home and college
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4">
        <MultiStopPicker
          label="Home stops"
          selected={home}
          onChange={handleHomeChange}
          placeholder="Search your home area…"
        />
        <MultiStopPicker
          label="College stops"
          selected={college}
          onChange={handleCollegeChange}
          placeholder="Search campus or nearest stop…"
        />

        <label className="block">
          <span className="text-sm font-medium text-slate-600">
            Display name (optional)
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Penryn → Falmouth Campus"
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">
              Usual arrive by
            </span>
            <input
              type="time"
              value={arriveBy}
              onChange={(e) => setArriveBy(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">
              Usual leave after
            </span>
            <input
              type="time"
              value={leaveAfter}
              onChange={(e) => setLeaveAfter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={home.length === 0 || college.length === 0}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-lg hover:bg-teal-700 disabled:opacity-40"
        >
          {saved ? "Saved! Redirecting…" : "Save journey"}
        </button>

        <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p className="font-medium text-slate-800">Why multiple stops?</p>
          <p className="mt-2 text-xs leading-relaxed">
            Bus routes often serve several stops at the same place — campus
            Stand A, B, C, D, or both sides of a road. Selecting all nearby
            stops means the planner can find routes even when one stand has no
            service.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Data from{" "}
            <a
              href="https://www.transportforcornwall.co.uk/open-data"
              className="text-teal-700 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Transport for Cornwall
            </a>
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
