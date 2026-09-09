#!/usr/bin/env npx tsx
/**
 * Download current GTFS from Transport for Cornwall and build routing graph.
 * https://www.transportforcornwall.co.uk/open-data
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { existsSync } from "fs";

const GTFS_URL =
  process.env.TFC_GTFS_URL ??
  "https://s3-eu-west-1.amazonaws.com/passenger-sources/gocornwallbus/gtfs/gocornwallbus_1788790529.zip";

const GTFS_DIR = join(process.cwd(), "data", "gtfs");
const EXTRACT_DIR = join(GTFS_DIR, "extracted");
const ZIP_PATH = join(GTFS_DIR, "cornwall-current.zip");

async function main() {
  await mkdir(GTFS_DIR, { recursive: true });

  console.log("Downloading Transport for Cornwall GTFS…");
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(ZIP_PATH, buf);
  console.log(`Saved ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  await mkdir(EXTRACT_DIR, { recursive: true });
  execSync(`unzip -qo "${ZIP_PATH}" -d "${EXTRACT_DIR}"`);

  console.log("Building connection graph…");
  execSync("npx tsx scripts/build-gtfs-graph.ts", { stdio: "inherit" });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
