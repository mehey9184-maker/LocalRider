import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Power, 
  ShieldAlert, 
  ChevronRight, 
  ShieldCheck, 
  Download, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  CheckCircle, 
  Rocket, 
  MapPin, 
  Pause, 
  Play, 
  Trash2, 
  Navigation, 
  Clock, 
  ArrowRight, 
  ShoppingBag 
} from 'lucide-react';

import { BentoCard } from './BentoCard';
import { SOSButton } from './SOSButton';
import { AnimatedCounter } from './AnimatedCounter';
import { RiderProfile, DeliveryOrder, AppView, WeatherData } from '../types';
import { cn } from '../lib/utils';
import { detectRegion } from '../lib/geoContext';
import { canToggleRiderAvailability } from '../utils/riderVerification';

interface DashboardProps {
  profile: RiderProfile;
  todayEarnings: number;
  totalDeliveries: number;
  history: DeliveryOrder[];
  onToggleOnline: () => void;
  setView: (view: AppView) => void;
  connectionCount: number;
  isListening?: boolean;
  onStartListening?: () => void;
  weather?: WeatherData | null;
  setWeather?: React.Dispatch<React.SetStateAction<WeatherData | null>>;
  cashOnHand?: number;
  setCashOnHand?: React.Dispatch<React.SetStateAction<number>>;
}

export const Dashboard = React.memo(({ 
  profile, 
  todayEarnings, 
  totalDeliveries, 
  history, 
  onToggleOnline, 
  setView, 
  connectionCount,
  cashOnHand,
  setCashOnHand
}: DashboardProps) => {
  const [shiftCount] = useState(() => {
    return parseInt(localStorage.getItem('shiftCount') || '0', 10);
  });

  const [recentRoutes, setRecentRoutes] = useState<Array<{name: string, lat: number, lng: number, timestamp: number, id?: string}>>(() => {
    try {
      return JSON.parse(localStorage.getItem('localeats_recent_routes') || '[]');
    } catch {
      return [];
    }
  });

  const [isRecordingPaused, setIsRecordingPaused] = useState(() => {
    return localStorage.getItem('localeats_pause_recording') === 'true';
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        setRecentRoutes(JSON.parse(localStorage.getItem('localeats_recent_routes') || '[]'));
      } catch { /* ignore */ }
      setIsRecordingPaused(localStorage.getItem('localeats_pause_recording') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 2000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const region = detectRegion(profile.current_latitude, profile.current_longitude);

  useEffect(() => {
    if (profile.is_online && shiftCount < 3) {
      const newCount = shiftCount + 1;
      localStorage.setItem('shiftCount', newCount.toString());
    }
  }, [profile.is_online, shiftCount]);

  const getRank = (pts: number) => {
    if (pts >= 7500) return { title: 'GOLD', next: 10000, target: 10000, progress: 100, color: 'text-[#f59e0b]' };
    if (pts >= 2500) return { title: 'SILVER', next: 7500, target: 7500, progress: ((pts - 2500) / 5000) * 100, color: 'text-zinc-300' };
    return { title: 'BRONZE', next: 2500, target: 2500, progress: (pts / 2500) * 100, color: 'text-orange-700' };
  };

  const rank = getRank(profile.active_points || 0);

  const [isStatsVisible, setIsStatsVisible] = useState(false);

  const handleExportData = useCallback(() => {
    try {
      const timestamp = new Date().toISOString();
      const csvContent = `ID,Metric,Value,Standing
1,Today Earnings,R ${Number(todayEarnings || 0).toFixed(2)},${rank.title}
2,Drops Cleared,${totalDeliveries} UNITS,${rank.title}
3,Active Points,${profile.active_points} EXP,${rank.title}
4,Export Timestamp,${timestamp},--
`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `localeats_stats_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Stats CSV report exported successfully!');
    } catch {
      toast.error('Failed to export state data.');
    }
  }, [todayEarnings, totalDeliveries, profile.active_points, rank.title]);

  return (
    <div className="px-3 xs:px-4 sm:px-6 py-4 xs:py-6 space-y-6 pb-28 xs:pb-32 sm:pb-36 max-w-5xl mx-auto w-full">
      <header className="flex flex-col gap-1 pt-1 opacity-90 transition-all">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] mb-1">{region.heroText}</span>
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-headline font-black tracking-tight text-white leading-none whitespace-normal">
          {region.greetingTitle}
        </h1>
      </header>

      {profile.verification_status === 'approved' && connectionCount === 0 && (
         <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-amber-500/10 border-2 border-amber-500/20 text-amber-300 p-5 rounded-[2rem] flex items-center gap-4 group cursor-pointer text-left"
            onClick={() => setView('hub')}
         >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
               <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
               <h4 className="text-[11px] font-black uppercase tracking-[0.1em] mb-1">Platform verified</h4>
               <p className="text-sm font-bold text-white/70 italic leading-tight">You can go online without a preferred shop. Rider Pool dispatch is being enabled; connected-shop deliveries remain available where supported. Shop pairing is optional.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-amber-300 transition-colors" />
         </motion.button>
      )}

      {/* Safety Protocol */}
      <SOSButton riderName={profile.name} />

      {/* Power Toggle */}
      <div className="flex flex-col gap-2">
        <button 
          id="dash-online-btn"
          disabled={!canToggleRiderAvailability(profile.verification_status, profile.is_online)}
          onClick={() => {
            onToggleOnline();
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
          }}
          className={cn(
            "w-full min-h-[76px] px-6 py-4 rounded-3xl flex items-center justify-start gap-5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/40 disabled:cursor-not-allowed disabled:opacity-50",
            profile.is_online 
              ? "bg-[#0b130e] border border-emerald-500/30 hover:border-emerald-400/50 glow-green shadow-[0_8px_30px_rgba(34,197,94,0.04)]" 
              : "bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-[#121214] shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
          )}
        >
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
            profile.is_online 
              ? "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/25 shadow-[0_0_20px_rgba(16,185,129,0.3)]" 
              : "text-zinc-500 bg-zinc-800/60"
          )}>
            <Power className={cn("w-5 h-5 transition-all duration-300", profile.is_online && "scale-110")} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <div className="flex items-center gap-3">
              <span className={cn("text-[17px] font-headline font-black uppercase tracking-wider italic transition-colors duration-300", profile.is_online ? "text-white text-glow" : "text-zinc-400")}>
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
              <span className={cn("text-[11px] font-sans font-semibold uppercase tracking-wider transition-colors duration-300", profile.is_online ? "text-emerald-400/80" : "text-zinc-500")}>
                {profile.is_online ? 'Connected-shop missions where available' : profile.verification_status === 'approved' ? 'Tap to go online' : 'Verification required to go online'}
              </span>
              {profile.verification_status === 'approved' && (
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
              You are online. Connected-shop deliveries remain available where supported; Rider Pool dispatch is being enabled.
            </p>
          </motion.div>
        )}
      </div>

      {/* Stats Bento */}
      <div className="space-y-4 relative">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">UPLINK METRICS</span>
          <div className="flex items-center gap-2">
            <button
              id="export-stats-btn"
              onClick={handleExportData}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-[#f59e0b] border border-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider active:scale-95 shadow-md justify-center"
              title="Export Local Summary Report"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
            <button
              id="toggle-stats-btn"
              onClick={() => setIsStatsVisible(!isStatsVisible)}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider active:scale-95 shadow-md justify-center"
              title={isStatsVisible ? "Hide Stats Panel" : "Show Stats Panel"}
            >
              {isStatsVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{isStatsVisible ? "Hide" : "Show"}</span>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isStatsVisible && (
            <motion.div 
              id="dash-stats-panel" 
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden"
            >
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
                    <AnimatedCounter value={todayEarnings || 0} isCurrency />
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
                    <AnimatedCounter value={totalDeliveries || 0} /> <span className="text-xs font-mono font-bold tracking-tighter text-zinc-500 uppercase">UNITS</span>
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" /> Speed rating 100%
                  </div>
                </div>
              </BentoCard>

              {/* Cash-on-Hand Limit Tracker Card */}
              <BentoCard className="bg-gradient-to-br from-zinc-950 to-zinc-900 border-zinc-800/80 p-5 flex flex-col justify-between" glow>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1 px-1.5 rounded text-[9px] font-mono font-black tracking-widest uppercase",
                      (cashOnHand || 0) >= 200 
                        ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    )}>
                      SEC // CASH-ON-HAND
                    </div>
                  </div>
                  <div className={cn(
                    "p-1.5 rounded-lg border",
                    (cashOnHand || 0) >= 200 
                      ? "bg-red-500/10 border-red-500/20" 
                      : "bg-[#f59e0b]/10 border-[#f59e0b]/20"
                  )}>
                    <ShieldAlert className={cn("w-4 h-4", (cashOnHand || 0) >= 200 ? "text-red-500 animate-pulse" : "text-[#f59e0b]")} />
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1">Cash Held (Limit R200)</span>
                  <div className="flex justify-between items-baseline">
                    <p className="text-3xl font-headline font-black italic tracking-tight text-white">
                      R{Number(cashOnHand || 0).toFixed(2)}
                    </p>
                    <span className="text-[10px] font-mono font-bold text-zinc-500">
                      {Math.min(100, Math.round(((cashOnHand || 0) / 200) * 100))}% Limit
                    </span>
                  </div>

                  {/* Limit progress bar */}
                  <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-850 mt-2.5">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${Math.min(((cashOnHand || 0) / 200) * 100, 100)}%` }} 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        (cashOnHand || 0) >= 200 
                          ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
                          : "bg-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                      )} 
                    />
                  </div>

                  {/* Warning banner inside bento */}
                  {(cashOnHand || 0) >= 200 ? (
                    <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-[9px] text-red-400 font-sans leading-snug">
                        ⚠️ <strong>LIMIT EXCEEDED</strong>: Depositing this cash at a linked store hub is required to unlock full system capabilities.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-500 font-sans mt-2.5">
                      Riders can carry a maximum of R200 cash before requiring a hub deposit.
                    </p>
                  )}

                  {/* Deposit button */}
                  {(cashOnHand || 0) > 0 && (
                    <button
                      onClick={() => {
                        if (setCashOnHand) {
                          setCashOnHand(0);
                          toast.success("Deposit success!", {
                            description: `R${Number(cashOnHand).toFixed(2)} deposited at store hub. Cash-on-hand register cleared!`
                          });
                          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        }
                      }}
                      className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[#f59e0b] font-black uppercase tracking-widest text-[8px] rounded-xl mt-3 transition-all cursor-pointer"
                    >
                      Clear & Deposit Held Cash
                    </button>
                  )}
                </div>
              </BentoCard>

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
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 italic font-headline">Your Progress</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-200">Sector Specialist</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Complete 3 orders for +50 Pts</p>
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Routes Section */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black italic uppercase tracking-tight flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#f59e0b]" /> Recent Routes
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newVal = !isRecordingPaused;
                  setIsRecordingPaused(newVal);
                  localStorage.setItem('localeats_pause_recording', newVal.toString());
                  toast.success(newVal ? "Recording paused" : "Recording resumed", {
                    description: newVal ? "Future trips will not be saved to your history." : "New navigation paths will be logged."
                  });
                  window.dispatchEvent(new Event('storage'));
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer",
                  isRecordingPaused
                    ? "bg-amber-950/20 text-amber-500 border-amber-500/30 hover:bg-amber-950/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                )}
                title={isRecordingPaused ? "Resume logging trips" : "Pause logging trips"}
              >
                {isRecordingPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>{isRecordingPaused ? "Resume" : "Pause"}</span>
              </button>

              {recentRoutes.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear your local route history?")) {
                      localStorage.removeItem('localeats_recent_routes');
                      localStorage.removeItem('localeats_pending_route');
                      setRecentRoutes([]);
                      toast.success("History cleared");
                      window.dispatchEvent(new Event('storage'));
                    }
                  }}
                  className="px-2.5 py-1.5 bg-red-950/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  title="Clear history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          <BentoCard className="p-5 border-zinc-800/40 bg-gradient-to-br from-zinc-950/80 to-zinc-900/40">
            {recentRoutes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Navigation className="w-8 h-8 text-zinc-750 animate-pulse mb-2.5" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-snug font-mono">No recent routes cached</span>
                <span className="text-[9px] text-zinc-600 font-sans mt-0.5">Trips active for &gt;2 mins will appear here automatically</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2 text-[8px] font-mono uppercase text-[#f59e0b] tracking-wider font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>One-Tap Offline Launcher Active</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {recentRoutes.map((route, idx) => (
                    <div 
                      key={route.id || idx} 
                      onClick={() => {
                        const originLat = profile?.current_latitude;
                        const originLng = profile?.current_longitude;
                        if (originLat == null || originLng == null) {
                          toast.error('Location unavailable', { description: 'Enable device location before starting navigation.' });
                          return;
                        }
                        const provider = localStorage.getItem('localeats_nav_pref') || 'google';
                        let url;
                        if (provider === 'waze') {
                          url = `https://waze.com/ul?ll=${route.lat},${route.lng}&navigate=yes`;
                        } else {
                          let travelMode = 'driving';
                          if (profile?.vehicle_type === 'Road' || profile?.vehicle_type === 'MTB' || profile?.vehicle_type === 'E-Bike') travelMode = 'bicycling';
                          if (profile?.vehicle_type === 'Motor') travelMode = 'two-wheeler';
                          url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${route.lat},${route.lng}&travelmode=${travelMode}`;
                        }
                        window.open(url, '_blank', 'noreferrer');
                        toast.info(`Launching ${provider === 'waze' ? 'Waze' : 'Google Maps'}...`, {
                          description: `Routing to: ${route.name}`
                        });
                      }}
                      className="flex items-center justify-between p-3.5 bg-zinc-900/40 border border-zinc-800 hover:border-[#f59e0b]/45 hover:bg-[#f59e0b]/5 rounded-2xl cursor-pointer active:scale-[0.99] transition-all group text-left"
                    >
                      <div className="flex items-center gap-3.5 overflow-hidden">
                        <div className="p-2.5 bg-zinc-800/80 group-hover:bg-[#f59e0b]/10 rounded-xl shrink-0 border border-zinc-700/60 group-hover:border-[#f59e0b]/20 transition-all">
                          <Navigation className="w-4 h-4 text-zinc-450 group-hover:text-[#f59e0b] transition-all" />
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-zinc-200 group-hover:text-white truncate leading-tight">{route.name}</span>
                          <span className="text-[9px] text-zinc-500 font-mono mt-1">
                            {new Date(route.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(route.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-zinc-900 border border-zinc-800 group-hover:border-[#f59e0b]/30 group-hover:bg-[#f59e0b]/10 text-zinc-500 group-hover:text-[#f59e0b] rounded-xl transition-all shrink-0">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </BentoCard>
        </section>

        {/* Logs */}
        <section className="space-y-4 pt-4 pb-12">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black italic uppercase tracking-tight flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-600" /> Recent Logs
            </h2>
            <button onClick={() => setView('log')} className="text-xs font-black uppercase tracking-widest text-[#f59e0b] hover:underline font-mono">Full Feed</button>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="py-12 text-center bg-zinc-900/10 rounded-[2rem] border border-dashed border-zinc-850">
                <p className="text-[11px] font-bold text-zinc-650 uppercase tracking-widest italic font-sans">No recent deliveries.</p>
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
                        <h4 className="text-sm font-bold text-zinc-150 uppercase tracking-tight mb-1">{order.restaurant_name}</h4>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-mono text-zinc-500 uppercase">{order.delivery_status}</span>
                           <div className="w-1 h-1 rounded-full bg-zinc-800" />
                           <span className="text-[10px] font-mono text-zinc-600">{new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-base font-black italic text-[#f59e0b] font-headline">R{Number(order.delivery_fee || 0).toFixed(2)}</p>
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

Dashboard.displayName = 'Dashboard';
