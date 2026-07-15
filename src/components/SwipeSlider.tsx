import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface SwipeSliderProps {
  label: string;
  onComplete: () => void;
  color?: string;
  resetToken?: string | number;
  disabled?: boolean;
}

export const SwipeSlider = ({
  label,
  onComplete,
  color = '#f59e0b',
  resetToken,
  disabled = false,
}: SwipeSliderProps) => {
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDrag, setMaxDrag] = useState(200);
  const x = useMotionValue(0);

  // Map slider progress to track guidelines opacity & indicator bg color
  const opacity = useTransform(x, [0, maxDrag * 0.82], [1, 0.15]);
  const handleBg = useTransform(
    x,
    [0, maxDrag],
    ['#18181b', color] // zinc-900 transitions to swipe color
  );

  useEffect(() => {
    if (resetToken !== undefined) {
      setTimeout(() => {
        setIsComplete(false);
        x.set(0);
      }, 0);
    }
  }, [resetToken, x]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const updateWidth = () => {
      const handleWidth = 52; // h-13 matches top-1.5 bottom-1.5 inside h-16
      setMaxDrag(Math.max(100, container.offsetWidth - handleWidth - 12));
    };

    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || container.offsetWidth;
        if (width > 0) {
          const handleWidth = 52;
          setMaxDrag(Math.max(100, width - handleWidth - 12));
        }
      }
    });

    observer.observe(container);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const triggerHapticFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 10, 15]);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-16 w-full bg-zinc-950/85 border border-zinc-800 rounded-full overflow-hidden p-1.5 select-none transition-all duration-300 touch-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
        disabled ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-zinc-700/50 hover:shadow-[0_4px_20px_rgba(245,158,11,0.05)]"
      )}
    >
      {/* Background Track Text Guidelines */}
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none text-zinc-400 font-semibold tracking-wide text-xs uppercase"
      >
        {isComplete ? "Action Confirmed" : label}
      </motion.div>

      {/* Dynamic completion overlay */}
      <motion.div
        style={{
          width: useTransform(x, (v) => `${v + 52}px`),
          backgroundColor: color,
        }}
        className="absolute left-1.5 top-1.5 bottom-1.5 rounded-full opacity-15 pointer-events-none"
      />

      {/* Swipe Trigger Handle */}
      <motion.div
        drag={disabled || isComplete ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={{ left: 0.05, right: 0.1 }}
        style={{ x, backgroundColor: handleBg }}
        onDragEnd={(_, info) => {
          if (disabled || isComplete) return;
          const currentX = x.get();
          if (currentX > maxDrag * 0.82 || info.offset.x > maxDrag * 0.8) {
            x.set(maxDrag);
            setIsComplete(true);
            triggerHapticFeedback();
            onComplete();
          } else {
            // Return handle back with soft spring
            x.set(0);
          }
        }}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.96 }}
        className={cn(
          "absolute left-1.5 top-1.5 bottom-1.5 aspect-square rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20 shadow-[0_4px_15px_rgba(0,0,0,0.3)] text-white border border-zinc-800/80 transition-colors duration-200"
        )}
      >
        {isComplete ? (
          <Check className="w-5 h-5 text-white" strokeWidth={3} />
        ) : (
          <ArrowRight className="w-5 h-5 text-zinc-300" strokeWidth={3} />
        )}
      </motion.div>
    </div>
  );
};
