import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Gift,
  Radar,
  WifiOff,
  Activity,
  Plus,
  Rocket,
  Minimize2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Toaster, toast } from 'sonner';
import { getSupabase, isSupabaseMocked } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { RiderProfile, DeliveryOrder, UserVehicle, DeliveryStatus, ShopConnection } from './types';
import { cn, getEstimatedMinutes } from './lib/utils';
import { QRScanner } from './components/QRScanner';
import { AppMapBackground } from './components/AppMapBackground';
import { TacticalOnboarding } from './components/TacticalOnboarding';

import { QRCodeSVG } from 'qrcode.react';

// --- Components ---


// --- Utilities ---

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) *
            Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000, timeoutMs = 8000): Promise<T> => {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
  } catch (error) {
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && (error.message === 'timeout' || error.message.includes('fetch'))))) {
      const nextDelay = delay * 2; // Exponential backoff
      console.warn(`Fetch failure, retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, nextDelay, timeoutMs);
    }
    throw error;
  }
};

const StatusBadge = ({ status }: { status: DeliveryStatus }) => {
  const styles: Record<DeliveryStatus, string> = {
    finding_rider: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    accepted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    picked_up: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    delivered: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border italic", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
};

const TelemetryData = ({ label, value, unit }: { label: string, value: string | number, unit?: string }) => (
  <div className="flex flex-col">
    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-4xl md:text-5xl font-mono font-bold text-[#F0F0F0] tabular-nums tracking-tighter">{value}</span>
      {unit && <span className="text-xs text-zinc-400 font-bold uppercase">{unit}</span>}
    </div>
  </div>
);

const BentoCard = ({ children, className, glow = false, ...props }: { children: React.ReactNode, className?: string, glow?: boolean } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={cn(
    "bg-[#0D0D0D] border border-zinc-800 rounded-3xl p-6 relative overflow-hidden group transition-all",
    glow && "shadow-[0_0_40px_rgba(57,255,20,0.1)] border-[#f59e0b]/20",
    className
  )}>
    {glow && <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f59e0b]/5 rounded-full blur-3xl" />}
    <div className="relative z-10">{children}</div>
  </div>
);

const SwipeButton = ({ label, onComplete, color = "#f59e0b", resetToken }: { label: string, onComplete: () => void, color?: string, resetToken?: string | number }) => {
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
    <div ref={containerRef} className="relative h-20 bg-zinc-900/50 border-2 border-zinc-800 rounded-2xl overflow-hidden p-1.5 select-none">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-black uppercase italic tracking-[0.3em] text-zinc-600">
          {label}
        </span>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.1}
        style={{ x, backgroundColor: isComplete ? '#fff' : color, touchAction: 'none' }}
        onDragEnd={(_, info) => {
          if (info.offset.x > maxDrag * 0.75) {
            setIsComplete(true);
            onComplete();
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
          } else {
            // Spring back if not complete
            animate(x, 0, { type: "spring", stiffness: 400, damping: 25 });
          }
        }}
        animate={!isComplete ? {
          scale: [1, 1.05, 1],
          transition: { repeat: Infinity, duration: 2, ease: "easeInOut", repeatDelay: 3 }
        } : {}}
        className="absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_0_20px_rgba(57,255,20,0.4)] touch-action-none"
      >
        <ArrowRight className="w-8 h-8 text-black" />
      </motion.div>
    </div>
  );
};

// --- Auth Views ---

const AuthView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<UserVehicle>('Road');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error: authError } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (authError) throw authError;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Auth Failed';
      toast.error(message);
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
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
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

const Dashboard = ({ profile, todayEarnings, totalDeliveries, history, onToggleOnline, setView, connectionCount }: { 
  profile: RiderProfile, 
  todayEarnings: number,
  totalDeliveries: number,
  history: DeliveryOrder[],
  onToggleOnline: () => void,
  setView: (view: AppView) => void,
  connectionCount: number
}) => {
  const [shiftCount, setShiftCount] = useState(() => {
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
    <div className="p-6 space-y-8 pb-32 max-w-lg mx-auto">
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
               <h4 className="text-[11px] font-black uppercase tracking-[0.1em] mb-1">Grid Restricted</h4>
               <p className="text-sm font-bold text-white/70 italic leading-tight">No merchant tether detected. Link in Hub to scan sector.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-red-500 transition-colors" />
         </motion.div>
      )}

      {profile.verification_status !== 'verified' && connectionCount > 0 && (
        <BentoCard className="bg-orange-500/10 border-orange-500/20 text-orange-500 py-5">
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Status: Verification Pending</span>
              <span className="text-sm font-bold leading-tight text-white/80 italic">Fleet HQ is reviewing your registry uplink. Access restricted.</span>
            </div>
          </div>
        </BentoCard>
      )}

      {/* Power Toggle */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => {
            onToggleOnline();
            if (navigator.vibrate) navigator.vibrate(50);
          }}
          className={cn(
            "w-full min-h-[60px] px-4 py-3 rounded-xl flex items-center justify-start gap-3 transition-colors active:bg-zinc-800 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-green-500/20",
            profile.is_online ? "bg-zinc-900 border border-zinc-900/50" : "bg-zinc-900/40 border border-zinc-800/40"
          )}
        >
          <div className={cn(
            "flex items-center justify-center transition-colors shadow-sm",
            profile.is_online ? "text-green-500" : "text-zinc-600"
          )}>
            <Power className="w-6 h-6" />
          </div>
          <div className="flex flex-col items-start leading-[1.2]">
            <span className={cn("text-[16px] font-sans font-medium tracking-normal", profile.is_online ? "text-white" : "text-zinc-400")}>
              {profile.is_online ? 'System Online' : 'System Standby'}
            </span>
            <span className={cn("text-[13px] font-sans mt-0.5 tracking-normal", profile.is_online ? "text-zinc-400" : "text-zinc-500")}>
              {profile.is_online ? 'Syncing local missions' : 'Ready for activation'}
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
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 italic">Neural Calibration</span>
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
                <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest italic">Sector activity log empty.</p>
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
};

const OrdersFeed = ({ 
  orders, 
  onAccept, 
  isOnline, 
  surgeMultiplier, 
  connectionCount,
  onRefresh
}: { 
  orders: DeliveryOrder[], 
  onAccept: (id: string) => void, 
  isOnline: boolean, 
  surgeMultiplier: number, 
  connectionCount: number,
  onRefresh: () => void
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="p-6 space-y-8 pb-32 max-w-lg mx-auto">
      <header className="flex flex-col gap-2 pt-6">
        <div className="flex items-center justify-between">
           <h2 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white">Live Missions</h2>
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
        <div className="flex items-center gap-3">
           <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] flex items-center gap-2 italic">
             Sector Alpha-12 Scan
           </p>
           {surgeMultiplier > 1 && (
             <div className="bg-orange-600 text-white px-3 py-1 rounded-xl shadow-lg border border-orange-500 animate-pulse">
                <span className="text-[10px] font-black uppercase">ROI x{surgeMultiplier.toFixed(1)}</span>
             </div>
           )}
        </div>
      </header>

      {confirmId && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <BentoCard className="w-full max-w-sm border-[#f59e0b]/30">
            <ShieldAlert className="w-12 h-12 text-[#f59e0b] mb-4 mx-auto" />
            <h3 className="text-xl font-black italic uppercase text-center text-white mb-2">Confirm Mission</h3>
            <p className="text-xs text-zinc-500 text-center mb-6 leading-relaxed">
              Accepting this mission indicates you are ready to initiate the delivery vector. 
              Unauthorized aborts may impact your reliability rating.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  onAccept(confirmId);
                  setConfirmId(null);
                }}
                className="w-full py-4 bg-[#f59e0b] text-black font-black uppercase italic tracking-widest rounded-xl active:scale-95 transition-all"
              >
                Accept Mission
              </button>
              <button 
                onClick={() => setConfirmId(null)}
                className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase tracking-widest rounded-xl active:scale-95 transition-all"
              >
                Abort Connection
              </button>
            </div>
          </BentoCard>
        </motion.div>
      )}

      {orders.length === 0 ? (
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
              {!isOnline ? "Network Offline" : connectionCount === 0 ? "No Tether" : "Scanning Sector [Alpha]"}
            </h3>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500 max-w-[280px] leading-relaxed italic">
              {!isOnline 
                ? "SIGNAL LOST - GO ONLINE TO SCAN FOR MISSIONS." 
                : connectionCount === 0 
                ? "UNLINKED TERRITORY - SYNC WITH A MERCHANT TO RECEIVE MISSIONS." 
                : "SCANNING SECTOR [ALPHA]... NO UNASSIGNED SIGNALS DETECTED."}
            </p>
            {isOnline && connectionCount > 0 && (
              <div className="flex gap-1 justify-center mt-4">
                {[...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
                    className="w-1 h-4 bg-zinc-800" 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <BentoCard className="border-l-4 border-l-[#f59e0b] shadow-2xl overflow-hidden group" glow={order.delivery_fee > 50}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                       <StatusBadge status={order.delivery_status} />
                       {order.match_score && (
                         <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-3 py-1 rounded-full">
                           <span className="text-[10px] font-black text-[#f59e0b] uppercase tracking-widest italic">
                             {Math.min(100, Math.round(order.match_score * 2.5))}% Match
                           </span>
                         </div>
                       )}
                    </div>
                    <h3 className="text-2xl font-headline font-black italic text-white uppercase tracking-tight leading-none mb-2">
                      {order.restaurant_name || 'Merchant-X'}
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <MapPin className="w-4 h-4 text-[#f59e0b] shrink-0" />
                        <span className="text-xs font-bold truncate max-w-[200px]">{order.address}, {order.city}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Navigation className="w-3.5 h-3.5 text-orange-600" />
                        <span className="text-[11px] font-black italic text-orange-600 uppercase tracking-widest">{Number(order.distance_km || 0).toFixed(1)} KM VECTOR</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-headline font-black italic text-[#f59e0b] tracking-tighter">R{Number(order.delivery_fee || 0).toFixed(2)}</div>
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Payload Reward</span>
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

                <SwipeButton 
                  label="SLIDE TO ACCEPT" 
                  onComplete={() => setConfirmId(order.id)} 
                  resetToken={confirmId || 'reset'}
                />
              </BentoCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActiveMissionView = ({ orders, onUpdateStatus }: { 
  orders: DeliveryOrder[], 
  onUpdateStatus: (id: string, status: DeliveryStatus) => void 
}) => {
  const [sortMethod, setSortMethod] = useState<'default' | 'optimized'>('default');
  const [activeIndex, setActiveIndex] = useState(0);

  const displayOrders = useMemo(() => {
    if (sortMethod === 'optimized') {
      return [...orders].sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    }
    return orders;
  }, [orders, sortMethod]);

  const currentOrder = useMemo(() => {
    const targetIdx = activeIndex >= displayOrders.length ? 0 : activeIndex;
    return displayOrders[targetIdx] || displayOrders[0];
  }, [displayOrders, activeIndex]);

  if (!currentOrder) return null;

  const isPickedUp = currentOrder.delivery_status === 'picked_up';
  const targetAddress = `${currentOrder.address}, ${currentOrder.city}`;

  const optimizeRoute = () => {
    setSortMethod('optimized');
    setActiveIndex(0);
    toast.success('Vector sequence optimized for range efficiency.');
  };

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col pt-24 pointer-events-none max-w-lg mx-auto">
      {/* Multi-Order Selector */}
      {displayOrders.length > 1 && (
        <div className="bg-black/60 backdrop-blur-3xl border-b border-white/5 p-4 pointer-events-auto shadow-2xl">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Auto-Routed Sequence
            </span>
            <button 
              onClick={optimizeRoute}
              className="text-[10px] uppercase font-bold text-zinc-500 hover:text-white transition-colors"
            >
              Re-optimize
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar relative w-full items-center">
            {/* Connecting line behind buttons */}
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-zinc-800 -z-10 -translate-y-1/2" />
            
            {displayOrders.map((o, idx) => (
              <button
                key={o.id}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 shrink-0 flex items-center gap-2",
                  activeIndex === idx 
                    ? "bg-[#f59e0b] text-black border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.4)]" 
                    : "bg-zinc-900/90 text-zinc-400 border-zinc-800"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", activeIndex === idx ? "bg-black" : (o.delivery_status === 'picked_up' ? "bg-red-500" : "bg-green-500"))} />
                {activeIndex === idx && "CURRENT • "}
                {o.delivery_status === 'picked_up' ? 'DROP' : 'PICK'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map Area placeholder (transparent) */}
      <div className="flex-1 relative overflow-hidden">
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
      </div>

      <div className="bg-black/60 backdrop-blur-md p-4 pb-8 pointer-events-auto shadow-2xl rounded-t-[2rem] mt-auto border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
            <div className="flex items-center justify-center w-10 h-10 bg-[#f59e0b] rounded-[10px] shrink-0 shadow-sm">
              <MapPin className="w-5 h-5 text-black" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-sans text-zinc-400 tracking-normal mb-0.5">Mission Objective</span>
              <span className="text-[16px] font-sans font-medium text-white truncate w-full leading-snug">
                {isPickedUp ? 'Drop-Off' : 'Pick-Up'} • {targetAddress}
              </span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end shrink-0 pl-3">
            <span className="text-[13px] font-sans text-zinc-400 tracking-normal mb-0.5">ETA</span>
            <span className="text-[16px] font-sans font-medium text-white tracking-tight">
              {String(Math.max(0, Math.floor((Number(currentOrder?.distance_km) || 0) * 2))).padStart(2, '0')}:15
            </span>
          </div>
        </div>

        <SwipeButton 
          label={isPickedUp ? "SLIDE TO COMPLETE" : "SLIDE TO PICK UP"}
          onComplete={() => onUpdateStatus(currentOrder.id, isPickedUp ? 'delivered' : 'picked_up')}
          color={isPickedUp ? "#f59e0b" : "#f58220"}
          resetToken={currentOrder.delivery_status}
        />
      </div>
    </div>
  );
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Zap key={i} className={cn("w-2 h-2", i < rating ? "text-[#f59e0b] fill-[#f59e0b]" : "text-zinc-800")} />
    ))}
  </div>
);

const HistoryView = ({ history }: { history: DeliveryOrder[] }) => {
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
    <div className="p-6 space-y-8 pb-32 max-w-lg mx-auto">
      <header className="pt-8 mb-4">
        <h2 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white mb-2">Telemetry</h2>
        <div className="flex items-center gap-3">
           <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.3em] flex items-center gap-2 italic">
             Operational Logs • Sector 7
           </p>
           <div className="p-1 bg-zinc-900 border border-zinc-800 rounded-md">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
           </div>
        </div>
      </header>

      <BentoCard className="h-72 border-zinc-800/40 bg-zinc-950/50 p-6" glow>
        <div className="flex items-center justify-between mb-6">
           <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Yield Variance Pulse</span>
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
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Mission Archive</h3>
          <Search className="w-4 h-4 text-zinc-600" />
        </div>
        
        {history.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic text-sm">No archive data synced.</div>
        ) : (
          history.map(item => (
            <BentoCard key={item.id} className="p-4 bg-zinc-900/10 border-zinc-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0 mr-4">
                  <div className="p-2 bg-zinc-800 rounded-lg shrink-0">
                    <CheckCircle className="w-4 h-4 text-[#f59e0b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black italic text-zinc-200 uppercase truncate w-full">{item.restaurant_name}</h4>
                    <p className="text-[9px] text-zinc-500 font-mono truncate w-full">{item.address}, {item.city}</p>
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
          ))
        )}
      </div>
    </div>
  );
};

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

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  const prevCoords = useRef<[number, number]>(coords);
  
  useEffect(() => {
    if (prevCoords.current[0] !== coords[0] || prevCoords.current[1] !== coords[1]) {
      map.setView(coords, 15);
      prevCoords.current = coords;
    }
  }, [coords, map]);
  
  return null;
};

const RiderTrackingMap = ({ 
  riderCoords
}: { 
  riderCoords: [number, number]
}) => {
  const customIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <div className="w-full h-56 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200/10 relative group mb-6 shadow-2xl z-0">
      <MapContainer 
        center={riderCoords} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={riderCoords} icon={customIcon} />
        <RecenterMap coords={riderCoords} />
      </MapContainer>
      <div className="absolute top-4 left-4 flex gap-2 pointer-events-none z-10">
        <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-[#f59e0b] border border-[#f59e0b]/20 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full animate-pulse" />
          Live Vector
        </div>
      </div>
    </div>
  );
};

const MerchantDashboard = ({ onSwitchRole }: { onSwitchRole: () => void }) => {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [activeRiders, setActiveRiders] = useState<RiderProfile[]>([]);
  const [ratingOrder, setRatingOrder] = useState<DeliveryOrder | null>(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'orders' | 'marketing' | 'coupons' | 'payments' | 'insights' | 'riders' | 'settings'>('orders');
  const [pairingCode, setPairingCode] = useState(isSupabaseMocked() ? 'LX-882' : '772901');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [riderSimCoords, setRiderSimCoords] = useState<[number, number]>([-33.922861, 18.421300]);

  // Simulation effect for mock mode
  useEffect(() => {
    if (!isSupabaseMocked()) return;
    const interval = setInterval(() => {
      setRiderSimCoords(prev => [
        prev[0] + (Math.random() - 0.5) * 0.001,
        prev[1] + (Math.random() - 0.5) * 0.001
      ]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isSupabaseMocked()) {
          // Generate mock data for preview
          setOrders([
            {
              id: 'mock-1',
              customer_name: 'Sarah Jenkins',
              address: '42 Greenway Blvd, Sandton',
              status: 'preparing',
              delivery_status: 'finding_rider',
              product_name: 'Big Double Burger Meal',
              total_price: 125,
              created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
              phone: '082 555 0123'
            },
            {
              id: 'mock-2',
              customer_name: 'Marcus Thabo',
              address: 'Unit 12, Skyview Apts',
              status: 'pending',
              delivery_status: 'finding_rider',
              product_name: 'Chicken Wings (12pc)',
              total_price: 89,
              created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
              phone: '071 222 9988'
            },
            {
              id: 'mock-3',
              customer_name: 'Aisha Kahn',
              address: '15 Rose Street, Cape Town',
              status: 'ready',
              delivery_status: 'accepted',
              product_name: 'Vegetarian Platter',
              total_price: 145,
              created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
              phone: '066 333 4455',
              rider: { name: 'Dumisani', current_latitude: -33.9, current_longitude: 18.4 } as unknown as RiderProfile,
              rider_dist_to_shop: 2.1
            }
          ] as unknown as DeliveryOrder[]);

          setActiveRiders([
            { id: 'r1', name: 'Rider Thabo', is_online: true },
            { id: 'r2', name: 'Rider Sipho', is_online: true },
            { id: 'r3', name: 'Rider Lerato', is_online: true }
          ] as RiderProfile[]);
          return;
        }

        const { data: ordersData, error: ordersError } = await getSupabase()
          .from('orders')
          .select('*, rider:rider_profiles(name, current_latitude, current_longitude)')
          .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        if (ordersData) {
          const fetchedOrders = ordersData as unknown as DeliveryOrder[];
          
          // Backwards-Compatible Cleanup: wipe finding_rider from completed orders
          const stuckIds = fetchedOrders
            .filter(o => o.status === 'completed' && o.delivery_status === 'finding_rider')
            .map(o => o.id);
            
          if (stuckIds.length > 0) {
            getSupabase().from('orders').update({ delivery_status: null }).in('id', stuckIds).then(() => {
              console.log('Cleaned up stuck orders:', stuckIds.length);
            });
            // Immediately clean locally to reflect
            fetchedOrders.forEach(o => {
              if (stuckIds.includes(o.id)) o.delivery_status = null as unknown as DeliveryStatus;
            });
          }
          
          setOrders(fetchedOrders);
        }

        const { data: ridersData, error: ridersError } = await getSupabase()
          .from('rider_profiles')
          .select('*')
          .eq('is_online', true);
        
        if (ridersError) throw ridersError;
        if (ridersData) setActiveRiders(ridersData as RiderProfile[]);
      } catch (_e) {
        console.error('Fetch error:', _e);
        toast.error('Local Grid sync failed. Using offline cache.');
        // Fallback to minimal mock if real fetch fails
        setOrders(prev => {
           if (prev.length === 0) {
              return [{ id: 'err-1', customer_name: 'Network Fallback', address: 'Mode: Offline', status: 'pending', product_name: 'Retry connection...', created_at: new Date().toISOString() }] as unknown as DeliveryOrder[];
           }
           return prev;
        });
      }
    };

    fetchData();
    if (isSupabaseMocked()) return;
    
    const channel = getSupabase()
      .channel(`merchant_updates_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_profiles' }, () => {
        fetchData();
      })
      .subscribe();
    
    return () => { 
      getSupabase().removeChannel(channel); 
    };
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      if (isSupabaseMocked()) {
        setOrders(prev => prev.map(o => {
          if (o.id === id) {
            return {
              ...o, 
              status: status as DeliveryStatus, 
              ...(status === 'completed' ? { delivery_status: null as unknown as DeliveryStatus } : {})
            };
          }
          return o;
        }));
        toast.success(`Order protocol updated: ${status.toUpperCase()}`);
        return;
      }
      
      const payload: Record<string, unknown> = { status };
      if (status === 'completed') {
        payload.delivery_status = null;
      }
      
      await getSupabase().from('orders').update(payload).eq('id', id);
      toast.success(`Order protocol updated: ${status.toUpperCase()}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Keep these for future feature expansion or internal use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRequestRider = async (id: string) => {
    try {
      await getSupabase().from('orders').update({ delivery_status: 'finding_rider' }).eq('id', id);
      toast.success('Rider request broadcasted to Sector Alpha.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingOrder) return;
    setLoading(true);
    try {
      await getSupabase()
        .from('orders')
        .update({ 
          merchant_rating: rating, 
          merchant_feedback: feedback 
        })
        .eq('id', ratingOrder.id);
      
      toast.success('Mission feedback synced with Fleet Headquarters.');
      setRatingOrder(null);
      setRating(5);
      setFeedback('');
    } catch {
      toast.error('Feedback upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  const newCount = orders.filter(o => o.status === 'pending').length;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#F8F9FA] min-h-screen text-zinc-900 font-sans pb-32">
       {/* Top Navigation Bar */}
      <header className="bg-white border-b border-zinc-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#f58220] rounded-xl flex items-center justify-center">
                 <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-headline font-black italic uppercase tracking-tighter">
                Local<span className="text-[#f58220]">Eats</span>
              </h1>
           </div>
           
           <nav className="hidden lg:flex items-center gap-6">
              {['Dashboard', 'Menu', 'Orders', 'Marketing', 'Coupons', 'Payments', 'Insights', 'Riders', 'Settings'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase() as typeof activeTab)}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest transition-colors",
                    activeTab === tab.toLowerCase() ? "text-[#f58220]" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  {tab}
                </button>
              ))}
           </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase text-green-700">Accepting Orders</span>
           </div>
           <button onClick={onSwitchRole} className="p-2 text-zinc-400 hover:text-zinc-600 bg-zinc-50 rounded-xl">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* IMPROVEMENT #8 — Merchant Secondary Mobile Navigation */}
      <div className="lg:hidden bg-white border-b border-zinc-100 sticky top-16 z-40 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 px-4 py-3 min-w-max">
          {['Dashboard', 'Menu', 'Orders', 'Marketing', 'Coupons', 'Riders', 'Insights', 'Settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase() as typeof activeTab)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.toLowerCase() 
                  ? "bg-[#f58220] text-white shadow-lg shadow-[#f58220]/20" 
                  : "bg-zinc-50 text-zinc-500 border border-zinc-100"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {activeTab === 'marketing' ? (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Marketing <span className="text-[#f58220]">Vector</span></h2>
                <p className="text-zinc-500 text-sm">Boost your visibility and customer loyalty across the LocalEats grid.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm col-span-2">
                   <div className="flex justify-between items-start mb-8">
                      <div>
                         <h3 className="text-lg font-bold">Grid Boost Campaigns</h3>
                         <p className="text-xs text-zinc-400">Target specific clusters to increase order volume.</p>
                      </div>
                      <button className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">New Campaign</button>
                   </div>

                   <div className="space-y-4">
                      {[
                        { title: 'Lunch Rush Blitz', status: 'Active', reach: '2,450 users', conversion: '12.4%', spend: 'R450.00' },
                        { title: 'Dinner Wave Pro', status: 'Scheduled', reach: '--', conversion: '--', spend: 'R800.00' }
                      ].map(campaign => (
                         <div key={campaign.title} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                  <Zap className="w-5 h-5 text-orange-500" />
                               </div>
                               <div>
                                  <p className="text-sm font-bold text-zinc-800">{campaign.title}</p>
                                  <div className="flex gap-3 mt-0.5">
                                     <span className="text-[8px] font-black uppercase text-green-600">{campaign.status}</span>
                                     <span className="text-[8px] font-mono text-zinc-400">Reach: {campaign.reach}</span>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-black text-zinc-900">{campaign.spend}</p>
                               <p className="text-[8px] font-mono text-zinc-400">Conv: {campaign.conversion}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </BentoCard>

                <div className="space-y-6">
                   <BentoCard className="bg-[#f58220] p-6 text-white text-center">
                      <Gift className="w-10 h-10 mx-auto mb-4" />
                      <h3 className="text-lg font-black uppercase italic leading-none mb-2">Loyalty Multiplier</h3>
                      <p className="text-[10px] opacity-80 font-medium mb-6">Users earn 2x tokens when ordering from your shop this weekend.</p>
                      <button className="w-full bg-white text-[#f58220] py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">Extend Period</button>
                   </BentoCard>

                   <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-4">Top Customers</h4>
                      <div className="space-y-4">
                         {['Sarah J.', 'Marcus T.', 'Aisha K.'].map((name, i) => (
                            <div key={name} className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold">{i+1}</div>
                                  <span className="text-xs font-medium">{name}</span>
                               </div>
                               <span className="text-[10px] font-mono text-[#f58220]">{12 - i} Orders</span>
                            </div>
                         ))}
                      </div>
                   </BentoCard>
                </div>
             </div>
           </div>
        ) : activeTab === 'coupons' ? (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Coupon <span className="text-[#f58220]">Forge</span></h2>
                <p className="text-zinc-500 text-sm">Issue high-impact discount codes to drive customer retention.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BentoCard className="bg-white border-zinc-200 p-8 shadow-sm">
                   <h3 className="text-lg font-bold mb-6">Create New Voucher</h3>
                   <div className="space-y-4">
                      <div>
                         <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Voucher Code</label>
                         <input type="text" placeholder="e.g. GRID20" className="w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl font-mono text-sm focus:ring-2 focus:ring-[#f58220] outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Discount Type</label>
                            <select className="w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl text-sm outline-none">
                               <option>Percentage (%)</option>
                               <option>Fixed Amount (R)</option>
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-zinc-400 mb-1 block">Value</label>
                            <input type="number" placeholder="20" className="w-full bg-zinc-50 border border-zinc-100 p-3 rounded-xl text-sm outline-none" />
                         </div>
                      </div>
                      <button className="w-full bg-zinc-900 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest mt-4">Forge Coupon</button>
                   </div>
                </BentoCard>

                <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                   <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-6">Active Vouchers</h3>
                   <div className="space-y-3">
                      {[
                        { code: 'FIRSTORDER', type: '30%', used: 142, limit: 500 },
                        { code: 'WEEKENDBLAST', type: 'R50', used: 89, limit: 100 },
                        { code: 'LUNCH10', type: '10%', used: 450, limit: '∞' }
                      ].map(coupon => (
                         <div key={coupon.code} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                            <div>
                               <p className="text-sm font-black font-mono text-zinc-800">{coupon.code}</p>
                               <p className="text-[8px] font-bold text-[#f58220] uppercase">{coupon.type} OFF</p>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-black text-zinc-900">{coupon.used} / {coupon.limit} uses</p>
                               <div className="w-24 h-1.5 bg-zinc-200 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-[#f58220]" style={{ width: typeof coupon.limit === 'number' ? `${(coupon.used / coupon.limit) * 100}%` : '40%' }} />
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </BentoCard>
             </div>
           </div>
        ) : activeTab === 'riders' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Fleet <span className="text-[#f58220]">Management</span></h2>
                <p className="text-zinc-500 text-sm">Monitor active couriers and authorize new neural uplinks.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                   <BentoCard className="bg-zinc-900 border-zinc-800 p-8 text-white relative overflow-hidden">
                      {/* FEATURE #1 — QR Code for pairing */}
                      <div className="absolute -right-12 -bottom-12 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                         <QRCodeSVG 
                           value={pairingCode} 
                           size={200} 
                           bgColor="#000000" 
                           fgColor="#f59e0b" 
                         />
                      </div>

                      <div className="flex items-center gap-3 mb-6">
                         <div className="p-2 bg-[#f58220]/20 rounded-lg">
                            <Zap className="w-5 h-5 text-[#f58220]" />
                         </div>
                         <h3 className="text-sm font-black uppercase tracking-widest">Active Tether</h3>
                      </div>

                      <div className="flex flex-col items-center justify-center py-6 gap-6">
                         <div className="bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(245,130,32,0.3)]">
                            <QRCodeSVG 
                              value={pairingCode} 
                              size={160} 
                              bgColor="#FFFFFF" 
                              fgColor="#000000" 
                              level="H"
                            />
                         </div>
                         
                         <div className="text-center">
                            <div className="text-4xl font-headline font-black italic tracking-widest text-[#f59e0b] mb-2 uppercase">
                               {pairingCode}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Current Pairing Cipher</p>
                         </div>
                      </div>

                      <button 
                        onClick={() => {
                          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                          setPairingCode(newCode);
                          toast.success('Neural sequence rotated.', {
                            description: `Cipher ${newCode} active for 24h`
                          });
                        }}
                        className="w-full bg-[#f58220] text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all mt-4"
                      >
                        Rotate Cipher
                      </button>

                      <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                         <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                            <span className="text-zinc-500">Protocol</span>
                            <span className="text-zinc-300">Handshake-V2</span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                            <span className="text-zinc-500">TTL</span>
                            <span className="text-zinc-300">24 Hours</span>
                         </div>
                      </div>
                   </BentoCard>

                   <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] mb-4">Neural Scan</h4>
                      <p className="text-xs text-zinc-500 font-bold leading-relaxed">
                         Authorizing a rider allows them to receive mission signals from this merchant node for 24 hours.
                      </p>
                   </BentoCard>
                </div>

                <div className="md:col-span-2 space-y-6">
                   <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-black italic uppercase tracking-tight">Active Couriers</h3>
                      <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-1 rounded-full font-black uppercase">{activeRiders.length} Online</span>
                   </div>

                   <div className="space-y-4">
                      {activeRiders.length > 0 ? activeRiders.map(rider => (
                         <BentoCard key={rider.id} className="bg-white border-zinc-200 p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center relative">
                                  <Bike className="w-6 h-6 text-zinc-400" />
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                               </div>
                               <div>
                                  <h4 className="text-sm font-black text-zinc-800 uppercase tracking-tight">{rider.name}</h4>
                                  <p className="text-[10px] text-zinc-400 font-bold uppercase">{rider.vehicle_type || 'Road Vector'} • {rider.rating || 5.0}★</p>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                                  <Smartphone className="w-4 h-4" />
                               </button>
                               <button className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                                  <ShieldAlert className="w-4 h-4" />
                               </button>
                            </div>
                         </BentoCard>
                      )) : (
                        <div className="py-12 text-center bg-zinc-50 rounded-[2rem] border-2 border-dashed border-zinc-200">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No riders currently tethered in this sector.</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
         ) : activeTab === 'insights' ? (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Sector <span className="text-[#f58220]">Analytics</span></h2>
                <p className="text-zinc-500 text-sm">Review operational telemetry and merchant node ROI performance.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm min-h-[400px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-8">Order Volume (24H Pulse)</h3>
                   <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={[
                         { time: '08:00', orders: 12 },
                         { time: '10:00', orders: 18 },
                         { time: '12:00', orders: 42 },
                         { time: '14:00', orders: 25 },
                         { time: '16:00', orders: 31 },
                         { time: '18:00', orders: 58 },
                         { time: '20:00', orders: 45 },
                         { time: '22:00', orders: 15 },
                       ]}>
                         <defs>
                           <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#f58220" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#f58220" stopOpacity={0}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                         <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                         <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: '#000', color: '#fff' }} />
                         <Area type="monotone" dataKey="orders" stroke="#f58220" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>
                </BentoCard>

                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                         <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Avg Prep Time</p>
                         <p className="text-3xl font-headline font-black italic">14.8 <span className="text-[10px] uppercase font-bold text-zinc-500">Mins</span></p>
                      </BentoCard>
                      <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                         <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Completion Rate</p>
                         <p className="text-3xl font-headline font-black italic">98.4<span className="text-[10px] uppercase font-bold text-zinc-500">%</span></p>
                      </BentoCard>
                   </div>
                   
                   <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-6">Heatmap: Order Clusters</h4>
                      <div className="space-y-4">
                         {[
                           { area: 'Sector Alpha (Downtown)', freq: 45, trend: '+12%' },
                           { area: 'Sector Beta (Residential)', freq: 32, trend: '-5%' },
                           { area: 'Sector Gamma (Business)', freq: 28, trend: '+18%' }
                         ].map(item => (
                            <div key={item.area} className="space-y-2">
                               <div className="flex justify-between items-center text-[11px] font-bold">
                                  <span>{item.area}</span>
                                  <span className={cn(item.trend.startsWith('+') ? "text-green-600" : "text-red-500")}>{item.trend}</span>
                               </div>
                               <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#f58220]" style={{ width: `${item.freq}%` }} />
                               </div>
                            </div>
                         ))}
                      </div>
                   </BentoCard>
                </div>
             </div>
           </div>
         ) : activeTab === 'settings' ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <BentoCard className="bg-white border-zinc-200 p-8 shadow-sm">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-8">System Configuration</h2>
               
               <div className="space-y-8">
                  <div className="p-6 bg-zinc-900 rounded-[2rem] text-white">
                     <div className="flex items-center justify-between mb-8">
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f59e0b] mb-1">Rider Uplink Protocol</p>
                           <h3 className="text-xs font-bold text-zinc-400">Merchant Terminal Code</h3>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-[#f59e0b]/10 flex items-center justify-center">
                           <Zap className="w-5 h-5 text-[#f59e0b]" />
                        </div>
                     </div>
                     
                     <div className="flex flex-col items-center py-6">
                        <div className="text-6xl font-headline font-black italic tracking-widest text-[#f59e0b] animate-pulse">
                           {isSupabaseMocked() ? '123456' : '772 901'}
                        </div>
                        <p className="mt-4 text-[10px] font-black uppercase text-zinc-500 text-center max-w-[200px]">
                           Share this sequence with a rider to establish a neural uplink.
                        </p>
                     </div>

                     <div className="mt-6 pt-6 border-t border-white/5 flex gap-4">
                        <button className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Regenerate Code</button>
                        <button className="flex-1 bg-[#f59e0b] text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Display QR</button>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">Terminal Access</h4>
                    <div className="divide-y divide-zinc-100 border rounded-2xl overflow-hidden bg-zinc-50">
                       <div className="p-4 flex items-center justify-between bg-white">
                          <span className="text-xs font-bold">Auto-Dispatch Mode</span>
                          <div className="w-10 h-5 bg-[#f59e0b] rounded-full relative">
                             <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                          </div>
                       </div>
                       <div className="p-4 flex items-center justify-between bg-white">
                          <span className="text-xs font-bold">Real-time Telemetry sharing</span>
                          <div className="w-10 h-5 bg-[#f59e0b] rounded-full relative">
                             <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
            </BentoCard>

            <BentoCard className="bg-red-50 border-red-100 p-8">
               <h4 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4">Danger Zone</h4>
               <button onClick={onSwitchRole} className="w-full bg-red-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">
                  Deactivate Merchant Node
               </button>
            </BentoCard>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column: Orders Queue */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Active Queue <span className="text-zinc-400 text-sm font-medium">{activeOrders.length} Orders</span>
              </h2>
              <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
                 <button className="px-3 py-1.5 bg-white shadow-sm rounded-lg text-[10px] font-black uppercase tracking-widest text-[#f58220]">Date ↓</button>
                 <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Price</button>
                 <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Order ID</button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeOrders.map(order => {
                const createdAt = new Date(order.created_at);
                const diffSecs = Math.floor((now - createdAt.getTime()) / 1000);
                const isOverdue = diffSecs > 1800; // 30 mins

                return (
                  <motion.div 
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {isOverdue && (
                       <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest py-1 px-4 text-center">
                          OVERDUE ({Math.floor(diffSecs / 60)}m)
                       </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-4 mt-2">
                       <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-mono text-zinc-400 uppercase">#LE-{order.id.slice(0, 8).toUpperCase()}</span>
                          <h3 className="text-lg font-black text-zinc-800">{order.customer_name || 'Debug Customer'}</h3>
                       </div>
                       <div className="flex flex-col items-end gap-1">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5",
                            order.status === 'preparing' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                          )}>
                             <div className="w-1.5 h-1.5 bg-current rounded-full" />
                             {order.status}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                               <Clock className="w-3 h-3" /> {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[9px] font-bold text-[#f58220] uppercase tracking-wider">
                              {diffSecs < 60 ? 'Just now' : `${Math.floor(diffSecs / 60)}m ago`}
                            </span>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-1 mb-6">
                       <div className="flex items-center gap-1.5 text-zinc-500">
                          <Smartphone className="w-3 h-3" />
                          <span className="text-xs font-medium font-mono">{order.phone || '000 000 0000'}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          <span className="text-xs font-medium truncate">{order.address || '123 Default St, Default City'}</span>
                       </div>
                    </div>

                    {order.rider && (
                       <div className="flex items-center gap-3 mb-6 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                          <div className="w-10 h-10 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                             <Bike className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[8px] font-black uppercase text-zinc-400 leading-none mb-1">Assigned Vector</p>
                             <p className="text-sm font-black text-zinc-800 truncate">{order.rider.name}</p>
                          </div>
                          <div className="flex gap-2">
                             <button className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg shadow-sm text-zinc-600">
                                <Smartphone className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => setTrackingOrderId(trackingOrderId === order.id ? null : order.id)}
                               className={cn(
                                 "w-8 h-8 flex items-center justify-center rounded-lg shadow-sm transition-all",
                                 trackingOrderId === order.id ? "bg-[#f59e0b] text-black border-[#f59e0b]" : "bg-white border border-zinc-200 text-zinc-600"
                               )}
                             >
                                <MapPin className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    )}

                    {trackingOrderId === order.id && order.rider && (
                       <RiderTrackingMap 
                         riderCoords={
                           isSupabaseMocked() 
                             ? riderSimCoords 
                             : [order.rider.current_latitude || -33.9188, order.rider.current_longitude || 18.4233]
                         }
                       />
                    )}

                    <div className="flex items-center justify-between py-3 border-y border-zinc-100 mb-6 font-mono">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-800">{order.product_name || 'Test Burger (Debug)'}</span>
                          {order.status !== 'completed' && (
                             <div className="mt-1 flex flex-col gap-0.5">
                                {order.rider ? (
                                   <span className="text-[8px] text-green-600 font-black uppercase tracking-widest flex items-center gap-1">
                                      <Bike className="w-2.5 h-2.5" /> Rider arriving in ~{ getEstimatedMinutes(order.rider_dist_to_shop || 2.4) }m
                                   </span>
                                ) : (
                                   <span className="text-[8px] text-orange-500 font-black uppercase tracking-widest flex items-center gap-1">
                                      <Search className="w-2.5 h-2.5 animate-pulse" /> Dispatching nearest rider...
                                   </span>
                                )}
                                <span className="text-[8px] text-zinc-400 font-black uppercase tracking-widest flex items-center gap-1">
                                   <Clock className="w-2.5 h-2.5" /> Est. Delivery: {(createdAt.getHours() + 1) % 24}:{(createdAt.getMinutes() + 35) % 60}
                                </span>
                             </div>
                          )}
                       </div>
                       <span className="text-xs font-black text-zinc-900">R {order.total_price || '55.00'}</span>
                    </div>

                    <div className="grid grid-cols-6 gap-2">
                       <button 
                        onClick={() => handleUpdateStatus(order.id, order.status === 'pending' ? 'preparing' : 'ready')}
                        className="col-span-3 py-4 rounded-xl bg-[#f58220] text-white text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                       >
                         {order.status === 'pending' ? 'Begin Prep' : 'Mark as Ready'}
                       </button>
                       <button className="col-span-1 p-4 bg-zinc-100 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors">
                          <List className="w-5 h-5 text-zinc-500" />
                       </button>
                       <button className="col-span-1 p-4 bg-zinc-100 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors">
                          <Smartphone className="w-5 h-5 text-zinc-500" />
                       </button>
                       <button className="col-span-1 p-4 bg-red-50 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors">
                          <ShieldAlert className="w-5 h-5 text-red-400" />
                       </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Insights */}
          <aside className="w-full md:w-80 space-y-6">
            <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm text-zinc-900">
               <h3 className="text-lg font-bold mb-6">Status Overview</h3>
               <div className="space-y-4">
                  {[
                    { label: 'New Orders', count: newCount, color: 'bg-blue-500' },
                    { label: 'Preparing', count: preparingCount, color: 'bg-orange-500' },
                    { label: 'Ready for Pickup', count: readyCount, color: 'bg-green-500' },
                    { label: 'Completed', count: completedCount, color: 'bg-zinc-300' },
                  ].map(stat => (
                    <div key={stat.label} className="flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-1.5 h-1.5 rounded-full", stat.color)} />
                          <span className="text-xs font-medium text-zinc-600">{stat.label}</span>
                       </div>
                       <span className="text-sm font-black font-mono">{stat.count}</span>
                    </div>
                  ))}
               </div>
               
               <div className="mt-8 pt-6 border-t border-zinc-100">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Avg. Prep Time</p>
                  <p className="text-3xl font-black italic color-zinc-900 tracking-tighter">16m 42s</p>
               </div>
            </BentoCard>

            <BentoCard className="bg-white border-zinc-200 p-6 shadow-sm text-zinc-900">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Live Riders</h3>
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                     <span className="text-[10px] font-black text-green-600 uppercase">{activeRiders.length} Online</span>
                  </div>
               </div>
               <div className="space-y-3">
                   {activeRiders.slice(0, 4).map(rider => (
                     <div key={rider.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
                              <Bike className="w-3 h-3 text-zinc-500" />
                           </div>
                           <span className="text-xs font-bold text-zinc-700">{rider.name}</span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-400">2.4 KM</span>
                     </div>
                   ))}
               </div>
            </BentoCard>

            {/* Hidden rating triggers or menu logic could go here */}
            {ratingOrder && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <BentoCard className="bg-white p-6 max-w-sm w-full font-sans">
                  <h3 className="text-xl font-bold mb-4">Rate Rider</h3>
                  <div className="space-y-4">
                    <StarRatingInput rating={rating} onRatingChange={setRating} />
                    <textarea 
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full border p-2 rounded text-zinc-900"
                      placeholder="Comment..."
                    />
                    <div className="flex gap-2">
                       <button onClick={handleSubmitRating} disabled={loading} className="flex-1 bg-[#f58220] text-white py-2 rounded font-bold">
                         {loading ? 'Submitting...' : 'Submit'}
                       </button>
                       <button onClick={() => setRatingOrder(null)} className="flex-1 bg-zinc-100 py-2 rounded font-bold">Cancel</button>
                    </div>
                  </div>
                </BentoCard>
              </div>
            )}
          </aside>
        </div>
      )}
      </div>
    </div>
  );
};

const ProfileView = ({ profile, connections, now, onUpdateVehicle, onLogout, onPair, onSwitchRole }: { 
  profile: RiderProfile, 
  connections: ShopConnection[],
  now: number,
  onUpdateVehicle: (v: UserVehicle) => void,
  onLogout: () => void,
  onPair: (code?: string) => void,
  onSwitchRole: () => void
}) => {
  return (
    <div className="p-6 space-y-8 pb-32 max-w-lg mx-auto">
      <header className="flex flex-col items-center pt-10 pb-6 text-center">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center p-1.5 glow ring-4 ring-[#f59e0b]/5">
            {profile.photo_url ? (
              <img src={profile.photo_url} className="w-full h-full object-cover rounded-[2rem]" alt="Profile" />
            ) : (
              <div className="text-5xl font-headline font-black italic text-[#f59e0b]">{profile.name[0]}</div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#f59e0b] text-black text-[10px] font-black italic px-3 py-1 rounded-xl shadow-xl border-2 border-[#050505]">
            RANK 42
          </div>
        </div>
        <h2 className="text-4xl font-headline font-black italic text-white uppercase tracking-tight leading-none mb-2">{profile.name}</h2>
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
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Authorized Uplinks</h3>
          <button 
            onClick={() => onPair()}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-[#f59e0b] border border-[#f59e0b]/30 px-4 py-2 rounded-2xl bg-[#f59e0b]/5 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Sync with Shop
          </button>
        </div>
        
        {connections.length === 0 ? (
          <BentoCard className="p-8 border-dashed border-zinc-800 bg-transparent text-center opacity-40">
            <Link2 className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No active merchant connections</p>
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
                           {isExpired ? 'Sync required' : 'Uplink active'}
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
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 ml-2">Vehicle Configuration</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['Road', 'MTB', 'E-Bike', 'Motor'] as UserVehicle[]).map(v => (
            <button 
              key={v}
              onClick={() => onUpdateVehicle(v)}
              className={cn(
                "p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95",
                profile.vehicle_type === v 
                  ? "bg-[#f59e0b]/10 border-[#f59e0b] text-[#f59e0b]" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              <Bike className="w-4 h-4" />
              <span className="text-[8px] font-black uppercase tracking-tighter">{v}</span>
            </button>
          ))}
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
        
        <BentoCard className="p-2 border-zinc-800/30">
          <button 
            onClick={onSwitchRole}
            className="w-full flex items-center justify-between p-3 text-[#f59e0b] hover:text-[#f59e0b]/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Merchant Dashboard</span>
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
      const msg = err instanceof Error ? err.message : 'Uplink rejected.';
      toast.error(msg === 'Uplink rejected. Testing failure protocol.' ? 'Sync failed. Please verify the code.' : msg);
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
      toast.error(msg === 'Uplink rejected. Testing failure protocol.' ? 'Invalid QR code. Please scan a valid Merchant QR.' : msg);
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  return (
    <>
      <div className="p-6 h-full min-h-[100dvh] pb-32 overflow-y-auto no-scrollbar flex flex-col">
         <button onClick={onBack} className="text-zinc-500 flex items-center gap-2 mb-8 group">
           <ArrowRight className="w-4 h-4 rotate-180 group-hover:text-[#f59e0b] transition-colors" />
           <span className="text-[10px] font-black uppercase tracking-widest">Return to Hub</span>
         </button>

         <div className="text-center mb-12">
            <h2 className="text-3xl font-headline font-black italic uppercase tracking-tighter text-white mb-2">Initialize Uplink</h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Establish 24h pairing with Merchant</p>
         </div>

         <div className="space-y-8 flex-1">
            <BentoCard className="p-8 text-center bg-[#151515]">
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

            <BentoCard className="p-6">
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
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </>
  );
};

// --- App Hub ---

type AppView = 'dash' | 'feed' | 'move' | 'log' | 'hub' | 'pair' | 'merchant_dash';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [connections, setConnections] = useState<ShopConnection[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'rider' | 'merchant'>('rider');
  const [view, setView] = useState<AppView>(() => {
    return (localStorage.getItem('localeats_view') as AppView) || 'dash';
  });
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DeliveryOrder[]>(() => {
    const saved = localStorage.getItem('localeats_active_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [history, setHistory] = useState<DeliveryOrder[]>([]);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Network Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Uplink Re-established. Signal secure.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Signal Loss Detected. Orbital telemetry suspended.');
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const prevActiveOrdersRef = useRef<DeliveryOrder[]>([]);

  const addBootLog = (msg: string) => {
    setBootLogs(prev => [...prev.slice(-3), `> ${msg}`]);
  };

  const fetchProfile = useCallback(async () => {
    if (!user) return;
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
      });

      if (error && error.code === 'PGRST116') {
        addBootLog('WARN: NO_PROFILE - INITIALIZING...');
        // Build initial profile
        const newProfile: Partial<RiderProfile> = {
          id: user.id,
          name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Rider',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          phone: user.user_metadata?.phone || '',
          is_online: false,
          vehicle_type: (user.user_metadata?.vehicle_type as UserVehicle) || 'Road',
          verification_status: user.email === 'aviwenotununu4@gmail.com' ? 'verified' : 'pending',
          rating: 5.0,
          total_earnings: 0,
          total_deliveries: 0,
          active_points: 0,
          updated_at: new Date().toISOString()
        };
        const { data: created, error: insertError } = await getSupabase().from('rider_profiles').upsert(newProfile).select().single();
        if (created) {
          addBootLog('SYNC: NEW_PROFILE_READY');
          setProfile(created as RiderProfile);
        }
        if (insertError) addBootLog('ERR: PROFILE_INIT_FAIL');
      } else if (data) {
        addBootLog('SYNC: TELEMETRY_COMPLETE');
        setProfile(data as RiderProfile);
        if (!data.onboarding_complete) {
          setShowOnboarding(true);
        }
      } else if (error) {
        addBootLog('ERR: FETCH_FAILED');
      }
    } catch {
      addBootLog('CRITICAL: SYNC_FAILURE');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchConnectionsAndOrders = useCallback(async () => {
    if (!user) return;
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
              delivery_fee: 25,
              total_price: 155,
              created_at: new Date().toISOString(),
              restaurant_name: 'Test Burger Hub',
              shop_id: 's1',
              distance_km: 2.3
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
      });
      
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
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData) {
        const formatted = ordersData
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => {
            const shopLat = item.shop_latitude || -33.9249;
            const shopLng = item.shop_longitude || 18.4241;
            const riderLat = profile?.current_latitude || -33.9100; // default near shop if missing
            const riderLng = profile?.current_longitude || 18.4100;
            
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
              toast('NEW SIGNAL DETECTED', { 
                description: 'A high-priority payload is waiting in your authorized sector.',
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
    } catch (e) {
      console.error(e);
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

  const lastLocationUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!user || !profile?.is_online || activeOrders.length === 0) return;

    let watchId: number;

    const updateLocation = async (lat: number, lng: number) => {
      // PERF #6 — Throttle the location update to once every 15 seconds minimum
      const now = Date.now();
      if (now - lastLocationUpdateRef.current < 15000) return;
      lastLocationUpdateRef.current = now;

      try {
        await getSupabase()
          .from('rider_profiles')
          .update({ 
            current_latitude: lat, 
            current_longitude: lng, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);
      } catch (e) {
        console.error('Location sync failed:', e);
      }
    };

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          // Fallback logic for GPS signal failure
          if (err.code === 1) { // Permission Denied
             addBootLog('ERROR: GPS_PERM_DENIED');
             toast.error('GPS AUTH FAILURE. Switch to simulator mode.', { id: 'gps-error' });
          } else if (err.code === 2) { // Position Unavailable
             addBootLog('SIGNAL_LOST: TRIANGULATING...');
             toast.warning('SIGNAL INTERFERENCE DETECTED', { id: 'gps-warning' });
          }
          
          // Fallback to mock movement to keep the UI valid
          const mockLat = -33.9249 + (Math.random() - 0.5) * 0.001;
          const mockLng = 18.4241 + (Math.random() - 0.5) * 0.001;
          updateLocation(mockLat, mockLng);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, profile?.is_online, activeOrders.length]);

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
               delivery_fee: 28,
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
  const toggleOnline = async () => {
    if (!profile) return;
    
    // IMPROVEMENT #7 — Prevent going offline during active mission
    if (profile.is_online && activeOrders.length > 0) {
      toast.error('Mission Active. Protocol requires completion before shutdown.', {
        description: 'Complete pending deliveries first.',
        icon: <ShieldAlert className="text-red-500" />
      });
      return;
    }

    if (profile.verification_status !== 'verified') {
      toast.error('Identity Verification Pending. Access to Missions blocked until Fleet HQ authorizes.');
      return;
    }

    try {
      if (isSupabaseMocked()) {
        const newStatus = !profile.is_online;
        setProfile({ ...profile, is_online: newStatus });
        if (newStatus) {
          toast.success('System Online! New missions from paired shops will appear here.', { duration: 4000 });
        } else {
          toast.info('System Standby. Taking a break.');
        }
        return;
      }

      const { error } = await getSupabase()
        .from('rider_profiles')
        .update({ is_online: !profile.is_online, updated_at: new Date().toISOString() })
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
      toast.error(message);
    }
  };

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
      toast.error(message);
    }
  };

  const handleOnboardingComplete = async () => {
    if (!user) return;
    try {
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
    
    // Profit-Driven Guard: Efficiency Batching Limit
    if (activeOrders.length >= 3) {
      toast.error('PAYLOAD LIMIT REACHED. Complete current missions first.');
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
          toast.success('Mission accepted. Navigation initialized.', {
            description: surgeMultiplier > 1 ? `ROI Surge active: x${surgeMultiplier.toFixed(1)}` : undefined
          });
          setView('move'); // It used to be 'active' but looking at AppView type it might be different, 
          // WAIT: looking at AppView definition on line 1834: 
          // type AppView = 'dash' | 'feed' | 'move' | 'log' | 'hub' | 'pair' | 'merchant_dash';
          // Previous edit set it to 'active' which isn't in the type. Fixing.
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
        toast.error(`Error: ${error?.message || 'Mission already locked by another unit'}`);
      } else {
        toast.success('Mission accepted. Navigation initialized.');
        setView('move');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Accept failed';
      toast.error(message);
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
        throw new Error('Invalid or expired pairing cipher. Ensure the Merchant has generated a fresh sequence.');
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
        throw new Error('Handshake failed. Verification of the uplink was unsuccessful. Please try again.');
      }

      // Haptic Feedback Trigger!
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);

      const shopName = connection.shops?.name || 'Authorized Merchant';
      toast.success(`Uplink established!`, {
        description: `Successfully tethered to ${shopName}. (24h Proxy active)`,
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
  const handleUpdateStatus = async (orderId: string, status: DeliveryStatus) => {
    if (!profile) return;
    
    // Find the order being updated
    const orderToUpdate = activeOrders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    
    const updates = { 
      delivery_status: status, 
      updated_at: new Date().toISOString() 
    };

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
           toast.success(`Mission Success! +${orderToUpdate.delivery_fee} credits synced.`);
           if (activeOrders.length <= 1) setView('dash');
        } else {
           toast.success('Vector updated.');
        }
        return;
      }
      const { error } = await getSupabase()
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) {
        toast.error('Phase sync failed');
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
               total_earnings: profile.total_earnings + orderToUpdate.delivery_fee,
               total_deliveries: profile.total_deliveries + 1,
               active_points: profile.active_points + 15,
               updated_at: new Date().toISOString()
             };
             await getSupabase().from('rider_profiles').update(profileUpdates).eq('id', profile.id);
          }
          
          toast.success(`Mission Success! +${orderToUpdate.delivery_fee} credits synced.`);
          // If no more orders, go back to dash
          if (activeOrders.length <= 1) setView('dash');
        } else {
          toast.success('Vector updated.');
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Update failed';
      toast.error(message);
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
            BOOTING_SYSTEM_v2.4
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
              Manual_Override_Bypass
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthView />;

  if (!profile) {
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
  updated_at timestamp with time zone DEFAULT now()
);

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
  delivery_status text DEFAULT 'finding_rider',
  status text DEFAULT 'pending',
  order_type text DEFAULT 'delivery',
  rider_id uuid REFERENCES public.rider_profiles(id),
  merchant_rating numeric,
  merchant_feedback text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
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

-- 2. Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_connections ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Shops
DO $$ BEGIN
    CREATE POLICY "Public shops are viewable by everyone" ON public.shops FOR SELECT USING (true);
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

-- Refresh Schema
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

  if (role === 'merchant') return <MerchantDashboard onSwitchRole={() => setRole('rider')} />;

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
            Signal Loss: Orbital Telemetry Offline • Attempting Re-sync
          </motion.div>
        )}
      </AnimatePresence>
      {showOnboarding && <TacticalOnboarding onComplete={handleOnboardingComplete} />}
      
      {/* Background Map layer */}
      {view === 'move' && (
        <AppMapBackground 
            isOnline={profile.is_online} 
            activeOrder={activeOrders.length > 0 ? activeOrders[0] : null} 
            isVisible={true}
        />
      )}
      
      {/* HUD Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-black/60 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-4 sm:px-6 pointer-events-auto transition-colors">
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
      </header>

      {/* Main Container */}
      <main className="pt-[60px] w-full max-w-md mx-auto min-h-[100dvh] pb-32 relative z-10 pointer-events-none">
        
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
                    <span className="text-xl font-mono font-bold text-white">{Math.max(0, Math.floor((Number(availableOrders[0].distance_km) || 0) * 3))}:00 M</span>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center">
                    <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-1">Range</span>
                    <span className="text-xl font-mono font-bold text-white">{Number(availableOrders[0].distance_km) || 0} KM</span>
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
              <OrdersFeed 
                orders={availableOrders} 
                onAccept={handleOrderAccept} 
                isOnline={profile?.is_online || false} 
                surgeMultiplier={surgeMultiplier} 
                connectionCount={connections.length} 
                onRefresh={fetchConnectionsAndOrders}
              />
            )}
            {view === 'move' && (
              activeOrders.length > 0 ? (
                <div className="absolute inset-0 z-0 pointer-events-none">
                  {/* Floating Instruction Module is inside AppMapBackground */}
                  <div className="absolute top-20 right-4 p-4 pointer-events-auto z-50">
                    <button 
                      onClick={() => setView('dash')}
                      className="px-4 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-zinc-400 hover:text-white shadow-xl pointer-events-auto flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Minimize2 className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-black tracking-widest">Back to Hub</span>
                    </button>
                  </div>
                  <ActiveMissionView orders={activeOrders} onUpdateStatus={handleUpdateStatus} />
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
            {view === 'hub' && (
              <ProfileView 
                profile={profile} 
                connections={connections}
                now={now}
                onUpdateVehicle={updateVehicle} 
                onLogout={() => getSupabase().auth.signOut()} 
                onPair={() => {
                  setView('pair');
                  // We could pass code to PairingView if we had a state for it
                }}
                onSwitchRole={() => {
                  setRole('merchant');
                  setView('merchant_dash');
                }}
              />
            )}
            {view === 'merchant_dash' && (
              <MerchantDashboard 
                onSwitchRole={() => {
                  setRole('rider');
                  setView('dash');
                }} 
              />
            )}
            {view === 'pair' && <PairingView onBack={() => setView('hub')} onComplete={handlePair} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* HUD Navigation */}
      {view !== 'merchant_dash' && (
        <nav className="fixed bottom-0 left-0 w-full p-6 z-[60] pointer-events-auto">
          <div className="max-w-md mx-auto bg-zinc-900/90 backdrop-blur-3xl border border-zinc-800/50 rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl">
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
        </nav>
      )}
    </div>
  );
}
