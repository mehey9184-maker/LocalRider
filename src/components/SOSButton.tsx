import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface SOSButtonProps {
  riderName: string;
}

export const SOSButton = ({ riderName }: SOSButtonProps) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    if (isHolding) return;
    setIsHolding(true);
    setProgress(0);
    
    if (navigator.vibrate) navigator.vibrate(50);
    
    const tickMs = 50;
    const duration = 2000; // 2 seconds
    const increment = (tickMs / duration) * 100;
    let currentProgress = 0;

    progressIntervalRef.current = setInterval(() => {
      currentProgress += increment;
      const pct = Math.min(currentProgress, 100);
      setProgress(pct);
      
      if (pct >= 100) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        triggerSOS();
      }
    }, tickMs);
  };

  const endHold = () => {
    setIsHolding(false);
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const triggerSOS = async () => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    
    let locationUrl = 'Location unknown';
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      locationUrl = `https://www.openstreetmap.org/?mlat=${pos.coords.latitude}&mlon=${pos.coords.longitude}#map=17/${pos.coords.latitude}/${pos.coords.longitude}`;
    } catch {
      // Fallback location gathering
    }

    const message = `EMERGENCY: Rider ${riderName} needs help at ${locationUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '🆘 SOS EMERGENCY - RIDER IN DISTRESS',
          text: message,
          url: locationUrl
        });
        toast.success('SOS Signal Broadcasted');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
    
    setIsHolding(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <div 
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      className="p-4 bg-red-600/10 border-2 border-red-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-red-500 group relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.1)] select-none cursor-pointer h-full min-h-[92px]"
    >
      {/* Background glowing layer */}
      <div className={cn("absolute inset-0 bg-red-500/10 transition-opacity duration-300", isHolding ? "opacity-30" : "opacity-15 animate-pulse")} />
      
      {/* Progress animation filling background */}
      <div 
        className="absolute bottom-0 left-0 bg-red-600/30 transition-all duration-75 pointer-events-none"
        style={{ width: `${progress}%`, height: '100%' }}
      />
      
      <LifeBuoy className={cn("w-6 h-6 z-10 duration-200 text-red-500", isHolding ? "scale-110 animate-spin" : "scale-100 animate-bounce")} />
      
      <div className="flex flex-col items-center z-10">
        <span className="text-[10px] font-black uppercase tracking-widest text-white">
          {isHolding ? `${Math.round(progress)}% HOLD...` : "HOLD 2S FOR SOS"}
        </span>
        <span className="text-[7.5px] font-bold text-red-400 uppercase tracking-wider mt-0.5">
          {isHolding ? "Release to cancel" : "Emergency protocol"}
        </span>
      </div>
      
      {/* Visual active pointer indicator */}
      {isHolding && (
        <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full border border-red-500/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
        </div>
      )}
    </div>
  );
};

SOSButton.displayName = 'SOSButton';
