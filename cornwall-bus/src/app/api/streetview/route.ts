import { NextRequest, NextResponse } from "next/server";

interface StreetViewMetadata {
  status: string;
  location?: { lat: number; lng: number };
  pano_id?: string;
  date?: string;
}

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (!apiKey) {
    return NextResponse.json({
      available: true,
      imageUrl: null,
      streetViewUrl,
      mapsUrl,
      hint: "Add GOOGLE_MAPS_API_KEY for inline Street View photos",
    });
  }

  try {
    const metaRes = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`,
      { next: { revalidate: 86400 } },
    );
    const meta = (await metaRes.json()) as StreetViewMetadata;

    if (meta.status !== "OK") {
      return NextResponse.json({
        available: false,
        imageUrl: null,
        streetViewUrl,
        mapsUrl,
      });
    }

    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${lat},${lng}&fov=90&pitch=0&key=${apiKey}`;

    return NextResponse.json({
      available: true,
      imageUrl,
      streetViewUrl,
      mapsUrl,
      captured: meta.date,
    });
  } catch {
    return NextResponse.json({
      available: true,
      imageUrl: null,
      streetViewUrl,
      mapsUrl,
    });
  }
}
