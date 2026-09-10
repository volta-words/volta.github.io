#!/usr/bin/env npx tsx
/**
 * Import Cornwall bus stops from NaPTAN CSV into data/cornwall-stops.json
 *
 * Usage:
 *   npx tsx scripts/import-naptan.ts [path-to-naptan.csv]
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CORNWALL_ADMIN = "073";

interface Stop {
  id: string;
  name: string;
  locality?: string;
  lat: number;
  lng: number;
  indicator?: string;
  street?: string;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

async function main() {
  const inputPath =
    process.argv[2] ??
    join(process.cwd(), "data", "naptan-national.csv");

  console.log(`Reading ${inputPath}...`);
  const content = await readFile(inputPath, "utf8");
  const lines = content.split("\n");
  const header = parseCsvLine(lines[0]);
  const idx = (n: string) => header.indexOf(n);

  const stops: Stop[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (
      !row.includes(`,${CORNWALL_ADMIN},`) ||
      !row.includes(",BCT,") ||
      !row.includes(",active")
    ) {
      continue;
    }

    const cols = parseCsvLine(row);
    const lat = parseFloat(cols[idx("Latitude")]);
    const lng = parseFloat(cols[idx("Longitude")]);
    if (isNaN(lat) || isNaN(lng)) continue;

    stops.push({
      id: cols[idx("ATCOCode")],
      name: cols[idx("CommonName")],
      locality: cols[idx("LocalityName")] || cols[idx("Town")] || undefined,
      lat,
      lng,
      indicator: cols[idx("Indicator")] || undefined,
      street: cols[idx("Street")] || undefined,
    });
  }

  const outDir = join(process.cwd(), "data");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "cornwall-stops.json");
  await writeFile(outPath, JSON.stringify(stops));

  console.log(`Wrote ${stops.length} Cornwall bus stops to ${outPath}`);
}

main().catch(console.error);
