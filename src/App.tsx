import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
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
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Toaster, toast } from 'sonner';
import { getSupabase, isSupabaseMocked } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { RiderProfile, DeliveryOrder, UserVehicle, DeliveryStatus, ShopConnection } from './types';
import { cn } from './lib/utils';
import { QRScanner } from './components/QRScanner';
import { AppMapBackground } from './components/AppMapBackground';
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
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && (error.message === 'timeout' || error.message.includes('fetch'))))) {
      const nextDelay = delay * 1.5; 
      const errMessage = error instanceof Error ? error.message : 'Network sequence interrupted';
      console.log(`[RETRYING] ${errMessage.toUpperCase()} | Attempts remaining: ${retries}`);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, nextDelay, timeoutMs);
    }
    throw error;
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
    "bg-[#0D0D0D] border border-zinc-800 rounded-3xl p-6 relative overflow-hidden group transition-all",
    glow && "shadow-[0_0_40px_rgba(57,255,20,0.1)] border-[#f59e0b]/20",
    className
  )}>
    {glow && <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f59e0b]/5 rounded-full blur-3xl" />}
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
      "relative h-20 bg-zinc-950/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden p-1.5 select-none",
      disabled ? "opacity-50 grayscale cursor-not-allowed" : ""
    )}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] font-black uppercase italic tracking-[0.4em] text-zinc-500 opacity-40">
          {label}
        </span>
      </div>
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.05}
        style={{ x, backgroundColor: isComplete ? '#fff' : color, touchAction: 'none' }}
        onDragEnd={(_, info) => {
          if (disabled) return;
          if (info.offset.x > maxDrag * 0.75) {
            setIsComplete(true);
            onComplete();
            if (navigator.vibrate) navigator.vibrate([10, 20, 10]);
          } else {
            animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
          }
        }}
        className="absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_10px_30px_rgba(245,158,11,0.3)] touch-action-none"
      >
        <ArrowRight className="w-8 h-8 text-black" strokeWidth={3} />
      </motion.div>
      
      <motion.div 
        style={{ width: x, opacity: 0.1, backgroundColor: color }}
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
  const handleSOS = async () => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    
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
  };

  return (
    <button 
      onClick={handleSOS}
      className="p-4 bg-red-600/10 border-2 border-red-500/50 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition-all text-red-500 group relative overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    >
      <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
      <LifeBuoy className="w-6 h-6 animate-bounce relative z-10" />
      <span className="text-[10px] font-black uppercase tracking-widest relative z-10">One-Tap SOS</span>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-red-500/20 blur-xl rounded-full" />
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
  connectionCount 
}: { 
  profile: RiderProfile, 
  todayEarnings: number,
  totalDeliveries: number,
  history: DeliveryOrder[],
  onToggleOnline: () => void,
  setView: (view: AppView) => void,
  connectionCount: number
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
        <VoiceController 
          isListening={false} 
          onStart={() => setView('hub')} 
        />
      </div>

      {/* Power Toggle */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => {
            onToggleOnline();
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
          }}
          className={cn(
            "w-full min-h-[70px] px-5 py-4 rounded-2xl flex items-center justify-start gap-4 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-500/20",
            profile.is_online ? "bg-zinc-900 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]" : "bg-zinc-900/40 border border-zinc-800/40"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-zinc-800/50",
            profile.is_online ? "text-green-500 bg-green-500/5 ring-1 ring-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]" : "text-zinc-600"
          )}>
            <Power className={cn("w-5 h-5", profile.is_online && "animate-pulse")} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <div className="flex items-center gap-2">
              <span className={cn("text-[16px] font-sans font-black uppercase tracking-widest italic", profile.is_online ? "text-white" : "text-zinc-400")}>
                {profile.is_online ? 'You are Online' : 'You are Offline'}
              </span>
              {profile.is_online && (
                <div className="flex items-center gap-0.5">
                   <div className="w-1 h-3 bg-green-500/20 rounded-full" />
                   <div className="w-1 h-2 bg-green-500/40 rounded-full" />
                   <div className="w-1 h-4 bg-green-500/60 rounded-full animate-pulse" />
                   <div className="w-1 h-2.5 bg-green-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <span className={cn("text-[11px] font-sans mt-1 font-bold uppercase tracking-wider items-center flex gap-1.5", profile.is_online ? "text-green-500/70" : "text-zinc-600")}>
              {profile.is_online ? 'Looking for orders...' : 'Tap to go online'}
              {profile.verification_status === 'verified' && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
                  <span className="text-[7px] text-emerald-500">VERIFIED</span>
                </div>
              )}
            </span>
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
      <div className="space-y-6">
        <BentoCard className="bg-zinc-900/50 border-zinc-800/80 p-6" glow>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#f59e0b]/10 rounded-lg">
                <Zap className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f59e0b]">Sector Yield</span>
            </div>
            <span className={cn("text-[11px] font-black uppercase tracking-widest", rank.color)}>{rank.title} TIER</span>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Today Earnings</p>
              <p className="text-3xl font-headline font-black italic tracking-tighter text-white">R {Number(todayEarnings || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Drops Cleared</p>
              <p className="text-3xl font-headline font-black italic tracking-tighter text-white">{totalDeliveries}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-headline font-black italic text-white uppercase tracking-tighter leading-none">{profile.active_points}</span>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">EXP</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Next Tier: {rank.next.toLocaleString()} Pts</p>
            </div>
            <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5">
               <motion.div 
                 initial={{ width: 0 }} 
                 animate={{ width: `${Math.min(rank.progress, 100)}%` }} 
                 className="h-full bg-[#f59e0b] rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
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
  riderLng
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
  riderLng?: number
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNearbyMap, setShowNearbyMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortMethod, setSortMethod] = useState<'distance' | 'fee' | 'eta'>('distance');
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
          <div className="space-y-2">
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
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedOrders.map(order => (
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
                                {(() => {
                                  if (!riderLat || !riderLng || !order.shop_lat || !order.shop_lng) return `${Number(order.distance_km || 0).toFixed(1)} KM`;
                                  const R = 6371;
                                  const dLat = (order.shop_lat - riderLat) * Math.PI / 180;
                                  const dLon = (order.shop_lng - riderLng) * Math.PI / 180;
                                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(riderLat * Math.PI / 180) * Math.cos(order.shop_lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                  return `${(R * c).toFixed(1)} KM`;
                                })()}
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
          ))}
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
       <MapContainer 
        center={center} 
        zoom={16} 
        minZoom={14}
        maxBounds={[
          [-26.040, 28.160], // Southwest
          [-25.930, 28.260]  // Northeast
        ]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        className="brightness-[1.05] contrast-[0.95] saturate-[0.8]"
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
        <Marker 
          position={center} 
          icon={L.divIcon({
            html: `<div style="background-color: #f59e0b; padding: 4px; border-radius: 50%; border: 1px solid white;"></div>`,
            className: 'mini-pin',
            iconSize: [12, 12]
          })} 
        />
      </MapContainer>
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
        onUpdateStatus(currentOrder.id, 'delivered');
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

  const handleStartNav = (e: React.MouseEvent) => {
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

    const url = buildNavigationUrl(originLat, originLng, destLat, destLng, profile?.vehicle_type || 'car');
    
    // Open in new tab/native maps app
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <div className="h-screen flex flex-col pointer-events-none max-w-5xl mx-auto w-full relative">
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

      {/* Map Area placeholder (transparent) */}
      <div 
        onClick={() => {
          if (onScreenTap) onScreenTap();
        }}
        className="flex-1 relative overflow-hidden cursor-pointer group pointer-events-auto"
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
          <div className="flex flex-col items-center group cursor-pointer" onClick={handleStartNav}>
             <div className="w-12 h-12 rounded-full bg-[#4285F4] shadow-[0_0_15px_#4285F4]/50 flex items-center justify-center mb-1 hover:brightness-110 active:scale-95 transition-all">
                <Navigation className="w-5 h-5 text-white fill-white" />
             </div>
             <span className="text-[8px] font-black text-white/90 drop-shadow-md uppercase tracking-widest">START NAV</span>
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
              onComplete={() => onUpdateStatus(currentOrder.id, isPickedUp ? 'delivered' : 'picked_up')}
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
  const chartData = useMemo(() => {
    // Group history by day of week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const earningsByDay = new Array(7).fill(0);
    
    history.forEach(order => {
      const date = new Date(order.updated_at);
      const dayIndex = date.getDay();
      earningsByDay[dayIndex] += Number(order.delivery_fee || 0);
    });

    return days.map((name, i) => ({
      name,
      yield: earningsByDay[i] || (i * 10) // Smooth fallback for empty days in demo
    }));
  }, [history]);

  return (
    <div className="p-6 space-y-8 pb-32 max-w-5xl mx-auto w-full">
      <header className="pt-8 mb-4">
        <h2 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white mb-2">Activity</h2>
        <div className="flex items-center gap-3">
           <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] flex items-center gap-2 italic">
             Recent logs • Sector 7
           </p>
           <div className="p-1 bg-zinc-900 border border-zinc-800 rounded-md">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
           </div>
        </div>
      </header>

      <BentoCard className="h-72 border-zinc-800/40 bg-zinc-950/50 p-6" glow>
        <div className="flex items-center justify-between mb-6">
           <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Earnings last 7 days</span>
           <Activity className="w-4 h-4 text-[#f59e0b] opacity-50" />
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#444', fontSize: 10, fontWeight: 'bold' }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0D0D0D', border: '1px solid #333', borderRadius: '12px', fontSize: '10px' }}
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

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Order History</h3>
          <Search className="w-4 h-4 text-zinc-600" />
        </div>
        
        {history.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic text-sm">No orders found.</div>
        ) : (
          <div className="space-y-4">
            {history.map((item, i) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <BentoCard className="p-4 bg-zinc-900/10 border-zinc-800/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0 mr-4">
                      <div className="p-2 bg-zinc-800 rounded-lg shrink-0 mt-1">
                        <CheckCircle className="w-4 h-4 text-[#f59e0b]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black italic text-zinc-200 uppercase truncate w-full">{item.restaurant_name}</h4>
                        <p className="text-[9px] text-zinc-500 font-mono truncate w-full">{item.address}, {item.city}</p>
                        <HistoryMap order={item} />
                        {item.merchant_rating && (
                          <div className="mt-2 flex items-center gap-2">
                            <StarRating rating={item.merchant_rating} />
                            {item.merchant_feedback && <span className="text-[8px] text-zinc-400 font-bold italic truncate max-w-[150px]">"{item.merchant_feedback}"</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black italic text-[#f59e0b]">R{Number(item.delivery_fee || 0).toFixed(2)}</span>
                      <p className="text-[8px] text-zinc-600 font-mono">CODE-{item.id.slice(-4).toUpperCase()}</p>
                    </div>
                  </div>
                </BentoCard>
              </motion.div>
            ))}
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
          <div className="w-28 h-28 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center p-1.5 glow ring-4 ring-[#f59e0b]/5">
            {profile.photo_url ? (
              <img src={profile.photo_url} className="w-full h-full object-cover rounded-[2rem]" alt="Profile" />
            ) : (
              <div className="text-5xl font-headline font-black italic text-[#f59e0b]">{profile.name[0]}</div>
            )}
          </div>
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
                <Link2 className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">No active store connections</p>
                <p className="text-xs text-zinc-600 max-w-[200px] mx-auto leading-relaxed">
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
                    "w-full min-h-[60px] px-4 py-3 rounded-xl flex items-center justify-between transition-colors active:bg-zinc-800 hover:bg-zinc-800",
                    isExpired ? "bg-zinc-900/40 border border-red-900/30 grayscale" : "bg-zinc-900 border border-zinc-800"
                  )}
                >
                  <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center shadow-sm shrink-0">
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
      
      <section className="space-y-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Fleet Configuration</h3>
        <BentoCard className="bg-zinc-900 border-zinc-800 p-5">
           <div className="flex items-center justify-between mb-4">
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
        </BentoCard>
      </section>

      {/* Offline Roadmap Cache (New) */}
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
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-zinc-600 tracking-tighter">Availability</span>
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Mission-Ready</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-black uppercase text-zinc-600 tracking-tighter">Sync Priority</span>
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">High</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-8">
        <BentoCard className="p-2 border-zinc-800/30">
          <button className="w-full flex items-center justify-between p-3 text-zinc-300 hover:text-white transition-colors">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Device Sync</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [connections, setConnections] = useState<ShopConnection[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>(() => {
    return (localStorage.getItem('localeats_view') as AppView) || 'dash';
  });
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>(() => {
    const saved = localStorage.getItem('localeats_active_orders');
    return saved ? JSON.parse(saved) : [];
  });
  
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
        if (insertError) addBootLog('ERR: PROFILE_INIT_FAIL');
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
        addBootLog('ERR: FETCH_FAILED');
        setSyncError(error.message);
      }
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : 'Unknown error';
      if (errMessage.toLowerCase().includes('fetch') || errMessage.toLowerCase().includes('network') || errMessage.toLowerCase().includes('timeout')) {
        addBootLog(`WARN: NETWORK_FAILURE - ENGAGING SIMULATOR OVERRIDE`);
        setProfile({
          id: user.id,
          name: 'Override_Rider',
          full_name: 'Fallback Rider',
          phone: '(Offline Node)',
          is_online: true,
          status: 'online',
          vehicle_type: 'Road',
          verification_status: 'verified',
          rating: 5.0,
          total_earnings: 0,
          total_deliveries: 0,
          active_points: 0,
          updated_at: new Date().toISOString()
        } as unknown as RiderProfile);
        setSyncError(null);
      } else {
        addBootLog(`CRITICAL: SYNC_FAILURE (${errMessage})`);
        setSyncError(errMessage);
      }
    } finally {
      isFetchingProfileRef.current = false;
      setLoading(false);
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
          // We can't easily call internal functions from here if they aren't exposed, 
          // so we'll rely on the existing pulse listeners which will naturally resume, 
          // or we can trigger a state update to force re-evaluation.
          setNow(Date.now());
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const lastLocationUpdateRef = useRef<{lat: number, lng: number, time: number} | null>(null);
  const isMockedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!user || !profile?.is_online || activeOrders.length === 0) return;

    let watchId: number;

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
      }
    };

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateLocation(pos);
        },
        (err) => {
          // Fallback logic for GPS signal failure in high-density areas (Kopanong / Ivory Park Ext)
          if (err.code === 1) { // Permission Denied
             addBootLog('ERROR: GPS_PERM_DENIED');
             toast.error('GPS AUTH FAILURE. Switch to simulator mode.', { id: 'gps-error' });
          } else if (err.code === 2) { // Position Unavailable
             addBootLog('SIGNAL_LOST: HIGH_DENSITY_INTERFERENCE');
             toast.warning('SIGNAL INTERFERENCE: TRIANGULATING...', { id: 'gps-warning' });
          } else if (err.code === 3) { // Timeout
             addBootLog('GPS_TIMEOUT: RECALIBRATING...');
          }
          
          // Regional Fallback if NO initial position found (Kopanong Shopping Centre Centerpoint)
          if (!profile?.current_latitude) {
            const baseLat = -25.9964; 
            const baseLng = 28.2268;
            updateLocation({ coords: { latitude: baseLat, longitude: baseLng, accuracy: 50 }, timestamp: Date.now(), isFallback: true });
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
    };
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
        setProfile(payload.new as RiderProfile);
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
        // fetchData is also called by its own effect, but we trigger standard refresh here
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
  }, [user]);

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
    if (!user) return;

    const fetchData = async () => {
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
    };

    fetchData();
  }, [user]);

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
      const { error } = await getSupabase()
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) {
        toast.error('Update failed');
      } else {
        if (status === 'delivered') {
          const { error: rpcError } = await getSupabase().rpc('increment_rider_stats', {
            p_rider_id: profile.id,
            p_earnings: orderToUpdate.delivery_fee,
            p_points: 15
          });
          
          if (rpcError) {
             console.warn('RPC failed, falling back to direct update', rpcError);
             const profileUpdates = {
               total_earnings: profile.total_earnings + (orderToUpdate.delivery_fee || 0),
               total_deliveries: profile.total_deliveries + 1,
               active_points: profile.active_points + 15,
               updated_at: new Date().toISOString()
             };
             await getSupabase().from('rider_profiles').update(profileUpdates).eq('id', profile.id);
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
    try {
      if (isSupabaseMocked()) {
        const newStatus = !profile.is_online;
        setProfile({ 
          ...profile, 
          is_online: newStatus,
          last_online: newStatus ? new Date().toISOString() : profile.last_online,
          status: newStatus ? 'online' : 'offline'
        });
        if (newStatus) {
          toast.success('System Online! New missions from paired shops will appear here.', { duration: 4000 });
        } else {
          toast.info('System Standby. Taking a break.');
        }
        return;
      }

      const { error } = await getSupabase()
        .from('rider_profiles')
        .update({ 
          is_online: !profile.is_online, 
          last_online: !profile.is_online ? new Date().toISOString() : undefined,
          status: !profile.is_online ? 'online' : 'offline',
          updated_at: new Date().toISOString() 
        })
        .eq('id', profile.id);
      if (error) toast.error('Failed to sync system status');
      else {
        if (!profile.is_online) {
          toast.success('System Online! New missions from paired shops will appear here.', { duration: 4000 });
        } else {
          toast.success('System Standby. Taking a break.');
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sync failed';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot sync offline.');
      } else {
        toast.error(message);
      }
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
    try {
      const { error } = await getSupabase()
        .from('rider_profiles')
        .update({ vehicle_type: type, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (error) toast.error('Sync failed');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sync failed';
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        toast.error('Network Error: Cannot sync vehicle offline.');
      } else {
        toast.error(message);
      }
    }
  };

  const handleOnboardingComplete = async () => {
    if (!user) return;
    try {
      localStorage.setItem('localeats_onboarding_seen', 'true');
      if (!isSupabaseMocked()) {
        await getSupabase()
          .from('rider_profiles')
          .update({ onboarding_complete: true })
          .eq('id', user.id);
      }
      setProfile(prev => prev ? { ...prev, onboarding_complete: true } : null);
      setShowOnboarding(false);
      addBootLog('SYS_READY: OPERATOR_CERTIFIED');
    } catch {
      setShowOnboarding(false);
    }
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
      const { data, error } = await getSupabase()
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
    if (syncError && (syncError.toLowerCase().includes('fetch') || syncError.toLowerCase().includes('network') || syncError.toLowerCase().includes('timeout'))) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <WifiOff className="w-16 h-16 text-zinc-700 mb-6 animate-pulse" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Connection Error</h2>
          <p className="text-zinc-500 text-sm max-w-xs mb-8 uppercase font-bold tracking-wide">
            Failed to connect to the server. Please check your internet connection.
            <span className="block mt-2 text-red-500/80 text-[10px] break-all">{syncError}</span>
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => {
                setLoading(true);
                setSyncError(null);
                fetchProfile();
              }}
              className="w-full py-4 bg-[#f59e0b] text-black font-black uppercase italic tracking-widest rounded-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              Try Again
            </button>
            <button 
              onClick={() => {
                setSyncError(null);
                setProfile({
                  id: user.id,
                  name: 'Offline_Unit',
                  full_name: 'Fallback Simulator Rider',
                  phone: '(Offline Node)',
                  is_online: true,
                  status: 'online',
                  vehicle_type: 'Road',
                  verification_status: 'verified',
                  rating: 5.0,
                  total_earnings: 1250,
                  total_deliveries: 42,
                  active_points: 156,
                  updated_at: new Date().toISOString()
                } as unknown as RiderProfile);
                setLoading(false);
              }}
              className="w-full py-4 bg-zinc-900 border border-zinc-800 text-[#f59e0b] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all"
            >
              Engage Simulator Override
            </button>
            <button 
              onClick={() => getSupabase().auth.signOut()}
              className="w-full py-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest"
            >
              Logout
            </button>
          </div>
        </div>
      );
    }

    const setupSql = `
-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rider_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text,
  full_name text,
  phone text,
  is_online boolean DEFAULT false,
  vehicle_type text DEFAULT 'Road',
  verification_status text DEFAULT 'pending',
  rating numeric DEFAULT 5.0,
  current_latitude numeric,
  current_longitude numeric,
  total_earnings numeric DEFAULT 0,
  total_deliveries integer DEFAULT 0,
  active_points integer DEFAULT 0,
  last_online timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 1.1 Integrity Checks (Ensure columns exist for legacy tables)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rider_profiles' AND column_name='last_online') THEN
        ALTER TABLE public.rider_profiles ADD COLUMN last_online timestamp with time zone DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='lat') THEN
        ALTER TABLE public.orders ADD COLUMN lat numeric DEFAULT -25.9933;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='lng') THEN
        ALTER TABLE public.orders ADD COLUMN lng numeric DEFAULT 28.2125;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shop_lat') THEN
        ALTER TABLE public.orders ADD COLUMN shop_lat numeric DEFAULT -25.9922;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shop_lng') THEN
        ALTER TABLE public.orders ADD COLUMN shop_lng numeric DEFAULT 28.2045;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id),
  customer_name text,
  phone text,
  address text,
  city text,
  product_name text,
  items jsonb DEFAULT '[]'::jsonb,
  restaurant_name text,
  total_price numeric DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  delivery_status text DEFAULT 'none',
  status text DEFAULT 'pending',
  order_type text DEFAULT 'delivery',
  rider_id uuid REFERENCES public.rider_profiles(id),
  merchant_rating numeric,
  merchant_feedback text,
  lat numeric DEFAULT -25.9933,
  lng numeric DEFAULT 28.2125,
  shop_lat numeric DEFAULT -25.9922,
  shop_lng numeric DEFAULT 28.2045,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_delivery_status_check CHECK (delivery_status IN ('none', 'finding_rider', 'accepted', 'picked_up', 'delivered', 'cancelled', 'ready', 'pending', 'preparing', 'confirmed', 'completed', 'rider_assigned'))
);

CREATE TABLE IF NOT EXISTS public.rider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id),
  rider_id uuid REFERENCES public.rider_profiles(id),
  rider_name text,
  connection_code text NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid REFERENCES public.rider_profiles(id),
  order_id uuid REFERENCES public.orders(id),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS heading numeric;
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS speed numeric;
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS timestamp timestamp with time zone;
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS is_mocked boolean DEFAULT false;
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS suspicious boolean DEFAULT false;

-- 3. Policies
-- Shops
DO $$ BEGIN
    CREATE POLICY "Public shops are viewable by everyone" ON public.shops FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rider Locations
DO $$ BEGIN
    CREATE POLICY "Any authenticated user can view rider locations" ON public.rider_locations FOR SELECT USING (true);
    CREATE POLICY "Riders can insert their own locations" ON public.rider_locations FOR INSERT WITH CHECK (auth.uid() = rider_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
DO $$ BEGIN
    CREATE POLICY "Users can view own profile" ON public.rider_profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON public.rider_profiles FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON public.rider_profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Orders
DO $$ BEGIN
    CREATE POLICY "Users can view available orders" ON public.orders FOR SELECT USING (
      delivery_status = 'finding_rider' OR rider_id = auth.uid()
    );
    CREATE POLICY "Users can update assigned orders" ON public.orders FOR UPDATE USING (
      rider_id = auth.uid() OR (delivery_status = 'finding_rider' AND rider_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Connections
DO $$ BEGIN
    CREATE POLICY "Users can view own connections" ON public.rider_connections FOR SELECT USING (rider_id = auth.uid() OR rider_id IS NULL);
    CREATE POLICY "Users can update own connections" ON public.rider_connections FOR UPDATE USING (rider_id = auth.uid() OR rider_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Diagnostic Queries (Copy for SQL Editor)
-- USE THESE TO DEBUG YOUR ECOSYSTEM
-- YOUR RIDER ID: ${user?.id}

-- A. The "Ghost Mission" Tracker (Stale Status Detection)
SELECT id, restaurant_name, status, delivery_status, created_at 
FROM public.orders 
WHERE status IN ('pending', 'preparing') 
AND created_at < NOW() - INTERVAL '45 minutes'
ORDER BY created_at ASC;

-- B. Uplink Health Check (Session Expiry)
SELECT id, name, last_online 
FROM public.rider_profiles 
WHERE is_online = true 
AND last_online < NOW() - INTERVAL '24 hours';

-- C. Coordinates Integrity (Bridge Fix)
SELECT id, restaurant_name, lat, lng, shop_lat, shop_lng 
FROM public.orders 
WHERE (lat = lng) OR (lat = 0) OR (shop_lat = 0);

-- D. Earnings Audit (Fixed Fee R5)
SELECT 
    rider_id, 
    COUNT(*) as completed_count, 
    SUM(delivery_fee) as pending_payout
FROM public.orders 
WHERE delivery_status = 'delivered' 
AND rider_id = '${user?.id}'
GROUP BY rider_id;

-- 5. Reload Schema
NOTIFY pgrst, 'reload schema';
    `.trim();

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 pb-20">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-black uppercase text-white mb-2">Supabase Setup Required</h2>
        <p className="text-xs text-zinc-500 max-w-md text-center mb-6">
          Authenticated successfully, but failed to read or create your rider profile in Supabase. 
          You need to create the database tables.
        </p>
        
        <div className="w-full max-w-lg mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b]">SQL Setup Script</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(setupSql);
                  toast.success('SQL copied to clipboard');
                }}
                className="text-[10px] bg-zinc-800 text-white px-2 py-1 rounded"
              >
                Copy SQL
              </button>
            </div>
            <pre className="text-[9px] text-zinc-400 font-mono overflow-auto max-h-60 whitespace-pre">
              {setupSql}
            </pre>
          </div>
        </div>

        <div className="flex flex-col w-full max-w-xs gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-[#f59e0b] text-black font-black uppercase italic tracking-widest rounded-xl active:scale-95 transition-all"
          >
            I've run the SQL, Retry
          </button>
          <button 
            onClick={() => getSupabase().auth.signOut()}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-widest rounded-xl active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>
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
      {showOnboarding && <TacticalOnboarding onComplete={handleOnboardingComplete} />}
      
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
              <div 
                onClick={() => setView('hub')}
                className="p-1 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-[#f59e0b]/50 transition-colors"
              >
                <UserIcon className="w-6 h-6 text-zinc-400" />
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
                    .filter(o => o.updated_at.startsWith(new Date().toISOString().split('T')[0]))
                    .reduce((acc, curr) => acc + Number(curr.delivery_fee || 0), 0)}
                  totalDeliveries={profile.total_deliveries}
                  history={history}
                  onToggleOnline={toggleOnline} 
                  setView={setView}
                  connectionCount={connections.length}
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
                  onLogout={() => getSupabase().auth.signOut()} 
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
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => setView(item.view as AppView)}
                  className={cn(
                    "relative flex-1 flex flex-col items-center py-4 rounded-[2rem] transition-all duration-300", 
                    view === item.view ? "bg-[#f59e0b] text-zinc-950 shadow-xl shadow-[#f59e0b]/20" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {item.alert && <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]" />}
                  <item.icon size={18} className={cn(view === item.view && "fill-current animate-pulse")} />
                  <span className="text-[8px] font-black uppercase mt-1.5 tracking-tighter">{item.label}</span>
                  {view === item.view && <motion.div layoutId="nav-glow" className="absolute -inset-1 bg-[#f59e0b]/20 blur-xl -z-10 rounded-full" />}
                </button>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
