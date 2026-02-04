import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MerchantMapPreviewProps {
  latitude: number;
  longitude: number;
  storeName: string;
  storeType: "food" | "attractions" | "entertainment";
}

const getMarkerIcon = (storeType: string) => {
  const iconMap: Record<string, { emoji: string; color: string }> = {
    food: { emoji: "🍜", color: "#f97316" },
    attractions: { emoji: "🏛️", color: "#8b5cf6" },
    entertainment: { emoji: "🍷", color: "#ec4899" },
  };
  
  const { emoji, color } = iconMap[storeType] || iconMap.food;
  
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">${emoji}</div>`,
    className: "custom-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const MerchantMapPreview = ({ latitude, longitude, storeName, storeType }: MerchantMapPreviewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([latitude, longitude], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add marker
    const marker = L.marker([latitude, longitude], {
      icon: getMarkerIcon(storeType),
    })
      .addTo(map)
      .bindPopup(`<strong>${storeName}</strong>`)
      .openPopup();

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    markerRef.current.setLatLng([latitude, longitude]);
    markerRef.current.setIcon(getMarkerIcon(storeType));
    markerRef.current.setPopupContent(`<strong>${storeName}</strong>`);
    mapInstanceRef.current.setView([latitude, longitude], 16);
  }, [latitude, longitude, storeName, storeType]);

  return (
    <div
      ref={mapRef}
      className="w-full h-64 rounded-lg overflow-hidden border-2 border-pink-200"
    />
  );
};

export default MerchantMapPreview;
