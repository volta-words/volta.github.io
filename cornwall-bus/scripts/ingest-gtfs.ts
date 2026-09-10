#!/usr/bin/env npx tsx
/**
 * Download Cornwall GTFS from BODS and prepare for OpenTripPlanner.
 *
 * Usage:
 *   BODS_API_KEY=xxx npx tsx scripts/ingest-gtfs.ts
 *   BODS_DATASET_ID=23002 npx tsx scripts/ingest-gtfs.ts
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const BODS_BASE = "https://data.bus-data.dft.gov.uk/api/v1";
const DATASET_ID = process.env.BODS_DATASET_ID ?? "23002";
const OUTPUT_DIR = join(process.cwd(), "data", "gtfs");

async function main() {
  const apiKey = process.env.BODS_API_KEY;
  if (!apiKey) {
    console.error("BODS_API_KEY environment variable is required");
    console.error("Register free at https://data.bus-data.dft.gov.uk");
    process.exit(1);
  }

  console.log(`Fetching dataset ${DATASET_ID} metadata...`);
  const metaRes = await fetch(
    `${BODS_BASE}/dataset/${DATASET_ID}/?api_key=${apiKey}`,
  );

  if (!metaRes.ok) {
    console.error(`Failed to fetch dataset metadata: ${metaRes.status}`);
    process.exit(1);
  }

  const meta = await metaRes.json();
  console.log(`Dataset: ${meta.name}`);
  console.log(`Description: ${meta.description?.slice(0, 120)}...`);

  if (!meta.url) {
    console.error("No download URL in dataset metadata");
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const zipPath = join(OUTPUT_DIR, `cornwall-${DATASET_ID}.zip`);

  console.log(`Downloading GTFS to ${zipPath}...`);
  const downloadRes = await fetch(meta.url);
  if (!downloadRes.ok || !downloadRes.body) {
    console.error(`Download failed: ${downloadRes.status}`);
    process.exit(1);
  }

  const nodeStream = Readable.fromWeb(
    downloadRes.body as import("stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(zipPath));

  const manifest = {
    datasetId: DATASET_ID,
    name: meta.name,
    downloadedAt: new Date().toISOString(),
    zipPath,
    status: meta.status,
  };

  await writeFile(
    join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  console.log("Done. Next steps:");
  console.log("  1. Unzip GTFS into data/gtfs/extracted/");
  console.log("  2. Run: docker compose up otp-build");
  console.log("  3. Start OTP: docker compose up otp");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
