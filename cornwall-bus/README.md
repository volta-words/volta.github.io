# Cornwall Bus Journey Planner

A mobile-friendly PWA that plans fixed home ↔ college bus journeys in Cornwall. Rank routes by **speed**, **number of changes**, and **where you change buses** — so you can avoid busy roadside stops like Sainsbury's and prefer simpler interchanges like Penryn station.

## Features

- **Today's plan** — outbound (arrive by) and return (leave after) routes
- **Preference tuning** — sliders for fastest / fewest changes / best change locations
- **Stop preferences** — mark interchange stops as Prefer, Neutral, or Avoid
- **Live delays** — BODS SIRI-VM realtime (with simulated fallback for demo)
- **5,800+ Cornwall stops** — searchable NaPTAN stop index
- **OpenTripPlanner** — optional Docker sidecar for full GTFS routing

## Quick start

```bash
cd cornwall-bus
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or browser.

### First-time setup

1. Go to **Setup** and pick your home and college stops
2. Open **Preferences** to adjust route priorities and mark stops to prefer/avoid
3. Use **Today** to see ranked outbound and return routes

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `BODS_API_KEY` | For live data | Free key from [BODS](https://data.bus-data.dft.gov.uk) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `OTP_URL` | Optional | OpenTripPlanner URL (default `http://localhost:8080`) |
| `BODS_DATASET_ID` | Optional | Cornwall GTFS dataset (default `23002`) |

Without Supabase, profile and preferences are stored in browser localStorage.

## Data scripts

```bash
# Download Cornwall GTFS from BODS
BODS_API_KEY=xxx npm run ingest-gtfs

# Re-import Cornwall stops from NaPTAN CSV
npm run import-naptan path/to/naptan.csv
```

## OpenTripPlanner (optional)

```bash
# After ingesting GTFS, unzip to data/gtfs/extracted/
docker compose --profile build run otp-build
docker compose up otp
```

Set `OTP_URL=http://localhost:8080` in `.env.local`.

## Supabase schema

Run the migration in `supabase/migrations/` against your Supabase project for cloud-synced profiles and preferences.

## Architecture

- **Next.js 16** App Router + API routes
- **Serwist** PWA (installable, offline shell)
- **Built-in fallback router** — works without OTP using representative Penryn corridor timetables
- **Custom scorer** — re-ranks OTP/fallback results using user weights and stop preferences
