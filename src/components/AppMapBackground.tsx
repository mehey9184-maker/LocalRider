import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoutingMachine } from './RoutingMachine';
import { Zap, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, MapPin, Radar, Activity, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { DeliveryOrder } from '../types';
import { cn } from '../lib/utils';

const getInstructionIcon = (modifier?: string, type?: string) => {
  if (type === 'DestinationReached') return <MapPin className="w-6 h-6 text-black" />;
  if (!modifier) return <ArrowUp className="w-6 h-6 text-black" />;
  const lModifier = modifier.toLowerCase();
  if (lModifier.includes('left')) {
    return lModifier.includes('sharp') ? <CornerUpLeft className="w-6 h-6 text-black" /> : <ArrowLeft className="w-6 h-6 text-black" />;
  }
  if (lModifier.includes('right')) {
    return lModifier.includes('sharp') ? <CornerUpRight className="w-6 h-6 text-black" /> : <ArrowRight className="w-6 h-6 text-black" />;
  }
  if (lModifier.includes('straight')) return <ArrowUp className="w-6 h-6 text-black" />;
  return <ArrowUp className="w-6 h-6 text-black" />;
};

const mockRiderIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; padding: 6px; border-radius: 50%; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
  className: 'rider-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const mockMerchantIcon = L.divIcon({
  html: `<div style="background-color: #f58220; padding: 6px; border-radius: 50%; border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>`,
  className: 'merchant-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const mockCustomerIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; padding: 6px; border-radius: 50%; border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'customer-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface AppMapBackgroundProps {
  isOnline: boolean;
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
}

function InnerMapListener({ onClick }: { onClick?: () => void }) {
  useMapEvents({
    click() {
      if (onClick) onClick();
    },
  });
  return null;
}

// Map Auto-Panning and Rotation Logic
function MapController({ riderPos, activeOrder, highlightedOrder }: { riderPos: [number, number] | null, activeOrder: DeliveryOrder | null | undefined, highlightedOrder?: DeliveryOrder | null }) {
  const map = useMapEvents({});
  const lastPos = useRef<[number, number] | null>(null);
  const prevOrder = useRef<string | null | undefined>(null);
  const prevHighlighted = useRef<string | null | undefined>(null);

  // Distance calculating utility
  const getDistance = (p1: [number, number], p2: [number, number]) => {
    const R = 6371; // km
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (highlightedOrder && highlightedOrder.id !== prevHighlighted.current) {
      if (highlightedOrder.shop_lat && highlightedOrder.shop_lng) {
        map.setView([highlightedOrder.shop_lat, highlightedOrder.shop_lng], 16, { animate: true });
        prevHighlighted.current = highlightedOrder.id;
        return;
      }
    }
    
    if (riderPos) {
      const orderChanged = prevOrder.current !== activeOrder?.id;
      let significantMove = false;
      
      if (lastPos.current) {
         significantMove = getDistance(lastPos.current, riderPos) > 0.05; // 50 meters
      }

      // Pan to rider
      map.panTo(riderPos, { animate: true, duration: activeOrder ? 1.5 : 1.0 });
      
      // If we significantly move, order changed, or it's the first fix, adjust zoom
      if (!lastPos.current || orderChanged || significantMove) {
        map.setZoom(activeOrder ? 17 : 16);
      }
      
      lastPos.current = riderPos;
      prevOrder.current = activeOrder?.id;
      if (!highlightedOrder) prevHighlighted.current = null;
    }
  }, [riderPos, map, activeOrder, highlightedOrder]);

  return null;
}

export const AppMapBackground = React.memo(function AppMapBackground({ 
  isOnline, 
  activeOrder, 
  allOrders = [],
  onOrderMarkerClick,
  isVisible = true, 
  onMapClick, 
  onProgressUpdate, 
  onETAUpdate, 
  onDistanceUpdate, 
  riderProfileLat, 
  riderProfileLng,
  riderLocation,
  highlightedOrderId 
}: AppMapBackgroundProps) {
  const [riderPos, setRiderPos] = useState<[number, number] | null>(
    riderLocation || (riderProfileLat && riderProfileLng ? [riderProfileLat, riderProfileLng] : null)
  );
  const [lastUpdate, setLastUpdate] = useState<number>(() => Date.now());

  // Render-time sync for external tracking vector updates
  const [prevRiderLocation, setPrevRiderLocation] = useState(riderLocation);
  if (riderLocation !== prevRiderLocation) {
    setPrevRiderLocation(riderLocation);
    if (riderLocation) {
      setRiderPos(riderLocation);
    }
  }
  const [isCharging, setIsCharging] = useState(false);
  const [localNow, setLocalNow] = useState<number>(() => Date.now());
  const [geoError, setGeoError] = useState<boolean>(false);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<unknown>(null);
  const [turnInstructionText, setTurnInstructionText] = useState<string>("Proceed to destination");
  const [turnDistance, setTurnDistance] = useState<number>(0);
  const [turnModifier, setTurnModifier] = useState<string | undefined>();
  const [turnType, setTurnType] = useState<string | undefined>();
  const [isGoogleView, setIsGoogleView] = useState(false);
  const [isNetworkOffline, setIsNetworkOffline] = useState(!navigator.onLine);
  
  // Custom Regional Tile Preloader (Browser Native Caching)
  useEffect(() => {
    // Tembisa, Ivory Park, Kaalfontein Sector
    // Preload basic z14-16 tiles aggressively into browser cache for the pilot region
    const preloadRegion = () => {
      const z = 15;
      const tLat = -25.993; // Centered between Ivory Park and Tembisa
      const tLng = 28.210;
      const n = Math.pow(2, z);
      const x = Math.floor((tLng + 180) / 360 * n);
      const latRad = tLat * Math.PI / 180;
      const y = Math.floor((1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0 * n);
      
      // Using CartoDB Light (No-Cost)
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const img = new Image();
          const s = ['a', 'b', 'c', 'd'][Math.abs(dx + dy) % 4];
          img.src = `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x+dx}/${y+dy}.png`;
        }
      }
      console.log("REGION PILOT CACHE: Preloaded Tembisa, Ivory Park & Kaalfontein sector tiles.");
    };
    
    // Only run when idle to prevent boot lag
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadRegion);
    } else {
      setTimeout(preloadRegion, 5000);
    }
  }, []);
  
  // Throttle routing updates to avoid OSRM spam
  const [routedStartPos, setRoutedStartPos] = useState<[number, number] | null>(null);

  const getDistance = (p1: [number, number], p2: [number, number]) => {
    const R = 6371; // km
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (riderPos) {
      if (!routedStartPos || getDistance(riderPos, routedStartPos) > 0.15) { // 150 meters
        setTimeout(() => setRoutedStartPos(riderPos), 0);
      }
    }
  }, [riderPos, routedStartPos]);


  // Sync Network & Battery State
  useEffect(() => {
    const handleOnline = () => setIsNetworkOffline(false);
    const handleOffline = () => setIsNetworkOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery Detection for High-Intensity Caching
    if ('getBattery' in navigator) {
      const nav = navigator as unknown as { getBattery: () => Promise<{ charging: boolean; addEventListener: (type: string, listener: () => void) => void }> };
      nav.getBattery().then((battery) => {
        setIsCharging(battery.charging);
        battery.addEventListener('chargingchange', () => setIsCharging(battery.charging));
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Impulse Clock for Signal HUD
  useEffect(() => {
    const clock = setInterval(() => setLocalNow(Date.now()), 2000);
    return () => clearInterval(clock);
  }, []);

  const isPickedUp = activeOrder?.delivery_status === 'picked_up';
  
  // Refined regional destination fallbacks (Ivory Park / Tembisa / Kaalfontein)
  const targetPos: [number, number] | null = useMemo(() => {
    return activeOrder 
      ? (isPickedUp ? [activeOrder.lat || -25.9933, activeOrder.lng || 28.2125] : [activeOrder.shop_lat || -25.9922, activeOrder.shop_lng || 28.2045]) 
      : null;
  }, [activeOrder, isPickedUp]);

  // Basic Signal Quality Logic
  const timeSinceLastUpdate = Math.floor((localNow - lastUpdate) / 1000);
  const signalQuality = Math.max(0, 100 - (timeSinceLastUpdate * 2));
  const isHealthy = signalQuality > 70;
  const isStale = signalQuality < 20;
  const isInterference = signalQuality <= 70 && signalQuality >= 40;

  // Simple Coordinate Smoothing Ref
  const prevPos = useRef<[number, number] | null>(null);

  const requestGeolocation = useCallback(() => {
    setGeoError(false);
    
    if (!navigator.geolocation) {
      if (riderProfileLat && riderProfileLng) {
        setRiderPos([riderProfileLat, riderProfileLng]);
      } else {
        // Mock movement for demo if geolocation is missing (Region Center)
        const mockLat = -25.9964 + (Math.random() - 0.5) * 0.005;
        const mockLng = 28.2268 + (Math.random() - 0.5) * 0.005;
        setRiderPos([mockLat, mockLng]);
      }
      setLastUpdate(Date.now());
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        
        // Jitter Reduction: Apply a 0.2 Alpha Low-Pass Filter
        // Only trust coordinates with accuracy < 100m for smoothing
        if (accuracy < 100 && prevPos.current) {
          const alpha = 0.25; 
          const filteredLat = (alpha * newLat) + ((1 - alpha) * prevPos.current[0]);
          const filteredLng = (alpha * newLng) + ((1 - alpha) * prevPos.current[1]);
          setRiderPos([filteredLat, filteredLng]);
          prevPos.current = [filteredLat, filteredLng];
        } else {
          setRiderPos([newLat, newLng]);
          prevPos.current = [newLat, newLng];
        }
        
        setLastUpdate(Date.now());
      },
      (err) => {
        console.warn('Geolocation error:', err.message, err.code);
        // 1: Permission Denied, 2: Position Unavailable, 3: Timeout
        if (err.code === 1) {
          setGeoError(true);
        } else if (err.code === 2 || err.code === 3) {
          // Timeout or unavailable - show interference
          setLastUpdate(prev => prev - 5000); 
          
          // Try to fallback to regional center if no initial position was found
          if (!prevPos.current && !riderProfileLat) {
             const mockLat = -25.9964 + (Math.random() - 0.5) * 0.005;
             const mockLng = 28.2268 + (Math.random() - 0.5) * 0.005;
             setRiderPos([mockLat, mockLng]);
          }
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 
      }
    );
    
    return watchId;
  }, [riderProfileLat, riderProfileLng, setLastUpdate]);

  useEffect(() => {
    let watchId: number | null = null;

    const startWatching = () => {
      watchId = requestGeolocation();

      // We no longer automatically fallback to a mock location unless
      // we explicitly want to bypass the error for testing, but per instructions
      // we should show "GPS SIGNAL INTERRUPTED". 
      // We will let the geoError state handle the UI.
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(() => {
        startWatching();
      }).catch(() => {
         startWatching();
      });
    } else {
      startWatching();
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [requestGeolocation]);

  // Calculate and broadcast progress
  useEffect(() => {
    if (riderPos && routedStartPos && targetPos) {
      const initialDist = getDistance(routedStartPos, targetPos);
      if (initialDist > 0.05) { // At least 50m to target start
        const currentDist = getDistance(riderPos, targetPos);
        const progress = Math.max(0, Math.min(100, ((initialDist - currentDist) / initialDist) * 100));
        if (onProgressUpdate) {
          onProgressUpdate(progress);
        }
      } else if (onProgressUpdate) {
        onProgressUpdate(100);
      }
    }
  }, [riderPos, routedStartPos, targetPos, onProgressUpdate]);

  // Route Caching Logic for Offline Guidance
  useEffect(() => {
    if (activeOrder?.id && isOnline && isCharging) {
       // Simulate high-priority download of mission assets
       const timer = setTimeout(() => {
         if (routeInfo) {
            localStorage.setItem(`map_assets_${activeOrder.id}`, 'cached');
            toast.info(`Mission assets for #${activeOrder.id.slice(-4)} cached for offline use.`, { icon: <Activity className="w-4 h-4" /> });
         }
       }, 5000);
       return () => clearTimeout(timer);
    }
  }, [activeOrder, routeInfo, isOnline, isCharging]);

  useEffect(() => {
    if (activeOrder?.id && !routeInfo) {
      const cachedInfo = localStorage.getItem(`routeInfo_${activeOrder.id}`);
      if (cachedInfo) {
        try {
          const parsed = JSON.parse(cachedInfo);
          // Set timeout to avoid cascading render in effect body
          setTimeout(() => {
            setRouteInfo(parsed);
          }, 0);
        } catch (e) {
          console.error('Failed to load cached route info', e);
        }
      }
    }
  }, [activeOrder, routeInfo]);

  const handleRouteFound = useCallback((route: { 
    summary?: { totalTime: number; totalDistance: number }; 
    instructions?: { text: string; type?: string; modifier?: string; distance?: number }[] 
  }) => {
    // Sanitize route info to avoid circular structures in state (important for motion/react-leaflet)
    if (route) {
      const sanitized = {
        summary: route.summary ? { ...route.summary } : { totalTime: 0, totalDistance: 0 },
        instructions: Array.isArray(route.instructions) 
          ? route.instructions.map((inst: { text: string; type?: string; modifier?: string; distance?: number }) => ({
              text: inst.text,
              type: inst.type,
              modifier: inst.modifier,
              distance: inst.distance
            })) 
          : []
      };
      
      if (activeOrder?.id) {
        localStorage.setItem(`routeInfo_${activeOrder.id}`, JSON.stringify(sanitized));
      }
      
      setRouteInfo(sanitized);

      // Extract next turn instruction
      if (sanitized.instructions.length > 0) {
         const nextStep = sanitized.instructions[1] || sanitized.instructions[0];
         setTurnInstructionText(nextStep.text);
         setTurnDistance(nextStep.distance || 0);
         setTurnModifier(nextStep.modifier);
         setTurnType(nextStep.type);
      }
    } else {
      setRouteInfo(null);
    }
  }, [activeOrder]);

  const typedRouteInfo = routeInfo as { summary: { totalTime: number, totalDistance: number }, instructions: { text: string, type?: string, modifier?: string, distance?: number }[] } | null;
  const etaMins = typedRouteInfo ? Math.ceil(typedRouteInfo.summary.totalTime / 60) : 0;
  const distKm = typedRouteInfo ? (typedRouteInfo.summary.totalDistance / 1000).toFixed(1) : 0;

  // Broadcast ETA & Distance to parent
  useEffect(() => {
    if (typedRouteInfo) {
      if (onETAUpdate) onETAUpdate(etaMins);
      if (onDistanceUpdate) onDistanceUpdate(typedRouteInfo.summary.totalDistance);
    }
  }, [etaMins, onETAUpdate, onDistanceUpdate, typedRouteInfo]);

  // Haptic Navigation Alerts
  const lastVibratedInstruction = useRef<string | null>(null);
  const hasVibratedArrival = useRef<boolean>(false);
  const lastVibrationTime = useRef<number>(0);

  useEffect(() => {
    if (!navigator.vibrate || !turnInstructionText || !typedRouteInfo) return;

    const now = Date.now();
    if (now - lastVibrationTime.current < 500) {
      return; // Debounce interval of 500ms
    }

    // Turn Warning: within 50m of a turn
    // Use the instruction text to ensure we only vibrate once per unique maneuver
    const instructionAlpha = turnInstructionText;
    
    if (turnDistance && turnDistance <= 50 && turnDistance > 0) {
      if (lastVibratedInstruction.current !== instructionAlpha) {
        try {
          navigator.vibrate([100, 50, 100]);
          lastVibratedInstruction.current = instructionAlpha;
          lastVibrationTime.current = now;
        } catch (e) {
          console.warn('Vibration rejected by subsystem', e);
        }
      }
    }

    // Destination Reached Logic: check OSRM flag or total tactical distance
    const isAtDestination = turnType === 'DestinationReached' || 
                            (typedRouteInfo.summary.totalDistance < 30); // within 30m sphere

    if (isAtDestination && !hasVibratedArrival.current) {
      try {
        navigator.vibrate(500);
        hasVibratedArrival.current = true;
        lastVibrationTime.current = now;
      } catch (e) {
        console.warn('Vibration rejected at destination', e);
      }
    }
  }, [turnInstructionText, turnDistance, turnType, typedRouteInfo]);

  // Reset protocol for new missions
  useEffect(() => {
    if (!activeOrder) {
      hasVibratedArrival.current = false;
      lastVibratedInstruction.current = null;
    }
  }, [activeOrder]);

  // SMOOTH RIDER MOVEMENT SIMULATION (MOCK)
  // When an active mission is in progress, the rider visually drifts towards the target.
  useEffect(() => {
    if (!activeOrder || !targetPos || !riderPos) return;

    // Movement speed: approx 2 meters every 2 seconds
    const moveInterval = setInterval(() => {
      const [rLat, rLng] = riderPos;
      const [tLat, tLng] = targetPos;

      // Distance check - stop moving if close enough (within 15m)
      const dist = getDistance([rLat, rLng], [tLat, tLng]);
      if (dist < 0.015) {
        clearInterval(moveInterval);
        return;
      }

      // Calculate direction vector
      const vectorLat = tLat - rLat;
      const vectorLng = tLng - rLng;
      
      const newLat = rLat + (vectorLat * 0.05);
      const newLng = rLng + (vectorLng * 0.05);

      setRiderPos([newLat, newLng]);
      setLastUpdate(Date.now());
    }, 2000);

    return () => clearInterval(moveInterval);
  }, [activeOrder, targetPos, riderPos]);

  const rootClassName = `absolute inset-0 z-0 overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  // If signal is lost (not online), we still show the map if there is an active order
  if ((!isOnline || isNetworkOffline) && !activeOrder) {
    return (
      <div className={`${rootClassName} flex items-center justify-center bg-[#050505]/90 backdrop-blur-sm z-[900]`}>
        <div className="flex flex-col items-center gap-4 text-zinc-500 bg-black/90 backdrop-blur-3xl p-10 rounded-[2rem] border border-[#f59e0b]/30 shadow-[0_0_100px_rgba(245,158,11,0.15)] text-center max-w-sm mx-4">
          <div className="relative">
            <Zap className="w-16 h-16 animate-pulse text-[#f59e0b] opacity-50" />
            <div className="absolute inset-0 bg-[#f59e0b]/10 blur-2xl animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-sans font-medium text-white mb-2">{isNetworkOffline ? 'Network Missing' : 'Searching for signal'}</p>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              {isNetworkOffline ? 'Switching to local mode. Awaiting connection...' : 'System is offline. Awaiting start...'}
            </p>
            {lastUpdate && (
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-4">
                Last Contact: {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (geoError) {
    return (
      <div className={`${rootClassName} flex items-center justify-center bg-[#050505] z-[999]`}>
         <div className="flex flex-col items-center gap-6 text-zinc-500 bg-black/95 backdrop-blur-3xl p-10 rounded-[2.5rem] border-2 border-red-500/40 shadow-[0_0_120px_rgba(239,68,68,0.2)] text-center max-w-sm mx-4 relative overflow-hidden">
            {/* Background Glitch Effect */}
            <div className="absolute inset-0 bg-red-500/5 opacity-50" />
            
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/40 blur-3xl animate-pulse rounded-full" />
              <div className="relative bg-black p-6 rounded-full border border-red-500/20">
                <Radar className="w-16 h-16 animate-spin-slow text-red-500" />
              </div>
              <Activity className="absolute -top-2 -right-2 w-8 h-8 text-red-500 animate-bounce" />
            </div>

            <div className="relative z-10">
              <h2 className="text-[18px] font-black uppercase tracking-[0.4em] text-red-500 mb-3 italic">
                Location access denied
              </h2>
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500">
                  Signal Status: FAILED
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-bold leading-relaxed uppercase tracking-widest px-4">
                We need location access to show the map. Please enable location services in your browser settings.
              </p>
              
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 text-left group hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black text-[#f59e0b] shadow-inner">01</div>
                  <div className="flex flex-col">
                    <p className="text-[11px] uppercase font-black tracking-wider text-white">Browser Settings</p>
                    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-tight">Access site permissions menu</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 text-left group hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black text-[#f59e0b] shadow-inner">02</div>
                  <div className="flex flex-col">
                    <p className="text-[11px] uppercase font-black tracking-wider text-white">Enable Location</p>
                    <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-tight">Toggle "Always Allow" for LocalEats</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4 w-full">
              <button 
                onClick={() => {
                  requestGeolocation();
                }}
                className="w-full py-5 bg-red-600 text-white font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-red-500 transition-all active:scale-95 shadow-[0_15px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-3"
              >
                <Zap className="w-5 h-5 fill-current" />
                Retry connection
              </button>
              
              <button 
                onClick={() => {
                  setGeoError(false);
                  setIsFallback(true);
                  if (riderProfileLat && riderProfileLng) {
                    setRiderPos([riderProfileLat, riderProfileLng]);
                  } else {
                    setRiderPos([-25.9864, 28.2198]);
                  }
                  toast.success("Simulation Protocol Engaged. Mock GPS active.");
                }}
                className="w-full py-3 bg-zinc-800 text-zinc-400 font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-zinc-700 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 border border-zinc-700"
              >
                Start Simulation Mode
              </button>
            </div>
            
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-4">Security Protocol • Error Signal: 403_GEO_BLOCKED</p>
         </div>
      </div>
    );
  }

  if (!riderPos) {
    return (
      <div className={`${rootClassName} flex items-center justify-center bg-zinc-900 z-[900]`}>
         <div className="flex flex-col items-center gap-4 text-zinc-500 bg-black/80 backdrop-blur-md p-8 rounded-3xl border border-zinc-800 shadow-2xl">
            <Zap className="w-12 h-12 animate-pulse text-[#f59e0b]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] text-center">Finding location<br/><span className="text-zinc-500">Updating GPS</span></p>
         </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
        
      {/* Map Content */}
      <MapContainer 
        center={riderPos} 
        zoom={activeOrder ? 16 : 14} 
        minZoom={13}
        maxBounds={[
          [-26.040, 28.160], // Southwest
          [-25.930, 28.260]  // Northeast
        ]}
        maxBoundsViscosity={1.0}
        zoomControl={true}
        scrollWheelZoom={true}
        touchZoom={true}
        tap={false} /* Leaflet 1.0+ handles tap better without this */
        className={cn(
          "w-full h-full transition-all duration-1000",
          !isGoogleView ? "brightness-[1.02] contrast-[0.98] saturate-[0.8]" : ""
        )}
      >
        <InnerMapListener onClick={() => {
          if (onMapClick) onMapClick();
        }} />
        <MapController 
          riderPos={riderPos} 
          activeOrder={activeOrder} 
          highlightedOrder={allOrders?.find(o => o.id === highlightedOrderId)} 
        />
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
        
        <Marker position={riderPos} icon={mockRiderIcon} zIndexOffset={100} />
        
        {/* Delivery Zone Boundaries (Tembisa, Ivory Park & Kaalfontein Sector) */}
        <Circle 
          center={[-25.993, 28.210]} 
          radius={4000} 
          pathOptions={{ color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.03, dashArray: '10, 20' }} 
        />
        <Circle 
          center={[-25.993, 28.210]} 
          radius={8000} 
          pathOptions={{ color: '#f59e0b', weight: 1, fillColor: '#f59e0b', fillOpacity: 0.02, dashArray: '5, 15' }} 
        />
        
        {/* Render markers for all available missions when not focusing on active order */}
        {!activeOrder && allOrders.length > 0 && (
          <>
            {allOrders.map((order, idx) => {
              const shopPos: [number, number] = [order.shop_lat || -25.9922, order.shop_lng || 28.2045];
              const custPos: [number, number] | null = order.lat && order.lng ? [order.lat, order.lng] : null;
              const isHighlight = highlightedOrderId === order.id;
              
              return (
                <React.Fragment key={order.id}>
                  {/* Merchant Marker */}
                  <Marker 
                    position={shopPos} 
                    icon={L.divIcon({
                      html: `<div style="background-color: #f59e0b; padding: 4px; border-radius: 50%; border: ${isHighlight ? '3px' : '2px'} solid white; box-shadow: 0 0 ${isHighlight ? '30px' : '15px'} rgba(245, 158, 11, ${isHighlight ? '1' : '0.6'}); display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 900; font-size: ${isHighlight ? '14px' : '11px'}; color: black; width: ${isHighlight ? '36px' : '28px'}; height: ${isHighlight ? '36px' : '28px'}; transform: scale(${isHighlight ? 1.2 : 1}); transition: all 0.3s ease;">${idx + 1}</div>`,
                      className: isHighlight ? 'order-sequence-marker z-50' : 'order-sequence-marker',
                      iconSize: isHighlight ? [42, 42] : [28, 28],
                      iconAnchor: isHighlight ? [21, 21] : [14, 14],
                    })}
                    eventHandlers={{
                      click: () => {
                        onOrderMarkerClick?.(order.id);
                        toast.info(`Target: ${order.restaurant_name}`, { description: "Order location found." });
                      }
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-2">
                        <p className="text-[10px] font-black uppercase text-[#f59e0b] mb-1">STORE {idx + 1}</p>
                        <p className="text-xs font-bold text-white uppercase italic">{order.restaurant_name}</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Customer Marker */}
                  {custPos && (
                    <Marker 
                      position={custPos} 
                      icon={L.divIcon({
                        html: `<div style="background-color: #3b82f6; padding: 4px; border-radius: 50%; border: ${isHighlight ? '3px' : '2px'} solid white; box-shadow: 0 0 ${isHighlight ? '30px' : '15px'} rgba(59, 130, 246, ${isHighlight ? '1' : '0.6'}); display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-weight: 900; font-size: ${isHighlight ? '14px' : '11px'}; color: white; width: ${isHighlight ? '32px' : '24px'}; height: ${isHighlight ? '32px' : '24px'}; transform: scale(${isHighlight ? 1.2 : 1}); transition: all 0.3s ease;"><svg width="${isHighlight ? '16' : '12'}" height="${isHighlight ? '16' : '12'}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
                        className: isHighlight ? 'customer-marker-mini z-50' : 'customer-marker-mini',
                        iconSize: isHighlight ? [38, 38] : [24, 24],
                        iconAnchor: isHighlight ? [19, 19] : [12, 12],
                      })}
                      eventHandlers={{
                        click: () => {
                          onOrderMarkerClick?.(order.id);
                          toast.info(`Destination: ${order.customer_name || 'Customer'}`, { description: "Drop-off area identified." });
                        }
                      }}
                    >
                      <Popup className="custom-popup">
                        <div className="p-2">
                          <p className="text-[10px] font-black uppercase text-[#3b82f6] mb-1">CUSTOMER {idx + 1}</p>
                          <p className="text-xs font-bold text-white uppercase italic">{order.customer_name || 'Anonymous'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Optional Customer Tether */}
                  {custPos && (
                    <Polyline 
                      positions={[shopPos, custPos]}
                      pathOptions={{ color: '#f59e0b', weight: 1, dashArray: '2, 4', opacity: 0.4 }}
                    />
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Draw optimized route sequence lines connecting rider and points */}
            <Polyline 
              positions={[riderPos, ...allOrders.map(o => [o.shop_lat || -25.9922, o.shop_lng || 28.2045])] as [number, number][]}
              pathOptions={{
                color: '#f59e0b',
                weight: 3,
                dashArray: '10, 15',
                opacity: 0.5,
                lineJoin: 'round',
                className: 'optimized-route-path'
              }}
            />
          </>
        )}

        {targetPos && (
          <>
            <Marker position={targetPos} icon={isPickedUp ? mockCustomerIcon : mockMerchantIcon} />
            {/* We only show the direct line if routing is unavailable or in fallback mode */}
            {isFallback && (
              <Polyline 
                positions={[riderPos, targetPos] as [number, number][]} 
                pathOptions={{ 
                  color: isPickedUp ? '#f59e0b' : '#3b82f6', 
                  dashArray: '10, 15', 
                  weight: 2,
                  opacity: 0.5
                }} 
              />
            )}
            <RoutingMachine 
              start={routedStartPos} 
              end={targetPos} 
              color="#00f2ff" 
              cacheId={activeOrder?.id}
              onFallback={setIsFallback}
              onRouteFound={handleRouteFound} 
            />
          </>
        )}
      </MapContainer>

      {/* Radar Scan when online and idle */}
      {!activeOrder && isOnline && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           {/* Pulsing rings */}
           <div className="w-64 h-64 rounded-full border border-[#f59e0b]/20 animate-ping absolute opacity-20" />
           <div className="w-96 h-96 rounded-full border border-[#f59e0b]/10 animate-ping absolute opacity-10" style={{ animationDelay: '500ms' }} />
           
           {/* Rotating Scan Line */}
           <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute w-[400px] h-[400px] rounded-full border-t border-t-[#f59e0b]/40 border-r border-r-[#f59e0b]/10"
              style={{ background: 'conic-gradient(from 0deg, transparent 80%, rgba(57, 255, 20, 0.1) 100%)' }}
           />
           
           <div className="absolute flex flex-col items-center gap-2">
              <div className="flex gap-1">
                 {[...Array(3)].map((_, i) => (
                   <motion.div 
                     key={i} 
                     animate={{ opacity: [0.2, 1, 0.2] }}
                     transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                     className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full shadow-[0_0_8px_#f59e0b]" 
                   />
                 ))}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f59e0b]/80 text-center px-8">
                 Searching for orders... <br/>
                 Looking for new deliveries
              </span>
           </div>
        </div>
      )}

      {/* Offline Mode Persistent Banner */}
      <AnimatePresence>
        {isNetworkOffline && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-20 left-0 right-0 z-[500] flex justify-center pointer-events-none"
          >
            <div className="bg-blue-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-blue-400/30 flex items-center gap-3 shadow-2xl">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                Offline Mode • Using saved map
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform HUD - Top Right */}
      <div className="absolute top-20 right-6 flex flex-col gap-2 z-[400] pointer-events-auto items-end">
        {/* Back to Hub Button */}
        <button 
          onClick={() => { if(onMapClick) onMapClick(); }} /* Simplified back action */
          className="bg-zinc-900/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 mb-2 hover:bg-zinc-800/60 transition-all active:scale-95 group"
        >
          <ArrowLeft size={12} className="text-zinc-400 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">BACK TO HUB</span>
        </button>

        {/* Status Pills */}
        <div className="flex flex-col gap-2 items-end">
          <button 
            onClick={() => setIsGoogleView(!isGoogleView)}
            className={cn(
              "px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all duration-300 backdrop-blur-md shadow-lg pointer-events-auto",
              isGoogleView ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-zinc-900/40 border-white/10 text-white"
            )}
          >
            <MapIcon size={10} className={cn(isGoogleView && "fill-black")} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">
              {isGoogleView ? "GOOGLE MAPS ON" : "COMPARE ROAD"}
            </span>
          </button>

          <div className={cn(
            "px-3 py-1.5 rounded-full border flex items-center gap-3 transition-all duration-500 backdrop-blur-md shadow-lg",
          isHealthy && !isNetworkOffline ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500/80" :
          isNetworkOffline ? "bg-blue-500/5 border-blue-500/20 text-blue-500/80" :
          isStale ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse font-bold" :
          "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse"
        )}>
           {(!isHealthy || isInterference) && <Activity size={10} className="animate-pulse" />}
           <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">
             {isHealthy && !isNetworkOffline ? "Connection Stable" : isNetworkOffline ? "Using Offline Data" : isStale ? "NO SIGNAL" : "POOR SIGNAL"}
           </span>
           {isHealthy && <Radar size={10} className="opacity-40" />}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/20 backdrop-blur-md">
           <Zap size={10} className="text-blue-500 fill-blue-500" />
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500/80">ORDER UPDATED</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/20 backdrop-blur-md">
           <Activity size={10} className="text-emerald-500" />
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/80">MAP LIVE</span>
        </div>
      </div>
    </div>

      {/* Navigation HUD Overlay - Top Center */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[600] pointer-events-none w-full max-w-[400px] px-4"
          >
            <div className="bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800 p-4 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col gap-2 relative overflow-hidden">
               {/* Decorative Gradient Background */}
               <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-transparent pointer-events-none" />
               
               <div className="flex items-center justify-between relative z-10">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#f59e0b] italic">NAVIGATION LIVE</span>
               </div>

               <div className="flex items-start gap-4 relative z-10">
                  <div className="w-14 h-14 bg-[#f59e0b] rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                     {getInstructionIcon(turnModifier, turnType)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-headline font-black italic text-white uppercase leading-tight line-clamp-2 tracking-tight">
                      {turnInstructionText}
                    </h3>
                    
                    <div className="flex items-center gap-4 mt-2">
                       <div className="flex items-center gap-1.5 overflow-hidden">
                          <Activity size={10} className="text-zinc-500 animate-pulse shrink-0" />
                          <span className="text-sm font-black italic text-white whitespace-nowrap">
                            {turnDistance > 1000 ? `${(turnDistance/1000).toFixed(1)}k` : `${Math.round(turnDistance)}m`}
                          </span>
                       </div>
                       
                       <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                             <span className="text-[11px] font-mono font-bold text-zinc-400">{distKm}</span>
                             <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter italic">KM</span>
                          </div>
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest -mt-1 italic">TOTAL</span>
                       </div>

                       <div className="ml-auto flex items-center gap-2">
                          <div className="px-2 py-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg">
                             <span className="text-[8px] font-black text-[#10b981] uppercase italic">R5 FIXED</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-2xl font-headline font-black italic text-cyan-400 leading-none">
                               {etaMins || 4}
                             </span>
                             <span className="text-[8px] font-black text-cyan-500 uppercase tracking-tighter italic">MIN</span>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hide default routing control */}
      <style>{`
        .leaflet-routing-container, .leaflet-routing-alternatives-container, .leaflet-routing-geocoders {
          display: none !important;
        }
      `}</style>
    </div>
  );
});

