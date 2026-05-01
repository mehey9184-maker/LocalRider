import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoutingMachine } from './RoutingMachine';
import { Zap, ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryOrder } from '../types';

const getInstructionIcon = (modifier?: string, type?: string) => {
  if (type === 'DestinationReached') return <MapPin className="w-8 h-8 text-[#39FF14]" />;
  if (!modifier) return <ArrowUp className="w-8 h-8 text-[#39FF14]" />;
  const lModifier = modifier.toLowerCase();
  if (lModifier.includes('left')) {
    return lModifier.includes('sharp') ? <CornerUpLeft className="w-8 h-8 text-[#39FF14]" /> : <ArrowLeft className="w-8 h-8 text-[#39FF14]" />;
  }
  if (lModifier.includes('right')) {
    return lModifier.includes('sharp') ? <CornerUpRight className="w-8 h-8 text-[#39FF14]" /> : <ArrowRight className="w-8 h-8 text-[#39FF14]" />;
  }
  if (lModifier.includes('straight')) return <ArrowUp className="w-8 h-8 text-[#39FF14]" />;
  return <ArrowUp className="w-8 h-8 text-[#39FF14]" />;
};

const mockRiderIcon = L.divIcon({
  html: `<div style="background-color: #39FF14; padding: 6px; border-radius: 50%; box-shadow: 0 0 10px #39FF14; border: 2px solid #050505;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg></div>`,
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
  const [geoError, setGeoError] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<unknown>(null);

  const isPickedUp = activeOrder?.delivery_status === 'picked_up';
  
  // Fake destination around Cape Town
  const targetPos: [number, number] | null = activeOrder 
    ? (isPickedUp ? [-33.9249, 18.4241] : [-33.9188, 18.4233]) 
    : null;

  const requestGeolocation = useCallback(() => {
    setGeoError(false);
    
    if (!navigator.geolocation) {
      setGeoError(true);
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRiderPos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        // Handle empty error object or explicit permission denied
        const isPermissionError = !err || Object.keys(err).length === 0 || err.code === 1;
        
        console.error("Geolocation error:", { 
          code: err?.code, 
          message: err?.message,
          isPermissionError,
          timestamp: new Date().toISOString()
        });
        
        setGeoError(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (result.state === 'granted' || result.state === 'prompt') {
          startWatching();
        } else {
          setGeoError(true);
        }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRouteFound = useCallback((route: any) => {
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
            <Zap className="w-12 h-12 animate-pulse text-[#39FF14]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#39FF14] text-center">Acquiring Lock<br/><span className="text-zinc-500">Orbital Positioning</span></p>
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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        <Marker position={riderPos} icon={mockRiderIcon} zIndexOffset={100} />
        
        {targetPos && (
          <Marker position={targetPos} icon={isPickedUp ? mockCustomerIcon : mockMerchantIcon} />
        )}
        
        {targetPos && (
          <RoutingMachine start={riderPos} end={targetPos} onRouteFound={handleRouteFound} />
        )}
      </MapContainer>

      {/* Radar Scan when online and idle */}
      {!activeOrder && isOnline && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           {/* Pulsing rings */}
           <div className="w-64 h-64 rounded-full border border-[#39FF14]/20 animate-ping absolute opacity-20" />
           <div className="w-96 h-96 rounded-full border border-[#39FF14]/10 animate-ping absolute opacity-10" style={{ animationDelay: '500ms' }} />
           
           {/* Rotating Scan Line */}
           <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute w-[400px] h-[400px] rounded-full border-t border-t-[#39FF14]/40 border-r border-r-[#39FF14]/10"
              style={{ background: 'conic-gradient(from 0deg, transparent 80%, rgba(57, 255, 20, 0.1) 100%)' }}
           />
           
           <div className="absolute flex flex-col items-center gap-2">
              <div className="flex gap-1">
                 {[...Array(3)].map((_, i) => (
                   <motion.div 
                     key={i} 
                     animate={{ opacity: [0.2, 1, 0.2] }}
                     transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                     className="w-1.5 h-1.5 bg-[#39FF14] rounded-full shadow-[0_0_8px_#39FF14]" 
                   />
                 ))}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#39FF14]/60">Scanning Sector</span>
           </div>
        </div>
      )}

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
                  className="bg-black border-2 border-[#39FF14] p-6 rounded-[2rem] flex items-center gap-6 shadow-[20px_20px_60px_rgba(0,0,0,1)] ring-8 ring-[#39FF14]/5 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="p-4 bg-[#39FF14] rounded-2xl relative overflow-hidden shrink-0 shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                     {getInstructionIcon(currentInstruction.modifier, currentInstruction.type)}
                  </div>
                  <div className="flex flex-col pr-4">
                    <p className="text-2xl font-headline font-black italic text-[#39FF14] uppercase leading-none tracking-tighter mb-1">
                      {nextInstructionText}
                    </p>
                    <div className="flex items-center gap-3">
                      {currentInstruction.distance && (
                        <p className="text-lg font-mono font-bold text-white tabular-nums">
                          {(currentInstruction.distance > 1000) ? `${(currentInstruction.distance/1000).toFixed(1)} km` : `${Math.round(currentInstruction.distance)}m`}
                        </p>
                      )}
                      <div className="w-1 h-1 bg-[#39FF14]/50 rounded-full" />
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

