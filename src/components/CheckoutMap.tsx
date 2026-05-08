import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

// Fix for default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const customPinIcon = L.divIcon({
  html: `<div style="background-color: #f59e0b; padding: 6px; border-radius: 50%; box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); border: 2px solid white;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'pin-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

interface DraggableMarkerProps {
    pos: [number, number];
    setPos: (pos: [number, number]) => void;
    onLocationSelect: (lat: number, lng: number, address?: string) => void;
    reverseGeocode: (lat: number, lng: number) => void;
}

const DraggableMarker: React.FC<DraggableMarkerProps> = ({ pos, setPos, onLocationSelect, reverseGeocode }) => {
    useMapEvents({
      click(e) {
        const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
        setPos(newPos);
        onLocationSelect(newPos[0], newPos[1]);
        reverseGeocode(newPos[0], newPos[1]);
      },
    });

    return (
      <Marker
        position={pos}
        icon={customPinIcon}
        draggable={true}
        eventHandlers={{
          dragend: (e: L.DragEndEvent) => {
            const marker = e.target;
            const position = marker.getLatLng();
            const newPos: [number, number] = [position.lat, position.lng];
            setPos(newPos);
            onLocationSelect(newPos[0], newPos[1]);
            reverseGeocode(newPos[0], newPos[1]);
          },
        }}
      />
    );
};

interface CheckoutMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
}

export const CheckoutMap: React.FC<CheckoutMapProps> = ({ initialLat = -25.9894, initialLng = 28.2148, onLocationSelect }) => {
  const [pos, setPos] = useState<[number, number]>([initialLat, initialLng]);
  const [isGoogleView, setIsGoogleView] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data.display_name) {
        onLocationSelect(lat, lng, data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  const autoLocate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser.");
      return;
    }

    toast.info("Acquiring GPS lock...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const newPos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setPos(newPos);
        onLocationSelect(newPos[0], newPos[1]);
        reverseGeocode(newPos[0], newPos[1]);
      },
      (err) => toast.error(`Position failed: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full h-[300px] rounded-3xl overflow-hidden border border-white/5 bg-zinc-950">
      <MapContainer
        center={pos}
        zoom={16}
        minZoom={14}
        maxBounds={[
          [-26.040, 28.160], // Southwest
          [-25.930, 28.260]  // Northeast
        ]}
        maxBoundsViscosity={1.0}
        className={cn(
          "w-full h-full transition-all duration-700",
          !isGoogleView ? "brightness-[1.02] contrast-[0.98] saturate-[0.8]" : ""
        )}
        zoomControl={false}
      >
        {isGoogleView ? (
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            attribution='&copy; Google Maps'
          />
        ) : (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
        )}
        <DraggableMarker pos={pos} setPos={setPos} onLocationSelect={onLocationSelect} reverseGeocode={reverseGeocode} />
      </MapContainer>

      <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
          <MapPin size={10} className="text-[#f59e0b]" />
          <span className="text-[9px] font-black uppercase text-white/70 tracking-widest">DRAG PIN TO DELIVERY SPOT</span>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto">
          <button
            onClick={autoLocate}
            className="w-10 h-10 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-zinc-800 transition-colors shadow-2xl"
          >
            <Navigation size={18} />
          </button>
          
          <button
            onClick={() => setIsGoogleView(!isGoogleView)}
            className={cn(
              "w-10 h-10 backdrop-blur-md border rounded-2xl flex items-center justify-center transition-all shadow-2xl",
              isGoogleView ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-black/80 border-white/10 text-white"
            )}
          >
            <MapIcon size={18} className={cn(isGoogleView && "fill-black")} />
          </button>
        </div>
      </div>
    </div>
  );
};
