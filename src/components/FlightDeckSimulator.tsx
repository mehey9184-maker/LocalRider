import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw,
  Sliders,
  Award
} from 'lucide-react';
import { audioSynth } from '../lib/audioSynth';
import { cn } from '../lib/utils';

interface FlightDeckSimulatorProps {
  onForceDeviationChange?: (deviated: boolean) => void;
  onRestartTour?: () => void;
  onArriveAtMerchantSimulation?: () => void;
  onArriveAtCustomerSimulation?: () => void;
}

export function FlightDeckSimulator({ 
  onForceDeviationChange, 
  onRestartTour,
  onArriveAtMerchantSimulation,
  onArriveAtCustomerSimulation
}: FlightDeckSimulatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeviated, setIsDeviated] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>("SYSTEM_IDLE");

  // Trigger play sound & log event
  const triggerAudio = async (type: 'assigned' | 'arrived' | 'warning' | 'delivered', label: string) => {
    setLastEvent(`PLAY_${label.toUpperCase()}`);
    if (type === 'assigned') {
      await audioSynth.playOrderAssigned();
    } else if (type === 'arrived') {
      await audioSynth.playArrivedDestination();
    } else if (type === 'warning') {
      await audioSynth.playWrongTurnWarning();
    } else if (type === 'delivered') {
      await audioSynth.playOrderDelivered();
    }
  };

  // Automatic interval reminder when rider operates in deviated / wrong route state
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isDeviated) {
      interval = setInterval(() => {
        audioSynth.playWrongTurnWarning();
        setLastEvent("WARN_RECURRENT_DEVIATION_PING");
      }, 9500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDeviated]);

  const toggleDeviation = () => {
    const nextState = !isDeviated;
    setIsDeviated(nextState);
    if (onForceDeviationChange) {
      onForceDeviationChange(nextState);
    }
    if (nextState) {
      triggerAudio('warning', 'Route Deviation');
    } else {
      setLastEvent("ROUTE_RESTORED_GREEN");
    }
  };

  return (
    <>
      {/* Floating Gear Access Button */}
      <div className="fixed left-4 top-20 z-[70] pointer-events-auto">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "px-4.5 py-3 rounded-full hover:brightness-110 active:scale-95 transition-all text-[10px] font-black tracking-widest uppercase flex items-center gap-2 border bg-zinc-950 shadow-2xl",
            isDeviated 
              ? "border-amber-500/80 text-amber-500 shadow-amber-950/20 animate-pulse" 
              : "border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60"
          )}
        >
          <Sliders className="w-4 h-4 text-[#f59e0b] animate-spin-slow" />
          <span>HUD Simulator</span>
          {isDeviated && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
          )}
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
            {/* Top Line Signal Metas */}
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

            {/* Simulated Live Trajectory Selection (Riders Road Tracker) */}
            <div className="mb-5 bg-zinc-900/50 rounded-2xl p-4.5 border border-zinc-900 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white uppercase tracking-wider">GPS Trajectory Path</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest",
                  isDeviated ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  {isDeviated ? "WRONG ROAD!" : "ON ROUTE"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={toggleDeviation}
                  className={cn(
                    "w-full py-2.5 px-3 rounded-xl font-bold uppercase text-[9px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border",
                    isDeviated
                      ? "bg-amber-500 border-amber-400 text-black shadow-lg"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                  )}
                >
                  <AlertTriangle className={cn("w-3.5 h-3.5", isDeviated ? "animate-bounce" : "")} />
                  <span>{isDeviated ? "⚠️ STOP DEVIATION SIMULATOR" : "🚧 SIMULATE WRONG ROAD"}</span>
                </button>
              </div>

              {isDeviated && (
                <div className="text-[9.5px] font-medium text-amber-300 leading-tight">
                  Simulating route drift off Tembisa Central trajectory. Triggering 140Hz low-resonance correction loop every 9.5s.
                </div>
              )}
            </div>

            {/* Quick Testing Audio Pitch System (Psychologically Calibrated) */}
            <div className="space-y-4">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">Calibrated Audios</span>
              
              <div className="grid grid-cols-1 gap-2">
                {/* 1. Low-frequency feedback */}
                <button
                  onClick={() => triggerAudio('assigned', 'Order Assigned')}
                  className="bg-zinc-900 border border-zinc-800 text-left hover:border-[#f59e0b]/40 rounded-xl p-3 flex items-start gap-3 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#f59e0b]/15 flex items-center justify-center text-[#f59e0b] border border-[#f59e0b]/20 shrink-0">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-wider">🚀 DOPAMINE UPLINK</div>
                    <div className="text-[9px] text-zinc-500 font-sans leading-none mt-0.5 mt-1">220Hz ➜ 440Hz alert sweeps. Signals assigned order.</div>
                  </div>
                </button>

                {/* 2. Destination arpeggio progression */}
                <button
                  onClick={() => triggerAudio('arrived', 'Arrived Point')}
                  className="bg-zinc-900 border border-zinc-800 text-left hover:border-emerald-500/40 rounded-xl p-3 flex items-start gap-3 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-wider">📍 HARMONIC ARPEGGIO</div>
                    <div className="text-[9px] text-zinc-500 font-sans leading-none mt-1">C-Major warm progression for tension relief at destination.</div>
                  </div>
                </button>

                {/* 3. Dual pulses warning */}
                <button
                  onClick={() => triggerAudio('warning', 'Wrong Turn Warning')}
                  className="bg-zinc-900 border border-zinc-800 text-left hover:border-red-500/40 rounded-xl p-3 flex items-start gap-3 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-red-500 border border-red-500/20 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-wider">⚠️ DEVIATION PULSES</div>
                    <div className="text-[9px] text-zinc-500 font-sans leading-none mt-1">Dual sawtooth low frequencies (140Hz) for wrong turns.</div>
                  </div>
                </button>

                {/* 4. Delivered triumph melodic rise */}
                <button
                  onClick={() => triggerAudio('delivered', 'Delivered Success')}
                  className="bg-zinc-900 border border-zinc-800 text-left hover:border-[#f59e0b]/40 rounded-xl p-3 flex items-start gap-3 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-wider">🏆 VICTORY TRIUMPH</div>
                    <div className="text-[9px] text-zinc-500 font-sans leading-none mt-1">Ascending pentatonic shimmer for verified mission success.</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Calibration triggers */}
            <div className="mt-5 border-t border-zinc-900 pt-4 gap-2 flex flex-col">
              {onArriveAtMerchantSimulation && (
                <button
                  onClick={onArriveAtMerchantSimulation}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white font-bold uppercase text-[9px] tracking-widest transition-all"
                >
                  Simulate Arrive at Merchant
                </button>
              )}
              {onArriveAtCustomerSimulation && (
                <button
                  onClick={onArriveAtCustomerSimulation}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white font-bold uppercase text-[9px] tracking-widest transition-all"
                >
                  Simulate Arrive at Customer
                </button>
              )}
              {onRestartTour && (
                <button
                  onClick={onRestartTour}
                  className="w-full py-2 border border-zinc-800 hover:border-zinc-700 rounded-lg text-[#f59e0b] font-bold uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restart Flight Guide
                </button>
              )}
            </div>

            {/* Simulated telemetry logger */}
            <div className="mt-4 bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-xl p-3">
              <span className="text-[8px] font-black text-[#f59e0b] uppercase tracking-wider block mb-1">Telemetry Register</span>
              <div className="text-[9px] font-mono text-zinc-400 leading-tight">
                {`STATUS: ${lastEvent}`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
