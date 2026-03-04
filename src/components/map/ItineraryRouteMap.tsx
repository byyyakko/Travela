import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RoutePoint {
  lat: number;
  lng: number;
  title: string;
  time: string;
  category: string;
  order: number;
}

interface ItineraryRouteMapProps {
  points: RoutePoint[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍜",
  culture: "🏛️",
  adventure: "🧗",
  shopping: "🛍️",
  sightseeing: "📸",
};

const CATEGORY_COLOR: Record<string, string> = {
  food: "#ea580c",
  culture: "#7c3aed",
  adventure: "#16a34a",
  shopping: "#db2777",
  sightseeing: "#2563eb",
};

const ItineraryRouteMap = ({ points }: ItineraryRouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const sortedPoints = [...points].sort((a, b) => a.order - b.order);
    const latLngs: L.LatLngExpression[] = [];

    sortedPoints.forEach((pt, idx) => {
      const emoji = CATEGORY_EMOJI[pt.category] || "📍";
      const color = CATEGORY_COLOR[pt.category] || "#6b7280";

      const icon = L.divIcon({
        className: "custom-route-marker",
        html: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;border-radius:50%;
          background:white;border:3px solid ${color};
          font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);
          position:relative;
        ">
          ${emoji}
          <span style="
            position:absolute;top:-8px;right:-8px;
            background:${color};color:white;
            width:20px;height:20px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:700;
          ">${idx + 1}</span>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(map);
      marker.bindPopup(
        `<div style="min-width:140px">
          <strong>${idx + 1}. ${pt.title}</strong><br/>
          <span style="color:#666;font-size:12px">${pt.time}</span>
        </div>`
      );

      latLngs.push([pt.lat, pt.lng]);
    });

    // Draw route polyline
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: "hsl(var(--primary))",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 8",
      }).addTo(map);
    }

    // Fit bounds
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div
      ref={mapRef}
      className="w-full h-[300px] rounded-xl border-2 border-primary/20 overflow-hidden z-0"
    />
  );
};

export default ItineraryRouteMap;
