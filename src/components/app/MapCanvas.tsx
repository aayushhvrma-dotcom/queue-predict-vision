import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, Circle } from "react-leaflet";

import { levelMeta, type CrowdSummary } from "@/lib/queue";

export type MapPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string;
  summary: CrowdSummary;
};

const CATEGORY_GLYPH: Record<string, string> = {
  bank: "🏦",
  hospital: "🏥",
  pharmacy: "💊",
  post_office: "📮",
  government: "🏛️",
};

function markerIcon(place: MapPlace, selected: boolean) {
  const meta = levelMeta(place.summary.level);
  const glyph = CATEGORY_GLYPH[place.category] ?? "📍";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:34px;height:34px;border-radius:9999px;background:${meta.color}33;${selected ? "box-shadow:0 0 0 3px #9B5CFF;" : ""}"></span>
        <span style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:${meta.color};border:2px solid rgba(23,21,31,0.9);font-size:12px;line-height:1;">${glyph}</span>
        <span style="position:absolute;top:-6px;right:-6px;display:flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 3px;border-radius:9999px;background:rgba(23,21,31,0.92);border:1px solid ${meta.color};font-size:9px;font-weight:700;color:#F5F3FF;">${place.summary.wait}</span>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function userIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;width:30px;height:30px;border-radius:9999px;background:rgba(155,92,255,0.25);"></span>
      <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:#9B5CFF;border:2px solid #F5F3FF;"></span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number | undefined }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.8 });
  }, [center[0], center[1], zoom, map]);
  return null;
}

type MapCanvasProps = {
  center: [number, number];
  userPosition: [number, number] | null;
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (place: MapPlace) => void;
  zoom?: number;
};

export default function MapCanvas({
  center,
  userPosition,
  places,
  selectedId,
  onSelect,
  zoom,
}: MapCanvasProps) {
  const markers = useMemo(
    () =>
      places.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={markerIcon(place, place.id === selectedId)}
          eventHandlers={{ click: () => onSelect(place) }}
        />
      )),
    [places, selectedId, onSelect],
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom ?? 15}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />
      <Recenter center={center} zoom={zoom} />
      {userPosition && (
        <>
          <Circle
            center={userPosition}
            radius={220}
            pathOptions={{ color: "#9B5CFF", fillColor: "#7C3AED", fillOpacity: 0.08, weight: 1 }}
          />
          <Marker position={userPosition} icon={userIcon()} />
        </>
      )}
      {markers}
    </MapContainer>
  );
}
