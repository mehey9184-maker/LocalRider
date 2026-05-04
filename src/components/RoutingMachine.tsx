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
  cacheId?: string; // Optional ID to cache the route for offline use
  onFallback?: (isFallback: boolean) => void;
  onRouteFound: (route: { 
    summary?: { totalTime: number; totalDistance: number }; 
    instructions?: { text: string; type?: string; modifier?: string; distance?: number }[] 
  }) => void;
}

export function RoutingMachine({ start, end, color = '#3b82f6', cacheId, onFallback, onRouteFound }: RoutingMachineProps) {
  const map = useMap();
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [cachedRoute, setCachedRoute] = useState<L.LatLng[] | null>(null);

  useEffect(() => {
    if (onFallback) onFallback(useFallback);
  }, [useFallback, onFallback]);

  // Load cached route once on mount or if cacheId changes
  useEffect(() => {
    if (cacheId) {
      const saved = localStorage.getItem(`route_${cacheId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const routes = parsed.map(p => L.latLng(p.lat, p.lng));
            // Defer update to avoid cascading render
            setTimeout(() => {
              setCachedRoute(routes);
            
              // Also notify listener about cached info if we seem to be in fallback mode
              const savedInfo = localStorage.getItem(`routeInfo_${cacheId}`);
              if (savedInfo) {
                onRouteFound(JSON.parse(savedInfo));
              }
            }, 0);
          }
        } catch (e) {
          console.error('Failed to load cached route', e);
        }
      }
    }
  }, [cacheId, onRouteFound]);

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
      show: false, 
      containerClassName: 'hidden',
      // @ts-expect-error - itineraryClassName is valid but not in all type defs
      itineraryClassName: 'hidden',
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
        instructions?: { text: string; type?: string; modifier?: string; distance?: number }[];
        coordinates?: L.LatLng[];
      }[];
    }
    
    const control = routingControl as L.Routing.Control & { 
      on: (event: string, fn: (e: RoutingEvent) => void) => void;
      off: (event: string, fn: (e: RoutingEvent) => void) => void;
    };

    const handleRouteError = (e: RoutingEvent) => {
      const errorMsg = e?.message || e?.error?.message || 'Unknown routing error';
      console.warn('MISSION CRITICAL: Routing uplink failed. Engaging offline roadmap.', errorMsg);
      setUseFallback(true);
    };

    const handleRouteFound = (e: RoutingEvent) => {
      if (e.routes && e.routes.length > 0) {
        const route = e.routes[0];
        setUseFallback(false);
        
        // Cache the route for offline mode
        if (cacheId && route.coordinates) {
          localStorage.setItem(`route_${cacheId}`, JSON.stringify(route.coordinates));
          setCachedRoute(route.coordinates);
        }
        
        onRouteFound(route);
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
          }
          map.removeControl(routingControlRef.current);
        }
      } catch (err) {
        console.error('Error removing routing control', err instanceof Error ? err.message : String(err));
      }
      routingControlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, color, cacheId]); // re-run if map instance, color or cacheId changes

  // Update waypoints dynamically
  useEffect(() => {
    if (routingControlRef.current && start && end) {
      routingControlRef.current.setWaypoints([
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ]);
    }
  }, [start, end]);

  if (useFallback && cachedRoute) {
    return <Polyline positions={cachedRoute} color={color} weight={6} opacity={0.6} />;
  }

  // Final fallback: Straight-line guide if no cache exists
  if (useFallback && start && end) {
    return (
      <Polyline 
        positions={[start, end]} 
        color={color} 
        weight={4} 
        opacity={0.3} 
        dashArray="5, 10" 
      />
    );
  }

  return null;
}
