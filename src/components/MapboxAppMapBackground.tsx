import React, { useState, useMemo, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Navigation, Compass, Map as MapIcon } from 'lucide-react';
import useSupercluster from 'use-supercluster';
import { DeliveryOrder } from '../types';
import { CARTO_DARK_RASTER, CARTO_LIGHT_RASTER } from '../lib/mapStyles';

const useWeatherService = (lat: number, lng: number) => {
  const [hasPrecipitation, setHasPrecipitation] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
        const data = await res.json();
        // WMO code 51 and above generally indicate precipitation (drizzle, rain, snow, etc)
        const code = data?.current_weather?.weathercode || 0;
        if (code >= 51) {
          setHasPrecipitation(true);
        } else {
          setHasPrecipitation(false);
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
      }
    };
    fetchWeather();
    
    const interval = setInterval(fetchWeather, 300000); // 5 mins
    return () => clearInterval(interval);
  }, [lat, lng]);

  return hasPrecipitation;
};

const EMPTY_ORDERS_ARRAY: DeliveryOrder[] = [];

export const AppMapBackground = React.memo(function AppMapBackground({
  activeOrder,
  allOrders = EMPTY_ORDERS_ARRAY,
  onOrderMarkerClick,
  isVisible = true,
  onMapClick,
  onProgressUpdate,
  onETAUpdate,
  onDistanceUpdate,
  riderProfileLat,
  riderProfileLng,
  riderLocation,
  highlightedOrderId,
  highContrast,
  hideNavigationHUD,
}: {
  isOnline?: boolean;
  activeOrder?: DeliveryOrder | null;
  allOrders?: DeliveryOrder[];
  onOrderMarkerClick?: (id: string) => void;
  isVisible?: boolean;
  onMapClick?: () => void;
  onProgressUpdate?: (progress: number) => void;
  onETAUpdate?: (etaMinutes: number) => void;
  onDistanceUpdate?: (distanceMeters: number) => void;
  riderProfileLat?: number;
  riderProfileLng?: number;
  riderLocation?: [number, number] | null;
  highlightedOrderId?: string | null;
  hideNavigationHUD?: boolean;
  highContrast?: boolean;
}) {
  const mapRef = useRef<MapRef | null>(null);

  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem('localeats_force_offline') === 'true');

  useEffect(() => {
    const checkOffline = () => {
      const isOff = localStorage.getItem('localeats_force_offline') === 'true';
      if (isOff !== forceOffline) {
        setForceOffline(isOff);
      }
    };
    const interval = setInterval(checkOffline, 1000);
    window.addEventListener('storage', checkOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkOffline);
    };
  }, [forceOffline]);

  const [riderPos, setRiderPos] = useState<[number, number] | null>(
    riderLocation || (riderProfileLat && riderProfileLng ? [riderProfileLat, riderProfileLng] : [-25.9964, 28.2268])
  );

  const [routeCoordinates, setRouteCoordinates] = useState<number[][]>([]);
  const hasPrecipitation = useWeatherService(riderPos ? riderPos[0] : -25.9964, riderPos ? riderPos[1] : 28.2268);
  
  // Simulated GPS updater for demo
  useEffect(() => {
    if (riderLocation) {
      const timer = setTimeout(() => {
        setRiderPos(riderLocation);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [riderLocation]);

  const targetPos: [number, number] | null = useMemo(() => {
    if (!activeOrder) return null;
    return activeOrder.delivery_status === 'picked_up' 
      ? [activeOrder.lat || -25.9933, activeOrder.lng || 28.2125] 
      : [activeOrder.shop_lat || -25.9922, activeOrder.shop_lng || 28.2045];
  }, [activeOrder]);

  // Fetch Route from OSRM
  useEffect(() => {
    if (riderPos && targetPos && activeOrder) {
      const [rLat, rLng] = riderPos;
      const [tLat, tLng] = targetPos;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout
      
      const routingUrl = `https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${tLng},${tLat}?geometries=geojson&overview=full${forceOffline ? '&force_offline=true' : ''}`;
      
      fetch(routingUrl, {
        signal: controller.signal
      })
        .then(res => {
          clearTimeout(timeoutId);
          return res.json();
        })
        .then(data => {
          if (data.routes?.[0]?.geometry?.coordinates) {
            setRouteCoordinates(data.routes[0].geometry.coordinates);
            
            const distance = data.routes[0].distance; // in meters
            const duration = data.routes[0].duration; // in seconds
            
            if (onDistanceUpdate) onDistanceUpdate(distance);
            if (onETAUpdate) onETAUpdate(Math.ceil(duration / 60));
            if (onProgressUpdate) {
               // mock progress based on some threshold or just send 0, it updates linearly normally
               onProgressUpdate(10); 
            }
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          if (err.name !== 'AbortError' && err.message?.indexOf('abort') === -1) {
            console.warn("OSRM routing failed", err);
          }
          // Fallback to straight line
          setRouteCoordinates([[rLng, rLat], [tLng, tLat]]);
        });

      return () => {
        controller.abort();
        clearTimeout(timeoutId);
      };
    } else {
      const timer = setTimeout(() => {
        setRouteCoordinates([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [riderPos, targetPos, activeOrder, onDistanceUpdate, onETAUpdate, onProgressUpdate, forceOffline]);


  const [viewState, setViewState] = useState({
    longitude: riderPos?.[1] || 28.2268,
    latitude: riderPos?.[0] || -25.9964,
    zoom: 15,
    pitch: activeOrder ? 45 : 0, 
    bearing: activeOrder ? 0 : 0
  });

  const [isFollowing, setIsFollowing] = useState(true);
  const [riderBearing, setRiderBearing] = useState(0);
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>('follow');

  const speedRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const prevRiderPosRef = useRef<[number, number] | null>(null);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  useEffect(() => {
    if (activeOrder && riderPos && targetPos) {
       if (mapRef.current) {
          const now = Date.now();
          const lastUp = lastUpdateRef.current === 0 ? now : lastUpdateRef.current;
          const dt = (now - lastUp) / 1000;
          let speed = speedRef.current;
          
          if (prevRiderPosRef.current && dt > 0) {
            const distMoved = getDistance(prevRiderPosRef.current[0], prevRiderPosRef.current[1], riderPos[0], riderPos[1]);
            const currentSpeed = distMoved / dt;
            speed = speed * 0.7 + currentSpeed * 0.3; // smoothing
            speedRef.current = speed;

            if (distMoved > 0.5) {
               const lat1 = prevRiderPosRef.current[0] * Math.PI/180;
               const lon1 = prevRiderPosRef.current[1] * Math.PI/180;
               const lat2 = riderPos[0] * Math.PI/180;
               const lon2 = riderPos[1] * Math.PI/180;
               const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
               const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
               let brng = Math.atan2(y, x);
               brng = brng * 180 / Math.PI;
               setRiderBearing((brng + 360) % 360);
            }
          }
          
          lastUpdateRef.current = now;
          prevRiderPosRef.current = riderPos;

          if (isFollowing) {
            if (cameraMode === 'follow') {
              // 3D Immersive Follow Speed-Adaptive Zoom
              mapRef.current.easeTo({
                center: [riderPos[1], riderPos[0]],
                zoom: 18.0, // High-fidelity zoomed in street-level path view
                pitch: 62, // Slick 3D immersive tilt angle
                bearing: riderBearing, // Dynamically align route facing forward
                duration: 1000
              });
            } else {
              const distanceToNext = getDistance(riderPos[0], riderPos[1], targetPos[0], targetPos[1]);
              
              // Scale zoom parameters based on speed and distance
              const speedFactor = Math.min(speed / 15, 1); // Max factor at ~54km/h
              const dynamicPadding = 40 + (speedFactor * 60);
              
              let pitch = 0;
              if (distanceToNext < 1000) pitch = 30;
              if (distanceToNext < 500) pitch = 50;
              if (distanceToNext < 200) pitch = 65;

              const lats = [riderPos[0], targetPos[0]];
              const lngs = [riderPos[1], targetPos[1]];
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);

              mapRef.current.fitBounds(
                [[minLng, minLat], [maxLng, maxLat]],
                { 
                  padding: { top: dynamicPadding + 50, bottom: dynamicPadding + 150, left: dynamicPadding + 20, right: dynamicPadding + 20 }, 
                  duration: 1200, 
                  maxZoom: Math.max(13, 17.5 - (speedFactor * 2)), 
                  pitch 
                }
              );
            }
          }
       }
    } else if (highlightedOrderId) {
       const order = allOrders.find(o => o.id === highlightedOrderId);
       if (order && order.shop_lat && order.shop_lng && mapRef.current) {
           mapRef.current.flyTo({
             center: [order.shop_lng, order.shop_lat],
             zoom: 15,
             pitch: 0,
             duration: 1200
           });
       }
    }
  }, [riderPos, targetPos, activeOrder, highlightedOrderId, allOrders, cameraMode, isFollowing, riderBearing]);

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

  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);

  // Prepare points for clustering
  const points = useMemo(() => {
    return allOrders.filter(o => o.shop_lat && o.shop_lng).map(order => ({
      type: 'Feature',
      properties: { cluster: false, orderId: order.id, category: 'order' },
      geometry: {
        type: 'Point',
        coordinates: [order.shop_lng as number, order.shop_lat as number]
      }
    }));
  }, [allOrders]);

  const superclusterOptions = useMemo(() => ({ radius: 75, maxZoom: 15 }), []);
  const defaultBounds = useMemo<[number, number, number, number]>(() => [-180, -85, 180, 85], []);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bounds || defaultBounds,
    zoom: viewState.zoom,
    options: superclusterOptions
  });

  if (!riderPos) return null;

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState(evt.viewState);
          if (mapRef.current) {
            const b = mapRef.current.getBounds();
            if (b) {
              setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
            }
          }
        }}
        onDragStart={(e) => {
          if (e.originalEvent) {
             setIsFollowing(false);
          }
        }}
        onZoomStart={(e) => {
          if (e.originalEvent) {
             setIsFollowing(false);
          }
        }}
        onLoad={() => {
          if (mapRef.current) {
            const b = mapRef.current.getBounds();
            if (b) {
              setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
            }
          }
        }}
        onClick={(evt) => {
          const target = evt.originalEvent?.target as HTMLElement;
          const isCanvas = target && (
            target.tagName === 'CANVAS' || 
            target.classList.contains('maplibregl-canvas') || 
            target.classList.contains('maplibre-canvas') ||
            target.classList.contains('mapboxgl-canvas')
          );
          if (isCanvas && onMapClick) {
            onMapClick();
          }
        }}
        mapStyle={highContrast !== undefined 
          ? (highContrast ? CARTO_LIGHT_RASTER : CARTO_DARK_RASTER)
          : (localStorage.getItem('localeats_contrast') === 'true' 
            ? CARTO_LIGHT_RASTER
            : CARTO_DARK_RASTER)}
        attributionControl={false}
        className={(highContrast !== undefined ? highContrast : localStorage.getItem('localeats_contrast') === 'true') ? "brightness-[1.2] contrast-[1.1] saturate-[1.0]" : "brightness-[1.1] contrast-[0.95] saturate-[0.85]"}
        style={{ width: '100%', height: '100%' }}
        transformRequest={(url, resourceType) => {
          if (resourceType === 'Tile' && url.includes('basemaps.cartocdn.com')) {
            const forceOffline = localStorage.getItem('localeats_force_offline') === 'true';
            if (forceOffline) {
              return { url: `${url}?force_offline=true` };
            }
          }
          return { url };
        }}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
        >
          <NavigationControl position="top-right" />
        </div>
        
        {/* Tembisa High-Traffic Weather Impact Overlay */}
        <Source id="high-traffic-routes" type="geojson" data={{
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [[28.2045, -25.9922], [28.2268, -25.9964], [28.2450, -25.9850], [28.2580, -25.9995]] }
            },
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [[28.2100, -25.9800], [28.2200, -25.9950], [28.2300, -26.0100]] }
            }
          ]
        }}>
          {hasPrecipitation ? (
            <Layer 
              id="rain-routes-glow"
              type="line"
              paint={{
                'line-color': '#3b82f6',
                'line-width': 12,
                'line-blur': 10,
                'line-opacity': 0.8
              }}
            />
          ) : (
            <Layer 
              id="dry-routes"
              type="line"
              paint={{
                'line-color': '#10b981',
                'line-width': 4,
                'line-opacity': 0.2
              }}
            />
          )}
        </Source>

        {/* Draw the Route Line with Glow Effect */}
        {activeOrder && routeCoordinates.length > 0 && (
          <Source id="route-source" type="geojson" data={routeGeoJSON}>
            {/* Background Glow */}
            <Layer 
              id="route-line-glow"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#06b6d4', // Cyan
                'line-width': 10,
                'line-blur': 12,
                'line-opacity': 0.6
              }}
            />
            {/* Core Route Line */}
            <Layer 
              id="route-line"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#22d3ee', // Bright Cyan 
                'line-width': 4,
                'line-opacity': 1.0
              }}
            />
          </Source>
        )}

        {/* Destination Marker */}
        {targetPos && (
          <Marker longitude={targetPos[1]} latitude={targetPos[0]} anchor="bottom">
             <div className="relative flex flex-col justify-center items-center group cursor-pointer">
                <div className="absolute top-1 w-12 h-12 bg-amber-500 rounded-full opacity-30 blur-md animate-pulse"></div>
                <div className="bg-[#f59e0b] p-3 rounded-full border-2 border-white shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10 transition-transform group-hover:scale-110">
                   <MapPin className="text-black w-5 h-5 fill-current" />
                </div>
                <div className="w-1.5 h-1.5 bg-white rounded-full mt-1 shadow-md"></div>
             </div>
          </Marker>
        )}

        {/* Rider Icon */}
        <Marker longitude={riderPos[1]} latitude={riderPos[0]} anchor="center">
           <div 
             className="relative flex justify-center items-center cursor-pointer transition-transform hover:scale-110" 
             style={{ transform: `rotate(${riderBearing}deg)` }}
           >
              <div className="absolute w-14 h-14 bg-cyan-500 rounded-full opacity-20 blur-sm animate-ping"></div>
              <div className="absolute w-10 h-10 bg-cyan-400 rounded-full opacity-30 animate-pulse"></div>
              <div className="relative bg-zinc-900 p-2.5 rounded-full border-2 border-cyan-400 z-10 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                 <Navigation className="text-cyan-400 w-5 h-5 fill-cyan-400/20" />
              </div>
           </div>
        </Marker>

        {/* Other Orders / Clusters */}
        {!activeOrder && clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { cluster: isCluster, point_count: pointCount, orderId } = cluster.properties as any;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(cluster.id as number), 20);
                  if (mapRef.current) {
                    mapRef.current.easeTo({
                      center: [longitude, latitude],
                      zoom: expansionZoom,
                      duration: 500
                    });
                  }
                }}
              >
                <div 
                  className="bg-[#10b981] rounded-full border-2 border-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center font-bold text-white transition-transform hover:scale-110"
                  style={{ 
                    width: `${Math.max(40, 30 + (pointCount / points.length) * 20)}px`, 
                    height: `${Math.max(40, 30 + (pointCount / points.length) * 20)}px` 
                  }}
                >
                  {pointCount}
                </div>
              </Marker>
            );
          }

          return (
            <Marker key={`order-${orderId}`} longitude={longitude} latitude={latitude} anchor="bottom" onClick={(e) => {
               e.originalEvent.stopPropagation();
               if(onOrderMarkerClick) onOrderMarkerClick(orderId);
            }}>
              <div className="bg-[#10b981] w-8 h-8 rounded-full border-2 border-zinc-900 shadow-lg flex items-center justify-center font-bold text-xs text-white transition-transform hover:scale-110">
                1
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Map Legend Overlay */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopPropagation();
        }}
        className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs font-mono shadow-xl pointer-events-auto z-10"
      >
        <div className="flex items-center gap-3 mb-2">
           <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></div>
           <span className="text-zinc-300 tracking-tight">Active Order</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
           <span className="text-zinc-300 tracking-tight">Available Order</span>
        </div>
      </div>

      {/* Tembisa Offline Mode Active Indicator Badge */}
      {forceOffline && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          className="absolute top-14 right-4 bg-amber-950/90 backdrop-blur-md border border-[#f59e0b]/40 rounded-xl p-3 text-[10px] font-mono shadow-xl pointer-events-auto z-20 animate-pulse flex items-center gap-2 max-w-[220px]"
        >
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]"></span>
          </span>
          <div className="text-left leading-tight">
            <p className="font-black text-[#f59e0b] uppercase tracking-widest">OFFLINE DATA SAVE</p>
            <p className="text-[8.5px] text-zinc-400 mt-0.5 font-sans font-semibold leading-normal">Bypassing live cellular cells. Rendering from local map memory.</p>
          </div>
        </div>
      )}

      {/* Dynamic Camera Navigator Controls */}
      {activeOrder && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          className="absolute top-28 left-4 bg-zinc-950/80 backdrop-blur-md border border-cyan-500/30 p-1 rounded-full shadow-[0_4px_20px_rgba(34,211,238,0.15)] z-20 pointer-events-auto flex items-center gap-1"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopPropagation();
              setCameraMode('follow');
              setIsFollowing(true);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
              cameraMode === 'follow'
                ? 'bg-cyan-500 text-black font-black shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-3 h-3 transition-transform duration-500 group-hover:rotate-45" />
            3D Nav
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopPropagation();
              setCameraMode('overview');
              setIsFollowing(true);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
              cameraMode === 'overview'
                ? 'bg-cyan-500 text-black font-black shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            Overview
          </button>
        </div>
      )}

      {/* Recenter Button */}
      {!isFollowing && (activeOrder || true) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
            setIsFollowing(true);
            if (mapRef.current) {
              mapRef.current.easeTo({
                center: [riderPos[1], riderPos[0]],
                zoom: cameraMode === 'follow' ? 18.0 : 16,
                duration: 1000
              });
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
          }}
          className={`absolute ${hideNavigationHUD ? 'bottom-28 md:bottom-32' : 'bottom-6'} right-6 bg-zinc-900 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.3)] font-mono text-sm hover:bg-zinc-800 transition-all duration-300 z-20 flex items-center gap-2 pointer-events-auto group`}
        >
          <Navigation className="w-4 h-4 fill-cyan-400/20 group-hover:scale-110 transition-transform" style={{ transform: 'rotate(45deg)' }} />
          Recenter
        </button>
      )}
    </div>
  );
});
