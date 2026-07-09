import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface SwipeButtonProps {
  label: string;
  onComplete: () => void;
  color?: string;
  resetToken?: string | number;
  disabled?: boolean;
}

export const SwipeButton = ({ 
  label, 
  onComplete, 
  color = "#f59e0b", 
  resetToken, 
  disabled = false 
}: SwipeButtonProps) => {
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
    const updateWidth = () => {
      if (containerRef.current) {
        const handleWidth = 72; // aspect-square sizing inside h-20 (minus padding)
        setMaxDrag(Math.max(100, containerRef.current.offsetWidth - handleWidth - 12));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative h-20 bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden p-1.5 select-none transition-all duration-300",
        disabled ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-zinc-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 opacity-60 text-center select-none truncate">
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
