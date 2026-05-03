import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Crosshair, Radar, Zap, Navigation } from 'lucide-react';
import { cn } from '../lib/utils';

interface TacticalOnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'VECTOR_SCAN',
    icon: Radar,
    color: 'text-orange-500',
    desc: 'The central hub for mission detection. When online, the grid scans and triangulates local merchant requests within your vicinity.'
  },
  {
    title: 'MISSION_CRITICAL',
    icon: Crosshair,
    color: 'text-blue-500',
    desc: 'Each drop is a Mission. Acceptance binds your signature to the delivery. Precision is mandatory—track the timer to optimize yield.'
  },
  {
    title: 'SURGE_UNIT',
    icon: Zap,
    color: 'text-yellow-500',
    desc: 'Dynamic Grid Demand triggers Surge Units. Higher demand equals higher payout multipliers. Look for high-energy sectors on your HUD.'
  },
  {
    title: 'UPLINK_SECURITY',
    icon: ShieldCheck,
    color: 'text-emerald-500',
    desc: 'Maintain active GPS telemetry. If your signal drops below threshold, the mission may be compromised. Always check your Signal HUD.'
  }
];

export function TacticalOnboarding({ onComplete }: TacticalOnboardingProps) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4">
           <div className="text-[10px] font-black text-zinc-600 tracking-widest">
              STEP_0{step + 1} / 0{STEPS.length}
           </div>
        </div>

        <div className="flex flex-col items-center text-center gap-6">
          <motion.div
            key={step}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn("w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center p-4", current.color)}
          >
             <current.icon className="w-full h-full" />
          </motion.div>

          <div className="space-y-2">
            <motion.h2 
              key={`t-${step}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-2xl font-black italic tracking-tighter text-white uppercase"
            >
              {current.title}
            </motion.h2>
            <motion.p 
              key={`p-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-zinc-400 font-medium leading-relaxed"
            >
              {current.desc}
            </motion.p>
          </div>

          <div className="flex gap-2 w-full pt-4">
             {STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex-1 h-1 rounded-full transition-all duration-500",
                    idx <= step ? "bg-orange-500" : "bg-zinc-800"
                  )}
                />
             ))}
          </div>

          <button
            onClick={next}
            className="w-full bg-orange-500 hover:bg-orange-600 text-black py-4 rounded-2xl font-black uppercase italic text-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.3)] flex items-center justify-center gap-2"
          >
            {step === STEPS.length - 1 ? 'Activate System' : 'Acknowledge Protocol'}
            <Navigation className="w-4 h-4 fill-current rotate-90" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
