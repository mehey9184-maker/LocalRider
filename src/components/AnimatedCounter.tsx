import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  isCurrency?: boolean;
}

export const AnimatedCounter = React.memo(({ value, duration = 1.0, isCurrency = false }: AnimatedCounterProps) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = 0;
    const endValue = value;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const easedProgress = progress * (2 - progress); // easeOutQuad
      const currentCount = startValue + easedProgress * (endValue - startValue);
      setCount(currentCount);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="inline-block"
    >
      {isCurrency ? `R ${count.toFixed(2)}` : Math.round(count)}
    </motion.span>
  );
});

AnimatedCounter.displayName = 'AnimatedCounter';
