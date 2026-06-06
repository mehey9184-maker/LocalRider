import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Crosshair, 
  Radar, 
  Navigation, 
  Mic, 
  QrCode, 
  Activity, 
  X, 
  ArrowRight, 
  ChevronRight,
  LifeBuoy
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ProfileOnboardingProps {
  onComplete: () => void;
  mode?: 'onboarding' | 'helphub';
  onStartInteractiveTour?: () => void;
}

interface StepItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGlow: string;
  desc: string;
}

const STEPS: StepItem[] = [
  {
    title: 'VECTOR_SCAN_SECTORS',
    icon: Radar,
    color: 'text-orange-500 border-orange-500/30',
    bgGlow: 'bg-orange-500/10 shadow-[0_0_25px_rgba(249,115,22,0.15)]',
    desc: 'The central hub for local food-dispatch detection. When online, the system monitors sectors to triangulate available contracts for delivery within your active network.'
  },
  {
    title: 'DISPATCH_ACCEPTANCE',
    icon: Crosshair,
    color: 'text-amber-500 border-amber-500/30',
    bgGlow: 'bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.15)]',
    desc: 'Each order is a critical order. Acceptance binds your profile signature to the client contract. Track coordinates and timers tightly to preserve delivery yield multipliers.'
  },
  {
    title: 'OPTIMIZATION_ENGINE',
    icon: Navigation,
    color: 'text-cyan-400 border-cyan-500/30',
    bgGlow: 'bg-cyan-500/10 shadow-[0_0_25px_rgba(34,211,238,0.15)]',
    desc: 'Avoid backtracking with the pathfinder (OPT menu). Optimize multi-stop routes to sequence restaurant pickups and customer drops in the fastest, fuel-efficient layout.'
  },
  {
    title: 'VOICE_PROTOCOLS',
    icon: Mic,
    color: 'text-pink-500 border-pink-500/30',
    bgGlow: 'bg-pink-500/10 shadow-[0_0_25px_rgba(236,72,153,0.15)]',
    desc: 'Deploy hands-free commands when driving. Trigger voice control to say "picked up" or "delivered" to adjust the order status without taking your hands off the vehicle bars.'
  },
  {
    title: 'CRYPTOGRAPHIC_QR_PAIR',
    icon: QrCode,
    color: 'text-indigo-400 border-indigo-500/30',
    bgGlow: 'bg-indigo-500/10 shadow-[0_0_25px_rgba(99,102,241,0.15)]',
    desc: 'Direct dispatch interface requires a store connection. Scan the merchant terminal QR or type their unique 6-digit channel code to import bulk packages instantly and join their priority list.'
  },
  {
    title: 'AUTONOMOUS_SIMULATOR',
    icon: Activity,
    color: 'text-purple-400 border-purple-500/30',
    bgGlow: 'bg-purple-500/10 shadow-[0_0_25px_rgba(168,85,247,0.15)]',
    desc: 'Running in a sandbox or nested preview? Integrated high-fidelity automated GPS simulation keeps coordinates updating so you can trial runs, route transitions, and geo-unlocks without leaving home.'
  },
  {
    title: 'LOCATION_SYNC',
    icon: ShieldCheck,
    color: 'text-emerald-500 border-emerald-500/30',
    bgGlow: 'bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.15)]',
    desc: 'Maintain live GPS flow. If network access drops, local queues log coordinates offline instantly. The sync shield automatically flushes logged waypoints and state once signal re-establishes.'
  }
];

export function ProfileOnboarding({ onComplete, mode: initialMode = 'onboarding', onStartInteractiveTour }: ProfileOnboardingProps) {
  const [currentMode, setCurrentMode] = useState<'onboarding' | 'helphub'>(initialMode);
  const [step, setStep] = useState(0);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      if (initialMode === 'helphub') {
        setCurrentMode('helphub');
      } else {
        onComplete();
      }
    }
  };

  const back = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const currentStep = STEPS[step];

  const handleLaunchTour = () => {
    if (onStartInteractiveTour) {
      onStartInteractiveTour();
    } else {
      setStep(0);
      setCurrentMode('onboarding');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/95 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.8)]"
      >
        {/* Neon HUD Background network and Accents */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none -z-10" />
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-[#f59e0b]/5 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[#f59e0b]/5 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-[#f59e0b] animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#f59e0b] font-mono">OPERATOR_INTEL</span>
          </div>
          <button 
            onClick={onComplete}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 flex items-center justify-center transition-colors border border-zinc-700/50"
            title="Close help monitor"
          >
            <X size={16} />
          </button>
        </div>

        {currentMode === 'onboarding' ? (
          <div className="flex flex-col items-center text-center gap-6">
            <div className="text-[10px] font-black text-zinc-500 tracking-[0.25em] font-mono">
              SYSTEM_MODULE_DIAGNOSTICS: 0{step + 1} / 0{STEPS.length}
            </div>

            <motion.div
              key={step}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className={cn("w-20 h-20 rounded-2xl flex items-center justify-center p-5 border", currentStep.color, currentStep.bgGlow)}
            >
              <currentStep.icon className="w-full h-full" />
            </motion.div>

            <div className="space-y-3 min-h-[140px] flex flex-col justify-center">
              <motion.h2 
                key={`t-${step}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-xl font-black tracking-widest text-white uppercase font-mono"
              >
                {currentStep.title}
              </motion.h2>
              <motion.p 
                key={`p-${step}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-zinc-400 font-medium leading-relaxed font-sans max-w-sm px-2"
              >
                {currentStep.desc}
              </motion.p>
            </div>

            {/* Stepper Progress Bar */}
            <div className="flex gap-1.5 w-full py-2">
              {STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-all duration-500",
                    idx === step 
                      ? "bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" 
                      : idx < step 
                        ? "bg-[#f59e0b]/50" 
                        : "bg-zinc-800"
                  )}
                />
              ))}
            </div>

            <div className="flex gap-3 w-full mt-2">
              {step > 0 && (
                <button
                  onClick={back}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 border border-zinc-700/50"
                >
                  Back
                </button>
              )}
              
              <button
                onClick={next}
                className="flex-[2] bg-[#f59e0b] hover:bg-amber-500 text-black py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-lg shadow-[#f59e0b]/20 flex items-center justify-center gap-1.5"
              >
                <span>
                  {step === STEPS.length - 1 
                    ? (initialMode === 'helphub' ? 'Return to Hub' : 'INITIALIZE SYSTEM') 
                    : 'ACKNOWLEDGE'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {initialMode === 'helphub' && (
              <button 
                onClick={() => setCurrentMode('helphub')}
                className="text-zinc-500 hover:text-[#f59e0b] text-[9px] font-black uppercase tracking-widest transition-colors font-mono"
              >
                ← Back to Operator Manual
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-widest text-[#f59e0b] uppercase font-mono">SYSTEM HANDBOOK</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-mono mt-1 tracking-wider">active Core & location tracking Directives</p>
            </div>

            {/* Interactive list of app features */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {/* Tour Relaunch trigger */}
              <button
                onClick={handleLaunchTour}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/15 border border-amber-500/20 text-left transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-[#f59e0b]">
                    <Radar className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white tracking-widest">RUN SYSTEMS TOUR</h4>
                    <p className="text-[9px] text-zinc-400 mt-0.5">Walkthrough of all system elements and features</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#f59e0b] group-hover:translate-x-1 transition-transform" />
              </button>

              {STEPS.map((s) => {
                const isOpen = openSection === s.title;
                return (
                  <div key={s.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-all">
                    <button
                      onClick={() => setOpenSection(isOpen ? null : s.title)}
                      className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-zinc-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", s.color)}>
                          <s.icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-200 font-mono">{s.title.replace(/_/g, ' ')}</span>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 text-zinc-500 transition-transform duration-300", isOpen && "rotate-90 text-[#f59e0b]")} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-1 border-t border-zinc-800/50 bg-zinc-950/40 text-[11px] text-zinc-400 leading-relaxed font-sans">
                            {s.desc}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-600 font-mono">
              <span className="uppercase text-[8px] tracking-widest text-[#f59e0b]">CORE_V1.4.3</span>
              <span>Connection_STATUS: LOGGED</span>
            </div>

            <button
              onClick={onComplete}
              className="w-full bg-[#f59e0b] hover:bg-amber-500 text-black py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-md font-mono"
            >
              CLOSE MANUAL
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
