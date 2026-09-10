import type { BusStop } from "./types";
import { formatStopLabel } from "./stops";

export function openStreetMapUrl(lat: number, lng: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

export function googleMapsUrl(lat: number, lng: number, label?: string): string {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=&center=${lat}%2C${lng}&zoom=17`;
}

export function googleStreetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/** Embedded OSM map iframe URL — no API key required. */
export function openStreetMapEmbedUrl(lat: number, lng: number): string {
  const padLng = 0.008;
  const padLat = 0.005;
  const bbox = [
    lng - padLng,
    lat - padLat,
    lng + padLng,
    lat + padLat,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function stopMapLabel(stop: BusStop): string {
  return formatStopLabel(stop);
}
