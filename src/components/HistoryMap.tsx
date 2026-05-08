import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DeliveryOrder } from '../types';
import { RoutingMachine } from './RoutingMachine';

const mockMerchantIcon = L.divIcon({
  html: `<div style="background-color: #f58220; padding: 4px; border-radius: 50%; border: 2px solid #050505;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>`,
  className: 'merchant-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const mockCustomerIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; padding: 4px; border-radius: 50%; border: 2px solid #050505;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'customer-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export const HistoryMap = React.memo(({ order }: { order: DeliveryOrder }) => {
  const [map, setMap] = useState<L.Map | null>(null);

  const shopLat = Number(order.shop_lat || -25.9864);
  const shopLng = Number(order.shop_lng || 28.2198);
  const dropLat = Number(order.lat || -25.9894);
  const dropLng = Number(order.lng || 28.2148);

  const startPos: [number, number] = [shopLat, shopLng];
  const targetPos: [number, number] = [dropLat, dropLng];

  return (
    <div className="w-full h-32 rounded-xl border border-zinc-800/40 overflow-hidden relative pointer-events-none grayscale opacity-80 mt-4 mb-2">
      <MapContainer 
        center={startPos} 
        zoom={12} 
        minZoom={12}
        maxBounds={[
          [-26.040, 28.160], // Southwest
          [-25.930, 28.260]  // Northeast
        ]}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        scrollWheelZoom={false}
        touchZoom={false}
        dragging={false}
        className="w-full h-full"
        ref={(instance) => {
          if (instance) setMap(instance as unknown as L.Map);
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={startPos} icon={mockMerchantIcon} />
        <Marker position={targetPos} icon={mockCustomerIcon} />
        <RoutingMachine 
            start={startPos} 
            end={targetPos} 
            color="#f59e0b" 
            cacheId={`history-${order.id}`}
            onRouteFound={() => {
              if (map) {
                const bounds = L.latLngBounds([startPos, targetPos]);
                map.fitBounds(bounds, { padding: [10, 10], animate: false });
              }
            }}
        />
      </MapContainer>
    </div>
  );
});
