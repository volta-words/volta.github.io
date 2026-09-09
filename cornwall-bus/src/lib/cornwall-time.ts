/** Cornwall / UK local time — GTFS times are always Europe/London. */
export const CORNWALL_TZ = "Europe/London";

export interface CornwallDateTime {
  date: string;
  /** Seconds from midnight on `date` in Europe/London (GTFS convention). */
  seconds: number;
}

export function parseCornwallTime(time: string, date: string): CornwallDateTime {
  if (time.includes("T")) {
    const d = new Date(time);
    const datePart = d.toLocaleDateString("en-CA", { timeZone: CORNWALL_TZ });
    const timePart = d.toLocaleString("en-GB", {
      timeZone: CORNWALL_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const [hours, minutes] = timePart.split(":").map(Number);
    return { date: datePart, seconds: hours * 3600 + minutes * 60 };
  }

  const [hours, minutes] = time.split(":").map(Number);
  return { date, seconds: hours * 3600 + minutes * 60 };
}

/** Convert GTFS seconds-from-midnight to an ISO UTC string for API responses. */
export function cornwallSecondsToIso(date: string, seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const target = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  const [y, mo, d] = date.split("-").map(Number);
  const dayStartUtc = Date.UTC(y, mo - 1, d, 0, 0, 0);

  for (let ms = dayStartUtc - 3600_000; ms < dayStartUtc + 36 * 3600_000; ms += 60_000) {
    const dt = new Date(ms);
    const londonDate = dt.toLocaleDateString("en-CA", { timeZone: CORNWALL_TZ });
    const londonTime = dt
      .toLocaleString("en-GB", {
        timeZone: CORNWALL_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .slice(0, 5);

    if (londonDate === date && londonTime === target) {
      return dt.toISOString();
    }
  }

  return new Date(dayStartUtc + seconds * 1000).toISOString();
}

export function formatCornwallTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: CORNWALL_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
