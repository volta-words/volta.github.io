"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StopPicker } from "@/components/StopPicker";
import { BottomNav } from "@/components/BottomNav";
import type { BusStop } from "@/lib/types";
import {
  getLocalProfile,
  saveLocalProfile,
  type LocalProfile,
} from "@/lib/profile-store";
import { getStopById } from "@/lib/stops";

function loadInitialSetup() {
  const local = getLocalProfile();
  return {
    home: local ? getStopById(local.homeStopId) ?? null : null,
    college: local ? getStopById(local.collegeStopId) ?? null : null,
    displayName: local?.displayName ?? "",
    arriveBy: local?.arriveBy ?? "09:00",
    leaveAfter: local?.leaveAfter ?? "17:00",
  };
}

export default function SetupPage() {
  const router = useRouter();
  const initial = loadInitialSetup();
  const [home, setHome] = useState<BusStop | null>(initial.home);
  const [college, setCollege] = useState<BusStop | null>(initial.college);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [arriveBy, setArriveBy] = useState(initial.arriveBy);
  const [leaveAfter, setLeaveAfter] = useState(initial.leaveAfter);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!home || !college) return;

    const profile: LocalProfile = {
      homeStopId: home.id,
      collegeStopId: college.id,
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
          Choose your home and college bus stops
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4">
        <StopPicker label="Home stop" value={home} onChange={setHome} />
        <StopPicker
          label="College stop"
          value={college}
          onChange={setCollege}
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
          disabled={!home || !college}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-lg hover:bg-teal-700 disabled:opacity-40"
        >
          {saved ? "Saved! Redirecting…" : "Save journey"}
        </button>

        <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p className="font-medium text-slate-800">Quick picks</p>
          <p className="mt-2 text-xs">
            Try searching &quot;Penryn&quot;, &quot;Falmouth Uni&quot;, or
            &quot;College&quot; for campus stops.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
