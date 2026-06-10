import React, { useState, useMemo, useEffect } from 'react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DeliveryOrder } from '../types';
import { CARTO_DARK_RASTER, CARTO_LIGHT_RASTER } from '../lib/mapStyles';

export const HistoryMap = React.memo(({ order, highContrast }: { order: DeliveryOrder, highContrast?: boolean }) => {
  const shopLat = Number(order.shop_lat || -25.9864);
  const shopLng = Number(order.shop_lng || 28.2198);
  const dropLat = Number(order.lat || -25.9894);
  const dropLng = Number(order.lng || 28.2148);

  const [routeCoordinates, setRouteCoordinates] = useState<number[][]>([[shopLng, shopLat], [dropLng, dropLat]]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout

    fetch(`https://router.project-osrm.org/route/v1/driving/${shopLng},${shopLat};${dropLng},${dropLat}?geometries=geojson&overview=full`, {
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(data => {
        if (data.routes?.[0]?.geometry?.coordinates) {
          setRouteCoordinates(data.routes[0].geometry.coordinates);
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name !== 'AbortError' && err.message?.indexOf('abort') === -1) {
          console.warn("History OSRM routing failed", err);
        }
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [shopLat, shopLng, dropLat, dropLng]);

  const routeGeoJSON = useMemo(() => {
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeCoordinates
      }
    };
  }, [routeCoordinates]);

  return (
    <div className="w-full h-32 rounded-xl border border-zinc-800/40 overflow-hidden relative pointer-events-none grayscale opacity-80 mt-4 mb-2">
      <Map
        initialViewState={{
          longitude: (shopLng + dropLng) / 2,
          latitude: (shopLat + dropLat) / 2,
          zoom: 12
        }}
        mapStyle={highContrast !== undefined ? (highContrast ? CARTO_LIGHT_RASTER : CARTO_DARK_RASTER) : (localStorage.getItem('localeats_contrast') === 'true' ? CARTO_LIGHT_RASTER : CARTO_DARK_RASTER)}
        attributionControl={false}
        interactive={false}
        style={{ width: '100%', height: '100%' }}
      >
         <Source id="history-route" type="geojson" data={routeGeoJSON}>
            <Layer 
              id="history-line"
              type="line"
              paint={{
                'line-color': '#f59e0b',
                'line-width': 3,
                'line-opacity': 0.8
              }}
            />
          </Source>
      </Map>
    </div>
  );
});
