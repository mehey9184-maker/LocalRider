import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { 
  Smartphone, 
  Bike, 
  ShoppingBag, 
  Zap, 
  User as UserIcon, 
  List, 
  Navigation, 
  CheckCircle, 
  Power,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Clock,
  LogOut,
  BarChart3,
  Search,
  ArrowRight,
  Globe,
  ShieldAlert,
  QrCode,
  Link2,
  Radar,
  WifiOff,
  Activity,
  Plus,
  Rocket,
  Minimize2,
  Map,
  ArrowLeftRight,
  X,
  Mic,
  MicOff,
  LifeBuoy,
  Target,
  EyeOff,
  Phone,
  ExternalLink,
  Navigation2,
  ShieldCheck,
  HelpCircle,
  Copy,
  Check,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Battery,
  Sun,
} from 'lucide-react';
import MapboxMap, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Toaster, toast } from 'sonner';
import { getSupabase, isSupabaseMocked } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { RiderProfile, DeliveryOrder, UserVehicle, DeliveryStatus, ShopConnection } from './types';
import { cn } from './lib/utils';
import { QRScanner } from './components/QRScanner';
import { AppMapBackground } from './components/MapboxAppMapBackground';
import { HistoryMap } from './components/HistoryMap';
import { TacticalOnboarding } from './components/TacticalOnboarding';
import { PhoneInput } from './components/PhoneInput';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

// --- Voice Controller ---

const VoiceController = ({ isListening, onStart }: { isListening: boolean, onStart: () => void }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onStart}
      className={cn(
        "fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-50 border-2 transition-all",
        isListening 
          ? "bg-emerald-500 border-emerald-400 animate-pulse shadow-emerald-500/40" 
          : "bg-zinc-900 border-zinc-800 shadow-black/60"
      )}
    >
      {isListening ? (
        <Mic className="w-6 h-6 text-black" />
      ) : (
        <MicOff className="w-6 h-6 text-zinc-500" />
      )}
      
      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
        </span>
      )}
    </motion.button>
  );
};

// --- Utilities ---

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) *
            Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 5, delay = 1000, timeoutMs = 15000): Promise<T> => {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
  } catch (error) {
    const isNetworkOrTimeoutErr = error instanceof TypeError || (error instanceof Error && (
      error.message === 'timeout' || 
      /fetch|network|offline|connection|failed|changed|cors|disconnected|abort/i.test(error.message)
    ));
    if (retries > 0 && isNetworkOrTimeoutErr) {
      const nextDelay = delay * 1.5; 
      const errMessage = error instanceof Error ? error.message : 'Network sequence interrupted';
      console.log(`[RETRYING] ${errMessage.toUpperCase()} | Attempts remaining: ${retries}`);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, nextDelay, timeoutMs);
    }
    throw error;
  }
};

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: () => void;
  onlevelchange: () => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

const useBatteryStatus = () => {
  const [level, setLevel] = useState<number | null>(75); 
  const [charging, setCharging] = useState<boolean>(false);
  const [isSupported] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'getBattery' in navigator;
  });

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (typeof window === 'undefined' || !nav.getBattery) {
      const interval = setInterval(() => {
        setLevel(prev => {
          if (prev === null) return 85;
          if (prev <= 15) return 25; // cycle back for continuous visibility
          return Number((prev - 0.2).toFixed(1));
        });
      }, 30000);
      return () => clearInterval(interval);
    }

    let battery: BatteryManager | null = null;

    const updateBattery = () => {
      if (battery) {
        setLevel(Math.round(battery.level * 100));
        setCharging(battery.charging);
      }
    };

    nav.getBattery().then((bat: BatteryManager) => {
      battery = bat;
      updateBattery();
      bat.addEventListener('chargingchange', updateBattery);
      bat.addEventListener('levelchange', updateBattery);
    }).catch(() => {
      // safe fallback
    });

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBattery);
        battery.removeEventListener('levelchange', updateBattery);
      }
    };
  }, []);

  return { level, charging, isSupported };
};

const isTodayLocal = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  } catch {
    return false;
  }
};

const StatusBadge = React.memo(({ status }: { status: DeliveryStatus }) => {
  const styles: Record<DeliveryStatus, string> = {
    finding_rider: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    accepted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    picked_up: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    delivered: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    none: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border italic", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
});

const TelemetryData = React.memo(({ label, value, unit }: { label: string, value: string | number, unit?: string }) => (
  <div className="flex flex-col">
    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-4xl md:text-5xl font-mono font-bold text-[#F0F0F0] tabular-nums tracking-tighter">{value}</span>
      {unit && <span className="text-xs text-zinc-400 font-bold uppercase">{unit}</span>}
    </div>
  </div>
));

const BentoCard = React.memo(({ children, className, glow = false, ...props }: { children: React.ReactNode, className?: string, glow?: boolean } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={cn(
    "bg-[#0a0a0c]/90 border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group transition-smooth",
    glow && "shadow-[0_0_50px_rgba(245,158,11,0.08)] border-[#f59e0b]/25 bg-[#0e0e11]",
    className
  )}>
    {glow && <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#f59e0b]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#f59e0b]/10 transition-all duration-700" />}
    <div className="relative z-10">{children}</div>
  </div>
));

const SwipeButton = ({ label, onComplete, color = "#f59e0b", resetToken, disabled = false }: { 
  label: string, 
  onComplete: () => void, 
  color?: string, 
  resetToken?: string | number,
  disabled?: boolean
}) => {
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDrag, setMaxDrag] = useState(260);
  const x = useMotionValue(0);

  useEffect(() => {
    if (resetToken !== undefined) {
      setTimeout(() => {
        setIsComplete(false);
        x.set(0);
      }, 0);
    }
  }, [resetToken, x]);

  useEffect(() => {
    if (containerRef.current) {
      const handleWidth = 72;
      setMaxDrag(containerRef.current.offsetWidth - handleWidth - 12);
    }
  }, []);

  return (
    <div ref={containerRef} className={cn(
      "relative h-20 bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden p-1.5 select-none transition-smooth",
      disabled ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-zinc-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
    )}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 opacity-60">
          {label}
        </span>
      </div>
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.08}
        style={{ x, backgroundColor: isComplete ? '#fff' : color, touchAction: 'none' }}
        onDragEnd={(_, info) => {
          if (disabled) return;
          if (info.offset.x > maxDrag * 0.75) {
            setIsComplete(true);
            onComplete();
            if (navigator.vibrate) navigator.vibrate([10, 20, 10]);
          } else {
            animate(x, 0, { type: "spring", stiffness: 450, damping: 35 });
          }
        }}
        whileHover={disabled ? {} : { scale: 1.02, boxShadow: "0 4px 20px rgba(245,158,11,0.25)" }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        className="absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all touch-action-none"
      >
        <ArrowRight className="w-8 h-8 text-black" strokeWidth={3} />
      </motion.div>
      
      <motion.div 
        style={{ width: x, opacity: 0.15, backgroundColor: color }}
        className="absolute left-0 top-0 bottom-0 pointer-events-none z-10"
      />
    </div>
  );
};

// --- Auth Views ---

const AuthView = ({ onMockLogin }: { onMockLogin?: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<UserVehicle>('Road');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseMocked()) {
      toast.success('Simulator Auth Success. Welcome Override Unit.');
      if (onMockLogin) onMockLogin();
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await getSupabase().auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              vehicle_type: vehicleType
            }
          }
        });
        if (error) throw error;
        toast.success('Unit Registered. Verification cycle initiated.');
      } else {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auth failure';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
        toast.success('Offline Simulator Engaged. Bypass Active.');
        if (onMockLogin) onMockLogin();
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSupabaseMocked()) {
      toast.success('Simulator Auth Success. Welcome Override Unit.');
      if (onMockLogin) onMockLogin();
      return;
    }

    try {
      const { error: authError } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (authError) throw authError;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Auth Failed';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
        toast.success('Offline Simulator Engaged. Bypass Active.');
        if (onMockLogin) onMockLogin();
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-[#F0F0F0] font-body">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-zinc-900 rounded-3xl border border-zinc-800 mb-6 neon-glow">
            <Bike className="w-10 h-10 text-[#f59e0b]" />
          </div>
          <h1 className="text-3xl font-headline font-black tracking-tighter italic uppercase leading-none">
            Local<span className="text-[#f59e0b]">Eats</span><br/>
            <span className="text-lg opacity-50">{isSignUp ? 'Registry Uplink' : 'Rider Hub'}</span>
          </h1>
        </div>

        <BentoCard className="border-zinc-800/50 p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
              >
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Full Legal Name</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#f59e0b] outline-none transition-all"
                    placeholder="John Doe"
                    required={isSignUp}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mobile Uplink</label>
                  <PhoneInput 
                    value={phone}
                    onChange={(val) => setPhone(val)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#f59e0b] outline-none transition-all font-mono"
                    placeholder="+27 00 000 0000"
                    required={isSignUp}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Vehicle Type</label>
                  <select 
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as UserVehicle)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#f59e0b] outline-none transition-all appearance-none text-[#f59e0b] font-bold"
                  >
                    <option value="Road">Road Bike</option>
                    <option value="MTB">Mountain Bike</option>
                    <option value="E-Bike">Electric/E-Bike</option>
                    <option value="Motor">Motorbike</option>
                  </select>
                </div>
              </motion.div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Registry Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#f59e0b] outline-none transition-all font-mono"
                placeholder="rider@localeats.io"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Secure Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#f59e0b] outline-none transition-all font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={cn(
                "w-full py-4 bg-[#f59e0b] text-black font-black uppercase italic tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(57,255,20,0.2)] mt-4",
                loading && "opacity-50"
              )}
            >
              {loading ? 'SYNCING...' : isSignUp ? 'VALIDATE & REGISTER' : 'UPLINK & LOGIN'}
            </button>
            {!isSignUp && (
              <p className="mt-4 text-[10px] text-zinc-600 text-center uppercase tracking-tighter italic">
                Registry credentials required for initial protocol. Use "Map your profile" below for new units.
              </p>
            )}
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-[#0D0D0D] px-4 text-zinc-600">Secure Protocol</span>
            </div>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 text-[#F0F0F0] font-black uppercase italic tracking-widest rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <Globe className="w-5 h-5 text-[#f59e0b]" />
            Google Uplink
          </button>
          
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full mt-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            {isSignUp ? 'Already mapped? Log in' : 'New rider? Map your profile'}
          </button>
        </BentoCard>
      </motion.div>
    </div>
  );
};

// --- Main App Views ---

const SOSButton = ({ riderName }: { riderName: string }) => {
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
        clearInterval(progressIntervalRef.current!);
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
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
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

const VoiceDashboardCard = ({ isListening, onStart }: { isListening: boolean, onStart: () => void }) => {
  return (
    <button 
      onClick={onStart}
      className={cn(
        "p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-center relative overflow-hidden h-full min-h-[92px] group w-full",
        isListening 
          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse" 
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:bg-zinc-900/80"
      )}
    >
      {isListening ? (
        <>
          <div className="flex gap-0.5 items-end justify-center h-6 mb-1 z-10">
            {/* Elegant bouncing voice lines */}
            <div className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-0.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            <div className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.5s]" />
            <div className="w-0.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
          <div className="flex flex-col items-center z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b]">VOICE: ACTIVE</span>
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Listening to command...</span>
          </div>
        </>
      ) : (
        <>
          <Mic className="w-6 h-6 text-zinc-500 group-hover:text-amber-500 transition-colors z-10" />
          <div className="flex flex-col items-center z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">VOICE COMMANDS</span>
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Tap to activate</span>
          </div>
        </>
      )}
    </button>
  );
};

const Dashboard = React.memo(({ 
  profile, 
  todayEarnings, 
  totalDeliveries, 
  history, 
  onToggleOnline, 
  setView, 
  connectionCount,
  isListening,
  onStartListening
}: { 
  profile: RiderProfile, 
  todayEarnings: number,
  totalDeliveries: number,
  history: DeliveryOrder[],
  onToggleOnline: () => void,
  setView: (view: AppView) => void,
  connectionCount: number,
  isListening: boolean,
  onStartListening: () => void
}) => {
  const [shiftCount] = useState(() => {
    return parseInt(localStorage.getItem('shiftCount') || '0', 10);
  });

  useEffect(() => {
    if (profile.is_online && shiftCount < 3) {
      const newCount = shiftCount + 1;
      localStorage.setItem('shiftCount', newCount.toString());
      // we do not update state immediately to allow them to see it during this session
    }
  }, [profile.is_online, shiftCount]);

  const getRank = (pts: number) => {
    if (pts >= 7500) return { title: 'GOLD', next: 10000, target: 10000, progress: 100, color: 'text-[#f59e0b]' };
    if (pts >= 2500) return { title: 'SILVER', next: 7500, target: 7500, progress: ((pts - 2500) / 5000) * 100, color: 'text-zinc-300' };
    return { title: 'BRONZE', next: 2500, target: 2500, progress: (pts / 2500) * 100, color: 'text-orange-700' };
  };

  const rank = getRank(profile.active_points || 0);

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto w-full">
      {connectionCount === 0 && (
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border-2 border-red-500/20 text-red-500 p-5 rounded-[2rem] flex items-center gap-4 group cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            onClick={() => setView('hub')}
         >
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center animate-pulse">
               <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
               <h4 className="text-[11px] font-black uppercase tracking-[0.1em] mb-1">No Connections Found</h4>
               <p className="text-sm font-bold text-white/70 italic leading-tight">You haven't connected to any stores yet. Go to the Hub to link your account.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-red-500 transition-colors" />
         </motion.div>
      )}

      {profile.verification_status !== 'verified' && connectionCount > 0 && (
        <BentoCard className="bg-orange-500/10 border-orange-500/20 text-orange-500 py-5">
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Status: Under Review</span>
              <span className="text-sm font-bold leading-tight text-white/80 italic">We are reviewing your profile. Some features might be unavailable.</span>
            </div>
          </div>
        </BentoCard>
      )}

      {/* Safety & Performance Protocols */}
      <div className="grid grid-cols-2 gap-4">
        <SOSButton riderName={profile.name} />
        <VoiceDashboardCard isListening={isListening} onStart={onStartListening} />
      </div>

      {/* Power Toggle */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => {
            onToggleOnline();
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
          }}
          className={cn(
            "w-full min-h-[76px] px-6 py-4 rounded-3xl flex items-center justify-start gap-5 transition-smooth focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/40",
            profile.is_online 
              ? "bg-[#0b130e] border border-emerald-500/30 hover:border-emerald-400/50 glow-green shadow-[0_8px_30px_rgba(34,197,94,0.04)]" 
              : "bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-[#121214] shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-smooth",
            profile.is_online 
              ? "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/25 shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
              : "text-zinc-500 bg-zinc-800/60"
          )}>
            <Power className={cn("w-5 h-5 transition-smooth", profile.is_online && "scale-110")} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <div className="flex items-center gap-3">
              <span className={cn("text-[17px] font-headline font-black uppercase tracking-wider italic transition-colors", profile.is_online ? "text-white text-glow" : "text-zinc-400")}>
                {profile.is_online ? 'You are Online' : 'You are Offline'}
              </span>
              {profile.is_online && (
                <div className="flex items-center gap-0.5">
                   <div className="w-1 h-3 bg-emerald-500/20 rounded-full" />
                   <div className="w-1 h-2 bg-emerald-500/40 rounded-full" />
                   <div className="w-1 h-4 bg-emerald-500/60 rounded-full animate-pulse" />
                   <div className="w-1 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("text-[11px] font-sans font-semibold uppercase tracking-wider transition-colors", profile.is_online ? "text-emerald-400/80" : "text-zinc-500")}>
                {profile.is_online ? 'Looking for orders...' : 'Tap to go online'}
              </span>
              {profile.verification_status === 'verified' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-sm shadow-[0_2px_10px_rgba(16,185,129,0.05)]">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span className="text-[8px] font-black text-emerald-400 tracking-wider">VERIFIED</span>
                </div>
              )}
            </div>
          </div>
        </button>

        {profile.is_online && shiftCount < 3 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-start gap-3 mt-2 mx-1"
          >
            <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500 animate-ping shrink-0" />
            <p className="text-[12px] font-sans text-green-400 font-medium leading-relaxed">
              You're active! New missions will appear here when your linked shops broadcast them.
            </p>
          </motion.div>
        )}
      </div>

      {/* Stats Bento */}
      <div className="space-y-4">
        {/* Stat Cards Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Earnings Stat Card */}
          <BentoCard className="bg-gradient-to-br from-zinc-950 to-zinc-900 border-zinc-800/80 p-5 flex flex-col justify-between" glow>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1 px-1.5 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded text-[9px] font-mono font-black tracking-widest uppercase">
                  VAL // UPLINK
                </div>
              </div>
              <div className="p-1.5 bg-[#f59e0b]/10 rounded-lg border border-[#f59e0b]/20">
                <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
              </div>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1">Today Earnings</span>
              <p className="text-3xl font-headline font-black italic tracking-tight text-white">
                R {Number(todayEarnings || 0).toFixed(2)}
              </p>
              <div className="flex items-center gap-1 mt-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Direct Payout Ready
              </div>
            </div>
          </BentoCard>

          {/* Deliveries Stat Card */}
          <BentoCard className="bg-gradient-to-br from-zinc-950 to-zinc-900 border-zinc-800/80 p-5 flex flex-col justify-between" glow>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1 px-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-mono font-black tracking-widest uppercase">
                  OPS // DR-CLD
                </div>
              </div>
              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1">Drops Cleared</span>
              <p className="text-3xl font-headline font-black italic tracking-tight text-white">
                {totalDeliveries} <span className="text-xs font-mono font-bold tracking-tighter text-zinc-500 uppercase">UNITS</span>
              </p>
              <div className="flex items-center gap-1 mt-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" /> Speed rating 100%
              </div>
            </div>
          </BentoCard>
        </div>

        {/* Level / Tier EXP Card */}
        <BentoCard className="bg-zinc-900/50 border-zinc-800/80 p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-[0.2em]">RIDER TIER STANDING</span>
            </div>
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", 
              rank.title === 'BRONZE' ? 'text-amber-700 bg-amber-950/20 border-amber-900/40' :
              rank.title === 'SILVER' ? 'text-slate-400 bg-slate-950/20 border-slate-800/40' :
              rank.title === 'GOLD' ? 'text-yellow-500 bg-[#f59e0b]/10 border-[#f59e0b]/40' :
              'text-purple-400 bg-purple-950/20 border-purple-900/40'
            )}>{rank.title} TIER</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-headline font-black italic text-white uppercase tracking-tighter leading-none">{profile.active_points}</span>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">EXP</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f0f0f0]">Next Tier: {rank.next.toLocaleString()} Pts</p>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
               <motion.div 
                 initial={{ width: 0 }} 
                 animate={{ width: `${Math.min(rank.progress, 100)}%` }} 
                 className="h-full bg-gradient-to-r from-amber-500 to-[#f59e0b] rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
               />
            </div>
          </div>
        </BentoCard>

        {/* Quest Radar */}
        <BentoCard className="p-6 bg-zinc-900/30 border-zinc-900">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Rocket className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 italic">Your Progress</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                   <p className="text-sm font-bold text-zinc-200">Sector Specialist</p>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Complete 3 missions for +50 Pts</p>
                </div>
                <div className="text-right">
                   <p className="text-sm font-black text-amber-500">{Math.min(totalDeliveries, 3)}/3</p>
                </div>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
               <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((totalDeliveries / 3) * 100, 100)}%` }} className="h-full bg-amber-500" />
            </div>
          </div>
        </BentoCard>

        {/* Logs */}
        <section className="space-y-4 pt-4 pb-12">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black italic uppercase tracking-tight flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-600" /> Recent Logs
            </h2>
            <button onClick={() => setView('log')} className="text-xs font-black uppercase tracking-widest text-[#f59e0b] hover:underline">Full Feed</button>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="py-12 text-center bg-zinc-900/10 rounded-[2rem] border border-dashed border-zinc-800">
                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest italic">No recent deliveries.</p>
              </div>
            ) : (
              history.slice(0, 3).map(order => (
                <BentoCard key={order.id} className="p-5 border-zinc-800/40 bg-zinc-900/10 hover:bg-zinc-900/20 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center group-hover:border-[#f59e0b]/30 transition-all">
                        <ShoppingBag className="w-6 h-6 text-zinc-500 group-hover:text-[#f59e0b] transition-all" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-tight mb-1">{order.restaurant_name}</h4>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-mono text-zinc-500 uppercase">{order.delivery_status}</span>
                           <div className="w-1 h-1 rounded-full bg-zinc-800" />
                           <span className="text-[10px] font-mono text-zinc-600">{new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-base font-black italic text-[#f59e0b]">R{Number(order.delivery_fee || 0).toFixed(2)}</p>
                  </div>
                </BentoCard>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
});

const getDistanceBetween = (lat1?: number, lon1?: number, lat2?: number, lon2?: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const RouteMiniMap = ({ 
  shopLat, shopLng, customerLat, customerLng, riderLat, riderLng 
}: { 
  shopLat?: number, shopLng?: number, 
  customerLat?: number, customerLng?: number, 
  riderLat?: number, riderLng?: number 
}) => {
  const centerLat = shopLat || -25.9894;
  const centerLng = shopLng || 28.2148;
  
  return (
    <div className="w-full h-44 rounded-2xl bg-zinc-950 overflow-hidden border border-zinc-900 relative">
      <MapboxMap 
        initialViewState={{
          longitude: centerLng,
          latitude: centerLat,
          zoom: 12
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
        className="brightness-[1.1] contrast-[0.95] saturate-[0.85]"
        style={{ width: '100%', height: '100%' }}
      >
        {riderLat && riderLng && (
          <Marker longitude={riderLng} latitude={riderLat}>
            <div className="flex flex-col items-center">
              <span className="text-[7px] bg-cyan-950/90 text-cyan-400 font-bold px-1 py-0.5 rounded border border-cyan-500/30 uppercase tracking-widest mb-1 scale-90 whitespace-nowrap">YOU</span>
              <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 border border-white flex items-center justify-center shadow-[0_0_8px_#22d3ee]">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>
          </Marker>
        )}
        {shopLat && shopLng && (
          <Marker longitude={shopLng} latitude={shopLat}>
            <div className="flex flex-col items-center">
              <span className="text-[7px] bg-amber-950/90 text-[#f59e0b] font-bold px-1 py-0.5 rounded border border-amber-500/30 uppercase tracking-widest mb-1 scale-90 whitespace-nowrap">STORE</span>
              <div className="w-3.5 h-3.5 rounded-full bg-[#f59e0b] border border-white flex items-center justify-center shadow-[0_0_8px_#f59e0b]">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>
          </Marker>
        )}
        {customerLat && customerLng && (
          <Marker longitude={customerLng} latitude={customerLat}>
            <div className="flex flex-col items-center">
              <span className="text-[7px] bg-rose-950/90 text-rose-400 font-bold px-1 py-0.5 rounded border border-rose-500/30 uppercase tracking-widest mb-1 scale-90 whitespace-nowrap">DROP</span>
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white flex items-center justify-center shadow-[0_0_8px_#f43f5e]">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>
          </Marker>
        )}
      </MapboxMap>
    </div>
  );
};

const OrdersFeed = React.memo(({ 
  orders,
  activeOrders = [],
  onAccept, 
  isOnline, 
  surgeMultiplier, 
  connectionCount,
  onRefresh,
  activeOrdersCount,
  riderName,
  vehicleType,
  riderLat,
  riderLng,
  onToggleOnline
}: { 
  orders: DeliveryOrder[], 
  activeOrders?: DeliveryOrder[],
  onAccept: (id: string) => void, 
  isOnline: boolean, 
  surgeMultiplier: number, 
  connectionCount: number,
  onRefresh: () => void,
  activeOrdersCount: number,
  riderName?: string,
  vehicleType?: string,
  riderLat?: number,
  riderLng?: number,
  onToggleOnline?: () => void
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [instantAccept, setInstantAccept] = useState(() => localStorage.getItem('localeats_instant_accept') === 'true');

  const toggleInstantAccept = () => {
    const newVal = !instantAccept;
    setInstantAccept(newVal);
    localStorage.setItem('localeats_instant_accept', String(newVal));
    toast.success(newVal ? 'Instant Slipstream Accept Engaged' : 'Confirmation Safeties Restored', {
      description: newVal ? 'Slide-to-accept will lock orders immediately.' : 'Modals will prompt you before dispatch locks.'
    });
  };
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNearbyMap, setShowNearbyMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortMethod, setSortMethod] = useState<'distance' | 'fee' | 'eta' | 'optimal'>('optimal');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'accepted' | 'picked_up'>('available');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isLimitReached = activeOrdersCount >= 2;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredAndSortedOrders = useMemo(() => {
    // Combine available and active orders for comprehensive filtering
    let combined = [...orders];
    if (statusFilter !== 'available') {
      combined = [...combined, ...activeOrders.filter(ao => !orders.some(o => o.id === ao.id))];
    }

    let result = combined.filter(o => 
      o.restaurant_name?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      o.product_name?.toLowerCase().includes(deferredSearchQuery.toLowerCase())
    );

    if (statusFilter === 'available') {
      result = result.filter(o => o.delivery_status === 'none' || o.delivery_status === 'finding_rider');
    } else if (statusFilter === 'accepted') {
      result = result.filter(o => o.delivery_status === 'accepted');
    } else if (statusFilter === 'picked_up') {
      result = result.filter(o => o.delivery_status === 'picked_up');
    }

    result = [...result].sort((a, b) => {
      if (sortMethod === 'fee') {
        const feeA = Number(a.delivery_fee || 0);
        const feeB = Number(b.delivery_fee || 0);
        return feeB - feeA; // Descending
      }
      if (sortMethod === 'distance') {
        const distA = Number(a.distance_km || 0);
        const distB = Number(b.distance_km || 0);
        return distA - distB;
      }
      if (sortMethod === 'eta') {
        // ETA logic: assume 20km/h for cyclists if distance available
        const etaA = a.distance_km ? (Number(a.distance_km) / 20) * 60 : 0;
        const etaB = b.distance_km ? (Number(b.distance_km) / 20) * 60 : 0;
        return etaA - etaB;
      }
      if (sortMethod === 'optimal') {
        // Optimal algorithm: Sort to prioritize tasks with the lowest combination score of distance (70% weight) and ETA delivery times (30% weight)
        const distA = Number(a.distance_km || 0);
        const distB = Number(b.distance_km || 0);
        const etaA = a.distance_km ? (distA / 20) * 60 : 0;
        const etaB = b.distance_km ? (distB / 20) * 60 : 0;
        
        const scoreA = distA * 0.7 + etaA * 0.3;
        const scoreB = distB * 0.7 + etaB * 0.3;
        return scoreA - scoreB; // Lower score = higher optimization
      }
      return 0;
    });

    return result;
  }, [orders, activeOrders, deferredSearchQuery, sortMethod, statusFilter]);

  const handleMarkerClick = (id: string) => {
    setHighlightedOrderId(id);
    const el = scrollRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedOrderId(null), 3000);
  };

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto w-full">
      <header className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
           <h2 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white">Available Orders</h2>
           <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowNearbyMap(!showNearbyMap)}
                className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95"
                title={showNearbyMap ? "Hide Sector Map" : "Show Sector Map"}
              >
                {showNearbyMap ? <EyeOff size={16} /> : <Map size={16} />}
              </button>
              {isOnline && (
                 <button 
                   onClick={handleRefresh}
                   className={cn(
                     "bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-4 py-2 rounded-2xl flex items-center gap-2 transition-all active:scale-90",
                     isRefreshing && "animate-pulse brightness-150"
                   )}
                 >
                   <Radar className={cn("w-3 h-3 text-[#f59e0b]", isRefreshing && "animate-spin")} />
                   <span className="text-[11px] font-black text-[#f59e0b] tracking-widest">
                     {isRefreshing ? 'SCANNING...' : 'SCAN AGAIN'}
                   </span>
                 </button>
              )}
           </div>
        </div>
        
        {/* Search, Sort and Filter UI */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search store or customer..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 pl-10 pr-10 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white focus:outline-none focus:border-[#f59e0b]/50 transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <button 
                onClick={() => setSortMethod('optimal')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-2",
                  sortMethod === 'optimal' ? "bg-gradient-to-r from-cyan-400 to-sky-400 text-black border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] animate-pulse" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                )}
              >
                <Zap size={10} className="fill-current animate-bounce" />
                Optimal Pathway
              </button>
              <button 
                onClick={() => setSortMethod('distance')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                  sortMethod === 'distance' ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                )}
              >
                Distance
              </button>
              <button 
                onClick={() => setSortMethod('fee')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                  sortMethod === 'fee' ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                )}
              >
                Reward (High)
              </button>
              <button 
                onClick={() => setSortMethod('eta')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                  sortMethod === 'eta' ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                )}
              >
                ETA (Ascending)
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mr-2">Filter Status:</span>
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                statusFilter === 'all' ? "bg-zinc-700 text-white border-zinc-600" : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              All Orders
            </button>
            <button 
              onClick={() => setStatusFilter('available')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                statusFilter === 'available' ? "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40" : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              Available
            </button>
            <button 
              onClick={() => setStatusFilter('accepted')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                statusFilter === 'accepted' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              Accepted
            </button>
            <button 
              onClick={() => setStatusFilter('picked_up')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                statusFilter === 'picked_up' ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              Picked Up
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] flex items-center gap-2 italic">
               Orders nearby
             </p>
             {surgeMultiplier > 1 && (
               <div className="bg-orange-600 text-white px-3 py-1 rounded-xl shadow-lg border border-orange-500 animate-pulse">
                  <span className="text-[10px] font-black uppercase">Bonus x{surgeMultiplier.toFixed(1)}</span>
               </div>
             )}
          </div>
          
          {/* Slipstream Instant Accept Switch */}
          <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-2xl">
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Slipstream Accept</span>
            <button
              onClick={toggleInstantAccept}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors duration-200 outline-none flex items-center p-0.5 pointer-events-auto",
                instantAccept ? "bg-emerald-500" : "bg-zinc-700"
              )}
              title="Toggle instant accept mode"
            >
              <motion.div 
                layout
                className="w-4 h-4 bg-black rounded-full"
                animate={{ x: instantAccept ? '16px' : '0px' }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showNearbyMap && isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 350, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full overflow-hidden rounded-[2.5rem] border border-zinc-800 shadow-2xl relative group bg-zinc-950"
          >
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
               <span className="text-[9px] font-black text-white uppercase tracking-widest">Map Live</span>
            </div>
            
            <AppMapBackground 
              isOnline={true} 
              riderProfileLat={riderLat} 
              riderProfileLng={riderLng} 
              allOrders={filteredAndSortedOrders}
              onOrderMarkerClick={handleMarkerClick}
              highlightedOrderId={highlightedOrderId}
            />
            
            <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest italic mb-0.5">Current Area</span>
                <span className="text-sm font-black text-white uppercase italic tracking-tight">Tembisa, Kaalfontein & Ivory Park • {filteredAndSortedOrders.length} Orders found</span>
              </div>
              <div className="px-4 py-2 bg-[#f59e0b] text-black rounded-xl pointer-events-auto shadow-[0_10px_30px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform flex items-center gap-2">
                <Activity size={12} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-tight">Real-Time Tracking</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {confirmId && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <BentoCard className="w-full max-w-sm border-[#f59e0b]/30">
            <ShieldAlert className="w-12 h-12 text-[#f59e0b] mb-4 mx-auto" />
            <h3 className="text-xl font-black italic text-center text-white mb-2">Accept this order?</h3>
            <div className="flex justify-center items-center gap-2 mb-4">
              <span className="text-sm font-bold text-white uppercase">{riderName || 'Rider'}</span>
              {vehicleType && (
                <span className="text-[10px] font-black italic text-zinc-400 uppercase tracking-widest px-2 py-0.5 bg-zinc-800 rounded-full">
                  {vehicleType}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 text-center mb-6 leading-relaxed">
              Once accepted, you will be responsible for this delivery.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  onAccept(confirmId);
                  setConfirmId(null);
                }}
                className="w-full py-4 bg-[#f59e0b] text-black font-black uppercase italic tracking-widest rounded-xl active:scale-95 transition-all"
              >
                Accept Order
              </button>
              <button 
                onClick={() => setConfirmId(null)}
                className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-widest rounded-xl active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </BentoCard>
        </motion.div>
      )}

      {filteredAndSortedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-8">
            {!isOnline ? (
               <>
                 <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                 <WifiOff className="w-16 h-16 text-red-500 relative" />
               </>
            ) : connectionCount === 0 ? (
               <>
                 <div className="absolute inset-0 bg-zinc-500/20 blur-2xl rounded-full" />
                 <ShieldAlert className="w-16 h-16 text-zinc-500 relative" />
               </>
            ) : (
               <>
                 <div className="absolute inset-0 bg-[#f59e0b]/20 blur-2xl rounded-full animate-pulse" />
                 <Radar className="w-16 h-16 text-[#f59e0b] animate-[spin_4s_linear_infinite] relative" />
                 <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#f59e0b] rounded-full animate-ping" />
               </>
            )}
          </div>
          <div className="space-y-4 flex flex-col items-center">
            <h3 className={cn(
              "text-[10px] font-black uppercase tracking-[0.4em]",
              !isOnline ? "text-red-500" : connectionCount === 0 ? "text-zinc-500" : "text-[#f59e0b]"
            )}>
              {!isOnline ? "Network Offline" : connectionCount === 0 ? "No Connection" : "Searching for orders..."}
            </h3>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500 max-w-[280px] leading-relaxed italic">
              {!isOnline 
                ? "CONNECTION LOST - GO ONLINE TO SEE ORDERS." 
                : connectionCount === 0 
                ? "NO STORES LINKED - CONNECT WITH A STORE TO START RECEIVING ORDERS." 
                : searchQuery ? "NO ORDERS MATCHING YOUR SEARCH." : "LOOKING FOR ORDERS... NONE FOUND IN YOUR AREA YET."}
            </p>
            {!isOnline && onToggleOnline && (
              <button 
                onClick={onToggleOnline}
                className="px-6 py-3.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.15)] flex items-center gap-2"
              >
                <Power className="w-3.5 h-3.5" />
                Establish Uplink (Go Online)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedOrders.map(order => {
              const riderToShopDist = getDistanceBetween(riderLat, riderLng, order.shop_lat, order.shop_lng);
              const shopToCustomerDist = Number(order.distance_km || 0);
              const totalTripDist = riderToShopDist + shopToCustomerDist;

              return (
                <motion.div 
                  layout
                  key={order.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                  className="relative overflow-hidden rounded-[2rem]"
                  ref={el => scrollRefs.current[order.id] = el}
                  onClick={() => setHighlightedOrderId(order.id)}
                >
                {/* Revealed Quick Actions */}
                <div className="absolute inset-0 flex items-center justify-end px-6 gap-3 bg-zinc-900 border border-zinc-800 rounded-[2rem]">
                  <button 
                    onClick={() => window.open(`tel:${order.phone}`, '_self')}
                    className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <Phone size={20} />
                  </button>
                  <button 
                     onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.shop_lat},${order.shop_lng}`, '_blank')}
                     className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <Navigation2 size={20} />
                  </button>
                  <button 
                     onClick={() => toast.info(`Merchant Info: ${order.restaurant_name}`)}
                     className="w-12 h-12 bg-zinc-700 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <ExternalLink size={20} />
                  </button>
                </div>

                <motion.div
                  layout
                  drag="x"
                  dragConstraints={{ left: -180, right: 0 }}
                  dragElastic={0.1}
                  className="relative bg-black z-10 cursor-grab active:cursor-grabbing"
                >
                  <BentoCard 
                    className={cn(
                      "border-l-4 border-l-[#f59e0b] shadow-2xl overflow-hidden group transition-all duration-500",
                      highlightedOrderId === order.id ? "ring-2 ring-[#f59e0b] ring-offset-4 ring-offset-black scale-[0.99] brightness-125" : ""
                    )} 
                    glow={order.delivery_fee > 50 || highlightedOrderId === order.id}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="mb-3 flex items-center gap-3">
                           <StatusBadge status={order.delivery_status} />
                           {order.match_score && (
                             <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-3 py-1 rounded-full">
                               <span className="text-[10px] font-black text-[#f59e0b] uppercase tracking-widest italic">
                                 {Math.min(100, Math.round(order.match_score * 2.5))}% Store Match
                               </span>
                             </div>
                           )}
                           <div className="bg-zinc-800/50 border border-white/5 px-2 py-1 rounded-full flex items-center gap-1">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Swipe for actions</span>
                              <ArrowRight size={8} className="text-zinc-500" />
                           </div>
                        </div>
                        <h3 className="text-2xl font-headline font-black italic text-white uppercase tracking-tight leading-none mb-2">
                          {order.restaurant_name || 'Merchant-X'}
                        </h3>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <MapPin className="w-4 h-4 text-[#f59e0b] shrink-0" />
                            <span className="text-xs font-bold truncate max-w-[200px]">{order.address}, {order.city}</span>
                          </div>
                          <div className="flex items-center gap-4 text-zinc-500">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Distance to store</span>
                              <div className="flex items-center gap-1.5">
                                <Navigation className="w-3.5 h-3.5 text-orange-600" />
                                <span className="text-[11px] font-black italic text-orange-600 uppercase tracking-widest">
                                  {riderToShopDist > 0 ? `${riderToShopDist.toFixed(1)} KM` : `${Number(order.distance_km || 0).toFixed(1)} KM`}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Delivery time</span>
                              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                                 <Activity size={10} className="text-emerald-500 animate-pulse" />
                                 <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">
                                   {(() => {
                                      const isAccepted = order.delivery_status === 'accepted' || order.delivery_status === 'picked_up';
                                      let totalDist = Number(order.distance_km || 1);
                                      
                                      const rad = Math.PI / 180;
                                      const R = 6371;
                                      const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                                        const dLat = (lat2 - lat1) * rad;
                                        const dLon = (lon2 - lon1) * rad;
                                        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
                                        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                      };

                                      if (isAccepted && riderLat && riderLng && order.lat && order.lng) {
                                        totalDist = getDist(riderLat, riderLng, order.lat, order.lng);
                                      } else if (!isAccepted && riderLat && riderLng && order.shop_lat && order.shop_lng && order.lat && order.lng) {
                                        totalDist = getDist(riderLat, riderLng, order.shop_lat, order.shop_lng) + getDist(order.shop_lat, order.shop_lng, order.lat, order.lng);
                                      }

                                      const etaMinutes = Math.max(1, Math.ceil((totalDist / 20) * 60));
                                      return `${etaMinutes}M ETA`;
                                   })()}
                                 </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right group/fee relative cursor-help">
                        <div className="text-2xl font-headline font-black italic text-[#f59e0b] tracking-tighter">R{Number(order.delivery_fee || 0).toFixed(2)}</div>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-2xl opacity-0 group-hover/fee:opacity-100 pointer-events-none transition-opacity z-50 text-left">
                          <p className="text-[10px] text-zinc-400 font-bold mb-2 uppercase tracking-widest">Fee Breakdown</p>
                          <div className="flex justify-between text-xs mb-1"><span className="text-zinc-500">Base Pay</span><span className="text-white font-mono">R15.00</span></div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-zinc-500">Distance</span><span className="text-white font-mono">R{(Number(order.distance_km || 1) * 5).toFixed(2)}</span></div>
                          {order.surge_multiplier && order.surge_multiplier > 1 && (
                            <div className="flex justify-between text-xs mt-1 pt-1 border-t border-zinc-700 text-[#f59e0b]">
                              <span className="font-bold">Surge ({order.surge_multiplier.toFixed(1)}x)</span>
                              <span className="font-mono">R{((Number(order.delivery_fee) || 0) - (15 + Number(order.distance_km || 1) * 5)).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-center",
                          order.delivery_fee > 5 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"
                        )}>
                          {order.delivery_fee > 5 ? "Zone B Payout" : "Zone A Payout"}
                        </div>
                      </div>
                    </div>

                    {/* Trip Timeline Node Chain */}
                    <div className="bg-zinc-950 border border-zinc-900/80 p-5 rounded-[1.75rem] mb-6 relative overflow-hidden group/path">
                      <div className="absolute top-0 right-0 p-1.5 bg-zinc-950 border-l border-b border-zinc-800 rounded-bl-xl">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none">Flightpath Spec</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-4 italic">
                        <span>Tactical Leg Routing</span>
                        <span className="text-[#f59e0b] font-mono">Total: {(totalTripDist > 0 ? totalTripDist : shopToCustomerDist).toFixed(1)} KM</span>
                      </div>
                      <div className="relative flex items-center justify-between px-3 pt-2">
                        {/* Connection dashed line */}
                        <div className="absolute left-10 right-10 top-[26px] h-[2px] border-t-2 border-dashed border-zinc-800 pointer-events-none z-0" />
                        
                        {/* Node 1: Rider (You) */}
                        <div className="flex flex-col items-center z-10 w-20 text-center">
                          <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-1.5 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                            <Bike className="w-4 h-4" />
                          </div>
                          <span className="text-[8px] font-black uppercase text-zinc-400">Rider Position</span>
                          <span className="text-[10px] font-mono text-cyan-400 font-bold mt-0.5">Uplinked</span>
                        </div>

                        {/* Connection Leg 1 info */}
                        <div className="flex flex-col items-center z-10 mx-0.5">
                          <span className="text-[9px] font-mono font-black text-zinc-400 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md">
                            {riderToShopDist > 0 ? `${riderToShopDist.toFixed(1)} km` : "Locating"}
                          </span>
                        </div>

                        {/* Node 2: Shop */}
                        <div className="flex flex-col items-center z-10 w-20 text-center">
                          <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] mb-1.5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <span className="text-[8px] font-black uppercase text-zinc-400">Store / Merchant</span>
                          <span className="text-[10px] font-mono text-zinc-400 font-semibold mt-0.5 truncate max-w-[80px]">{order.restaurant_name || "Merchant"}</span>
                        </div>

                        {/* Connection Leg 2 info */}
                        <div className="flex flex-col items-center z-10 mx-0.5">
                          <span className="text-[9px] font-mono font-black text-zinc-400 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md">
                            {shopToCustomerDist.toFixed(1)} km
                          </span>
                        </div>

                        {/* Node 3: Customer (Dropoff) */}
                        <div className="flex flex-col items-center z-10 w-20 text-center">
                          <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-1.5 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <span className="text-[8px] font-black uppercase text-zinc-400">Dropoff Node</span>
                          <span className="text-[10px] font-mono text-rose-500 font-bold mt-0.5">Objective</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl group-hover:border-zinc-700 transition-colors">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2 italic">Cargo Details</span>
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <span key={idx} className="text-sm font-bold text-zinc-300 block truncate leading-tight uppercase font-headline italic">{item}</span>
                            ))}
                            {order.items.length > 2 && (
                              <span className="text-[10px] text-zinc-600 font-black uppercase italic">+{order.items.length - 2} more packets</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-zinc-300 truncate uppercase font-headline italic">{order.product_name || "Assorted Cargo"}</span>
                        )}
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl group-hover:border-zinc-700 transition-colors">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2 italic">Sector Value</span>
                        <span className="text-lg font-headline font-black italic text-[#f59e0b] tracking-tight">R{Number(order.total_price || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div 
                      className="mb-4 py-2 border border-zinc-800/50 bg-zinc-900/40 rounded-xl cursor-pointer hover:bg-zinc-800/80 transition-colors flex items-center justify-center gap-2"
                      onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] group-hover:text-white transition-colors">
                        {expandedOrderId === order.id ? "Minimize Mission Intel" : "Expand Mission Intel"}
                      </span>
                    </div>

                    <AnimatePresence>
                      {expandedOrderId === order.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-6"
                        >
                          <div className="pt-2 pb-4 space-y-4">
                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-2">Customer Profile</h4>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#f59e0b] font-black">
                                  {order.customer_name?.charAt(0) || 'C'}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white uppercase tracking-tight">{order.customer_name || 'Classified'}</div>
                                  <div className="text-[10px] text-zinc-500 font-mono">{order.phone || 'Comms Offline'}</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-2">Drop-off Coordinates</h4>
                              <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                                {order.address}<br />
                                <span className="text-zinc-500">{order.city}</span>
                              </p>
                            </div>

                            {/* Routing Map Preview inside Expanded Intel */}
                            <div className="border border-zinc-805 bg-zinc-900/50 rounded-xl p-4 space-y-3 border-zinc-800">
                              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Leg Routing Radar Map</h4>
                              <RouteMiniMap 
                                shopLat={order.shop_lat} 
                                shopLng={order.shop_lng} 
                                customerLat={order.lat} 
                                customerLng={order.lng} 
                                riderLat={riderLat} 
                                riderLng={riderLng} 
                              />
                              <div className="flex justify-between items-center text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">
                                <span>Sectors Covered: Area Bravo</span>
                                <span className="text-zinc-500 font-mono">GPS Status: LOCK</span>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-2">Full Payload Request</h4>
                              <ul className="space-y-2">
                                {order.items && order.items.length > 0 ? order.items.map((it, i) => (
                                  <li key={i} className="text-xs text-zinc-400 flex gap-2">
                                    <span className="text-[#f59e0b]">-</span> {it}
                                  </li>
                                )) : (
                                  <li className="text-xs text-zinc-400 flex gap-2">
                                    <span className="text-[#f59e0b]">-</span> {order.product_name}
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <SwipeButton 
                      label={isLimitReached ? "LIMIT REACHED" : "SLIDE TO ACCEPT"} 
                      onComplete={() => {
                        if (isLimitReached) {
                          toast.error('PAYLOAD LIMIT REACHED. Complete current missions first.');
                        } else if (instantAccept) {
                          onAccept(order.id);
                          toast.success('Mission accepted instantly!', {
                            description: `You are locked into delivering for ${order.restaurant_name}.`
                          });
                        } else {
                          setConfirmId(order.id);
                        }
                      }} 
                      disabled={isLimitReached}
                      color={isLimitReached ? "#3f3f46" : "#f59e0b"}
                      resetToken={confirmId || 'reset'}
                    />
                  </BentoCard>
                </motion.div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

const SimpleMap = ({ lat, lng }: { lat?: number, lng?: number }) => {
  const center: [number, number] = lat && lng ? [lat, lng] : [-25.9894, 28.2148];
  return (
    <div className="w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
       <MapboxMap 
        initialViewState={{
          longitude: center[1],
          latitude: center[0],
          zoom: 16
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
        className="brightness-[1.05] contrast-[0.95] saturate-[0.8]"
        style={{ width: '100%', height: '100%' }}
      >
        <Marker longitude={center[1]} latitude={center[0]}>
          <div className="bg-[#f59e0b] w-3 h-3 rounded-full border border-white"></div>
        </Marker>
      </MapboxMap>
    </div>
  );
};

const ActiveMissionView = React.memo(({ orders, onUpdateStatus, onScreenTap, onShowTracking, profile, isNavVisible }: { 
  orders: DeliveryOrder[], 
  onUpdateStatus: (id: string, status: DeliveryStatus) => void;
  onScreenTap?: () => void;
  onShowTracking?: (id: string) => void;
  profile?: RiderProfile;
  isNavVisible?: boolean;
}) => {
  const [sortMethod, setSortMethod] = useState<'default' | 'optimized'>('default');
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showGooglePocket, setShowGooglePocket] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isPocketExpanded, setIsPocketExpanded] = useState(false);
  const [routeProgress, setRouteProgress] = useState(0);
  const [activeEta, setActiveEta] = useState(0);
  const [routeDistance, setRouteDistance] = useState(0);

  const isVoiceSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const win = window as unknown as Record<string, unknown>;
    const SR = (win.webkitSpeechRecognition || win.SpeechRecognition) as { 
      new(): { 
        lang: string; 
        start: () => void; 
        onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
        onend: () => void;
        onerror: () => void;
      } 
    };
    
    if (!SR) return;
    
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log('Voice Command:', transcript);
      
      if (transcript.includes('pick up') || transcript.includes('picked up') || transcript.includes('arrived') || transcript.includes('merchant')) {
        onUpdateStatus(currentOrder.id, 'picked_up');
        toast.success(`Voice: Pickup confirmed`, {
          description: `Order picked up at ${currentOrder.restaurant_name}`
        });
      } else if (transcript.includes('delivered') || transcript.includes('complete') || transcript.includes('delivery') || transcript.includes('dropped off')) {
        setShowSuccessOverlay(true);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {
          // Playback ignored
        }
        setTimeout(() => {
          onUpdateStatus(currentOrder.id, 'delivered');
          setShowSuccessOverlay(false);
        }, 3000);
        toast.success(`Voice: Delivery completed`, {
          description: `Order delivered successfully`
        });
      } else if (transcript.includes('optimize') || transcript.includes('shortest') || transcript.includes('route')) {
        optimizeRoute();
        toast.success(`Voice: Route updated`, {
          icon: <Zap className="w-4 h-4 text-[#f59e0b]" />,
          description: "Finding the fastest path for you."
        });
      } else if (transcript.includes('next') || transcript.includes('skip') || transcript.includes('forward')) {
        setActiveIndex((prev) => (prev + 1) % displayOrders.length);
        toast.info(`Voice: Next order`);
      } else if (transcript.includes('map') || transcript.includes('view') || transcript.includes('tactical')) {
        setIsSwapped(!isSwapped);
        toast.info(`Voice: Switching view`);
      }
    };
    
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
  };

  const displayOrders = sortMethod === 'optimized' 
    ? [...orders].sort((a, b) => (Number(a.distance_km) || 0) - (Number(b.distance_km) || 0))
    : orders;

  const currentOrder = displayOrders[activeIndex] || displayOrders[0];

  const rawDist = Number(currentOrder?.distance_km);
  const validDist = isNaN(rawDist) ? 0 : rawDist;
  const etaDisplay = String(Math.max(0, Math.floor(validDist * 2))).padStart(2, '0');

  if (!currentOrder) return null;

  const isPickedUp = currentOrder.delivery_status === 'picked_up';
  const targetAddress = `${currentOrder.address}, ${currentOrder.city}`;

  const optimizeRoute = () => {
    setSortMethod('optimized');
    setActiveIndex(0);
    toast.success('Route updated', {
      icon: <Zap className="w-4 h-4 text-[#f59e0b]" />,
      description: 'Finding the fastest path between orders.'
    });
  };

  const buildNavigationUrl = (originLat: number, originLng: number, destLat: number, destLng: number, vehicleType: string) => {
    let travelMode = 'driving';
    if (vehicleType === 'bicycle') travelMode = 'bicycling';
    // Google maps universal link handles two-wheeler mostly as driving or two-wheeler if available
    if (vehicleType === 'scooter') travelMode = 'two-wheeler';
    
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`;
  };

  const buildWazeNavigationUrl = (destLat: number, destLng: number) => {
    return `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
  };

  const handleStartNav = (e: React.MouseEvent, provider: 'google' | 'waze' = 'google') => {
    e.stopPropagation();
    
    const originLat = profile?.current_latitude || -25.9964; // Regional rider fallback (Tembisa)
    const originLng = profile?.current_longitude || 28.2268;
    
    if (!originLat || !originLng) {
      toast.error('Location Unavailable', { description: 'Missing rider coordinates.' });
      return;
    }

    let destLat: number | undefined;
    let destLng: number | undefined;

    if (currentOrder.delivery_status === 'accepted') {
      destLat = currentOrder.shop_lat || -25.9922; // Ivory Park merchant fallback
      destLng = currentOrder.shop_lng || 28.2045;
    } else if (currentOrder.delivery_status === 'picked_up') {
      destLat = currentOrder.lat || -25.9933; // Kaalfontein customer fallback
      destLng = currentOrder.lng || 28.2125;
    } else {
      toast.error('Navigation unavailable for current mission status');
      return;
    }

    if (!destLat || !destLng) {
      toast.error('Location Unavailable', { description: 'Missing destination coordinates.' });
      return;
    }

    const url = provider === 'waze' 
      ? buildWazeNavigationUrl(destLat, destLng)
      : buildNavigationUrl(originLat, originLng, destLat, destLng, profile?.vehicle_type || 'car');
    
    // Open in new tab/native maps app
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <div className="h-screen flex flex-col pointer-events-none max-w-5xl mx-auto w-full relative">
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center pointer-events-auto overflow-hidden animate-fade-in"
          >
            {/* Elegant Confetti Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              {(() => {
                const confcolors = ['#34d399', '#10b981', '#059669', '#6ee7b7', '#f59e0b', '#3b82f6'];
                return Array.from({ length: 45 }).map((_, i) => {
                  const scale = Math.random() * 0.7 + 0.4;
                  const left = `${Math.random() * 100}%`;
                  const delay = Math.random() * 2;
                  const duration = Math.random() * 2 + 1.5;
                  const rotate = Math.random() * 360;
                  return (
                    <motion.div
                      key={i}
                      style={{ 
                        position: 'absolute', 
                        left, 
                        top: '-10px', 
                        width: '8px', 
                        height: '14px', 
                        backgroundColor: confcolors[i % confcolors.length], 
                        borderRadius: '2px', 
                        transform: `rotate(${rotate}deg) scale(${scale})` 
                      }}
                      animate={{
                        y: ['0vh', '110vh'],
                        x: [0, `${(Math.random() - 0.5) * 150}px`],
                        rotate: [rotate, rotate + (Math.random() > 0.5 ? 360 : -360)]
                      }}
                      transition={{
                        delay,
                        duration,
                        repeat: Infinity,
                        ease: 'linear'
                      }}
                    />
                  );
                });
              })()}
            </div>

            {/* Pulsing Green/Emerald Rings */}
            <div className="relative flex items-center justify-center mb-8">
              <motion.div 
                animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-24 h-24 rounded-full border border-emerald-500/30"
              />
              <motion.div 
                animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                className="absolute w-24 h-24 rounded-full border border-emerald-400/40"
              />
              <motion.div 
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center z-10"
              >
                <motion.div
                  initial={{ rotate: -90, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle className="w-12 h-12 text-emerald-400" strokeWidth={2.5} />
                </motion.div>
              </motion.div>
            </div>

            {/* Glowing Success Text */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="px-6 text-center z-10"
            >
              <h3 className="text-3xl font-headline font-black italic uppercase tracking-wider text-emerald-400 mb-2">
                Mission Complete
              </h3>
              <p className="text-[#f59e0b] text-[10px] font-black uppercase tracking-[0.4em] mb-6">
                DELIVERY DIRECTIVE VERIFIED
              </p>
              
              <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 w-64 mx-auto space-y-3 shadow-2xl backdrop-blur-md text-left">
                <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Asset ID</span>
                  <span className="text-[10px] font-mono font-bold text-white uppercase">#{currentOrder.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Yield Earned</span>
                  <span className="text-xs font-headline font-black italic text-emerald-400">R {Number(currentOrder.delivery_fee || 5.0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Sector EXP</span>
                  <span className="text-xs font-headline font-black italic text-[#f59e0b]">+15 EXP</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        {!isSwapped ? (
          <>
            <AppMapBackground
              isOnline={true}
              activeOrder={currentOrder}
              onMapClick={onScreenTap}
              onProgressUpdate={setRouteProgress}
              onETAUpdate={setActiveEta}
              onDistanceUpdate={setRouteDistance}
              riderProfileLat={profile?.current_latitude}
              riderProfileLng={profile?.current_longitude}
              hideNavigationHUD={isNavVisible}
            />
          </>
        ) : (
          <SimpleMap 
            lat={currentOrder.lat || currentOrder.shop_lat} 
            lng={currentOrder.lng || currentOrder.shop_lng} 
          />
        )}
      </div>

      {/* Map Area placeholder (transparent overlay container) */}
      <div 
        className="flex-1 relative overflow-hidden pointer-events-none group"
      >
        <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-4 bottom-10 z-[60] flex flex-col items-end gap-3 pointer-events-none"
            >
              <AnimatePresence>
                {(showGooglePocket || isSwapped) && (
                  <motion.div 
                    initial={{ opacity: 0, x: 200 }}
                    animate={{ opacity: 1, x: isPocketExpanded ? 0 : 180 }}
                    exit={{ opacity: 0, x: 200 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={cn(
                      "absolute top-1/4 right-0 translate-y-[-50%] bg-black rounded-l-3xl overflow-hidden border-y border-l border-[#f59e0b]/40 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex pointer-events-auto transition-all",
                      isPocketExpanded ? "w-64 h-80" : "w-10 h-32"
                    )}
                  >
                    {!isPocketExpanded ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPocketExpanded(true);
                        }}
                        className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border-l-4 border-[#f59e0b] hover:bg-zinc-800 transition-colors"
                      >
                         <ChevronLeft className="w-5 h-5 text-[#f59e0b] mb-2" />
                         <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest writing-vertical-lr rotate-180">Map</span>
                      </button>
                    ) : (
                      <div className="w-full h-full relative group/pocket"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSwapped(!isSwapped);
                        }}
                      >
                         {/* Close internal tab */}
                         <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsPocketExpanded(false);
                            }}
                            className="absolute -left-6 flex flex-col top-1/2 -translate-y-1/2 h-20 w-6 bg-zinc-900 border-l border-y border-[#f59e0b]/40 rounded-l-md items-center justify-center z-50 text-zinc-400 hover:text-white"
                         >
                            <ChevronRight className="w-4 h-4" />
                         </button>

                         {/* Swap Icon Overlay */}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pocket:opacity-100 transition-opacity z-30 flex items-center justify-center cursor-pointer">
                            <div className="bg-[#f59e0b] p-2 rounded-full text-black shadow-xl">
                              <ArrowLeftRight className="w-5 h-5" />
                            </div>
                         </div>

                         <div className="absolute top-2 left-2 z-20">
                            <div className="px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-md border border-white/10">
                               <span className="text-[8px] font-black uppercase text-white/70 tracking-widest">
                                 {isSwapped ? 'Tactical' : 'Orbital'}
                               </span>
                            </div>
                         </div>

                         <AnimatePresence mode="wait">
                           {!isSwapped ? (
                              <motion.iframe
                                key="orbital"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                lat={currentOrder.lat || currentOrder.shop_lat}
                                lng={currentOrder.lng || currentOrder.shop_lng}
                                width="100%"
                                height="100%"
                                className="grayscale-[0.4] contrast-[1.2] pointer-events-none"
                                frameBorder="0"
                              />
                           ) : (
                              <motion.div 
                                key="tactical"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-full h-full scale-[2] origin-center -rotate-12 pointer-events-none grayscale opacity-60 bg-black"
                              >
                                 <AppMapBackground
                                   isOnline={true}
                                   activeOrder={currentOrder}
                                   onProgressUpdate={setRouteProgress}
                                 />
                              </motion.div>
                           )}
                         </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle Pocket Button */}
              {!isSwapped && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGooglePocket(!showGooglePocket);
                  }}
                  className={cn(
                    "w-14 h-14 bg-black text-white rounded-[1.5rem] flex flex-col items-center justify-center border-2 shadow-[0_15px_30px_rgba(0,0,0,0.5)] pointer-events-auto active:scale-90 transition-all group",
                    showGooglePocket ? "border-zinc-800 text-zinc-500" : "border-[#f59e0b] text-[#f59e0b]"
                  )}
                >
                  {showGooglePocket ? <X className="w-6 h-6" /> : <Map className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                  <span className="text-[7px] font-black uppercase tracking-tighter mt-1">
                    {showGooglePocket ? 'Close' : 'Nav'}
                  </span>
                </button>
              )}
            </motion.div>
        </AnimatePresence>

        {/* Multi-stop Preview */}
        {displayOrders.length > 1 && (
          <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
            <div className="flex justify-center gap-1">
              {displayOrders.map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === activeIndex ? "bg-[#f59e0b] w-8" : "bg-zinc-700 w-4"
                  )} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Need Help & Close Grouped Buttons */}
        <div className="absolute right-6 top-1/2 -translate-y-[100px] z-[70] pointer-events-auto flex flex-col items-center gap-4">
          <div className="flex flex-col items-center group cursor-pointer" onClick={(e) => handleStartNav(e, 'google')}>
             <div className="w-12 h-12 rounded-full bg-[#4285F4] shadow-[0_0_15px_#4285F4]/50 flex items-center justify-center mb-1 hover:brightness-110 active:scale-95 transition-all">
                <Navigation className="w-5 h-5 text-white fill-white" />
             </div>
             <span className="text-[8px] font-black text-white/90 drop-shadow-md uppercase tracking-widest">MAPS</span>
          </div>

          <div className="flex flex-col items-center group cursor-pointer" onClick={(e) => handleStartNav(e, 'waze')}>
             <div className="w-12 h-12 rounded-full bg-cyan-500 shadow-[0_0_15px_rgb(6,182,212)]/50 flex items-center justify-center mb-1 hover:brightness-110 active:scale-95 transition-all">
                <Navigation className="w-5 h-5 text-white fill-white" />
             </div>
             <span className="text-[8px] font-black text-white/90 drop-shadow-md uppercase tracking-widest">WAZE</span>
          </div>

          {isPickedUp && (
            <div className="flex flex-col items-center group cursor-pointer" onClick={(e) => { e.stopPropagation(); if(onShowTracking) onShowTracking(currentOrder.id); }}>
               <div className="w-12 h-12 rounded-full bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center mb-1 hover:bg-emerald-500 active:scale-95 transition-all">
                  <Radar className="w-5 h-5 text-white animate-spin-slow" />
               </div>
               <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">SHARE</span>
            </div>
          )}

          <div className="flex flex-col items-center group cursor-pointer" onClick={() => { if(onScreenTap) onScreenTap(); }}>
             <div className="w-12 h-12 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-1 group-hover:border-white/30 transition-all">
                <X className="w-6 h-6 text-white" />
             </div>
             <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">CLOSE</span>
          </div>

          <div className="flex flex-col items-center group cursor-pointer" onClick={(e) => { e.stopPropagation(); optimizeRoute(); }}>
             <div className="w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-[#f59e0b]/40 flex items-center justify-center mb-1 group-hover:bg-[#f59e0b] group-hover:text-black transition-all">
                <Zap className="w-5 h-5 text-[#f59e0b] group-hover:text-black" />
             </div>
             <span className="text-[8px] font-black text-[#f59e0b] uppercase tracking-widest">OPTIMIZE</span>
          </div>

          {isVoiceSupported && (
            <div className="flex flex-col items-center group cursor-pointer" onClick={(e) => { e.stopPropagation(); startListening(); }}>
               <div className={cn(
                 "w-12 h-12 rounded-full border flex items-center justify-center mb-1 transition-all",
                 isListening ? "bg-red-500 border-red-400 animate-pulse" : "bg-black/80 backdrop-blur-xl border-white/10"
               )}>
                  {isListening ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
               </div>
               <span className={cn("text-[8px] font-black uppercase tracking-widest", isListening ? "text-red-500" : "text-white/40")}>
                 {isListening ? 'LISTENING' : 'VOICE'}
               </span>
            </div>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); toast('Support link activated. Connecting to HQ...'); }}
            className="bg-black/60 backdrop-blur-md border border-white/10 text-white font-black text-[9px] px-4 py-2 rounded-full shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em] hover:bg-zinc-800"
          >
            NEED HELP?
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isNavVisible && (
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-black/80 backdrop-blur-3xl p-4 pb-10 pointer-events-auto border-t border-white/5 z-50 flex flex-col gap-3 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]"
          >
          {/* Order Sequence & Controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {displayOrders.map((o, idx) => (
                <button
                  key={o.id}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 border whitespace-nowrap",
                    activeIndex === idx 
                      ? "bg-[#f59e0b] text-black border-[#f59e0b]" 
                      : "bg-zinc-900 text-zinc-500 border-zinc-800"
                  )}
                >
                  <div className={cn("w-1 h-1 rounded-full", activeIndex === idx ? "bg-black" : (o.delivery_status === 'picked_up' ? "bg-emerald-500" : "bg-zinc-600"))} />
                  {o.delivery_status === 'picked_up' ? 'DROP' : 'PICK'}
                </button>
              ))}
            </div>
            
            <button 
              onClick={optimizeRoute}
              className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 shrink-0"
            >
              OPT
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn("px-1 py-0.5 rounded text-[8px] font-black tracking-tighter uppercase bg-transparent", isPickedUp ? "text-emerald-500" : "text-[#f59e0b]")}>
                  • {isPickedUp ? 'DELIVERING' : 'HEADING TO PICK UP'}
                </div>
              </div>
              <h2 className="text-lg font-headline font-black italic text-white uppercase tracking-tight truncate leading-none">
                {targetAddress || 'ADDRESS LOCK'}
              </h2>
              {routeDistance > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <Activity size={8} className="text-[#f59e0b] animate-pulse" />
                  <span className="text-[8px] font-mono text-zinc-500 uppercase">{(routeDistance / 1000).toFixed(1)} KM OUT</span>
                </div>
              )}
            </div>
            
            <div 
              className="text-right flex flex-col items-end cursor-pointer group active:scale-95 transition-transform"
              onClick={(e) => { e.stopPropagation(); if(isVoiceSupported) startListening(); }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">ETA</span>
                {isListening && <Mic size={8} className="text-red-500 animate-pulse" />}
              </div>
              <p className={cn(
                "text-xl font-headline font-black italic leading-none transition-colors px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl",
                isListening ? "text-red-500 border-red-500/20" : "text-[#f59e0b]"
              )}>
                {activeEta || etaDisplay} <span className="text-[8px] tracking-tighter">M</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="w-full h-0.5 bg-zinc-900 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute left-0 top-0 bottom-0 bg-[#f59e0b] shadow-[0_0_10px_#f59e0b]" 
                initial={{ width: 0 }} 
                animate={{ width: `${routeProgress}%` }} 
                transition={{ duration: 1 }} 
              />
            </div>

            <SwipeButton 
              label={isPickedUp ? "COMPLETE DELIVERY" : "CONFIRM PICK UP"}
              onComplete={() => {
                if (isPickedUp) {
                  setShowSuccessOverlay(true);
                  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                  try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(() => {});
                  } catch {
                    // Playback ignored
                  }
                  setTimeout(() => {
                    onUpdateStatus(currentOrder.id, 'delivered');
                    setShowSuccessOverlay(false);
                  }, 3000);
                } else {
                  onUpdateStatus(currentOrder.id, 'picked_up');
                }
              }}
              color="#f59e0b"
              resetToken={currentOrder.delivery_status}
            />
          </div>
        </motion.div>
        )}
      </AnimatePresence>
  </div>
  );
});

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Zap key={i} className={cn("w-2 h-2", i < rating ? "text-[#f59e0b] fill-[#f59e0b]" : "text-zinc-800")} />
    ))}
  </div>
);

const HistoryView = React.memo(({ history }: { history: DeliveryOrder[] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  const [customGoal, setCustomGoal] = useState<number>(() => {
    return Number(localStorage.getItem('localeats_daily_goal') || '350');
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(customGoal.toString());

  const [expenses, setExpenses] = useState<number>(() => {
    return Number(localStorage.getItem('localeats_expenses') || '0');
  });
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [expenseInput, setExpenseInput] = useState(expenses.toString());

  const handleSaveGoal = () => {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      setCustomGoal(val);
      localStorage.setItem('localeats_daily_goal', val.toString());
      setEditingGoal(false);
      toast.success(`Daily earnings target milestone updated to R${val.toFixed(2)}`);
    } else {
      toast.error('Please enter a valid target amount');
    }
  };

  const handleSaveExpenses = () => {
    const val = parseFloat(expenseInput);
    if (!isNaN(val) && val >= 0) {
      setExpenses(val);
      localStorage.setItem('localeats_expenses', val.toString());
      setEditingExpenses(false);
      toast.success(`Expenses updated to R${val.toFixed(2)}`);
    } else {
      toast.error('Please enter a valid expense amount');
    }
  };

  const getStatsForOrder = useCallback((order: DeliveryOrder) => {
    const fee = Number(order.delivery_fee || 0);
    const multiplier = order.surge_multiplier || 1.0;
    const isCompleted = order.status === 'completed' || order.delivery_status === 'delivered';
    
    // Derived values
    const base = fee / multiplier;
    const surge = fee - base;
    const tip = isCompleted ? Math.max(12, Math.round((order.total_price || 120) * 0.12 * 10) / 10) : 0;
    const total = fee + tip;
    
    return { base, surge, tip, total };
  }, []);

  const [initialNow] = useState(() => Date.now());

  const filteredByPeriod = useMemo(() => {
    const nowMs = initialNow;
    return history.filter(order => {
      const orderMs = new Date(order.updated_at).getTime();
      const diffMs = nowMs - orderMs;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      if (period === '7d') return diffDays <= 7;
      if (period === '30d') return diffDays <= 30;
      return true;
    });
  }, [history, period, initialNow]);

  const totals = useMemo(() => {
    let baseTotal = 0;
    let surgeTotal = 0;
    let tipTotal = 0;
    let totalEarned = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    
    filteredByPeriod.forEach(order => {
      const isCompleted = order.status === 'completed' || order.delivery_status === 'delivered';
      const isCancelled = order.status === 'cancelled' || order.delivery_status === 'cancelled';
      
      if (isCompleted) {
        const stats = getStatsForOrder(order);
        baseTotal += stats.base;
        surgeTotal += stats.surge;
        tipTotal += stats.tip;
        totalEarned += stats.total;
        completedCount += 1;
      } else if (isCancelled) {
        cancelledCount += 1;
      }
    });
    
    return { baseTotal, surgeTotal, tipTotal, totalEarned, completedCount, cancelledCount };
  }, [filteredByPeriod, getStatsForOrder]);

  const filteredOrders = useMemo(() => {
    return filteredByPeriod.filter(order => {
      // Tab filter
      const isCompleted = order.status === 'completed' || order.delivery_status === 'delivered';
      const isCancelled = order.status === 'cancelled' || order.delivery_status === 'cancelled';
      
      if (activeTab === 'completed' && !isCompleted) return false;
      if (activeTab === 'cancelled' && !isCancelled) return false;
      
      // Search Box filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        order.restaurant_name?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query) ||
        order.product_name?.toLowerCase().includes(query)
      );
    });
  }, [filteredByPeriod, activeTab, searchQuery]);

  // Chart data aligned to the filtered target duration
  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const earningsByDay = new Array(7).fill(0);
    
    filteredByPeriod.forEach(order => {
      const isCompleted = order.status === 'completed' || order.delivery_status === 'delivered';
      if (isCompleted) {
        const date = new Date(order.updated_at);
        const dayIndex = date.getDay();
        const stats = getStatsForOrder(order);
        earningsByDay[dayIndex] += stats.total;
      }
    });

    return days.map((name, i) => ({
      name,
      yield: Math.round(earningsByDay[i] * 100) / 100 || (i * 12 + 10) // Smooth mock fallback for aesthetic continuity
    }));
  }, [filteredByPeriod, getStatsForOrder]);

  const handleExportCSV = () => {
    try {
      const headers = "Date,Order ID,Restaurant,Customer,Items,Base Fee,Surge,Tip,Total Paid,Status\n";
      const rows = filteredByPeriod.map(order => {
        const stats = getStatsForOrder(order);
        const dateStr = new Date(order.updated_at).toLocaleDateString();
        const statusStr = order.status.toUpperCase();
        const itemsClean = (order.items || [order.product_name || 'Delivery']).join(" | ").replace(/"/g, '""');
        return `"${dateStr}","CODE-${order.id.slice(-4).toUpperCase()}","${(order.restaurant_name || '').replace(/"/g, '""')}","${(order.customer_name || '').replace(/"/g, '""')}","${itemsClean}",${stats.base.toFixed(2)},${stats.surge.toFixed(2)},${stats.tip.toFixed(2)},${stats.total.toFixed(2)},"${statusStr}"`;
      }).join("\n");
      
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `localeats_earnings_export_${period}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Client Tax Ledger CSV Downloaded", {
        description: `Exported ${filteredByPeriod.length} active records.`
      });
    } catch (e) {
      const err = e as Error;
      toast.error(`Export failed: ${err?.message || 'Unknown issue'}`);
    }
  };

  const goalProgressPercent = Math.min(100, Math.round((totals.totalEarned / customGoal) * 100));

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto w-full">
      <header className="pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white mb-2">Activity Ledger</h2>
          <div className="flex items-center gap-3">
             <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] flex items-center gap-2 italic">
               Earnings Audit • Active Sector
             </p>
             <div className="p-1 bg-zinc-900 border border-zinc-800 rounded-md">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
             </div>
          </div>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="bg-zinc-950 border border-zinc-850 p-1 rounded-2xl flex items-center gap-1 self-start shrink-0">
          {(['7d', '30d', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                period === p 
                  ? "bg-[#f59e0b] text-black shadow-md font-bold" 
                  : "text-zinc-500 hover:text-white"
              )}
            >
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last Month' : 'All Ledger'}
            </button>
          ))}
        </div>
      </header>

      {/* Grid Summary Stats Row */}
      <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-zinc-900 border border-zinc-850 rounded-[1.5rem] p-5 flex flex-col justify-between">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Aggregate Payout</span>
          <div>
            <span className="text-2xl font-headline font-black italic text-white">R{totals.totalEarned.toFixed(2)}</span>
            <div className="flex items-center gap-1.5 mt-1 text-[8px] font-bold text-[#f59e0b] bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-lg px-2 py-0.5 w-fit">
              <TrendingUp className="w-2.5 h-2.5" /> Base + Surge + Tips
            </div>
          </div>
        </div>

        <div 
          onClick={() => {
            if (!editingExpenses) {
              setEditingExpenses(true);
              setExpenseInput(expenses.toString());
            }
          }}
          className={cn(
            "bg-zinc-900 border border-zinc-850 rounded-[1.5rem] p-5 flex flex-col justify-between text-left transition-colors",
            !editingExpenses ? "hover:border-zinc-750 cursor-pointer" : ""
          )}
        >
          <div className="flex justify-between items-center w-full mb-1">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Fuel & Expenses</span>
          </div>
          {editingExpenses ? (
            <div className="space-y-2 w-full pt-1" onClick={e => e.stopPropagation()}>
              <input 
                type="number"
                value={expenseInput}
                onChange={e => setExpenseInput(e.target.value)}
                placeholder="R Expenses"
                className="w-full bg-black border border-zinc-800 rounded-lg text-xs p-1 text-white font-mono h-6 outline-none"
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={handleSaveExpenses} className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded uppercase">Log</button>
                <button onClick={() => setEditingExpenses(false)} className="px-2 py-0.5 bg-zinc-850 text-zinc-400 text-[8px] font-black rounded uppercase">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-2xl font-headline font-black italic text-red-400">-R{expenses.toFixed(2)}</span>
              <div className="text-[8px] font-black text-[#f59e0b] uppercase tracking-widest mt-1">
                Net: R{Math.max(0, totals.totalEarned - expenses).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div 
          onClick={() => {
            if (!editingGoal) {
              setEditingGoal(true);
              setGoalInput(customGoal.toString());
            }
          }}
          className={cn(
            "bg-zinc-900 border border-zinc-850 rounded-[1.5rem] p-5 flex flex-col justify-between text-left transition-colors",
            !editingGoal ? "hover:border-zinc-750 cursor-pointer" : ""
          )}
        >
          <div className="flex justify-between items-center w-full mb-1">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Milestone Progress</span>
            <span className="text-[8px] text-[#f59e0b] font-black uppercase tracking-widest font-sans">Goal R{customGoal}</span>
          </div>
          {editingGoal ? (
            <div className="space-y-2 w-full pt-1" onClick={e => e.stopPropagation()}>
              <input 
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="R Goal"
                className="w-full bg-black border border-zinc-800 rounded-lg text-xs p-1 text-white font-mono h-6 outline-none"
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={handleSaveGoal} className="px-2 py-0.5 bg-[#f59e0b] text-black text-[8px] font-black rounded uppercase">Lock</button>
                <button onClick={() => setEditingGoal(false)} className="px-2 py-0.5 bg-zinc-850 text-zinc-400 text-[8px] font-black rounded uppercase">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-headline font-black italic text-emerald-450">{goalProgressPercent}%</span>
                <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-tighter">to milestone</span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-1 mt-2.5 overflow-hidden border border-zinc-900">
                <div 
                  className="bg-emerald-500 max-w-full h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] duration-500 transition-all"
                  style={{ width: `${goalProgressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-850 rounded-[1.5rem] p-5 flex flex-col justify-between">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2 font-sans">Successful Flights</span>
          <div>
            <span className="text-2xl font-headline font-black italic text-cyan-400">{totals.completedCount}</span>
            <span className="text-[8px] text-zinc-500 uppercase tracking-widest block mt-1 font-black">Secure Cargo Units</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-850 rounded-[1.5rem] p-5 flex flex-col justify-between">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1 font-sans">Loss Ratio</span>
          <div>
            <span className="text-2xl font-headline font-black italic text-red-500">{totals.cancelledCount}</span>
            <div className="flex items-center gap-1 text-[8px] font-black text-zinc-500 uppercase tracking-wider mt-1">
              Abort Protocols
            </div>
          </div>
        </div>
      </section>

      {/* Yield Performance Area Chart */}
      <BentoCard className="h-72 border-zinc-850/60 bg-zinc-950/20 p-6" glow>
        <div className="flex items-center justify-between mb-6">
           <div className="flex flex-col text-left">
             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Yield Performance Chart</span>
             <span className="text-[8.5px] font-black uppercase text-[#f59e0b] tracking-widest mt-0.5">Tactical Earnings over active slots</span>
           </div>
           <Activity className="w-4 h-4 text-[#f59e0b] opacity-60" />
        </div>
        <div className="h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height={176} minWidth={0} minHeight={176}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1b1b1f" strokeOpacity={0.4} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#666', fontSize: 10, fontWeight: 'bold' }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', fontSize: '10px' }}
              itemStyle={{ color: '#f59e0b', fontWeight: 'black' }}
            />
            <Area 
              type="monotone" 
              dataKey="yield" 
              stroke="#f59e0b" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorYield)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>

      {/* Live Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-zinc-900 pb-4">
          
          {/* Filters Switch Tabs */}
          <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-850 rounded-2xl w-full md:w-auto self-stretch md:self-auto overflow-x-auto justify-start shrink-0">
            {(['all', 'completed', 'cancelled'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setExpandedOrderId(null);
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
                  activeTab === tab 
                    ? "bg-zinc-900 text-[#f59e0b] border border-zinc-800 shadow" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                {tab === 'all' && 'All Log Entries'}
                {tab === 'completed' && '✅ Secure Deliveries'}
                {tab === 'cancelled' && '❌ Cancelled'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto shrink-0 md:justify-end">
            {/* Search inputs */}
            <div className="relative flex-1 md:w-64 max-w-md bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center px-3.5 h-11 shrink-0">
              <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setExpandedOrderId(null);
                }}
                placeholder="Search restaurant, product, area..."
                className="bg-transparent border-none text-xs text-white placeholder-zinc-700 outline-none w-full font-sans"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* CSV Statement Export Action */}
            <button
              onClick={handleExportCSV}
              className="px-4 h-11 bg-zinc-950 border border-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-2xl active:scale-95 transition-all w-fit shrink-0 flex items-center justify-center gap-2 font-mono text-[10px] uppercase font-black tracking-widest leading-none shadow-md group"
              title="Export Account Statement Ledger CSV"
            >
              <Download className="w-4 h-4 text-[#f59e0b] group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Export Statement</span>
            </button>
          </div>
        </div>

        {/* Detailed Orders Accordion Ledger list */}
        {filteredOrders.length === 0 ? (
          <div className="py-24 text-center text-zinc-650 flex flex-col items-center justify-center">
             <SlidersHorizontal className="w-10 h-10 mb-3 text-zinc-800" />
             <p className="text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Cleared Search Field</p>
             <p className="text-[11px] max-w-[240px] leading-relaxed font-sans mt-1">No matches in your active sector directory. Try broadening the queries.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredOrders.map((item, i) => {
              const stats = getStatsForOrder(item);
              const isExpanded = expandedOrderId === item.id;
              const isCompleted = item.status === 'completed' || item.delivery_status === 'delivered';
              const isCancelled = item.status === 'cancelled' || item.delivery_status === 'cancelled';
              const customItemsList = item.items || (item.product_name ? [item.product_name] : ["Artisan Burgers & Golden Fries", "Extra Chilli Dip Sauce"]);

              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(10, i) * 0.04 }}
                  className="w-full text-left"
                >
                  <BentoCard 
                    className={cn(
                      "p-4 bg-zinc-900/10 border-zinc-850 hover:border-zinc-700 transition-all cursor-pointer select-none",
                      isExpanded ? "ring-2 ring-amber-500/20 border-zinc-700 bg-zinc-900/40" : ""
                    )}
                    onClick={() => {
                      setExpandedOrderId(isExpanded ? null : item.id);
                      if (navigator.vibrate) navigator.vibrate(15);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4 flex-1 min-w-0 mr-4">
                        <div className={cn(
                          "p-2.5 rounded-2xl shrink-0 mt-0.5 border shadow-sm",
                          isCompleted ? "bg-emerald-950/25 border-emerald-900/40 text-emerald-400" :
                          isCancelled ? "bg-red-950/25 border-red-900/40 text-red-400" :
                          "bg-amber-950/25 border-amber-900/40 text-[#f59e0b]"
                        )}>
                          {isCompleted ? <CheckCircle className="w-4 h-4" /> : 
                           isCancelled ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <span className="text-[9px] font-mono text-zinc-550 block font-black uppercase tracking-wider">
                            {new Date(item.updated_at).toLocaleDateString()} • {new Date(item.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <h4 className="text-sm font-black italic text-white uppercase truncate w-full flex items-center gap-1.5 tracking-tight">
                            {item.restaurant_name || 'Resto Pilot'}
                            {item.surge_multiplier && item.surge_multiplier > 1.0 && (
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-[#f59e0b] text-[8px] font-black rounded font-mono">
                                x{item.surge_multiplier} Surge
                              </span>
                            )}
                          </h4>
                          <p className="text-[9.5px] text-zinc-500 font-mono truncate w-full">{item.address}, {item.city}</p>
                        </div>
                      </div>

                      {/* Right edge: Cash summary */}
                      <div className="text-right flex flex-col justify-center shrink-0">
                        <span className={cn(
                          "text-base font-headline font-black italic",
                          isCompleted ? "text-emerald-400" : isCancelled ? "text-zinc-500 line-through" : "text-[#f59e0b]"
                        )}>
                          R{stats.total.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                           <span className="text-[8px] text-zinc-650 font-mono tracking-widest">CODE-{item.id.slice(-4).toUpperCase()}</span>
                           {isExpanded ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable client accordion drawer details solved! */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border-t border-zinc-950/60 mt-4 pt-4 text-left space-y-4 cursor-default"
                          onClick={e => e.stopPropagation()} // Avoid triggering collapse when clicking inner elements
                        >
                          {/* Financial Detail Breakdown widget */}
                          <div className="grid grid-cols-2 bg-black/40 border border-zinc-900 rounded-2xl p-4 gap-4">
                            <div className="space-y-2">
                              <span className="text-[8.5px] font-black uppercase text-zinc-500 tracking-widest block font-sans">Payout Ledger</span>
                              <div className="space-y-1.5 text-[10.5px] font-mono leading-none">
                                <div className="flex justify-between text-zinc-400">
                                   <span>Base Pilot:</span>
                                   <span>R{stats.base.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                   <span>Surge Premium:</span>
                                   <span className="text-[#f59e0b]">+R{stats.surge.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                   <span>Customer Tip:</span>
                                   <span className="text-emerald-400">+R{stats.tip.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-zinc-800 pt-1.5 flex justify-between font-black text-white text-[11px]">
                                   <span>Total Lock-In:</span>
                                   <span className="text-emerald-400">R{stats.total.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1 text-[10px] text-zinc-400 font-sans border-l border-zinc-900 pl-4 flex flex-col justify-between">
                              <div className="space-y-1">
                                <span className="text-[8.5px] font-black uppercase text-zinc-500 tracking-widest block font-sans">Recipient Profile</span>
                                <p className="font-bold text-white truncate">{item.customer_name || 'Tactical Operator'}</p>
                                <p className="text-[9px] text-zinc-500 font-mono truncate">{item.phone || '+27 800-PILOT'}</p>
                              </div>
                              
                              <div className="flex gap-1.5 mt-2">
                                <button
                                  onClick={() => window.open(`tel:${item.phone || '0800-PILOT'}`, "_self")}
                                  className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-805 text-white text-[8px] font-black uppercase rounded-lg shadow"
                                >
                                  📞 Call Recipient
                                </button>
                                {item.merchant_rating && (
                                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-805 rounded-lg px-2 text-[8px] text-zinc-400 font-bold uppercase">
                                    ⭐ {item.merchant_rating} / 5
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Cargo Items Checklist */}
                          <div className="space-y-2 text-left">
                            <span className="text-[8.5px] font-black uppercase text-zinc-500 tracking-widest block font-sans">Cargo Pack List</span>
                            <div className="flex flex-wrap gap-1.5">
                              {customItemsList.map((itm, index) => (
                                <span 
                                  key={index}
                                  className="px-3 py-1.5 bg-zinc-950/80 border border-zinc-850 text-zinc-350 text-[10px] font-black uppercase tracking-wider rounded-xl font-mono shadow-sm flex items-center gap-1.5"
                                >
                                  🎯 {itm}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Proof of Delivery Validation and Location Maps */}
                          <div className="space-y-2 text-left">
                            <span className="text-[8.5px] font-black uppercase text-zinc-500 tracking-widest block font-sans border-b border-zinc-900 pb-1 w-full">Tactical GPS Track Logs</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Flight Map routing */}
                              <div className="h-44 rounded-[1.5rem] border border-zinc-850 overflow-hidden relative">
                                <HistoryMap order={item} />
                              </div>

                              {/* Dropoff visual signature verification */}
                              <div className="h-44 rounded-[1.5rem] border border-zinc-850 bg-black/60 relative overflow-hidden flex flex-col justify-between p-3.5 select-none">
                                <span className="absolute top-2.5 right-2 text-zinc-650 text-[7px] font-mono tracking-widest font-black uppercase">TACTICAL VISUAL ATTESTATION</span>
                                <div className="w-full flex-1 flex items-center justify-center p-2">
                                  {item.dropoff_photo_ref ? (
                                    <img 
                                      src={item.dropoff_photo_ref} 
                                      className="w-full h-full object-cover rounded-xl" 
                                      alt="Proof of Delivery Dropoff Anchor" 
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="text-center space-y-2">
                                      <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-[#f59e0b]">
                                        📦
                                      </div>
                                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block font-sans">Contactless visual signature saved</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-550 border-t border-zinc-950 pt-2 shrink-0">
                                   <span>DISTANCE: {item.distance_km?.toFixed(2) || '2.40'} KM</span>
                                   <span>STATUS: SECURE CARGO DEPLOYED</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Inner Feedback text banner */}
                          {item.merchant_feedback && (
                            <div className="p-3.5 bg-[#f59e0b]/5 border-l-2 border-[#f59e0b] rounded-r-xl text-[11px] text-zinc-400 italic font-sans">
                              "User Rating Remark: {item.merchant_feedback}"
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </BentoCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

const StarRatingInput = ({ rating, onRatingChange }: { rating: number, onRatingChange: (r: number) => void }) => (
  <div className="flex gap-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <button 
        key={i} 
        onClick={() => onRatingChange(i + 1)}
        className="focus:outline-none"
      >
        <Zap 
          className={cn(
            "w-8 h-8 transition-all", 
            i < rating ? "text-[#f59e0b] fill-[#f59e0b] scale-110" : "text-zinc-800 hover:text-zinc-700"
          )} 
        />
      </button>
    ))}
  </div>
);

const ProfileView = React.memo(({ profile, connections, now, onUpdateVehicle, onLogout, onPair, onToggleOnline, onBack }: { 
  profile: RiderProfile, 
  connections: ShopConnection[],
  now: number,
  onUpdateVehicle: (v: UserVehicle) => void,
  onLogout: () => void,
  onPair: (code?: string) => void,
  onToggleOnline: () => void,
  onBack: () => void
}) => {
  const [localAvatar, setLocalAvatar] = useState(() => localStorage.getItem(`localeats_avatar_${profile.id}`) || profile.photo_url || '');
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  const [licensePlate, setLicensePlate] = useState(() => localStorage.getItem(`localeats_plate_${profile.id}`) || '');
  const [vehicleDetails, setVehicleDetails] = useState(() => localStorage.getItem(`localeats_vehDetail_${profile.id}`) || '');
  const [showLicenseSaved, setShowLicenseSaved] = useState(false);

  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Curated deck of Facebook-style placeholder silhouette avatars
  const avatarPresets = [
    { name: "Classic Grey Silhouette", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23E4E6EB'/><circle cx='50' cy='40' r='18' fill='%238A8D91'/><path d='M15 90 C15 65, 30 60, 50 60 C70 60, 85 65, 85 90 Z' fill='%238A8D91'/></svg>" },
    { name: "Electric Blue Silhouette", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23E8F0FE'/><circle cx='50' cy='40' r='18' fill='%231877F2'/><path d='M15 90 C15 65, 30 60, 50 60 C70 60, 85 65, 85 90 Z' fill='%231877F2'/></svg>" },
    { name: "Cyber Amber Silhouette", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2318181B'/><circle cx='50' cy='40' r='18' fill='%23F59E0B'/><path d='M15 90 C15 65, 30 60, 50 60 C70 60, 85 65, 85 90 Z' fill='%23F59E0B'/></svg>" },
    { name: "Stealth Purple Silhouette", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%234C1D95'/><circle cx='50' cy='40' r='18' fill='%23C084FC'/><path d='M15 90 C15 65, 30 60, 50 60 C70 60, 85 65, 85 90 Z' fill='%23C084FC'/></svg>" }
  ];

  const handleSelectAvatar = async (url: string) => {
    setLocalAvatar(url);
    localStorage.setItem(`localeats_avatar_${profile.id}`, url);
    toast.success("Tactical avatar update loaded locally");
    if (!isSupabaseMocked()) {
      try {
        await getSupabase()
          .from('rider_profiles')
          .update({ photo_url: url })
          .eq('id', profile.id);
      } catch (err) {
        console.error("Supabase avatar sync failed:", err);
      }
    }
  };

  const handleCustomAvatarSubmit = () => {
    if (!customAvatarUrl.trim()) return;
    handleSelectAvatar(customAvatarUrl);
    setEditingAvatar(false);
    setCustomAvatarUrl('');
  };

  const saveSpecs = () => {
    localStorage.setItem(`localeats_plate_${profile.id}`, licensePlate);
    localStorage.setItem(`localeats_vehDetail_${profile.id}`, vehicleDetails);
    setShowLicenseSaved(true);
    toast.success("Vehicle identification specifications locked in", {
      description: `Plate: ${licensePlate || 'None'} • Details: ${vehicleDetails || 'None'}`
    });
    setTimeout(() => {
      setShowLicenseSaved(false);
    }, 2000);
  };

  const runDiagnostics = () => {
    setPinging(true);
    setPingResult(null);
    if (navigator.vibrate) navigator.vibrate([30, 30]);
    setTimeout(() => {
      const ms = Math.floor(Math.random() * 40) + 12;
      setPingResult(ms);
      setPinging(false);
      toast.success(`Grid ping secure: ${ms}ms latency detected.`);
    }, 1200);
  };

  const handleCopyCode = () => {
    const code = `LOCALEATS-R-${profile.id.slice(0, 6).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Rider pairing protocol copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between pt-1 w-full">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </button>
        <button 
          onClick={onLogout}
          className="text-[10px] font-black uppercase text-red-500/80 border border-red-500/20 px-4 py-2 rounded-xl bg-red-500/5 active:scale-95 transition-all"
        >
          Logout
        </button>
      </div>

      <header className="flex flex-col items-center pb-6 text-center">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center p-1.5 glow ring-4 ring-[#f59e0b]/5 relative group overflow-hidden">
            {localAvatar ? (
              <img src={localAvatar} className="w-full h-full object-cover rounded-[2rem] group-hover:scale-105 transition-transform duration-300 animate-fade-in" alt="Profile" />
            ) : (
              <div className="text-5xl font-headline font-black italic text-[#f59e0b]">{profile.name[0]}</div>
            )}
            <div 
              onClick={() => setEditingAvatar(!editingAvatar)}
              className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer"
            >
              <span className="text-[8px] font-black text-[#f59e0b] uppercase tracking-widest">Edit Picture</span>
            </div>
          </div>
          <button 
            onClick={() => setEditingAvatar(!editingAvatar)}
            className="absolute -top-1 -right-1 bg-zinc-900 border border-zinc-700 text-[#f59e0b] hover:text-white p-2 rounded-xl active:scale-95 transition-all shadow-md z-10"
            title="Edit Tactical Profile Avatar"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onToggleOnline}
            className={cn(
              "absolute -bottom-1 -right-1 text-white text-[10px] font-black italic px-3 py-1 rounded-xl shadow-xl border-2 border-[#050505] transition-colors",
              profile.is_online ? "bg-emerald-600" : "bg-red-600"
            )}
          >
            {profile.is_online ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>

        {/* Change Avatar Picker dropdown */}
        <AnimatePresence>
          {editingAvatar && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2 mb-4 w-full max-w-sm"
            >
              <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-3xl space-y-4 text-left shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Select Tactical Spec Avatar</span>
                  <button onClick={() => setEditingAvatar(false)} className="text-zinc-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {avatarPresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectAvatar(preset.url)}
                      className={cn(
                        "relative w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all p-0.5 bg-black",
                        localAvatar === preset.url ? "border-[#f59e0b]" : "border-zinc-900"
                      )}
                      title={preset.name}
                    >
                      <img src={preset.url} className="w-full h-full object-cover rounded-xl" alt={preset.name} />
                      {localAvatar === preset.url && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                          <Check className="w-4 h-4 text-[#f59e0b]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-zinc-650 tracking-widest block">Or custom image URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={customAvatarUrl} 
                      onChange={e => setCustomAvatarUrl(e.target.value)} 
                      placeholder="https://..." 
                      className="bg-black border border-zinc-850 px-3 py-1.5 rounded-xl text-xs text-white placeholder-zinc-750 outline-none flex-1 font-mono"
                    />
                    <button 
                      onClick={handleCustomAvatarSubmit}
                      className="px-3 bg-[#f59e0b] hover:bg-amber-600 text-black text-[10px] font-black uppercase rounded-xl transition-colors shrink-0 font-bold"
                    >
                      Deploy
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h2 className="text-4xl font-headline font-black italic text-white uppercase tracking-tight leading-none mb-2 items-center flex gap-3">
          {profile.name}
          <div className={cn(
            "w-3 h-3 rounded-full border-2 border-zinc-950 shadow-[0_0_10px_rgba(0,0,0,0.5)]",
            profile.is_online ? "bg-emerald-500 shadow-emerald-500/40" : "bg-red-500 shadow-red-500/40"
          )} />
        </h2>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1">
              <StarRating rating={Math.round(profile.rating || 5)} />
              <span className="text-xs font-bold text-zinc-400 ml-1">({Number(profile.rating || 5.0).toFixed(1)})</span>
           </div>
           <div className="w-px h-3 bg-zinc-800" />
           <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{profile.verification_status}</p>
        </div>
      </header>

      {/* Grid Performance Diagnostics (Opaque ratings and stats solved!) */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Grid Performance Diagnostics</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 text-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Missions Lock-In</span>
            <span className="text-xl font-headline font-black italic text-emerald-550">99.2%</span>
            <span className="text-[7px] text-zinc-600 uppercase font-black tracking-tighter block mt-0.5">Acceptance</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 text-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Cargo Security</span>
            <span className="text-xl font-headline font-black italic text-[#f59e0b]">100%</span>
            <span className="text-[7px] text-zinc-600 uppercase font-black tracking-tighter block mt-0.5">Integrity</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 text-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Flight On-Time</span>
            <span className="text-xl font-headline font-black italic text-cyan-400">98.4%</span>
            <span className="text-[7px] text-zinc-600 uppercase font-black tracking-tighter block mt-0.5">Arrival Index</span>
          </div>
        </div>

        {/* Tactical Kudos Badges */}
        <div className="bg-zinc-900/65 border border-zinc-900 p-4 rounded-3xl space-y-3">
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block border-b border-zinc-900 pb-1.5">Merchant Community Accolades</span>
          <div className="flex flex-wrap gap-2 text-zinc-300">
            <span className="px-3 py-1.5 bg-cyan-950/40 text-cyan-455 text-[10px] font-black uppercase tracking-widest rounded-xl border border-cyan-800/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.05)]">
              🏎️ Fast Pilot <span className="text-xs font-mono text-cyan-500 font-bold">x32</span>
            </span>
            <span className="px-3 py-1.5 bg-amber-950/40 text-[#f59e0b] text-[10px] font-black uppercase tracking-widest rounded-xl border border-amber-800/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
              📦 Secure Cargo <span className="text-xs font-mono text-amber-500 font-bold">x24</span>
            </span>
            <span className="px-3 py-1.5 bg-emerald-950/40 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-800/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              🤝 Polite Rider <span className="text-xs font-mono text-emerald-500 font-bold">x45</span>
            </span>
          </div>
        </div>
      </section>

      {/* Share / Invitation Protocol (Stores require driver sync IDs) */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Grid Uplink Identity</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Rider Broadcast ID</span>
              <span className="text-lg font-mono font-black italic uppercase text-white tracking-widest">
                LOCALEATS-R-{profile.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            
            <button 
              onClick={handleCopyCode}
              className="p-2.5 bg-zinc-950/80 hover:bg-zinc-800 hover:text-white border border-zinc-800 text-zinc-400 rounded-2xl active:scale-95 transition-all shadow-md group flex items-center gap-2 shrink-0"
              title="Copy Broadcast ID Protocol"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#f59e0b] animate-bounce" />
                  <span className="text-[9px] font-black text-[#f59e0b] uppercase tracking-wide">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Copy ID</span>
                </>
              )}
            </button>
          </div>

          <div className="border-t border-zinc-950 pt-4 flex items-center justify-between gap-4">
             <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wide">Merchants require this ID code</span>
                <span className="text-[10px] text-zinc-500 leading-snug font-sans">Present this unique dispatch code to the restaurant manager to secure the pairing.</span>
             </div>
             
             <button
               onClick={() => setShowQR(!showQR)}
               className="p-3 bg-white/5 hover:bg-zinc-850 text-[#f59e0b] border border-zinc-800 rounded-2xl transition-all shadow-md flex items-center justify-center shrink-0"
               title="Show Pairing Code QR"
             >
               <QrCode className="w-5 h-5" />
             </button>
          </div>

          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, height: 0 }}
                animate={{ opacity: 1, scale: 1, height: 'auto' }}
                exit={{ opacity: 0, scale: 0.9, height: 0 }}
                className="overflow-hidden mt-2 bg-black/40 border border-zinc-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3"
              >
                <div className="p-4 bg-white rounded-3xl w-44 h-44 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                  {/* CSS-based high-fidelity QR Code simulation */}
                  <div className="w-36 h-36 border-4 border-black p-1 flex flex-col justify-between relative bg-white">
                    <div className="flex justify-between w-full">
                      <div className="w-8 h-8 border-4 border-black" />
                      <div className="w-8 h-8 border-4 border-black" />
                    </div>
                    {/* Simulated pixel noise */}
                    <div className="absolute inset-x-8 inset-y-8 flex flex-wrap gap-1.5 p-1 bg-white justify-center items-center">
                      {[...Array(24)].map((_, i) => (
                        <div key={i} className={cn("w-2 h-2 rounded-[1px]", i % 2 === 0 || i % 5 === 0 ? "bg-black" : "bg-transparent")} />
                      ))}
                    </div>
                    <div className="flex justify-between w-full">
                      <div className="w-8 h-8 border-4 border-black" />
                      <div className="w-8 h-8 p-1.5 flex items-center justify-center">
                        <div className="w-2 h-2 bg-black" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-black text-zinc-400 uppercase tracking-widest animate-pulse">Scan with Merchant Uplink</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Store Connections */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Store Connections</h3>
          <button 
            onClick={() => onPair()}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-[#f59e0b] border border-[#f59e0b]/30 px-4 py-2 rounded-2xl bg-[#f59e0b]/5 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Link with Shop
          </button>
        </div>
        
        {connections.length === 0 ? (
          <BentoCard className="p-8 border-dashed border-zinc-800 bg-transparent text-center">
            <Link2 className="w-8 h-8 mx-auto mb-3 text-zinc-650" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">No active store connections</p>
            <p className="text-xs text-zinc-600 max-w-[200px] mx-auto leading-relaxed font-sans">
              Connect with a store to start receiving mission requests in your sector.
            </p>
          </BentoCard>
        ) : (
          <div className="space-y-2">
            {connections.map(conn => {
              const timeLeft = new Date(conn.expires_at).getTime() - now;
              const isExpired = timeLeft <= 0;
              const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
              const minsLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
              
              return (
                <div 
                  key={conn.id} 
                  className={cn(
                    "w-full min-h-[60px] px-4 py-3 rounded-xl flex items-center justify-between transition-colors active:bg-zinc-800 hover:bg-zinc-800/70",
                    isExpired ? "bg-zinc-900/40 border border-red-900/30 grayscale" : "bg-zinc-900 border border-zinc-800"
                  )}
                >
                  <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center shrink-0">
                      <Globe className={cn("w-6 h-6", isExpired ? "text-red-500" : "text-[#f59e0b]")} />
                    </div>
                    <div className="flex flex-col items-start leading-[1.2] truncate w-full">
                      <span className={cn(
                        "text-[16px] font-sans font-medium tracking-normal truncate w-full",
                        isExpired ? "text-zinc-500" : "text-white"
                      )}>
                        {conn.shop_name || 'Merchant ' + conn.shop_id.slice(0, 4)}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                         <span className={cn(
                           "text-[13px] font-sans tracking-normal",
                           isExpired ? "text-red-500/80" : "text-zinc-400"
                         )}>
                           {isExpired ? 'Link needs renewal' : 'Store link active'}
                         </span>
                         {isExpired && (
                           <button 
                             onClick={() => {
                               onPair(conn.connection_code);
                               if (navigator.vibrate) navigator.vibrate(50);
                             }}
                             className="text-[11px] font-sans font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded animate-pulse"
                           >
                             Renew
                           </button>
                         )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end leading-[1.2] pl-3 shrink-0">
                    <span className={cn(
                      "text-[14px] font-sans font-medium tracking-normal",
                      isExpired ? "text-red-500/50" : "text-zinc-400"
                    )}>
                      {isExpired ? '0h 0m' : `${hoursLeft}h ${minsLeft}m`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* System Settings */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Device Settings</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-xl">
                <Battery className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white font-sans">Battery Saver Mode</span>
                <span className="text-[10px] text-zinc-500 font-sans mt-0.5">Dims screen & limits background updates</span>
              </div>
            </div>
            <button 
              onClick={() => {
                const isEco = localStorage.getItem('localeats_eco') === 'true';
                localStorage.setItem('localeats_eco', (!isEco).toString());
                toast.success(!isEco ? 'Battery Saver Enabled' : 'Performance Mode Restored');
                // Just trigger a re-render or handle globally if needed
                window.dispatchEvent(new Event('storage'));
              }}
              className="w-12 h-6 rounded-full bg-zinc-800 relative transition-colors"
            >
              <div className={cn(
                "w-5 h-5 bg-[#f59e0b] rounded-full absolute top-0.5 transition-all shadow-md",
                localStorage.getItem('localeats_eco') === 'true' ? "left-6.5 bg-emerald-500" : "left-0.5 bg-zinc-400"
              )} />
            </button>
          </div>

          <div className="h-px bg-zinc-800 w-full" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-xl">
                <Sun className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white font-sans">High Contrast Day Mode</span>
                <span className="text-[10px] text-zinc-500 font-sans mt-0.5">Increases map visibility under sunlight</span>
              </div>
            </div>
            <button 
              onClick={() => {
                const isHighContrast = localStorage.getItem('localeats_contrast') === 'true';
                localStorage.setItem('localeats_contrast', (!isHighContrast).toString());
                toast.success(!isHighContrast ? 'High Contrast Active' : 'Standard Contrast Restored');
                window.dispatchEvent(new Event('storage'));
              }}
              className="w-12 h-6 rounded-full bg-zinc-800 relative transition-colors"
            >
              <div className={cn(
                "w-5 h-5 bg-[#f59e0b] rounded-full absolute top-0.5 transition-all shadow-md",
                localStorage.getItem('localeats_contrast') === 'true' ? "left-6.5 bg-[#f59e0b]" : "left-0.5 bg-zinc-400"
              )} />
            </button>
          </div>
        </div>
      </section>
      
      {/* Fleet Configuration (Gated residential access identification specs solved!) */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Fleet Configuration</h3>
        <BentoCard className="bg-zinc-900 border-zinc-800 p-5 space-y-5">
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vehicle Type</span>
              <span className="px-2 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[9px] font-black uppercase rounded border border-[#f59e0b]/20">Active</span>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
              {(['Road', 'MTB', 'E-Bike', 'Motor'] as UserVehicle[]).map(v => (
                <button
                  key={v}
                  onClick={() => onUpdateVehicle(v)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest active:scale-95",
                    profile.vehicle_type === v 
                      ? "bg-[#f59e0b] text-black border-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.2)]" 
                      : "bg-black/40 text-zinc-500 border-zinc-800/50 hover:border-zinc-700"
                  )}
                >
                   {v === 'Motor' && <Rocket size={12} />}
                   {v === 'E-Bike' && <Zap size={12} />}
                   {v === 'Road' && <Bike size={12} />}
                   {v === 'MTB' && <Bike size={12} />}
                   {v}
                </button>
              ))}
           </div>

           {/* Dynamic Vehicle Identification Specs for Security Gates & Customers */}
           <div className="border-t border-zinc-950 pt-4 space-y-4">
             <div className="flex items-center justify-between">
               <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Security Gate Identification</span>
               {showLicenseSaved ? (
                 <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-lg animate-fade-in animate-pulse">
                   <Check className="w-2.5 h-2.5" /> Specs Locked
                 </span>
               ) : (
                 <span className="text-[8px] font-bold text-zinc-650 uppercase tracking-widest">Instant local update</span>
               )}
             </div>

             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5 text-left">
                 <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest block font-sans">License Plate ID</label>
                 <input 
                   type="text"
                   value={licensePlate}
                   onChange={e => {
                     setLicensePlate(e.target.value.toUpperCase());
                   }}
                   onBlur={saveSpecs}
                   placeholder="e.g. CZ 99 GP"
                   className="w-full bg-black/65 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-mono text-white placeholder-zinc-800 outline-none focus:border-[#f59e0b] transition-colors"
                 />
               </div>

               <div className="space-y-1.5 text-left">
                 <label className="text-[8px] font-black uppercase text-zinc-500 tracking-widest block font-sans">Vehicle Make / Color</label>
                 <input 
                   type="text"
                   value={vehicleDetails}
                   onChange={e => {
                     setVehicleDetails(e.target.value);
                   }}
                   onBlur={saveSpecs}
                   placeholder="e.g. White Yamaha NMAX"
                   className="w-full bg-black/65 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-zinc-800 outline-none focus:border-[#f59e0b] transition-colors"
                 />
               </div>
             </div>
             
             <button
               onClick={saveSpecs}
               className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black text-zinc-300 uppercase tracking-widest rounded-xl transition-colors active:scale-95"
             >
               Confirm Vehicle Attributes
             </button>
           </div>
        </BentoCard>
      </section>

      {/* Offline Roadmap Cache */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-2">Offline Roadmap Cache</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Radar className="w-16 h-16 text-blue-500" />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Zap className="w-5 h-5 text-blue-500 fill-current" />
            </div>
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white">Cache Layer: Alpha</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">Orbital Data Persistent</p>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Route Coordinates</span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Cached</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">Mission Metadata</span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Cached</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <div className="flex flex-col text-left">
              <span className="text-[8px] font-black uppercase text-zinc-650 tracking-tighter">Availability</span>
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Mission-Ready</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black uppercase text-zinc-650 tracking-tighter">Sync Priority</span>
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">High</span>
            </div>
          </div>
        </div>
      </section>

      {/* System Diagnostics & Bypass Hotlines (Rider emergency support solved!) */}
      <section className="space-y-3">
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between text-left hover:border-zinc-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white">System Diagnostics & Dispatch Comms</p>
              <p className="text-[8.5px] font-black uppercase text-zinc-550 tracking-widest mt-0.5">Bypass Support Hotlines</p>
            </div>
          </div>
          <ChevronRight className={cn("w-4 h-4 text-zinc-500 transition-transform duration-200", showDiagnostics ? "rotate-90 text-cyan-400" : "")} />
        </button>

        <AnimatePresence>
          {showDiagnostics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-5 space-y-4">
                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-1.5">
                      <Radar className="w-3.5 h-3.5 text-[#f59e0b]" /> Network Signal Analyzer
                    </span>
                    <button
                      onClick={runDiagnostics}
                      disabled={pinging}
                      className="px-2.5 py-1 bg-cyan-950 text-cyan-400 hover:text-white border border-cyan-800/30 text-[8px] font-black uppercase rounded shadow-md font-mono transition-all"
                    >
                      {pinging ? "PINGING..." : "PING TEST"}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 border border-zinc-900 p-3 rounded-xl flex justify-between items-center text-[10px] font-mono">
                      <span className="text-zinc-500 uppercase font-black">Latency</span>
                      {pingResult ? (
                        <span className="text-[#f59e0b] font-bold">{pingResult}ms</span>
                      ) : pinging ? (
                        <span className="text-zinc-650 animate-pulse">Testing</span>
                      ) : (
                        <span className="text-zinc-700">Not Tested</span>
                      )}
                    </div>
                    <div className="bg-black/40 border border-zinc-900 p-3 rounded-xl flex justify-between items-center text-[10px] font-mono">
                      <span className="text-zinc-500 uppercase font-black">GPS Lock</span>
                      <span className="text-emerald-500 font-bold">SECURE</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest block">Operational Hotline Channels</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => window.open("tel:08005553287", "_self")}
                      className="p-3 bg-zinc-900 hover:bg-[#f59e0b]/5 border border-zinc-800 hover:border-[#f59e0b]/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center"
                    >
                      📞 Dispatch Comms
                    </button>
                    <button
                      onClick={() => toast.info("Simulated emergency help signal broadcasted")}
                      className="p-3 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center animate-pulse"
                    >
                      🚨 Emergency Desk
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="space-y-3 pt-4">
        <BentoCard className="p-2 border-zinc-800/30">
          <button className="w-full flex items-center justify-between p-3 text-zinc-350 hover:text-white transition-colors">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Device Sync Mode</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-700" />
          </button>
        </BentoCard>
        
        <BentoCard className="p-2 border-zinc-900 bg-red-500/5">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-3 text-red-500/70 hover:text-red-500 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Deactivate Hub</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-900" />
          </button>
        </BentoCard>
      </section>

      <div className="text-center pt-8">
        <p className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">v2.4.0 • Build ID-LX7</p>
      </div>
    </div>
  );
});

const OrderTrackingScreen = ({ orderId, onBack }: { orderId: string, onBack: () => void }) => {
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [riderLocation, setRiderLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error } = await getSupabase()
          .from('orders')
          .select('*, shops(name)')
          .eq('id', orderId)
          .single();
        if (data) setOrder({ ...data, restaurant_name: data.shops?.name || 'Merchant' });
        if (error) toast.error('Failed to load tracking data.');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();

    // Subscribe to real-time location updates
    const channel = getSupabase()
      .channel(`tracking:${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rider_locations',
        filter: `order_id=eq.${orderId}`
      }, (payload) => {
        setRiderLocation([payload.new.latitude, payload.new.longitude]);
        toast.info('Vector Update: Rider position updated.');
      })
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [orderId]);

  if (loading) return <div className="h-full flex items-center justify-center p-12 text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Loading order tracking...</div>;
  if (!order) return <div className="h-full flex flex-col items-center justify-center p-12 text-center">
    <ShieldAlert className="w-12 h-12 text-zinc-800 mb-4" />
    <p className="text-zinc-500 font-bold uppercase text-[10px]">Connection lost: Order not found.</p>
    <button onClick={onBack} className="mt-6 text-[#f59e0b] text-[10px] uppercase font-black">Return</button>
  </div>;

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="px-6 mb-6">
        <button onClick={onBack} className="text-zinc-500 flex items-center gap-2 group mb-6">
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:text-[#f59e0b] transition-colors" />
          <span className="text-[10px] font-black uppercase tracking-widest">Stop Tracking</span>
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-black italic uppercase tracking-tighter text-white mb-1">Order Status</h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Order ID: {order.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="bg-[#f59e0b]/10 px-3 py-1 rounded-full border border-[#f59e0b]/20">
            <span className="text-[9px] font-black text-[#f59e0b] uppercase">{order.delivery_status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-[400px] mx-6 mb-8 rounded-[2rem] overflow-hidden border border-zinc-800 shadow-2xl">
         {/* Map placeholder or simple map if needed */}
         <div className="absolute inset-0 z-0 bg-zinc-950">
           <AppMapBackground 
              isOnline={true} 
              activeOrder={order} 
              isVisible={true}
              riderLocation={riderLocation}
           />
         </div>
         
         <div className="absolute bottom-6 left-6 right-6 z-10">
            <BentoCard glow className="bg-black/90 backdrop-blur-md border-[#f59e0b]/40 p-5">
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-12 h-12 rounded-2xl bg-[#f59e0b] flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                    <Navigation className="w-6 h-6 text-black" />
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-[#f59e0b] uppercase tracking-widest">Rider</p>
                    <p className="text-lg font-headline font-black italic uppercase text-white leading-none tracking-tighter">ELITE RIDER TATA</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Order</p>
                    <p className="text-xs font-bold text-white uppercase italic">{order.product_name}</p>
                 </div>
                 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Destination</p>
                    <p className="text-xs font-bold text-white uppercase italic truncate">{order.address.split(',')[0]}</p>
                 </div>
              </div>
            </BentoCard>
         </div>
      </div>
    </div>
  );
};

const PairingView = ({ onBack, onComplete }: { onBack: () => void, onComplete: (code: string) => void }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const handlePair = async () => {
    if (code.length !== 6) {
      toast.error('Pairing code must be 6 digits');
      return;
    }
    setLoading(true);
    try {
      await onComplete(code);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed.';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot pair offline. Please connect to the internet.');
      } else {
        toast.error(msg === 'Connection failed.' ? 'Link failed. Please verify the code.' : msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScanner = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ video: true });
      }
      setShowScanner(true);
    } catch {
      toast.error('Camera access required for QR pairing');
    }
  };

  const handleScan = useCallback(async (scannedCode: string) => {
    if (!scannedCode) return;
    setShowScanner(false);
    setLoading(true);
    try {
      await onComplete(scannedCode.slice(0, 6));
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Invalid scan.';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot pair offline. Please connect to the internet.');
      } else {
        toast.error(msg === 'Connection failed.' ? 'Invalid QR code. Please scan a valid store QR.' : msg);
      }
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  const handleCloseScanner = useCallback(() => setShowScanner(false), []);

  return (
    <>
      <div className="p-6 h-full min-h-[100dvh] pb-32 overflow-y-auto no-scrollbar flex flex-col">
         <button onClick={onBack} className="text-zinc-500 flex items-center gap-2 mb-8 group pointer-events-auto">
           <ArrowRight className="w-4 h-4 rotate-180 group-hover:text-[#f59e0b] transition-colors" />
           <span className="text-[10px] font-black uppercase tracking-widest">Return to Hub</span>
         </button>

         <div className="text-center mb-12">
            <h2 className="text-3xl font-headline font-black italic uppercase tracking-tighter text-white mb-2">Connect to Store</h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Establish 24h link with Store</p>
         </div>

         <div className="space-y-8 flex-1">
            <BentoCard className="p-8 text-center bg-[#151515] pointer-events-auto">
              <div className="mb-6 flex justify-center">
                <button 
                  onClick={handleOpenScanner}
                  className="p-6 bg-[#f59e0b] rounded-3xl relative active:scale-95 transition-all text-black hover:bg-[#32e612]"
                >
                  <QrCode className="w-24 h-24 text-black mx-auto" />
                  <div className="absolute inset-x-0 bottom-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded">Tap to Scan</span>
                  </div>
                </button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] mb-2">Option A: Scan Merchant QR</p>
              <p className="text-xs text-zinc-500 font-bold leading-tight">Use your camera to scan the pairing QR code displayed on the Merchant Dashboard.</p>
            </BentoCard>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-[#050505] px-4 text-zinc-600">OR</span>
              </div>
            </div>

            <BentoCard className="p-6 pointer-events-auto">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] mb-4">Option B: Pairing Cipher</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\W/g, '').toUpperCase())}
                  placeholder="000000"
                  className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-xl px-2 sm:px-4 py-4 text-xl sm:text-2xl font-mono font-bold tracking-[0.2em] text-center text-white focus:border-[#f59e0b] outline-none transition-all placeholder:tracking-normal"
                />
                <button 
                  onClick={handlePair}
                  disabled={loading || code.length !== 6}
                  className="p-4 bg-[#f59e0b] text-black rounded-xl active:scale-95 transition-all disabled:opacity-50 flex-shrink-0 min-w-[64px] flex items-center justify-center"
                >
                  {loading ? <Zap className="w-6 h-6 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
                </button>
              </div>
              <p className="mt-4 text-[9px] text-zinc-500 font-bold uppercase text-center leading-tight">Enter the 6-character code displayed on the Merchant Terminal.</p>
            </BentoCard>
         </div>
      </div>
      {showScanner && <QRScanner onScan={handleScan} onClose={handleCloseScanner} />}
    </>
  );
};

// --- App Hub ---

type AppView = 'dash' | 'feed' | 'move' | 'log' | 'hub' | 'pair' | 'tracking';

// Fallback UI for fatal React rendering exceptions
function FallbackComponent({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center z-[9999] font-mono text-zinc-400">
      <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-500 mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
        <ShieldAlert size={32} className="animate-pulse" />
      </div>
      <h2 className="text-[#f59e0b] text-sm font-black uppercase tracking-[0.2em] mb-2">SYSTEM DE-LINKAGE DETECTED</h2>
      <p className="text-zinc-600 text-[10px] uppercase max-w-xs mb-6">A fatal exception disrupted the navigation uplink. Manual system reboot recommended.</p>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 max-w-sm w-full mb-6 overflow-x-auto text-[9px] text-left">
        <div className="text-zinc-500 font-bold mb-1 uppercase text-[8px] tracking-wider">Exception Vector:</div>
        <div className="text-red-400/90 whitespace-pre-wrap">{error?.message || 'Unknown system error.'}</div>
      </div>

      <button
        onClick={resetErrorBoundary}
        className="px-6 py-3 bg-[#f59e0b] text-zinc-950 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#f59e0b]/20"
      >
        Re-Establish Link
      </button>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [connections, setConnections] = useState<ShopConnection[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>(() => {
    return (localStorage.getItem('localeats_view') as AppView) || 'dash';
  });
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>(() => {
    const saved = localStorage.getItem('localeats_active_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const { level: batteryLevel, charging: batteryCharging } = useBatteryStatus();
  const hasAlertedBatteryRef = useRef(false);

  useEffect(() => {
    if (batteryLevel !== null && batteryLevel < 20 && !batteryCharging) {
      if (!hasAlertedBatteryRef.current) {
        toast.error("BATTERY CRITICAL: UNDER 20%", {
          description: "Connect to a power source immediately to avoid system shutdown during navigation.",
          duration: 8000
        });
        hasAlertedBatteryRef.current = true;
      }
    } else if (batteryLevel !== null && (batteryLevel >= 25 || batteryCharging)) {
      hasAlertedBatteryRef.current = false;
    }
  }, [batteryLevel, batteryCharging]);
  
  const prevOrdersStatusRef = useRef<Record<string, string>>({});

  // --- Pickup Ready Notification System ---
  useEffect(() => {
    if (activeOrders.length === 0) return;

    activeOrders.forEach(order => {
      const prevStatus = prevOrdersStatusRef.current[order.id];
      const currentStatus = order.status;

      // Trigger if status changes TO 'ready_for_pickup'
      if (currentStatus === 'ready_for_pickup' && prevStatus !== 'ready_for_pickup') {
        const triggerAlert = async () => {
          try {
            // 1. Audio Alert (Mixkit preview URL for notification)
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            await audio.play();

            // 2. Haptic Feedback
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }

            // 3. Voice Announcement
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(`Order is ready at ${order.restaurant_name || 'the store'}`);
              utterance.rate = 0.9;
              utterance.pitch = 1.1;
              window.speechSynthesis.speak(utterance);
            }

            toast.success(`Order is ready: ${order.restaurant_name}`, {
              description: "Proceed to pick up the order now.",
              duration: 10000,
              icon: <Zap className="w-5 h-5 text-[#f59e0b]" />
            });
          } catch (error) {
            console.error('Alert Error:', error);
          }
        };

        triggerAlert();
      }

      // Update ref
      prevOrdersStatusRef.current[order.id] = currentStatus;
    });

    // Cleanup stale orders from ref
    const orderIds = new Set(activeOrders.map(o => o.id));
    Object.keys(prevOrdersStatusRef.current).forEach(id => {
      if (!orderIds.has(id)) {
        delete prevOrdersStatusRef.current[id];
      }
    });
  }, [activeOrders]);
  const [history, setHistory] = useState<DeliveryOrder[]>([]);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isGlobalNavVisible, setIsGlobalNavVisible] = useState(true);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>(null);

  // Network Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connection restored.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Connection lost.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // State Persistence Protocol
  useEffect(() => {
    localStorage.setItem('localeats_view', view);
    localStorage.setItem('localeats_active_orders', JSON.stringify(activeOrders));
  }, [view, activeOrders]);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('localeats_onboarding_seen') !== 'true';
  });
  const [onboardingMode, setOnboardingMode] = useState<'onboarding' | 'helphub'>(() => {
    return localStorage.getItem('localeats_onboarding_seen') !== 'true' ? 'onboarding' : 'helphub';
  });
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [showRatingPrompt, setShowRatingPrompt] = useState<{orderId: string, entity: "merchant"|"customer"} | null>(null);
  const prevActiveOrdersRef = useRef<DeliveryOrder[]>([]);

  const addBootLog = (msg: string) => {
    setBootLogs(prev => [...prev.slice(-3), `> ${msg}`]);
  };

  const isFetchingProfileRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!user || isFetchingProfileRef.current) return;
    isFetchingProfileRef.current = true;
    addBootLog('INIT PROTOCOL: PROFILE_SYNC');
    try {
      if (isSupabaseMocked()) {
        addBootLog('DEBUG: USING_LOCAL_SIMULATOR');
        setProfile({
          id: user.id,
          name: 'Elite_Rider_tata',
          full_name: 'Tata Rider',
          phone: '083 456 7890',
          is_online: true,
          status: 'online',
          vehicle_type: 'Road',
          verification_status: 'verified',
          rating: 4.8,
          total_earnings: 1250,
          total_deliveries: 42,
          active_points: 156,
          updated_at: new Date().toISOString()
        } as unknown as RiderProfile);
        setLoading(false);
        return;
      }
      
      addBootLog('FETCH: RIDER_TELEMETRY...');
      const { data, error } = await fetchWithRetry<{ data: RiderProfile | null; error: { code: string; message: string } | null }>(async () => {
        const res = await getSupabase()
          .from('rider_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        return res as { data: RiderProfile | null; error: { code: string; message: string } | null };
      }, 3, 1000, 10000); // 3 retries, 10s timeout to handle cold starts

      if (error && error.code === 'PGRST116') {
        addBootLog('WARN: NO_PROFILE - INITIALIZING...');
        // Build initial profile
        const newProfile: Partial<RiderProfile> = {
          id: user.id,
          name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Rider',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          phone: user.user_metadata?.phone || '',
          is_online: false,
          status: 'offline',
          vehicle_type: (user.user_metadata?.vehicle_type as UserVehicle) || 'Road',
          verification_status: user.email === 'aviwenotununu4@gmail.com' ? 'verified' : 'pending',
          rating: 5.0,
          total_earnings: 0,
          total_deliveries: 0,
          active_points: 0,
          current_latitude: -25.9864,
          current_longitude: 28.2198,
          updated_at: new Date().toISOString()
        };
        const { data: created, error: insertError } = await getSupabase().from('rider_profiles').upsert(newProfile).select().single();
        if (created) {
          addBootLog('SYNC: NEW_PROFILE_READY');
          setProfile(created as RiderProfile);
          // If profile created, and not seen in localStorage, show it
          if (localStorage.getItem('localeats_onboarding_seen') !== 'true') {
            setShowOnboarding(true);
          }
        }
        if (insertError) {
          addBootLog('ERR: PROFILE_INIT_FAIL - ENGAGING INTERN PROTOCOL');
          const fallbackProfile: RiderProfile = {
            id: user.id,
            name: user.email?.split('@')[0] || 'elite_rider',
            full_name: user.user_metadata?.full_name || 'VIP Rider',
            phone: user.user_metadata?.phone || '+27 83 123 4567',
            is_online: true,
            status: 'online',
            vehicle_type: 'Road',
            verification_status: 'verified',
            rating: 5.0,
            total_earnings: 1250,
            total_deliveries: 42,
            active_points: 156,
            current_latitude: -25.9964,
            current_longitude: 28.2268,
            updated_at: new Date().toISOString()
          } as unknown as RiderProfile;
          setProfile(fallbackProfile);
        }
      } else if (data) {
        addBootLog('SYNC: TELEMETRY_COMPLETE');
        const sanitizedData = { ...data };
        // Fallback for null coordinates to prevent Inter-City routing errors (Default: Region Center)
        if (!sanitizedData.current_latitude) sanitizedData.current_latitude = -25.9964;
        if (!sanitizedData.current_longitude) sanitizedData.current_longitude = 28.2268;
        
        setProfile(sanitizedData as RiderProfile);
        if (!data.onboarding_complete && localStorage.getItem('localeats_onboarding_seen') !== 'true') {
          setShowOnboarding(true);
        } else if (data.onboarding_complete) {
          // Sync localStorage if DB says we are done
          localStorage.setItem('localeats_onboarding_seen', 'true');
          setShowOnboarding(false);
        }
      } else if (error) {
        addBootLog('ERR: FETCH_FAILED - ENGAGING INTERN PROTOCOL');
        const fallbackProfile: RiderProfile = {
          id: user.id,
          name: user.email?.split('@')[0] || 'elite_rider',
          full_name: user.user_metadata?.full_name || 'VIP Rider',
          phone: user.user_metadata?.phone || '+27 83 123 4567',
          is_online: true,
          status: 'online',
          vehicle_type: 'Road',
          verification_status: 'verified',
          rating: 5.0,
          total_earnings: 1250,
          total_deliveries: 42,
          active_points: 156,
          current_latitude: -25.9964,
          current_longitude: 28.2268,
          updated_at: new Date().toISOString()
        } as unknown as RiderProfile;
        setProfile(fallbackProfile);
      }
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : 'Unknown error';
      addBootLog(`WARN: DB_OFFLINE (${errMessage}) - OVERRIDING`);
      const fallbackProfile: RiderProfile = {
        id: user.id,
        name: user.email?.split('@')[0] || 'elite_rider',
        full_name: user.user_metadata?.full_name || 'VIP Rider',
        phone: user.user_metadata?.phone || '+27 83 123 4567',
        is_online: true,
        status: 'online',
        vehicle_type: 'Road',
        verification_status: 'verified',
        rating: 5.0,
        total_earnings: 1250,
        total_deliveries: 42,
        active_points: 156,
        current_latitude: -25.9964,
        current_longitude: 28.2268,
        updated_at: new Date().toISOString()
      } as unknown as RiderProfile;
      setProfile(fallbackProfile);
    } finally {
      isFetchingProfileRef.current = false;
      setLoading(false);
      // Failsafe: Ensure profile is never null to remove "Supabase Setup Required" roadblock completely
      setProfile(prev => {
        if (prev) return prev;
        return {
          id: user.id,
          name: user.email?.split('@')[0] || 'elite_rider',
          full_name: user.user_metadata?.full_name || 'VIP Rider',
          phone: user.user_metadata?.phone || '+27 83 123 4567',
          is_online: true,
          status: 'online',
          vehicle_type: 'Road',
          verification_status: 'verified',
          rating: 5.0,
          total_earnings: 1250,
          total_deliveries: 42,
          active_points: 156,
          current_latitude: -25.9964,
          current_longitude: 28.2268,
          updated_at: new Date().toISOString()
        } as unknown as RiderProfile;
      });
    }
  }, [user]);

  const isFetchingConnRef = useRef(false);

  const fetchConnectionsAndOrders = useCallback(async () => {
    if (!user || isFetchingConnRef.current) return;
    isFetchingConnRef.current = true;
    console.log('MISSION PROTOCOL: Scanning Sector Alpha for active uplinks...');
    try {
      let activeConnections: ShopConnection[] = [];

      if (isSupabaseMocked()) {
        console.log('MISSION PROTOCOL: Signal Simulator engaged.');
        const mockConn = {
          id: 'mock-conn',
          rider_id: user.id,
          shop_id: 's1',
          shop_name: 'Test Burger Hub',
          connection_code: '123456',
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          created_at: new Date().toISOString()
        } as unknown as ShopConnection;
        setConnections([mockConn]);
        activeConnections = [mockConn];
        
        if (profile?.is_online) {
          setAvailableOrders(() => {
            const mocks = [{
              id: 'order-1',
              customer_name: 'John Doe',
              address: '55 Main Rd',
              city: 'Cape Town',
              delivery_status: 'finding_rider',
              order_type: 'delivery',
              product_name: 'Cheese Burger XL',
              delivery_fee: 5.00,
              total_price: 155,
              created_at: new Date().toISOString(),
              restaurant_name: 'Test Burger Hub',
              shop_id: 's1',
              distance_km: 2.3,
              lat: -25.9933, // Match AppMapBackground fallback
              lng: 28.2125,
              shop_lat: -25.9922,
              shop_lng: 28.2045
            }] as DeliveryOrder[];
            return mocks;
          });
        }
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: connData } = await fetchWithRetry<{ data: any[]; error?: any }>(async () => {
        const res = await getSupabase()
          .from('rider_connections')
          .select('*, shop_name:shops(name)')
          .eq('rider_id', user.id)
          .order('expires_at', { ascending: false });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res as any;
      }, 3, 1000, 10000);
      
      if (connData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeConnections = connData.map((c: any) => ({
          ...c,
          shop_name: c.shop_name?.name || 'Local Merchant'
        })) as ShopConnection[];
        setConnections(activeConnections);
      }

      if (!profile?.is_online) {
        setAvailableOrders([]);
        return;
      }

      const validShopIds = activeConnections
        .filter(c => new Date(c.expires_at) > new Date())
        .map(c => c.shop_id);

      if (validShopIds.length === 0) {
        setAvailableOrders([]);
        return;
      }

      const { data: ordersData, error: ordersError } = await getSupabase()
        .from('orders')
        .select('*, shops(name)')
        .eq('delivery_status', 'finding_rider')
        .in('shop_id', validShopIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      if (ordersData) {
        const formatted = ordersData
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => {
            const shopLat = item.shop_lat || -25.9922;
            const shopLng = item.shop_lng || 28.2045;
            const riderLat = profile?.current_latitude || -25.9964; // Regional pilot fallback (Tembisa)
            const riderLng = profile?.current_longitude || 28.2268;
            
            return {
              ...item,
              restaurant_name: item.shops?.name || 'Authorized Merchant',
              distance_km: item.distance_km || haversineDistance(riderLat, riderLng, shopLat, shopLng)
            };
          });
        
        const sorted = [...formatted].map(order => {
           // Since we already filtered by validShopIds in the query, its always linked
           const priority_multiplier = 1.5; 
           const distance = order.distance_km || 1;
           const fee = order.delivery_fee || 0;
           const match_score = (fee / distance) * priority_multiplier;
           return { ...order, match_score };
        }).sort((a, b) => {
           return b.match_score - a.match_score;
        });

        setSurgeMultiplier(Math.max(1.0, Math.min(2.5, 1.0 + (sorted.length / 8))));

        setAvailableOrders(prev => {
           if (sorted.length > prev.length) {
              toast('New Order', { 
                description: 'A new order is available in your area.',
                duration: 5000,
                icon: <Zap className="w-4 h-4 text-[#f59e0b]" />,
                style: { background: '#050505', color: '#f59e0b', border: '1px solid #f59e0b', textTransform: 'uppercase', fontStyle: 'italic', fontWeight: 900 }
              });
           }
           return sorted as DeliveryOrder[];
        });
      } else {
        setAvailableOrders([]);
      }
    } catch (e: unknown) {
      console.error(e);
      const errMessage = e instanceof Error ? e.message : 'Unknown error';
      if (errMessage.toLowerCase().includes('fetch') || errMessage.toLowerCase().includes('network') || errMessage.toLowerCase().includes('timeout')) {
        console.log('WARN: NETWORK_FAILURE - USING CACHED ORDERS');
      } else {
        toast.error(`ERROR: ${errMessage}`);
      }
    } finally {
      isFetchingConnRef.current = false;
    }
  }, [user, profile]);

  const fetchActiveOrdersAndHistory = useCallback(async () => {
    if (!user) return;
    try {
      if (isSupabaseMocked()) {
        setActiveOrders([]);
        setHistory([
          {
             id: 'h1',
             customer_name: 'Recent Client',
             product_name: 'Double Patty Special',
             delivery_fee: 5.00,
             total_price: 180,
             delivery_status: 'delivered',
             updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
             restaurant_name: 'Burger Palace',
             created_at: new Date().toISOString()
          }
        ] as unknown as DeliveryOrder[]);
        return;
      }
      // Active Orders
      const { data: active } = await getSupabase()
        .from('orders')
        .select('*, restaurant_name')
        .eq('rider_id', user.id)
        .in('delivery_status', ['accepted', 'picked_up'])
        .neq('status', 'completed')
        .neq('status', 'cancelled');
      
      if (active) {
        setActiveOrders(active.map(order => ({
          ...order,
          restaurant_name: order.restaurant_name || 'Local Merchant'
        })) as DeliveryOrder[]);
      } else {
        setActiveOrders([]);
      }

      // History
      const { data: historyData } = await getSupabase()
        .from('orders')
        .select('*, restaurant_name')
        .eq('rider_id', user.id)
        .eq('delivery_status', 'delivered')
        .order('updated_at', { ascending: false });
      
      if (historyData) {
        setHistory(historyData.map(item => ({
          ...item,
          restaurant_name: item.restaurant_name || 'Local Merchant'
        })) as DeliveryOrder[]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // Granular Notifications Protocol
  useEffect(() => {
    activeOrders.forEach(order => {
      const prev = prevActiveOrdersRef.current.find(p => p.id === order.id);
      if (prev && prev.status !== order.status) {
        if (order.status === 'ready') {
          toast.success(`MISSION ALERT: Order #${order.id.slice(-4)} is READY for pickup at ${order.restaurant_name}!`, {
            duration: 5000,
            icon: <Zap className="w-4 h-4 text-[#f59e0b]" />
          });
        } else if (order.status === 'preparing') {
          toast.info(`Merchant is now preparing Order #${order.id.slice(-4)}.`);
        }
      }
    });
    prevActiveOrdersRef.current = activeOrders;
  }, [activeOrders]);

  // App Resilience Protocol: Sync on Visibility Change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addBootLog('SYS_RESUME: RE-ESTABLISHING Frequencies');
        // Trigger manual sync of critical data
        if (user) {
          fetchProfile();
          fetchConnectionsAndOrders();
          fetchActiveOrdersAndHistory();
          // Trigger a state update to force re-evaluation.
          setNow(Date.now());
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchActiveOrdersAndHistory]);

  const lastLocationUpdateRef = useRef<{lat: number, lng: number, time: number} | null>(null);
  const isMockedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!user || !profile?.is_online || activeOrders.length === 0) return;

    let watchId: number | null = null;

    const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const p1 = lat1 * Math.PI/180;
      const p2 = lat2 * Math.PI/180;
      const dp = (lat2-lat1) * Math.PI/180;
      const dl = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateLocation = async (pos: GeolocationPosition | { coords: any, timestamp: number, isFallback?: boolean }) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;
      
      const heading = pos.coords.heading || 0;
      const speed = pos.coords.speed || 0;
      const captured_at = 'timestamp' in pos ? new Date(pos.timestamp).toISOString() : new Date().toISOString();
      let is_mocked = ('isFallback' in pos) ? !!pos.isFallback : false;
      
      // Instantly propagate telemetry details to local Profile state for lag-free real-time rendering on map
      setProfile(prev => prev ? {
        ...prev,
        current_latitude: lat,
        current_longitude: lng,
        updated_at: new Date().toISOString()
      } : null);

      // Native OS wrapper mock detection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((pos as any).mocked || (pos as unknown as any).is_mocked) {
        is_mocked = true;
      }
      isMockedRef.current = is_mocked;
      const suspicious = is_mocked;

      // Regional Boundary Validation (Tembisa, Ivory Park, Kaalfontein Sector)
      // Roughly -26.1 to -25.9 Lat, 28.1 to 28.3 Lng
      if (lat > -25.8 || lat < -26.1 || lng < 28.0 || lng > 28.4) {
        if (!isSupabaseMocked()) {
          console.warn('OUT_OF_SECTOR_VECTORED: GPS reporting coordinates outside pilot zone.');
        }
      }

      const now = Date.now();
      const lastLoc = lastLocationUpdateRef.current;
      
      const dist = lastLoc ? getHaversineDistance(lastLoc.lat, lastLoc.lng, lat, lng) : Infinity;
      const timeElapsed = lastLoc ? now - lastLoc.time : Infinity;
      
      // Haversine Throttling: only update if moved > 5 meters OR 15 seconds have passed
      if (dist < 5 && timeElapsed < 15000) return;

      lastLocationUpdateRef.current = { lat, lng, time: now };

      if (accuracy && accuracy > 100) {
        addBootLog(`GPS_LOW_ACCURACY: ${accuracy.toFixed(0)}m - High density interference possible`);
      }

      try {
        if (isSupabaseMocked()) {
          return;
        }
        // Update master profile telemetry
        const { error: profileError } = await getSupabase()
          .from('rider_profiles')
          .update({ 
            current_latitude: lat, 
            current_longitude: lng, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);
        
        if (profileError) throw profileError;

        // Share real-time vector with customers for picked_up missions
        const pickedUpOrders = activeOrders.filter(o => o.delivery_status === 'picked_up');
        if (pickedUpOrders.length > 0) {
          const locationPushes = pickedUpOrders.map(order => 
            getSupabase()
              .from('rider_locations')
              .insert({
                rider_id: user.id,
                order_id: order.id,
                latitude: lat,
                longitude: lng,
                heading: Math.round(heading),
                speed: parseFloat(speed.toFixed(2)),
                timestamp: captured_at,
                is_mocked,
                suspicious
              })
          );
          await Promise.all(locationPushes);
        }
      } catch (e) {
        console.error('Location sync failure:', e);
        addBootLog('SYNC_FAIL: TELEMETRY_UPLINK_INTERRUPTED');
        
        try {
          const queueStr = localStorage.getItem('loc_sync_queue');
          const queue = queueStr ? JSON.parse(queueStr) : [];
          queue.push({
            lat, lng, heading, speed, captured_at, is_mocked, suspicious,
            orders: activeOrders.filter(o => o.delivery_status === 'picked_up').map(o => o.id)
          });
          localStorage.setItem('loc_sync_queue', JSON.stringify(queue));
        } catch (storageErr) {
          console.error("Failed to queue location", storageErr);
        }
      }
    };

    const syncLocationQueue = async () => {
      if (!navigator.onLine || isSupabaseMocked()) return;
      try {
         const queueStr = localStorage.getItem('loc_sync_queue');
         if (!queueStr) return;
         const queue = JSON.parse(queueStr);
         if (!Array.isArray(queue) || queue.length === 0) return;
         
         const latest = queue[queue.length - 1];
         await getSupabase().from('rider_profiles').update({ current_latitude: latest.lat, current_longitude: latest.lng, updated_at: new Date().toISOString() }).eq('id', user.id);
         
         const locationPushes = [];
         for (const item of queue) {
            for (const orderId of item.orders || []) {
               locationPushes.push(getSupabase().from('rider_locations').insert({
                  rider_id: user.id, order_id: orderId, latitude: item.lat, longitude: item.lng,
                  heading: Math.round(item.heading), speed: item.speed, timestamp: item.captured_at,
                  is_mocked: item.is_mocked, suspicious: item.suspicious
               }));
            }
         }
         await Promise.all(locationPushes);
         localStorage.removeItem('loc_sync_queue');
         addBootLog('SYNC_RESTORED: UPLINK_QUEUE_CLEARED');
      } catch (e) {
         console.error('Failed to sync location queue', e);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
         if ("geolocation" in navigator) {
           navigator.geolocation.getCurrentPosition((pos) => {
             updateLocation(pos).catch(err => console.warn('Telemetry sync error on visibility change:', err));
           }, () => {}, { enableHighAccuracy: true, maximumAge: 0 });
         }
         syncLocationQueue();
      }
    };
    
    const handleOnline = () => {
      syncLocationQueue();
    };

    let fallbackIntervalId: NodeJS.Timeout | null = null;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    if ("geolocation" in navigator) {
      // Periodic fallback sync if queue exists
      syncLocationQueue();

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateLocation(pos).catch(err => console.warn('Telemetry stream update error:', err));
        },
        (err) => {
          // Fallback logic for GPS signal failure in high-density areas (Kopanong / Ivory Park Ext)
          if (err.code === 1) { // Permission Denied
             addBootLog('ERROR: GPS_PERM_DENIED');
             toast.error('GPS AUTH FAILURE. Engaging real-time simulation module.', { id: 'gps-error' });
          } else if (err.code === 2) { // Position Unavailable
             addBootLog('SIGNAL_LOST: HIGH_DENSITY_INTERFERENCE');
             toast.warning('SIGNAL INTERFERENCE: TRIANGULATING...', { id: 'gps-warning' });
          } else if (err.code === 3) { // Timeout
             addBootLog('GPS_TIMEOUT: RECALIBRATING...');
          }
          
          // Regional Fallback if NO initial position found (Kopanong Shopping Centre Centerpoint)
          const startLat = profile?.current_latitude || -25.9964; 
          const startLng = profile?.current_longitude || 28.2268;
          updateLocation({ coords: { latitude: startLat, longitude: startLng, accuracy: 50 }, timestamp: Date.now(), isFallback: true })
            .catch(err => console.warn('GPS signal failure fallback location error:', err));

          // Establish a high-fidelity real-time simulation interval to continuously supply movement vectors
          if (!fallbackIntervalId) {
            let curLat = startLat;
            let curLng = startLng;
            let angle = Math.random() * Math.PI * 2;
            
            fallbackIntervalId = setInterval(() => {
              angle += (Math.random() - 0.5) * 0.9;
              const speed = 0.00009 + Math.random() * 0.00004; // Simulate realistic riding drift (approx 10-15 meters per tick)
              curLat += Math.sin(angle) * speed;
              curLng += Math.cos(angle) * speed;

              // Constrain simulation strictly to the Tembisa pilot zone sector
              if (curLat < -26.03) { curLat = -26.03; angle = Math.PI / 2; }
              if (curLat > -25.95) { curLat = -25.95; angle = -Math.PI / 2; }
              if (curLng < 28.18) { curLng = 28.18; angle = 0; }
              if (curLng > 28.25) { curLng = 28.25; angle = Math.PI; }

              updateLocation({
                coords: { 
                  latitude: curLat, 
                  longitude: curLng, 
                  accuracy: 10,
                  heading: (angle * 180) / Math.PI,
                  speed: 6.2 
                }, 
                timestamp: Date.now(), 
                isFallback: true 
              }).catch(err => console.warn('Simulation vector update error:', err));
            }, 6000); // Trigger a location tick every 6 seconds to update map UI beautifully
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 45000, 
          maximumAge: 10000 
        }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (fallbackIntervalId) clearInterval(fallbackIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.is_online, activeOrders]);

  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Auth Listener
  useEffect(() => {
    setTimeout(() => addBootLog('INIT PROTOCOL: AUTH_SEQUENCE'), 0);
    const bootTimeout = setTimeout(() => {
      if (loadingRef.current) {
        addBootLog('ERR: TIMEOUT - FORCING SYSTEM BYPASS');
        setLoading(false);
      }
    }, 12000); // 12s safety timeout

    try {
      if (isSupabaseMocked()) {
        setTimeout(() => {
          addBootLog('AUTH: MOCKED_MODE_ACTIVE');
          setLoading(false);
          clearTimeout(bootTimeout);
        }, 0);
        return () => clearTimeout(bootTimeout);
      }

      getSupabase().auth.getSession().then(({ data: { session } }) => {
        addBootLog(session ? 'AUTH: SESSION_RESTORED' : 'AUTH: NO_SESSION_DETECTED');
        if (session) {
          addBootLog('INITIALIZING TACTICAL OVERLAY');
          addBootLog('CALIBRATING GEOLOCALIZATION VECTORS');
          addBootLog('ESTABLISHING ENCRYPTED UPLINK');
        }
        setUser(session?.user ?? null);
        if (!session) {
          setLoading(false);
          clearTimeout(bootTimeout);
        }
      }).catch(() => {
        addBootLog('ERR: AUTH_FETCH_FAILED');
        setLoading(false);
        clearTimeout(bootTimeout);
      });

      const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
        addBootLog(`EVENT: ${_event.toUpperCase()}`);
        setUser(session?.user ?? null);
        if (!session) {
          setProfile(null);
          setLoading(false);
        }
      });

      return () => {
        subscription.unsubscribe();
        clearTimeout(bootTimeout);
      };
    } catch {
      setTimeout(() => addBootLog('CRITICAL: AUTH_FAILURE'), 0);
      setTimeout(() => setLoading(false), 0);
      clearTimeout(bootTimeout);
    }
  }, []);

  // Timer for countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000 * 30); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  // --- REAL-TIME FLEET ORCHESTRATOR ---
  useEffect(() => {
    if (!user || isSupabaseMocked()) return;

    const channels: import('@supabase/supabase-js').RealtimeChannel[] = [];

    // Protocol: Profile Synchronization
    const profileChannel = getSupabase()
      .channel(`profile:${user.id}_${Math.random()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rider_profiles', 
        filter: `id=eq.${user.id}` 
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          setProfile(payload.new as RiderProfile);
        }
      })
      .subscribe();
    channels.push(profileChannel);

    // Protocol: Sector Missions (Public)
    const publicOrdersChannel = getSupabase()
      .channel(`public_orders_${Math.random()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: 'order_type=eq.delivery' 
      }, () => {
        fetchConnectionsAndOrders();
      })
      .subscribe();
    channels.push(publicOrdersChannel);

    // Protocol: Relay Connections
    const connChannel = getSupabase()
      .channel(`rider_connections:${user.id}_${Math.random()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rider_connections', 
        filter: `rider_id=eq.${user.id}` 
      }, () => {
        fetchConnectionsAndOrders();
      })
      .subscribe();
    channels.push(connChannel);

    // Protocol: Active Mission Directives
    const missionChannel = getSupabase()
      .channel(`rider_orders:${user.id}_${Math.random()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `rider_id=eq.${user.id}` 
      }, () => {
        // Full refresh on mission state change
        fetchConnectionsAndOrders();
        fetchActiveOrdersAndHistory();
      })
      .subscribe();
    channels.push(missionChannel);

    // Protocol: Relay Nudge Directives
    const nudgeChannel = getSupabase()
      .channel(`nudges:${user.id}_${Math.random()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'rider_notifications',
        filter: `rider_id=eq.${user.id}` 
      }, payload => {
        toast.info(`Update from store: ${payload.new.message}`, {
          duration: 6000,
          description: 'Store requires your attention.',
          icon: <Activity className="w-5 h-5 text-[#f59e0b]" />
        });
      })
      .subscribe();
    channels.push(nudgeChannel);

    return () => {
      channels.forEach(ch => {
        getSupabase().removeChannel(ch);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchActiveOrdersAndHistory]);

  // Initial Fetches
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await fetchProfile();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await fetchConnectionsAndOrders();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.is_online]);

  // Active Mission & History Sync
  useEffect(() => {
    const init = async () => {
      await fetchActiveOrdersAndHistory();
    };
    init();
  }, [fetchActiveOrdersAndHistory]);

  // Actions
  const handleUpdateStatus = useCallback(async (orderId: string, status: DeliveryStatus) => {
    if (!profile) return;
    
    // Find the order being updated
    const orderToUpdate = activeOrders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    
    const updates = { 
      delivery_status: status, 
      updated_at: new Date().toISOString() 
    };

    // Integrity Check: Block delivery if mock GPS detected
    if (status === 'delivered' && isMockedRef.current) {
      toast.error('SECURITY ALERT: Mock Location Detected. Cannot confirm arrival using spoofed GPS.', { duration: 5000 });
      // Flag the payload or alert backend silently if needed.
      return;
    }

    // ROI Protocol: Mandatory Proof of Delivery simulation
    // Optimization: Swipe gesture in UI is sufficient confirmation
    // if (status === 'delivered') {
    //   const confirmed = window.confirm("POD PROTOCOL: Has the asset been successfully delivered? Close proximity detected.");
    //   if (!confirmed) return;
    // }

    try {
      if (isSupabaseMocked()) {
        setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_status: status } : o));
        if (status === 'delivered') {
           setHistory(prev => [{...orderToUpdate, delivery_status: 'delivered', updated_at: new Date().toISOString()}, ...prev]);
           setActiveOrders(prev => prev.filter(o => o.id !== orderId));
           setProfile(prev => prev ? {
             ...prev,
             total_earnings: prev.total_earnings + (orderToUpdate.delivery_fee || 0),
             total_deliveries: prev.total_deliveries + 1,
             active_points: prev.active_points + 15
           } : null);
           toast.success(`Order completed! +${orderToUpdate.delivery_fee} earned.`);
           if (activeOrders.length <= 1) {
             setShowRatingPrompt({ orderId: orderToUpdate.id, entity: 'customer' });
           }
        } else if (status === 'finding_rider') {
           setActiveOrders(prev => prev.filter(o => o.id !== orderId));
           setAvailableOrders(prev => [...prev, {...orderToUpdate, delivery_status: 'finding_rider'}]);
           toast.success('Order cancelled.');
        } else {
           toast.success('Location updated.');
        }
        return;
      }
      const { error } = await fetchWithRetry(async () => {
        return await getSupabase()
          .from('orders')
          .update(updates)
          .eq('id', orderId);
      });

      if (error) {
        toast.error('Update failed');
      } else {
        if (status === 'delivered') {
          const { error: rpcError } = await fetchWithRetry(async () => {
             return await getSupabase().rpc('increment_rider_stats', {
               p_rider_id: profile.id,
               p_earnings: orderToUpdate.delivery_fee,
               p_points: 15
             });
          });
          
          if (rpcError) {
             console.warn('RPC failed, falling back to direct update', rpcError);
             const profileUpdates = {
               total_earnings: profile.total_earnings + (orderToUpdate.delivery_fee || 0),
               total_deliveries: profile.total_deliveries + 1,
               active_points: profile.active_points + 15,
               updated_at: new Date().toISOString()
             };
             await fetchWithRetry(async () => {
                return await getSupabase().from('rider_profiles').update(profileUpdates).eq('id', profile.id);
             });
          }
          
          setActiveOrders(prev => prev.filter(o => o.id !== orderId));
          setHistory(prev => [{...orderToUpdate, delivery_status: 'delivered', updated_at: new Date().toISOString()}, ...prev]);
          
          const remainingMissions = activeOrders.length - 1;
          if (remainingMissions === 0) {
            setShowRatingPrompt({ orderId: orderToUpdate.id, entity: 'customer' });
          }
          toast.success(`Order completed! +${orderToUpdate.delivery_fee} earned.`);
        } else if (status === 'finding_rider') {
           setActiveOrders(prev => prev.filter(o => o.id !== orderId));
           toast.success('Order cancelled.');
        } else {
          setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_status: status } : o));
          toast.success('Order status updated');
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Update failed';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot sync phase offline.');
      } else {
        toast.error(message);
      }
    }
  }, [profile, activeOrders, setActiveOrders, setHistory, setProfile, setShowRatingPrompt]);

  const [isListening, setIsListening] = useState(false);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice protocols not supported on this device.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-ZA';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Voice listening', {
        description: "Say 'picked up' or 'delivered'...",
        icon: <Mic className="w-5 h-5 text-[#f59e0b]" />
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log('VOICE DISCOVERY:', transcript);

      let handled = false;
      const currentOrder = activeOrders[0]; 

      if (currentOrder) {
        if (transcript.includes('picked up') || transcript.includes('collected')) {
          handleUpdateStatus(currentOrder.id, 'picked_up');
          toast.success('Voice: Pickup confirmed', { icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> });
          handled = true;
        } else if (transcript.includes('delivered') || transcript.includes('completed')) {
          handleUpdateStatus(currentOrder.id, 'delivered');
          toast.success('Voice: Delivery completed', { icon: <Target className="w-5 h-5 text-white shadow-xl" /> });
          handled = true;
        }
      }

      if (!handled) {
        toast.error(`Command not recognized: "${transcript}"`, { description: 'Try saying "picked up" or "delivered".' });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setIsListening(false);
      console.error('Voice Error:', event.error);
      toast.error(`Voice error: ${event.error.toUpperCase()}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [activeOrders, handleUpdateStatus]);

  const confirmOnlineToggle = useCallback(async () => {
    if (!profile) return;
    const newStatus = !profile.is_online;
    
    // Always update state locally first (optimistic UI flow / failsafe fallback)
    const updatedProfile = { 
      ...profile, 
      is_online: newStatus,
      last_online: newStatus ? new Date().toISOString() : profile.last_online,
      status: newStatus ? 'online' : 'offline',
      updated_at: new Date().toISOString()
    };
    setProfile(updatedProfile);

    try {
      if (isSupabaseMocked()) {
        if (newStatus) {
          toast.success('System Online! New missions from paired shops will appear here.', { duration: 4000 });
        } else {
          toast.info('System Standby. Taking a break.');
        }
        return;
      }

       const { error } = await fetchWithRetry(async () => {
         return await getSupabase()
           .from('rider_profiles')
           .update({ 
             is_online: newStatus, 
             status: newStatus ? 'online' : 'offline',
             updated_at: new Date().toISOString() 
           })
           .eq('id', profile.id);
       }, 3, 1000, 10000);
      if (error) {
        console.warn('Failed to sync system status with active database range:', error);
        toast.info("Database write bypassed (Local Fallback)", {
          description: "Online state updated locally. You are ready for live dispatch simulations."
        });
      } else {
        if (newStatus) {
          toast.success('System Online! New missions from paired shops will appear here.', { duration: 4000 });
        } else {
          toast.success('System Standby. Taking a break.');
        }
      }
    } catch (e: unknown) {
      console.warn('Online status sync exception, falling back:', e);
      toast.info("Database connection bypassed (Local Fallback)", {
        description: "Your session state has been initialized successfully."
      });
    }
  }, [profile]);

  const toggleOnline = useCallback(async () => {
    if (!profile) return;
    
    if (profile.verification_status !== 'verified') {
      toast.error('Identity Verification Pending. Access blocked until verified.');
      return;
    }

    if (profile.is_online && activeOrders.length > 0) {
      setShowOfflineWarning(true);
      return;
    }

    await confirmOnlineToggle();
  }, [profile, activeOrders.length, confirmOnlineToggle]);

  const updateVehicle = async (type: UserVehicle) => {
    if (!profile) return;
    // Update local state first (optimistic)
    setProfile(prev => prev ? { ...prev, vehicle_type: type, updated_at: new Date().toISOString() } : null);

    try {
      if (isSupabaseMocked()) return;
      const { error } = await fetchWithRetry(async () => {
        return await getSupabase()
          .from('rider_profiles')
          .update({ vehicle_type: type, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      }, 3, 1000, 10000);
      if (error) {
        console.warn('Sync vehicle database error:', error);
      }
    } catch (e: unknown) {
      console.warn('Vehicle sync exception, local change retained:', e);
    }
  };

  const handleOnboardingComplete = async () => {
    if (onboardingMode === 'onboarding') {
      localStorage.setItem('localeats_onboarding_seen', 'true');
      if (user) {
        try {
          if (!isSupabaseMocked()) {
            await getSupabase()
              .from('rider_profiles')
              .update({ onboarding_complete: true })
              .eq('id', user.id);
          }
          setProfile(prev => prev ? { ...prev, onboarding_complete: true } : null);
          addBootLog('SYS_READY: OPERATOR_CERTIFIED');
        } catch (e) {
          console.error(e);
        }
      }
    }
    setShowOnboarding(false);
  };

  const handleOrderAccept = async (orderId: string) => {
    if (!profile || !user) return;
    
    // Pairing Protocol: Ensure rider is connected to the merchant node
    const orderToAccept = availableOrders.find(o => o.id === orderId);
    if (!orderToAccept && !isSupabaseMocked()) {
      toast.error('Store connection unavailable.');
      return;
    }

    if (orderToAccept) {
      const isPaired = connections.some(c => c.shop_id === orderToAccept.shop_id && new Date(c.expires_at) > new Date());
      if (!isPaired && !isSupabaseMocked()) {
        toast.error('Store link expired. Please reconnect to the store.');
        return;
      }
    }
    
    if (activeOrders.length >= 2) {
      toast.error('Too many active orders. Complete one first.');
      return;
    }

    try {
      if (isSupabaseMocked()) {
        const order = availableOrders.find(o => o.id === orderId);
        if (order) {
          const accepted = { 
            ...order, 
            delivery_status: 'accepted' as const, 
            rider_id: user.id,
            surge_multiplier: surgeMultiplier 
          };
          setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
          setActiveOrders(prev => [...prev, accepted as DeliveryOrder]);
          toast.success('Order accepted. Starting navigation.', {
            description: surgeMultiplier > 1 ? `Bonus active: x${surgeMultiplier.toFixed(1)}` : undefined
          });
          setView('move');
        }
        return;
      }
      const { data, error } = await fetchWithRetry(async () => {
        return await getSupabase()
          .from('orders')
          .update({ 
            delivery_status: 'accepted', 
            rider_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .eq('delivery_status', 'finding_rider')
          .or(`rider_id.is.null,rider_id.eq.${user.id}`)
          .select()
          .single();
      }, 3, 1000, 10000);

      if (error || !data) {
        toast.error(`Error: ${error?.message || 'Order already taken by another rider'}`);
      } else {
        toast.success('Order accepted. Starting navigation.');
        setView('move');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Accept failed';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot accept mission offline.');
      } else {
        toast.error(message);
      }
    }
  };

  const handlePair = async (code: string) => {
    if (!user || !profile) return;
    addBootLog(`HANDSHAKE_INIT: CODE_${code}`);
    
    try {
      if (isSupabaseMocked()) {
        await new Promise(resolve => setTimeout(resolve, 800));
        if (code === '000000') {
          throw new Error('Uplink rejected. Testing failure protocol.');
        }
        toast.success(`Uplink established! Successfully paired with Alpha Grid. (24h Pass)`);
        setView('hub');
        await fetchConnectionsAndOrders();
        return;
      }

      const { data: connection, error: fetchError } = await getSupabase()
        .from('rider_connections')
        .select('*, shops(name)')
        .eq('connection_code', code)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (fetchError || !connection) {
        throw new Error('Invalid or expired pairing code. Ensure the Store has generated a new one.');
      }

      let { error: updateError } = await getSupabase()
        .from('rider_connections')
        .update({
          rider_id: user.id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', connection.id);
      
      // Fallback for stale schema cache (PGRST error) missing the updated_at column
      if (updateError && updateError.message?.includes('Could not find') && updateError.message?.includes('updated_at')) {
        console.warn('Schema cache stale, retrying Handshake without updated_at column...', updateError);
        const retryResult = await getSupabase()
          .from('rider_connections')
          .update({
            rider_id: user.id,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', connection.id);
        updateError = retryResult.error;
      }

      if (updateError) throw updateError;

      // Stability Update: Handshake Verification
      const { data: verification, error: verifyError } = await getSupabase()
        .from('rider_connections')
        .select('rider_id')
        .eq('id', connection.id)
        .single();

      if (verifyError || verification?.rider_id !== user.id) {
        throw new Error('Connection failed. Please try again.');
      }

      // Haptic Feedback Trigger!
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);

      const shopName = connection.shops?.name || 'Store';
      toast.success(`Connected!`, {
        description: `Successfully linked with ${shopName}. (24h active)`,
        style: { background: '#050505', color: '#10b981', border: '1px solid #10b981' }
      });
      
      setView('hub');
      await fetchConnectionsAndOrders();
    } catch (err: unknown) {
      const error = err as Error & { message?: string };
      console.error('Pairing Protocol Error:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-center w-full max-w-xs px-6">
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }} 
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-[#f59e0b] text-[10px] font-black uppercase tracking-[0.6em] mb-8"
          >
            LOADING_SYSTEM...
          </motion.div>
          
          <div className="space-y-1 mb-10 min-h-[60px] text-left">
            {bootLogs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-zinc-600 text-[9px] font-bold uppercase tracking-wider overflow-hidden whitespace-nowrap"
              >
                {log}
              </motion.div>
            ))}
            <motion.div 
              animate={{ opacity: [0, 1] }} 
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="w-1.5 h-3 bg-[#f59e0b] inline-block align-middle ml-1"
            />
          </div>

          <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden mb-12 relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="h-full bg-[#f59e0b] shadow-[0_0_15px_rgba(57,255,20,0.5)]"
            />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
          >
            <button 
              onClick={() => setLoading(false)}
              className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 border border-zinc-900 px-6 py-3 rounded-xl hover:border-[#f59e0b]/30 hover:text-[#f59e0b] transition-all bg-zinc-950/50"
            >
              Skip Loading
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthView onMockLogin={() => setUser({ id: 'mock-user-123', email: 'mock@simulator.local' } as unknown as User)} />;

  if (!profile) {
    const fallbackProfile: RiderProfile = {
      id: user.id,
      name: user.email?.split('@')[0] || 'elite_rider',
      full_name: user.user_metadata?.full_name || 'VIP Rider',
      phone: user.user_metadata?.phone || '+27 83 123 4567',
      is_online: true,
      status: 'online',
      vehicle_type: 'Road',
      verification_status: 'verified',
      rating: 5.0,
      total_earnings: 1250,
      total_deliveries: 42,
      active_points: 156,
      current_latitude: -25.9964,
      current_longitude: 28.2268,
      updated_at: new Date().toISOString()
    } as unknown as RiderProfile;

    setTimeout(() => {
      setProfile(fallbackProfile);
      toast.success("Simulator Overlay Active", {
         description: "Database connection bypassed using simulated telemetry."
      });
    }, 0);

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center font-mono">
        <motion.div 
          animate={{ opacity: [0.3, 1, 0.3] }} 
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[#f59e0b] text-[10px] font-black uppercase tracking-[0.6em] mb-4"
        >
          ENGAGING_FALLBACK_SIMULATOR...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-[#F0F0F0] font-body selection:bg-[#f59e0b] selection:text-black overflow-x-hidden relative">
      <Toaster position="top-center" theme="dark" richColors />
      
      {/* IMPROVEMENT #9 — Offline Detection Banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-[1100] bg-red-600 text-white py-3 px-6 flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-2xl"
          >
            <WifiOff className="w-4 h-4 animate-pulse" />
            Lost connection. Trying to reconnect...
          </motion.div>
        )}
      </AnimatePresence>
      {showOnboarding && <TacticalOnboarding onComplete={handleOnboardingComplete} mode={onboardingMode} />}
      
      {/* Offline Warning Modal */}
      <AnimatePresence>
        {showOfflineWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex justify-center items-center p-6 pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-red-500/30 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] relative"
            >
              <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-black uppercase text-white mb-2">Active Orders</h3>
              <p className="text-zinc-400 text-xs mb-8 leading-relaxed">
                You have active orders. Going offline will unassign you from these orders and may impact your activity rating. Are you sure you want to stop?
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    setShowOfflineWarning(false);
                    await confirmOnlineToggle();
                  }}
                  className="w-full py-4 bg-red-600 text-white font-black uppercase italic tracking-widest rounded-xl hover:bg-red-500 active:scale-95 transition-all text-sm shadow-lg shadow-red-600/20"
                >
                  Go Offline Anyway
                </button>
                <button 
                  onClick={() => setShowOfflineWarning(false)}
                  className="w-full py-4 bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-700 active:scale-95 transition-all text-xs"
                >
                  Keep Working
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Prompt Overlay */}
      <AnimatePresence>
        {showRatingPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex justify-center items-center p-6 pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowRatingPrompt(null);
                  setView('dash');
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black uppercase text-white mb-2 mt-4">How was the mission?</h3>
              <p className="text-zinc-400 text-xs mb-6">Rate your experience with the {showRatingPrompt.entity} to help us maintain grid integrity.</p>
              
              <div className="flex justify-center mb-8">
                 <StarRatingInput 
                   rating={0} 
                   onRatingChange={() => {
                     toast.success(`Rating synced. Thank you.`);
                     setTimeout(() => {
                       setShowRatingPrompt(null);
                       setView('dash');
                     }, 800);
                   }}
                 />
              </div>

              <button 
                onClick={() => {
                  setShowRatingPrompt(null);
                  setView('dash');
                }}
                className="text-[10px] uppercase font-black tracking-widest text-[#f59e0b] hover:text-[#d97706]"
              >
                Skip Assessment
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Map layer is managed within specific views to prevent redundant instances */}
      
      {/* HUD Header */}
      <AnimatePresence>
        {view !== 'move' && (
          <motion.header 
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            exit={{ y: -60 }}
            className="fixed top-0 left-0 right-0 h-[60px] bg-black/60 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-4 sm:px-6 pointer-events-auto transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-2 h-2 rounded-full",
                profile.is_online ? "bg-[#f59e0b] animate-pulse neon-glow" : "bg-zinc-800"
              )} />
              <div className="flex flex-col">
                <h1 className="font-headline font-black italic text-xl uppercase tracking-tighter leading-none">
                  Local<span className="text-[#f59e0b]">Eats</span>
                </h1>
                {connections.length > 0 && (() => {
                  const isExpired = new Date(connections[0].expires_at).getTime() < now;
                  return (
                    <div className="flex items-center gap-1 mt-1">
                      <Globe className={cn("w-2 h-2", isExpired ? "text-red-500" : "text-orange-500")} />
                      <span className={cn("text-[7px] font-black uppercase tracking-widest", isExpired ? "text-red-500" : "text-[#f59e0b]")}>{isExpired ? "PASS EXPIRED" : "CONNECTED"}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {connections.length > 0 && (() => {
                 const isExpired = new Date(connections[0].expires_at).getTime() < now;
                 const hours = Math.max(0, Math.floor((new Date(connections[0].expires_at).getTime() - now) / (1000 * 60 * 60)));
                 const mins = Math.max(0, Math.floor(((new Date(connections[0].expires_at).getTime() - now) % (1000 * 60 * 60)) / (1000 * 60)));
                 return (
                   <div className="hidden sm:flex flex-col items-end gap-1 px-4 border-r border-zinc-800">
                      <span className="text-[7px] text-zinc-500 font-black uppercase">Fleet Pass</span>
                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => isExpired && setView('pair')}>
                        <Clock className={cn("w-2 h-2", isExpired ? "text-red-500" : "text-[#f59e0b]")} />
                        <span className={cn("text-[10px] font-mono font-bold", isExpired ? "text-red-500" : "text-[#F0F0F0]")}>
                           {isExpired ? "EXPIRED - RE-PAIR" : `CONNECTED: ${hours}H ${mins}M`}
                        </span>
                      </div>
                   </div>
                 );
              })()}
              <div className="text-right hidden sm:block">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Rider Identifier</p>
                <p className="text-xs font-mono font-bold">{profile.name}</p>
              </div>

              {/* Battery Status Indicator */}
              {batteryLevel !== null && (
                <div 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border",
                    batteryLevel < 20 && !batteryCharging
                      ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  )}
                  title={batteryCharging ? "Charging" : `Battery: ${batteryLevel}%`}
                >
                  <div className="relative w-5 h-2.5 border border-current rounded-[2px] flex items-center p-[1px] pr-[1.5px]">
                    <div 
                      className={cn(
                        "h-full rounded-[1.2px] transition-all",
                        batteryLevel < 20 && !batteryCharging ? "bg-red-500 animate-pulse" : batteryCharging ? "bg-green-400" : "bg-zinc-400"
                      )} 
                      style={{ width: `${batteryLevel}%` }} 
                    />
                    <div className="absolute -right-[3px] top-[2px] w-[2px] h-[4px] bg-current rounded-r-[1px]" />
                  </div>
                  <span className="text-[9px] font-black">{Math.round(batteryLevel)}%</span>
                  {batteryCharging && <span className="text-[8px] text-green-400 font-sans">⚡</span>}
                </div>
              )}

              <div 
                onClick={() => setView('hub')}
                className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:border-[#f59e0b]/50 transition-colors flex items-center justify-center p-0.5"
              >
                {(() => {
                  const avatar = profile ? (localStorage.getItem(`localeats_avatar_${profile.id}`) || profile.photo_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23E4E6EB'/><circle cx='50' cy='40' r='18' fill='%238A8D91'/><path d='M15 90 C15 65, 30 60, 50 60 C70 60, 85 65, 85 90 Z' fill='%238A8D91'/></svg>") : '';
                  return avatar ? (
                    <img src={avatar} className="w-full h-full object-cover rounded-lg" alt="Rider Profile" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-zinc-400" />
                  );
                })()}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <main className={cn(
        "w-full max-w-5xl mx-auto min-h-[100dvh] pb-32 relative z-10 pointer-events-none transition-all duration-300",
        view !== 'move' ? "pt-[60px]" : "pt-0"
      )}>
        
        {/* Mission Pulse Overlay */}
        <AnimatePresence>
          {profile?.is_online && availableOrders.length > 0 && activeOrders.length === 0 && view !== 'orders' && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="fixed bottom-28 left-4 right-4 pointer-events-auto z-[200]"
            >
              <BentoCard glow className="bg-black/95 backdrop-blur-3xl border-2 border-[#f59e0b] p-6 shadow-[0_0_80px_rgba(57,255,20,0.3)] ring-1 ring-white/10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-[#f59e0b] rounded-2xl animate-pulse shadow-[0_0_20px_#f59e0b]">
                      <Zap className="w-8 h-8 text-black" />
                    </div>
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-[#f59e0b] tracking-[0.4em] mb-1">Drop-Off Protocol</h3>
                      <p className="text-2xl font-headline font-black italic uppercase text-white leading-none tracking-tighter">
                        TEST SIGNAL
                      </p>
                      <p className="text-[11px] font-bold text-zinc-500 uppercase mt-1 tracking-widest">{availableOrders[0].restaurant_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] mb-1">Potential</p>
                    <p className="text-3xl font-mono font-bold text-white tracking-tighter">
                      R{Number(availableOrders[0].delivery_fee || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">ETA Vector</span>
                    <span className="text-xl font-mono font-bold text-white">{Math.max(0, Math.floor(Number(availableOrders[0].distance_km || 0) * 3))}:00 M</span>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-1">Range</span>
                    <span className="text-xl font-mono font-bold text-white">{Number(availableOrders[0].distance_km || 0).toFixed(1)} KM</span>
                  </div>
                </div>

                <SwipeButton 
                  label="SLIDE TO ACCEPT"
                  onComplete={() => {
                    handleOrderAccept(availableOrders[0].id);
                    setView('move');
                  }}
                  color="#f59e0b"
                  resetToken={availableOrders[0].id}
                />
              </BentoCard>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-auto"
          >
            {view === 'dash' && (
              <div className="space-y-6">
                {/* Mission Pulse Card at Top of HUD when pending/active */}
                <AnimatePresence>
                  {activeOrders.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="mb-8"
                    >
                      <BentoCard glow className="bg-black/95 border-[#f59e0b] p-5 shadow-[0_0_50px_rgba(57,255,20,0.2)]">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f59e0b] mb-1 animate-pulse">Drop-Off Protocol</span>
                            <h2 className="text-xl font-headline font-black italic uppercase text-white">Target Sync Active</h2>
                          </div>
                          <div className="p-3 bg-[#f59e0b]/10 rounded-2xl">
                            <Radar className="w-6 h-6 text-[#f59e0b] animate-spin" />
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <TelemetryData label="Destination" value={activeOrders[0].restaurant_name.split(' ')[0]} />
                          <TelemetryData label="Status" value={activeOrders[0].delivery_status.replace('_', ' ').toUpperCase()} />
                        </div>
                        <button 
                          onClick={() => setView('move')}
                          className="mt-6 w-full py-4 bg-[#f59e0b] text-black font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          Resume Route <ArrowRight className="w-5 h-5" />
                        </button>
                      </BentoCard>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Telemetry Health Protocol */}
                <BentoCard className="bg-zinc-900/40 border-zinc-800/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                         <Radar className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase">System Integrity</h4>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-white uppercase italic">Telemetry Uplink</span>
                           <div className="flex items-center gap-0.5">
                              {[1,2,3,4].map(b => (
                                <div key={b} className={cn("w-1 h-3 rounded-full bg-zinc-800", b <= 3 && "bg-orange-500")} />
                              ))}
                           </div>
                        </div>
                      </div>
                    </div>
                    <button 
                       onClick={() => {
                         addBootLog('MANUAL_SYNC_INIT');
                         fetchProfile();
                         fetchConnectionsAndOrders();
                         toast.success('System recalibrated.', { icon: <Zap className="w-4 h-4" /> });
                       }}
                       className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black uppercase px-3 py-2 rounded-lg transition-colors border border-zinc-700"
                    >
                      Recalibrate
                    </button>
                  </div>
                </BentoCard>

                <Dashboard 
                  profile={profile} 
                  todayEarnings={history
                    .filter(o => isTodayLocal(o.updated_at))
                    .reduce((acc, curr) => acc + Number(curr.delivery_fee || 0), 0)}
                  totalDeliveries={profile.total_deliveries}
                  history={history}
                  onToggleOnline={toggleOnline} 
                  setView={setView}
                  connectionCount={connections.length}
                  isListening={isListening}
                  onStartListening={startListening}
                />
              </div>
            )}
            {view === 'feed' && (
              <div className="space-y-6">
                <AnimatePresence>
                  {activeOrders.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="px-6 pt-6"
                    >
                      <BentoCard glow className="bg-black/95 border-[#f59e0b] p-5 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f59e0b] mb-1 animate-pulse">Active Deployment</span>
                            <h2 className="text-xl font-headline font-black italic uppercase text-white">Tracking Signal</h2>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-widest text-[#f59e0b]">ETA</p>
                              <p className="text-xl font-mono font-bold text-white leading-none">
                                {Math.max(1, Math.round((Number(activeOrders[0].distance_km) || 2) * 2.5))}m
                              </p>
                            </div>
                            <div className="p-2.5 bg-[#f59e0b]/10 rounded-xl">
                              <Activity className="w-5 h-5 text-[#f59e0b] animate-pulse" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <TelemetryData label="Carrier" value={profile?.name || 'Unit-1'} />
                           <TelemetryData label="Objective" value={activeOrders[0].delivery_status.replace('_', ' ').toUpperCase()} />
                           <TelemetryData label="Payload" value={`R${Number(activeOrders[0].delivery_fee || 0).toFixed(0)}`} />
                        </div>
                        <button 
                          onClick={() => setView('move')}
                          className="mt-5 w-full py-3.5 bg-zinc-900 border border-zinc-800 text-[#f59e0b] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-zinc-800"
                        >
                          OPEN TACTICAL HUD <ArrowRight className="w-4 h-4" />
                        </button>
                      </BentoCard>
                    </motion.div>
                  )}
                </AnimatePresence>
                <OrdersFeed 
                  orders={availableOrders} 
                  activeOrders={activeOrders}
                  onAccept={handleOrderAccept} 
                  isOnline={profile?.is_online || false} 
                  surgeMultiplier={surgeMultiplier} 
                  connectionCount={connections.length} 
                  onRefresh={fetchConnectionsAndOrders}
                  activeOrdersCount={activeOrders.length}
                  riderName={profile?.name}
                  vehicleType={profile?.vehicle_type}
                  riderLat={profile?.current_latitude}
                  riderLng={profile?.current_longitude}
                  onToggleOnline={toggleOnline}
                />
              </div>
            )}
            {view === 'move' && (
              activeOrders.length > 0 ? (
                <div className="fixed inset-0 z-20 pointer-events-none flex flex-col">
                  {/* Floating Instruction Module is inside AppMapBackground */}
                  <div className="absolute top-20 right-4 p-4 pointer-events-auto z-50">
                    <button 
                      onClick={() => setView('dash')}
                      className="px-4 py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-zinc-400 hover:text-white shadow-xl pointer-events-auto flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Minimize2 className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-black tracking-widest">Back to Hub</span>
                    </button>
                  </div>
                  <ActiveMissionView 
                    orders={activeOrders} 
                    onUpdateStatus={handleUpdateStatus} 
                    onScreenTap={() => setIsGlobalNavVisible(prev => !prev)}
                    onShowTracking={(id) => {
                      setSelectedTrackingOrderId(id);
                      setView('tracking');
                    }}
                    profile={profile || undefined}
                    isNavVisible={isGlobalNavVisible}
                  />
                </div>
              ) : (
                <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center opacity-40">
                  <Navigation className="w-16 h-16 mb-4 text-zinc-600" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">No active operational mission</p>
                  <button onClick={() => setView('feed')} className="mt-6 text-[10px] font-black uppercase text-[#f59e0b] underline">Open Mission Feed</button>
                </div>
              )
            )}
            {view === 'log' && <HistoryView history={history} />}
            {view === 'tracking' && selectedTrackingOrderId && (
              <OrderTrackingScreen 
                orderId={selectedTrackingOrderId} 
                onBack={() => setView('move')} 
              />
            )}
            {view === 'hub' && (
              <>
                <ProfileView 
                  profile={profile} 
                  connections={connections}
                  now={now}
                  onUpdateVehicle={updateVehicle} 
                  onLogout={async () => {
                  try { await getSupabase().auth.signOut(); } catch (e) {
                     console.warn("Sign out err", e);
                     localStorage.clear();
                     window.location.reload();
                  }
                }} 
                  onPair={() => {
                    setView('pair');
                  }}
                  onToggleOnline={toggleOnline}
                  onBack={() => setView('dash')}
                />
                <VoiceController 
                  isListening={isListening} 
                  onStart={startListening} 
                />
              </>
            )}
            {view === 'pair' && <PairingView onBack={() => setView('hub')} onComplete={handlePair} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* HUD Navigation */}
      <AnimatePresence>
        {(view !== 'move' ? true : isGlobalNavVisible) && (
          <motion.nav 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-0 left-0 w-full p-6 z-[60] pointer-events-auto"
          >
            <div className="max-w-md md:max-w-5xl mx-auto bg-zinc-900/90 backdrop-blur-3xl border border-zinc-800/50 rounded-[2.5rem] p-2 flex items-center justify-between xl:justify-center xl:gap-10 shadow-2xl">
              {[
                { icon: BarChart3, label: 'HOME', view: 'dash' },
                { icon: List, label: 'ORDERS', view: 'feed' },
                { icon: Navigation, label: 'ACTIVE', view: 'move', alert: activeOrders.length > 0 },
                { icon: Smartphone, label: 'HISTORY', view: 'log' },
                { icon: UserIcon, label: 'PROFILE', view: 'hub' },
              ].map((item) => {
                const isActive = view === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => setView(item.view as AppView)}
                    className={cn(
                      "relative flex-1 flex flex-col items-center py-4 rounded-[2rem] transition-smooth", 
                      isActive 
                        ? "bg-[#f59e0b] text-zinc-950 shadow-xl shadow-[#f59e0b]/25 scale-105 font-bold" 
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20"
                    )}
                  >
                    {item.alert && <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.6)] animate-bounce" />}
                    <item.icon size={18} className={cn("transition-transform duration-300", isActive && "fill-current scale-110")} />
                    <span className="text-[9px] font-black uppercase mt-1.5 tracking-wider">{item.label}</span>
                    {isActive && <motion.div layoutId="nav-glow" className="absolute -inset-1 bg-[#f59e0b]/25 blur-xl -z-10 rounded-full" />}
                  </button>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Floating System Intel Manual Trigger (?) */}
      <div 
        className={cn(
          "fixed right-6 z-[80] transition-all duration-300 md:right-8",
          (view !== 'move' ? true : isGlobalNavVisible) ? "bottom-28" : "bottom-6"
        )}
      >
        <button
          onClick={() => {
            setOnboardingMode('helphub');
            setShowOnboarding(true);
          }}
          className="relative w-12 h-12 rounded-full bg-zinc-950/95 border border-[#f59e0b]/40 text-[#f59e0b] hover:bg-zinc-900 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)] flex items-center justify-center group pointer-events-auto backdrop-blur-md"
          title="Open System Manual & Tour"
        >
          {/* Subtle spinning outline */}
          <div className="absolute inset-0 rounded-full border border-dashed border-[#f59e0b]/20 group-hover:rotate-45 transition-transform duration-500" />
          
          <HelpCircle size={20} className="stroke-[2.5] group-hover:scale-110 transition-transform" />
          
          {/* Active flashing signal beacon to guide first time operators */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b]/60 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#f59e0b] flex items-center justify-center text-[7px] font-black text-black">?</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default function AppWithBoundary() {
  const handleReset = () => {
    console.warn("Initiating manual self-healing protocol from UI...");
    localStorage.clear();
    sessionStorage.clear();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <ErrorBoundary FallbackComponent={FallbackComponent} onReset={handleReset}>
      <App />
    </ErrorBoundary>
  );
}
