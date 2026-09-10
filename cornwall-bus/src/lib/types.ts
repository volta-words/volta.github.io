export type StopRating = "prefer" | "neutral" | "avoid";

export interface BusStop {
  id: string;
  name: string;
  locality?: string;
  lat: number;
  lng: number;
  indicator?: string;
}

export interface StopPreference {
  stopId: string;
  rating: StopRating;
  note?: string;
}

export interface WeightPreferences {
  speed: number;
  changes: number;
  stops: number;
}

export interface UserProfile {
  id: string;
  homeStopIds: string[];
  collegeStopIds: string[];
  homeStops?: BusStop[];
  collegeStops?: BusStop[];
  /** @deprecated use homeStopIds */
  homeStopId?: string;
  /** @deprecated use collegeStopIds */
  collegeStopId?: string;
  homeStop?: BusStop;
  collegeStop?: BusStop;
  displayName?: string;
  weights: WeightPreferences;
}

export interface RouteLeg {
  mode: "WALK" | "BUS";
  fromStop: BusStop;
  toStop: BusStop;
  routeShortName?: string;
  routeLongName?: string;
  /** Transport for Cornwall timetable page for this route */
  timetableUrl?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  isTransfer?: boolean;
}

export interface ScoredRoute {
  id: string;
  legs: RouteLeg[];
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  numTransfers: number;
  transferStops: BusStop[];
  score: number;
  scoreBreakdown: {
    timeCost: number;
    changesCost: number;
    stopsCost: number;
  };
  explanations: string[];
  tags: string[];
  /** Live delay in minutes (positive = late) */
  delayMinutes?: number;
  atRisk?: boolean;
}

export interface LiveDeparture {
  stopId: string;
  routeName: string;
  destination: string;
  scheduledTime: string;
  predictedTime?: string;
  delayMinutes: number;
  status: "on-time" | "delayed" | "early" | "cancelled" | "unknown";
}

export interface JourneyRequest {
  /** Single stop (legacy) */
  fromStopId?: string;
  toStopId?: string;
  /** Multiple nearby stops — routes planned across all combinations */
  fromStopIds?: string[];
  toStopIds?: string[];
  mode: "arrive-by" | "depart-after";
  time: string; // ISO or HH:mm
  date?: string; // YYYY-MM-DD
  weights?: WeightPreferences;
  stopPreferences?: StopPreference[];
}
