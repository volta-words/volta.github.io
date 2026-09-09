const BODS_BASE = "https://data.bus-data.dft.gov.uk/api/v1";

export interface BodsDataset {
  id: number;
  name: string;
  description: string;
  url: string;
  status: string;
  localities?: string[];
}

export function getBodsApiKey(): string | undefined {
  return process.env.BODS_API_KEY;
}

export async function fetchDataset(
  datasetId: string | number,
): Promise<BodsDataset | null> {
  const apiKey = getBodsApiKey();
  if (!apiKey) return null;

  const url = `${BODS_BASE}/dataset/${datasetId}/?api_key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}

export async function downloadGtfsZip(
  datasetId: string | number,
): Promise<ArrayBuffer | null> {
  const dataset = await fetchDataset(datasetId);
  if (!dataset?.url) return null;

  const res = await fetch(dataset.url);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

export interface SiriVehicleActivity {
  lineRef?: string;
  directionRef?: string;
  originRef?: string;
  destinationRef?: string;
  vehicleRef?: string;
  recordedAtTime?: string;
  delayMinutes: number;
  status: "on-time" | "delayed" | "early" | "unknown";
}

/** Parse SIRI-VM XML into vehicle activities (simplified parser) */
export function parseSiriVm(xml: string): SiriVehicleActivity[] {
  const activities: SiriVehicleActivity[] = [];

  const activityBlocks = xml.match(
    /<VehicleActivity[\s\S]*?<\/VehicleActivity>/g,
  );
  if (!activityBlocks) return activities;

  for (const block of activityBlocks) {
    const lineRef = extractTag(block, "LineRef");
    const directionRef = extractTag(block, "DirectionRef");
    const originRef = extractTag(block, "OriginRef");
    const destinationRef = extractTag(block, "DestinationRef");
    const vehicleRef = extractTag(block, "VehicleRef");
    const recordedAtTime = extractTag(block, "RecordedAtTime");

    // Delay from MonitoredVehicleJourney or EstimatedDelay
    let delayMinutes = 0;
    const delayMatch = block.match(
      /<Delay>([^<]+)<\/Delay>|<EstimatedDelay>([^<]+)<\/EstimatedDelay>/,
    );
    if (delayMatch) {
      const delayStr = delayMatch[1] || delayMatch[2];
      delayMinutes = parseDelayToMinutes(delayStr);
    }

    let status: SiriVehicleActivity["status"] = "unknown";
    if (delayMinutes > 2) status = "delayed";
    else if (delayMinutes < -2) status = "early";
    else if (delayMinutes !== 0 || block.includes("RecordedAtTime"))
      status = "on-time";

    activities.push({
      lineRef,
      directionRef,
      originRef,
      destinationRef,
      vehicleRef,
      recordedAtTime,
      delayMinutes,
      status,
    });
  }

  return activities;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)<\\/${tag}>`));
  return match?.[1]?.trim();
}

function parseDelayToMinutes(delay: string): number {
  // ISO 8601 duration PT5M30S or plain seconds
  if (delay.startsWith("PT")) {
    const hours = delay.match(/(\d+)H/)?.[1];
    const mins = delay.match(/(\d+)M/)?.[1];
    const secs = delay.match(/(\d+)S/)?.[1];
    return (
      (hours ? parseInt(hours) * 60 : 0) +
      (mins ? parseInt(mins) : 0) +
      (secs ? parseInt(secs) / 60 : 0)
    );
  }
  const num = parseFloat(delay);
  if (!isNaN(num)) return num > 300 ? num / 60 : num; // seconds vs minutes heuristic
  return 0;
}

export async function fetchRealtimeFeed(
  datafeedId: string | number,
): Promise<SiriVehicleActivity[]> {
  const apiKey = getBodsApiKey();
  if (!apiKey) return [];

  const url = `${BODS_BASE}/datafeed/${datafeedId}/?api_key=${apiKey}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseSiriVm(xml);
  } catch {
    return [];
  }
}

/** Search BODS datasets for Cornwall operators */
export async function searchCornwallDatasets(): Promise<BodsDataset[]> {
  const apiKey = getBodsApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    search: "Cornwall",
    status: "published",
  });

  const res = await fetch(`${BODS_BASE}/dataset/?${params}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return data.results ?? [];
}
