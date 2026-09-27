import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Play,
  Award,
  ChevronLeft,
  MousePointerClick
} from 'lucide-react';

interface TourStep {
  targetId: string | null;
  title: string;
  desc: string;
  view: string;
  arrowDir?: 'top' | 'bottom' | 'left' | 'right';
  tapTargetLabel?: string;
}

interface RiderInteractiveTourProps {
  onComplete: () => void;
  setView: (view: string) => void;
  currentView: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: null,
    title: "Driver Dashboard Initialized",
    desc: "Greetings, Driver! Welcome to your LocalEats Dashboard. Let's execute a quick interactive tour to show you exactly where to tap and how to navigate.",
    view: 'dash'
  },
  {
    targetId: "dash-online-btn",
    title: "1. COUPLING TO Local Network",
    desc: "This availability switch becomes usable after LocalEats approves your Rider account. Going online does not require a shop link; Rider Pool dispatch is being enabled.",
    view: 'dash',
    arrowDir: 'bottom',
    tapTargetLabel: "Toggle Online"
  },
  {
    targetId: "dash-stats-panel",
    title: "2. PERFORMANCE MULTIPLIER",
    desc: "Your live session panel logs daily earnings, metrics, and completion statistics. High delivery yields grant priority order dispatches.",
    view: 'dash',
    arrowDir: 'top',
    tapTargetLabel: "Session Stats"
  },
  {
    targetId: "nav-feed",
    title: "3. DISPATCH MARKETPLACE",
    desc: "This feed shows connected-shop deliveries where supported. Rider Pool dispatch is not available here yet.",
    view: 'feed',
    arrowDir: 'top',
    tapTargetLabel: "Markets Tab"
  },
  {
    targetId: "nav-move",
    title: "4. Order Tracking HUD",
    desc: "Your active route control screen. Tap here to pull up current client coordinates, active delivery progress, maps, and direct customer Comm-Links.",
    view: 'move',
    arrowDir: 'top',
    tapTargetLabel: "Active HUD Tab"
  },
  {
    targetId: "preferred-shop-link-btn",
    title: "5. OPTIONAL PREFERRED SHOP LINK",
    desc: "Preferred-shop pairing is optional. It does not control your LocalEats platform verification or Go Online eligibility.",
    view: 'dash',
    arrowDir: 'top',
    tapTargetLabel: "Preferred Shop Link"
  },
  {
    targetId: "nav-hub",
    title: "6. OPERATIONS DIAGNOSTICS",
    desc: "Your profile terminal. Tap here to toggle Eco-Battery thresholds, register vehicle details, trace performance pings, or verify POPIA privacy standards.",
    view: 'hub',
    arrowDir: 'top',
    tapTargetLabel: "Profile Settings Tab"
  },
  {
    targetId: null,
    title: "Unit Tour Completed",
    desc: "Tour complete. Refresh your verification status after LocalEats review. Once approved, you may go online; dispatch availability depends on supported mission sources.",
    view: 'dash'
  }
];

export function RiderInteractiveTour({ onComplete, setView, currentView }: RiderInteractiveTourProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const step = TOUR_STEPS[stepIdx];

  // Helper to find target element and calculate bounding box
  const updateTargetCoords = () => {
    if (!step.targetId) {
      setCoords(null);
      return;
    }

    const element = document.getElementById(step.targetId);
    if (element) {
      const rect = element.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    } else {
      // Element not rendered yet, retry in 150ms
      setTimeout(updateTargetCoords, 150);
    }
  };

  // Change view and recalculate when step index changes
  useEffect(() => {
    if (currentView !== step.view) {
      setView(step.view);
    }
    // Delay slightly to give screen components time to mount
    const timer = setTimeout(() => {
      updateTargetCoords();
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // Recalculate if user changes window sizes
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        updateTargetCoords();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  const handleNext = () => {
    if (navigator.vibrate) navigator.vibrate(20);
    if (stepIdx < TOUR_STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (navigator.vibrate) navigator.vibrate(15);
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
    }
  };

  const handleSkip = () => {
    if (navigator.vibrate) navigator.vibrate([30, 20]);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none select-none">
      {/* Absolute full-screen backdrop overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-300 pointer-events-auto" />

      {/* Dynamic Target Finder Highlight Ring */}
      <AnimatePresence>
        {coords && (
          <motion.div
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: 'absolute',
              top: coords.top - 6,
              left: coords.left - 6,
              width: coords.width + 12,
              height: coords.height + 12,
            }}
            className="rounded-3xl border-2 border-[#f59e0b] shadow-[0_0_30px_rgba(245,158,11,0.5)] z-[10000] pointer-events-none"
          >
            {/* Visual pulsing ripple inside target */}
            <span className="absolute -inset-2 rounded-[2rem] border border-dashed border-[#f59e0b]/40 animate-ping" />
            
            {/* Hover Helper Label pointing to the element */}
            {step.tapTargetLabel && (
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-[#f59e0b] text-black font-mono font-black uppercase text-[8px] tracking-widest px-2 py-0.5 rounded shadow-lg border border-yellow-400">
                {step.tapTargetLabel}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Instructions Dialog Card */}
      <div className="absolute inset-x-4 bottom-28 md:bottom-32 md:max-w-md md:mx-auto flex flex-col items-center pointer-events-auto z-[10005]">
        <motion.div
          key={stepIdx}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="w-full bg-zinc-950 border border-zinc-800/80 rounded-[2.5rem] p-6 shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex flex-col font-mono"
        >
          {/* Top Line Tech Tracker */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-zinc-500 text-[9px] font-black uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
              <span>Rider Tutorial Module</span>
            </div>
            <div className="text-[9.5px] font-black text-[#f59e0b]">
              {stepIdx + 1} / {TOUR_STEPS.length}
            </div>
          </div>

          {/* Icon + Title Header */}
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] border border-[#f59e0b]/20">
              {stepIdx === 0 ? (
                <Play className="w-4 h-4 fill-current animate-pulse" />
              ) : stepIdx === TOUR_STEPS.length - 1 ? (
                <Award className="w-4 h-4 text-emerald-400 animate-bounce" />
              ) : (
                <MousePointerClick className="w-4 h-4 animate-bounce" />
              )}
            </div>
            <h3 className="text-[13px] font-black uppercase text-white tracking-widest leading-none">
              {step.title}
            </h3>
          </div>

          <p className="text-[11px] text-zinc-400 font-sans font-medium leading-relaxed mb-6">
            {step.desc}
          </p>

          {/* Interactive Navigation Rows */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-900">
            <button
              onClick={handleSkip}
              className="text-[9px] font-black text-zinc-500 hover:text-zinc-350 uppercase tracking-widest py-1 transition-colors"
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              {stepIdx > 0 && (
                <button
                  onClick={handlePrev}
                  className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black uppercase text-[10px] tracking-widest rounded-xl transition-all active:scale-95 shadow-md flex items-center gap-2"
              >
                <span>
                  {stepIdx === TOUR_STEPS.length - 1 ? "LAUNCH CADET" : "CONTINUE"}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
