import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Set default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Place {
  id: string;
  name: string;
  type: "store" | "local" | "itinerary" | "ai";
  storeType?: "food" | "attractions" | "entertainment";
  lat: number;
  lng: number;
  description?: string;
}

interface MapComponentProps {
  center: [number, number];
  userPosition: [number, number] | null;
  places: Place[];
  onLocationFound: (lat: number, lng: number) => void;
}

const MapComponent = ({ center, userPosition, places, onLocationFound }: MapComponentProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const placeMarkersRef = useRef<L.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: 14,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Start location tracking
    map.locate({ watch: true, enableHighAccuracy: true });

    map.on("locationfound", (e) => {
      onLocationFound(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center]);

  // Update user position marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Add new user marker
    if (userPosition) {
      const userIcon = L.divIcon({
        className: "user-location-marker",
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userMarkerRef.current = L.marker(userPosition, { icon: userIcon })
        .addTo(mapRef.current)
        .bindPopup("<b>📍 You are here</b>");
    }
  }, [userPosition]);

  // Update place markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old markers
    placeMarkersRef.current.forEach((marker) => marker.remove());
    placeMarkersRef.current = [];

    // Add new markers
    places.forEach((place) => {
      let markerColor = "#22c55e";
      let markerEmoji = "📋";
      
      if (place.type === "store" || place.type === "ai") {
        switch (place.storeType) {
          case "food":
            markerColor = "#f97316";
            markerEmoji = "🍜";
            break;
          case "attractions":
            markerColor = "#8b5cf6";
            markerEmoji = "🏛️";
            break;
          case "entertainment":
            markerColor = "#ec4899";
            markerEmoji = "🎮";
            break;
          default:
            markerColor = place.type === "ai" ? "#6366f1" : "#3b82f6";
            markerEmoji = place.type === "ai" ? "✨" : "🏪";
        }
      }

      const placeIcon = L.divIcon({
        className: "place-marker",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          ">${markerEmoji}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([place.lat, place.lng], { icon: placeIcon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="min-width: 120px;">
            <p style="font-weight: 600; margin: 0 0 4px 0;">${place.name}</p>
            ${place.description ? `<p style="font-size: 12px; color: #666; margin: 0;">${place.description}</p>` : ""}
            <span style="
              display: inline-block;
              margin-top: 8px;
              padding: 2px 8px;
              background: #f3f4f6;
              border-radius: 12px;
              font-size: 11px;
            ">${markerEmoji} ${place.type === "store" ? (place.storeType || "Store") : place.type === "ai" ? `AI · ${place.storeType || "Place"}` : "Itinerary"}</span>
          </div>
        `);

      placeMarkersRef.current.push(marker);
    });
  }, [places]);

  return (
    <div 
      ref={mapContainerRef} 
      className="h-full w-full z-0"
      style={{ minHeight: "300px" }}
    />
  );
};

export default MapComponent;
