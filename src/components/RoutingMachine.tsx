import { useEffect, useRef, useState } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

// Need to fix icon issues with Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface RoutingMachineProps {
  start: [number, number] | null;
  end: [number, number];
  color?: string;
  onRouteFound: (route: { 
    summary?: { totalTime: number; totalDistance: number }; 
    instructions?: { text: string; type?: string; modifier?: string; distance?: number }[] 
  }) => void;
}

export function RoutingMachine({ start, end, color = '#3b82f6', onRouteFound }: RoutingMachineProps) {
  const map = useMap();
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!map || !start || !end) return;

    const router = L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        });

    // Create the routing control once
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ],
      router: router,
      routeWhileDragging: false,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false, // Hide the default text instructions
      lineOptions: {
        extendToWaypoints: true,
        missingRouteTolerance: 0,
        styles: [{ color: color, weight: 6, opacity: 0.8 }]
      },
      // @ts-expect-error - createMarker exists in leaflet-routing-machine options but types are incomplete
      createMarker: () => null, // Hide default markers
      draggableWaypoints: false
    }).addTo(map);

    routingControlRef.current = routingControl;

    // Type helper for routing events
    interface RoutingEvent {
      message?: string;
      error?: { message?: string };
      routes?: { 
        summary?: { totalTime: number; totalDistance: number }; 
        instructions?: { text: string; type?: string; modifier?: string; distance?: number }[] 
      }[];
    }
    
    const control = routingControl as L.Routing.Control & { 
      on: (event: string, fn: (e: RoutingEvent) => void) => void;
      off: (event: string, fn: (e: RoutingEvent) => void) => void;
    };

    const handleRouteError = (e: RoutingEvent) => {
      // Silence standard log if we can, and force fallback
      const errorMsg = e?.message || e?.error?.message || 'Unknown routing error';
      console.warn('MISSION CRITICAL: Routing uplink failed. Engaging visual line fallback.', errorMsg);
      setUseFallback(true);
    };

    const handleRouteFound = (e: RoutingEvent) => {
      if (e.routes && e.routes.length > 0) {
        setUseFallback(false);
        onRouteFound(e.routes[0]);
      }
    };

    control.on('routingerror', handleRouteError);
    control.on('routesfound', handleRouteFound);

    return () => {
      try {
        control.off('routingerror', handleRouteError);
        control.off('routesfound', handleRouteFound);
        if (map && routingControlRef.current) {
          try {
             routingControlRef.current.getPlan().setWaypoints([]);
          } catch {
            // Error when clearing plan waypoints usually means the control was already partially destroyed
            // We can safely ignore it.
          }
          map.removeControl(routingControlRef.current);
        }
      } catch (err) {
        console.error('Error removing routing control', err instanceof Error ? err.message : String(err));
      }
      routingControlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, color]); // re-run if map instance or color changes

  // Update waypoints dynamically
  useEffect(() => {
    if (routingControlRef.current && start && end) {
      routingControlRef.current.setWaypoints([
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ]);
    }
  }, [start, end]);

  if (useFallback && start && end) {
    return <Polyline positions={[start, end]} color={color} weight={6} opacity={0.6} dashArray="10, 10" />;
  }

  return null;
}
