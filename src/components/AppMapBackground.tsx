import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoutingMachine } from './RoutingMachine';
import { Zap, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, MapPin, Radar, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  html: `<div style="background-color: #22d3ee; padding: 6px; border-radius: 50%; box-shadow: 0 0 15px #22d3ee; border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
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
  isVisible?: boolean;
}

export function AppMapBackground({ isOnline, activeOrder, isVisible = true }: AppMapBackgroundProps) {
  const [riderPos, setRiderPos] = useState<[number, number] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(() => Date.now());
  const [lastKnownSync, setLastKnownSync] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [localNow, setLocalNow] = useState<number>(() => Date.now());
  const [geoError, setGeoError] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<unknown>(null);
  const [isNetworkOffline, setIsNetworkOffline] = useState(!navigator.onLine);

  // Sync Network & Battery State
  useEffect(() => {
    const handleOnline = () => setIsNetworkOffline(false);
    const handleOffline = () => setIsNetworkOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery Detection for High-Intensity Caching
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setIsCharging(battery.working);
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
  
  // Fake destination around Cape Town
  const targetPos: [number, number] | null = activeOrder 
    ? (isPickedUp ? [-33.9249, 18.4241] : [-33.9188, 18.4233]) 
    : null;

  // Basic Signal Quality Logic
  const timeSinceLastUpdate = Math.floor((localNow - lastUpdate) / 1000);
  const signalQuality = Math.max(0, 100 - (timeSinceLastUpdate * 8));
  const isHealthy = signalQuality > 70;
  const isStale = signalQuality < 40;
  const isInterference = signalQuality <= 70 && signalQuality >= 40;

  // Simple Coordinate Smoothing Ref
  const prevPos = useRef<[number, number] | null>(null);

  const requestGeolocation = useCallback(() => {
    setGeoError(false);
    
    if (!navigator.geolocation) {
      // Mock movement for demo if geolocation is missing
      const mockLat = -33.9188 + (Math.random() - 0.5) * 0.005;
      const mockLng = 18.4233 + (Math.random() - 0.5) * 0.005;
      setRiderPos([mockLat, mockLng]);
      setLastUpdate(Date.now());
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        
        // Jitter Reduction: Apply a 0.2 Alpha Low-Pass Filter if we have a previous position
        if (prevPos.current) {
          const alpha = 0.25; // Slightly more responsive
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
        // Permission Denied
        if (err.code === 1) {
          setGeoError(true);
        } else if (err.code === 3) {
          // Timeout - show interference but don't block
          setLastUpdate(prev => prev - 5000); // artificially degrade signal
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    
    return watchId;
  }, []);

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

  // Route Caching Logic for Offline Guidance
  useEffect(() => {
    if (activeOrder?.id && !routeInfo) {
      const cachedInfo = localStorage.getItem(`routeInfo_${activeOrder.id}`);
      if (cachedInfo) {
        try {
          setRouteInfo(JSON.parse(cachedInfo));
        } catch (e) {
          console.error('Failed to load cached route info', e);
        }
      }
    }
  }, [activeOrder?.id, routeInfo]);

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
    } else {
      setRouteInfo(null);
    }
  }, [activeOrder?.id]);

  const typedRouteInfo = routeInfo as { summary: { totalTime: number, totalDistance: number }, instructions: { text: string, type?: string, modifier?: string, distance?: number }[] } | null;
  const etaMins = typedRouteInfo ? Math.ceil(typedRouteInfo.summary.totalTime / 60) : 0;
  const distKm = typedRouteInfo ? (typedRouteInfo.summary.totalDistance / 1000).toFixed(1) : 0;
  
  // Extract custom instructions
  const currentInstruction = typedRouteInfo?.instructions?.[1] || typedRouteInfo?.instructions?.[0];
  const nextInstructionText = currentInstruction?.text || "Proceed to destination";

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
            <p className="text-sm font-sans font-medium text-white mb-2">{isNetworkOffline ? 'Network Missing' : 'Signal Lost'}</p>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              {isNetworkOffline ? 'Switching to local cache protocols. Awaiting uplink...' : 'System is offline. Awaiting activation...'}
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
              <h2 className="text-[18px] font-black uppercase tracking-[0.4em] text-red-500 mb-3 italic">Uplink Denied</h2>
              <p className="text-[11px] text-zinc-400 font-bold leading-relaxed uppercase tracking-widest px-4">
                Orbital positioning requires active authorization. Location services are restricted or signal is blocked by heavy interference.
              </p>
              
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 text-left">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black">01</div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-zinc-300">Open Browser Settings</p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 text-left">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black">02</div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-zinc-300">Allow "Location" for this site</p>
                </div>
              </div>
            </div>

            <button 
              onClick={requestGeolocation}
              className="mt-4 w-full py-5 bg-red-600 text-white font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-red-500 transition-all active:scale-95 shadow-[0_15px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-3"
            >
              <Zap className="w-5 h-5 fill-current" />
              Reset Connection
            </button>
            
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
            <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] text-center">Acquiring Lock<br/><span className="text-zinc-500">Orbital Positioning</span></p>
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
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''}`}
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
        />
        
        <Marker position={riderPos} icon={mockRiderIcon} zIndexOffset={100} />
        
        {targetPos && (
          <>
            <Marker position={targetPos} icon={isPickedUp ? mockCustomerIcon : mockMerchantIcon} />
            <Polyline 
              positions={[riderPos, targetPos] as [number, number][]} 
              pathOptions={{ 
                color: isPickedUp ? '#f59e0b' : '#3b82f6', 
                dashArray: '10, 15', 
                weight: 2,
                opacity: 0.8
              }} 
            />
            <RoutingMachine 
              start={riderPos} 
              end={targetPos} 
              color={isPickedUp ? '#f59e0b' : '#3b82f6'} 
              cacheId={activeOrder?.id}
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
                 SCANNING SECTOR [ALPHA]... <br/>
                 NO UNASSIGNED SIGNALS DETECTED
              </span>
           </div>
        </div>
      )}

      {/* Platform HUD */}
      <div className="absolute top-24 right-6 flex flex-col gap-2 z-[400] pointer-events-none items-end">
        <div className={cn(
          "px-3 py-1.5 rounded-full border flex items-center gap-3 transition-all duration-500 backdrop-blur-md shadow-lg",
          isHealthy && !isNetworkOffline ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
          isNetworkOffline ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
          isStale ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" :
          "bg-amber-500/10 border-amber-500/30 text-amber-500"
        )}>
          <div className="flex items-end gap-0.5 h-3">
             {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-0.5 rounded-full transition-all duration-300",
                    i === 0 ? "h-1" : i === 1 ? "h-1.5" : i === 2 ? "h-2" : "h-3",
                    (!isNetworkOffline && isHealthy) || 
                    (isNetworkOffline && i < 4) ||
                    (isInterference && i < 3) || 
                    (signalQuality > 20 && i < 2) || 
                    (signalQuality > 0 && i < 1)
                      ? "bg-current" : "bg-white/10"
                  )}
                />
             ))}
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">
            {isHealthy && !isNetworkOffline ? "Link Stable" : isNetworkOffline ? "Local Cache" : isStale ? "No Signal" : "Weak Uplink"}
          </span>
          <Radar size={10} className={isHealthy && !isNetworkOffline ? "opacity-50" : "animate-spin"} />
        </div>
        
        {isNetworkOffline && activeOrder && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-blue-400"
          >
            <Zap size={10} className="fill-current" />
            <span className="text-[8px] font-black uppercase tracking-widest">Roadmap Cached</span>
          </motion.div>
        )}

        {(isStale || isNetworkOffline) && !isHealthy && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
          >
            GPS Jitter Detected
          </motion.div>
        )}
      </div>

      {/* Navigation HUD Overlay - Only shows when active mission */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-4 flex flex-col gap-4 z-[400] pointer-events-none"
          >
            {/* Floating Instruction "Button" style Module */}
            <AnimatePresence>
              {routeInfo && currentInstruction && (
                <motion.div 
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-xl flex items-center gap-4 shadow-xl pointer-events-auto cursor-pointer active:bg-zinc-800 transition-colors max-h-[80px]"
                >
                  <div className="p-2 bg-[#f59e0b] rounded-lg relative overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                     {getInstructionIcon(currentInstruction.modifier, currentInstruction.type)}
                  </div>
                  <div className="flex flex-col pr-2 flex-1">
                    <p className="text-[14px] font-sans font-medium text-white line-clamp-1 break-all leading-tight">
                      {nextInstructionText}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {currentInstruction.distance && (
                        <p className="text-[12px] font-sans font-medium text-zinc-300">
                          {(currentInstruction.distance > 1000) ? `${(currentInstruction.distance/1000).toFixed(1)} km` : `${Math.round(currentInstruction.distance)}m`}
                        </p>
                      )}
                      {currentInstruction.distance && <div className="w-1 h-1 bg-zinc-500 rounded-full" />}
                      <p className="text-[12px] font-sans font-medium text-zinc-400">
                        {distKm} KM
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center pl-3 border-l border-zinc-800 shrink-0 min-w-[50px]">
                    <span className="text-[20px] font-black leading-none text-[#22d3ee] drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{etaMins}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#22d3ee]/80 mt-1">MIN</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

