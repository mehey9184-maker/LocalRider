import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw,
  Sliders,
  Award,
  LucideIcon
} from 'lucide-react';
import { audioSynth } from '../lib/audioSynth';
import { cn } from '../lib/utils';

export interface FlightDeckSimulatorProps {
  onForceDeviationChange?: (deviated: boolean) => void;
  onRestartTour?: () => void;
  onArriveAtMerchantSimulation?: () => void;
  onArriveAtCustomerSimulation?: () => void;
}

// -----------------------------------------------------------------------------
// TYPES & CONFIGURATIONS (Strict Typings & Contracts)
// -----------------------------------------------------------------------------
type AudioType = 'assigned' | 'arrived' | 'warning' | 'delivered';
type ColorScheme = 'amber' | 'emerald' | 'red';

interface AudioConfig {
  type: AudioType;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  colorScheme: ColorScheme;
}

const AUDIO_CONFIGS: readonly AudioConfig[] = [
  {
    type: 'assigned', label: 'Order Assigned', icon: Volume2,
    title: '🚀 DOPAMINE Connection', description: '220Hz ➜ 440Hz alert sweeps. Signals assigned order.',
    colorScheme: 'amber'
  },
  {
    type: 'arrived', label: 'Arrived Point', icon: CheckCircle,
    title: '📍 HARMONIC ARPEGGIO', description: 'C-Major warm progression for tension relief at destination.',
    colorScheme: 'emerald'
  },
  {
    type: 'warning', label: 'Wrong Turn Warning', icon: AlertTriangle,
    title: '⚠️ DEVIATION PULSES', description: 'Dual sawtooth low frequencies (140Hz) for wrong turns.',
    colorScheme: 'red'
  },
  {
    type: 'delivered', label: 'Delivered Success', icon: Award,
    title: '🏆 VICTORY TRIUMPH', description: 'Ascending pentatonic shimmer for verified order success.',
    colorScheme: 'emerald'
  }
];

const COLOR_MAPS: Record<ColorScheme, { borderState: string, iconBg: string, iconText: string, iconBorder: string }> = {
  amber: { borderState: 'hover:border-[#f59e0b]/40', iconBg: 'bg-[#f59e0b]/15', iconText: 'text-[#f59e0b]', iconBorder: 'border-[#f59e0b]/20' },
  emerald: { borderState: 'hover:border-emerald-500/40', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400', iconBorder: 'border-emerald-500/20' },
  red: { borderState: 'hover:border-red-500/40', iconBg: 'bg-red-500/15', iconText: 'text-red-500', iconBorder: 'border-red-500/20' }
};

// -----------------------------------------------------------------------------
// PURE COMPONENTS (KISS & Single Responsibility)
// -----------------------------------------------------------------------------
const AudioControlCard = React.memo(({ config, onClick }: { config: AudioConfig, onClick: () => void }) => {
  const Icon = config.icon;
  const colors = COLOR_MAPS[config.colorScheme];
  
  return (
    <button
      onClick={onClick}
      className={cn("bg-zinc-900 border border-zinc-800 text-left rounded-xl p-3 flex items-start gap-3 transition-colors group", colors.borderState)}
    >
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", colors.iconBg, colors.iconText, colors.iconBorder)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <div className="text-[10px] font-bold text-white uppercase tracking-wider">{config.title}</div>
        <div className="text-[9px] text-zinc-500 font-sans leading-none mt-1">{config.description}</div>
      </div>
    </button>
  );
});

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export function FlightDeckSimulator({ 
  onForceDeviationChange, 
  onRestartTour,
  onArriveAtMerchantSimulation,
  onArriveAtCustomerSimulation
}: FlightDeckSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeviated, setIsDeviated] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>("SYSTEM_IDLE");

  // Encapsulated dispatcher pattern for pure functions
  const handleAudioTrigger = useCallback(async (type: AudioType, label: string) => {
    try {
      setLastEvent(`PLAY_${label.toUpperCase()}`);
      
      const audioStrategy: Record<AudioType, () => Promise<void>> = {
        assigned: audioSynth.playOrderAssigned,
        arrived: audioSynth.playArrivedDestination,
        warning: audioSynth.playWrongTurnWarning,
        delivered: audioSynth.playOrderDelivered,
      };

      const execute = audioStrategy[type];
      if (execute) await execute();
    } catch (err) {
      console.warn("Audio playback interrupted", err);
      setLastEvent("WARN_AUDIO_FAILED");
    }
  }, []);

  // Defensive timeout handling avoiding memory leaks
  useEffect(() => {
    if (!isDeviated) return;
    
    // Explicit return clearing avoids unbounded allocations
    const interval = setInterval(() => {
      audioSynth.playWrongTurnWarning().catch(console.warn);
      setLastEvent("WARN_RECURRENT_DEVIATION_PING");
    }, 9500);
    
    return () => clearInterval(interval);
  }, [isDeviated]);

  const toggleDeviation = useCallback(() => {
    setIsDeviated(prev => {
      const next = !prev;
      onForceDeviationChange?.(next);
      
      if (next) handleAudioTrigger('warning', 'Route Deviation');
      else setLastEvent("ROUTE_RESTORED_GREEN");
      
      return next;
    });
  }, [onForceDeviationChange, handleAudioTrigger]);

  const quickActions = useMemo(() => [
    { label: 'Simulate Arrive at Merchant', action: onArriveAtMerchantSimulation, type: 'simulation' },
    { label: 'Simulate Arrive at Customer', action: onArriveAtCustomerSimulation, type: 'simulation' },
    { label: 'Restart Flight Guide', action: onRestartTour, type: 'reset', icon: RotateCcw }
  ].filter(a => !!a.action), [onArriveAtMerchantSimulation, onArriveAtCustomerSimulation, onRestartTour]);

  return (
    <>
      <div className="fixed left-4 top-20 z-[70] pointer-events-auto">
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={cn(
            "px-4.5 py-3 rounded-full hover:brightness-110 active:scale-95 transition-all text-[10px] font-black tracking-widest uppercase flex items-center gap-2 border bg-zinc-950 shadow-2xl",
            isDeviated 
              ? "border-amber-500/80 text-amber-500 shadow-amber-950/20 animate-pulse" 
              : "border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60"
          )}
        >
          <Sliders className="w-4 h-4 text-[#f59e0b] animate-spin-slow" />
          <span>HUD Simulator</span>
          {isDeviated && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="fixed top-36 left-4 w-80 bg-zinc-950/95 border border-zinc-900 rounded-[2rem] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-[65] pointer-events-auto font-mono text-left max-h-[70vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between mb-4.5 border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">Rider Control Module</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-bold text-zinc-600 hover:text-white uppercase transition-colors"
              >
                Hide
              </button>
            </div>

            <div className="mb-5 bg-zinc-900/50 rounded-2xl p-4.5 border border-zinc-900 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white uppercase tracking-wider">GPS Trajectory Path</span>
                <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest", 
                  isDeviated ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {isDeviated ? "WRONG ROAD!" : "ON ROUTE"}
                </span>
              </div>
              <button
                onClick={toggleDeviation}
                className={cn(
                  "w-full py-2.5 px-3 rounded-xl font-bold uppercase text-[9px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border",
                  isDeviated ? "bg-amber-500 border-amber-400 text-black shadow-lg" : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                )}
              >
                <AlertTriangle className={cn("w-3.5 h-3.5", isDeviated ? "animate-bounce" : "")} />
                <span>{isDeviated ? "⚠️ STOP DEVIATION SIMULATOR" : "🚧 SIMULATE WRONG ROAD"}</span>
              </button>
              {isDeviated && (
                <div className="text-[9.5px] font-medium text-amber-300 leading-tight">
                  Simulating route drift off Tembisa Central trajectory. Triggering 140Hz low-resonance correction loop every 9.5s.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">Calibrated Audios</span>
              <div className="grid grid-cols-1 gap-2">
                {AUDIO_CONFIGS.map(config => (
                  <AudioControlCard 
                    key={config.type} 
                    config={config} 
                    onClick={() => handleAudioTrigger(config.type, config.label)} 
                  />
                ))}
              </div>
            </div>

            {quickActions.length > 0 && (
              <div className="mt-5 border-t border-zinc-900 pt-4 gap-2 flex flex-col">
                {quickActions.map((action, idx) => {
                  const AcIcon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={action.action}
                      className={cn("w-full py-2 rounded-lg font-bold uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-1.5",
                        action.type === 'simulation' ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "border border-zinc-800 hover:border-zinc-700 text-[#f59e0b]"
                      )}
                    >
                      {AcIcon && <AcIcon className="w-3 h-3" />}
                      {action.label}
                    </button>
                  );
                 })}
              </div>
            )}

            <div className="mt-4 bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-xl p-3">
              <span className="text-[8px] font-black text-[#f59e0b] uppercase tracking-wider block mb-1">status log</span>
              <div className="text-[9px] font-mono text-zinc-400 leading-tight">
                STATUS: {lastEvent}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
