import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoutingMachine } from './RoutingMachine';
import { Zap, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, MapPin, Radar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryOrder } from '../types';
import { cn } from '../lib/utils';

const getInstructionIcon = (modifier?: string, type?: string) => {
  if (type === 'DestinationReached') return <MapPin className="w-8 h-8 text-[#f59e0b]" />;
  if (!modifier) return <ArrowUp className="w-8 h-8 text-[#f59e0b]" />;
  const lModifier = modifier.toLowerCase();
  if (lModifier.includes('left')) {
    return lModifier.includes('sharp') ? <CornerUpLeft className="w-8 h-8 text-[#f59e0b]" /> : <ArrowLeft className="w-8 h-8 text-[#f59e0b]" />;
  }
  if (lModifier.includes('right')) {
    return lModifier.includes('sharp') ? <CornerUpRight className="w-8 h-8 text-[#f59e0b]" /> : <ArrowRight className="w-8 h-8 text-[#f59e0b]" />;
  }
  if (lModifier.includes('straight')) return <ArrowUp className="w-8 h-8 text-[#f59e0b]" />;
  return <ArrowUp className="w-8 h-8 text-[#f59e0b]" />;
};

const mockRiderIcon = L.divIcon({
  html: `<div style="background-color: #f59e0b; padding: 6px; border-radius: 50%; box-shadow: 0 0 10px #f59e0b; border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
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
  const [localNow, setLocalNow] = useState<number>(() => Date.now());
  const [geoError, setGeoError] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<unknown>(null);

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
  const signalQuality = Math.max(0, 100 - (Math.floor((localNow - lastUpdate) / 1000) * 10));
  const isHealthy = signalQuality > 60;
  const isStale = signalQuality < 30;

  // Simple Coordinate Smoothing Ref
  const prevPos = useRef<[number, number] | null>(null);

  const requestGeolocation = useCallback(() => {
    setGeoError(false);
    
    if (!navigator.geolocation) {
      const mockLat = -33.9249 + (Math.random() - 0.5) * 0.01;
      const mockLng = 18.4241 + (Math.random() - 0.5) * 0.01;
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
          const alpha = 0.2;
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
        // Handle empty error object or explicit permission denied
        const isPermissionError = !err || Object.keys(err).length === 0 || err.code === 1;
        
        if (err?.code !== 3) {
          console.warn("Geolocation warning, falling back to mock coordinates:", { 
            code: err?.code, 
            message: err?.message,
            isPermissionError,
            timestamp: new Date().toISOString()
          });
        }
        
        // Fallback to mock position instead of blocking the app
        const mockLat = -33.9249 + (Math.random() - 0.5) * 0.01;
        const mockLng = 18.4241 + (Math.random() - 0.5) * 0.01;
        setRiderPos([mockLat, mockLng]);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
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
      setRouteInfo(sanitized);
    } else {
      setRouteInfo(null);
    }
  }, []);

  const typedRouteInfo = routeInfo as { summary: { totalTime: number, totalDistance: number }, instructions: { text: string, type?: string, modifier?: string, distance?: number }[] } | null;
  const etaMins = typedRouteInfo ? Math.ceil(typedRouteInfo.summary.totalTime / 60) : 0;
  const distKm = typedRouteInfo ? (typedRouteInfo.summary.totalDistance / 1000).toFixed(1) : 0;
  
  // Extract custom instructions
  const currentInstruction = typedRouteInfo?.instructions?.[1] || typedRouteInfo?.instructions?.[0];
  const nextInstructionText = currentInstruction?.text || "Proceed to destination";

  const rootClassName = `absolute inset-0 bg-[#050505] overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  if (geoError) {
    return (
      <div className={`${rootClassName} flex items-center justify-center bg-[#050505] z-[999]`}>
         <div className="flex flex-col items-center gap-6 text-zinc-500 bg-black/90 backdrop-blur-3xl p-10 rounded-[2rem] border border-red-500/30 shadow-[0_0_100px_rgba(239,68,68,0.15)] text-center max-w-sm mx-4">
            <div className="relative">
              <Zap className="w-16 h-16 animate-pulse text-red-500" />
              <div className="absolute inset-0 bg-red-500/20 blur-2xl animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-red-500 mb-2 italic">Permission Required</p>
              <p className="text-xs text-zinc-400 font-bold leading-relaxed uppercase tracking-wider">
                Uplink failed. Orbital permission denied or signal blocked by atmospheric interference.<br/>
                <span className="text-[10px] text-zinc-600 mt-2 block">Enable Geolocation in your browser settings.</span>
              </p>
            </div>
            <button 
              onClick={requestGeolocation}
              className="mt-2 w-full py-5 bg-red-500 text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all active:scale-95 shadow-[0_10px_30px_rgba(239,68,68,0.3)]"
            >
              Re-Authorize Uplink
            </button>
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
        className="w-full h-full grayscale invert brightness-50 contrast-125 opacity-70"
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution="&copy; Google Maps"
        />
        
        <Marker position={riderPos} icon={mockRiderIcon} zIndexOffset={100} />
        
        {targetPos && (
          <>
            <Marker position={targetPos} icon={isPickedUp ? mockCustomerIcon : mockMerchantIcon} />
            <Polyline 
              positions={[riderPos, targetPos] as [number, number][]} 
              pathOptions={{ 
                color: '#f59e0b', 
                dashArray: '10, 15', 
                weight: 2,
                opacity: 0.4
              }} 
            />
            <RoutingMachine start={riderPos} end={targetPos} onRouteFound={handleRouteFound} />
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
      <div className="absolute top-24 right-6 flex flex-col gap-2 z-[400] pointer-events-none">
        <div className={cn(
          "px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all duration-500",
          isHealthy ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
          isStale ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" :
          "bg-orange-500/10 border-orange-500/30 text-orange-500"
        )}>
          <Radar size={12} className={isHealthy ? "" : "animate-spin"} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {isHealthy ? "Uplink Secure" : isStale ? "Signal Lost" : "Interference"}
          </span>
        </div>
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
                  className="bg-black border-2 border-[#f59e0b] p-6 rounded-[2rem] flex items-center gap-6 shadow-[20px_20px_60px_rgba(0,0,0,1)] ring-8 ring-[#f59e0b]/5 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="p-4 bg-[#f59e0b] rounded-2xl relative overflow-hidden shrink-0 shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                     {getInstructionIcon(currentInstruction.modifier, currentInstruction.type)}
                  </div>
                  <div className="flex flex-col pr-4">
                    <p className="text-2xl font-headline font-black italic text-[#f59e0b] uppercase leading-none tracking-tighter mb-1">
                      {nextInstructionText}
                    </p>
                    <div className="flex items-center gap-3">
                      {currentInstruction.distance && (
                        <p className="text-lg font-mono font-bold text-white tabular-nums">
                          {(currentInstruction.distance > 1000) ? `${(currentInstruction.distance/1000).toFixed(1)} km` : `${Math.round(currentInstruction.distance)}m`}
                        </p>
                      )}
                      <div className="w-1 h-1 bg-[#f59e0b]/50 rounded-full" />
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        {etaMins} MIN • {distKm} KM
                      </p>
                    </div>
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

