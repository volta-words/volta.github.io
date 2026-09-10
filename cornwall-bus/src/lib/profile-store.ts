import type { StopPreference, UserProfile, WeightPreferences } from "./types";
import { getStopById, getStopsByIds } from "./stops";

const PROFILE_KEY = "cornwall-bus-profile";
const PREFS_KEY = "cornwall-bus-stop-prefs";
const WEIGHTS_KEY = "cornwall-bus-weights";

const DEFAULT_WEIGHTS: WeightPreferences = { speed: 50, changes: 25, stops: 25 };

export interface LocalProfile {
  homeStopIds: string[];
  collegeStopIds: string[];
  displayName?: string;
  arriveBy?: string;
  leaveAfter?: string;
  /** @deprecated migrated to homeStopIds */
  homeStopId?: string;
  /** @deprecated migrated to collegeStopIds */
  collegeStopId?: string;
}

function migrateProfile(raw: LocalProfile): LocalProfile {
  const homeStopIds =
    raw.homeStopIds?.length > 0
      ? raw.homeStopIds
      : raw.homeStopId
        ? [raw.homeStopId]
        : [];
  const collegeStopIds =
    raw.collegeStopIds?.length > 0
      ? raw.collegeStopIds
      : raw.collegeStopId
        ? [raw.collegeStopId]
        : [];

  return { ...raw, homeStopIds, collegeStopIds };
}

export function getLocalProfile(): LocalProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return migrateProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: LocalProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getLocalStopPreferences(): StopPreference[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalStopPreferences(prefs: StopPreference[]): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function getLocalWeights(): WeightPreferences {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  const raw = localStorage.getItem(WEIGHTS_KEY);
  if (!raw) return DEFAULT_WEIGHTS;
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function saveLocalWeights(weights: WeightPreferences): void {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

export function buildUserProfile(): UserProfile | null {
  const local = getLocalProfile();
  if (!local) return null;

  const homeStops = getStopsByIds(local.homeStopIds);
  const collegeStops = getStopsByIds(local.collegeStopIds);

  if (homeStops.length === 0 || collegeStops.length === 0) return null;

  return {
    id: "local",
    homeStopIds: local.homeStopIds,
    collegeStopIds: local.collegeStopIds,
    homeStops,
    collegeStops,
    homeStop: homeStops[0],
    collegeStop: collegeStops[0],
    homeStopId: homeStops[0].id,
    collegeStopId: collegeStops[0].id,
    displayName: local.displayName,
    weights: getLocalWeights(),
  };
}

/** Default demo preferences for Sainsbury's vs Station example */
export function getDefaultStopPreferences(): StopPreference[] {
  return [
    {
      stopId: "0800COD41054",
      rating: "prefer",
      note: "Penryn station — sheltered, simpler crossing",
    },
    {
      stopId: "0800FWV38516",
      rating: "avoid",
      note: "Sainsbury's — busy road, awkward change",
    },
  ];
}
