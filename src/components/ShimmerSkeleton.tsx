import React from 'react';
/* In Vite setup, we might have standard classnames or a custom utility, or we can write standard tailwind/template literals directly! Let's write standard tailwind classNames helper or just literal string evaluations to prevent dependency issues. */

interface SkeletonProps {
  className?: string;
  isHighContrastMode?: boolean;
}

export function ShimmerBlock({ className, isHighContrastMode }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded",
        isHighContrastMode ? "shimmer-bg-light" : "shimmer-bg",
        className
      )}
    />
  );
}

export function OrderCardSkeleton({ isHighContrastMode }: { isHighContrastMode?: boolean }) {
  const bgClass = isHighContrastMode 
    ? "bg-zinc-100 border-zinc-300" 
    : "bg-zinc-950 border-zinc-900";
  
  return (
    <div className={cn("p-5 rounded-2xl border transition-all duration-300 shadow-md", bgClass)}>
      {/* Top section: Restaurant brand/avatar & status */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <ShimmerBlock 
            isHighContrastMode={isHighContrastMode} 
            className="w-11 h-11 rounded-xl" 
          />
          {/* Title and subtitle */}
          <div className="space-y-2">
            <ShimmerBlock 
              isHighContrastMode={isHighContrastMode} 
              className="h-4 w-32 rounded" 
            />
            <ShimmerBlock 
              isHighContrastMode={isHighContrastMode} 
              className="h-3 w-20 rounded" 
            />
          </div>
        </div>
        {/* Price/Fee badge */}
        <ShimmerBlock 
          isHighContrastMode={isHighContrastMode} 
          className="h-6 w-16 rounded-full" 
        />
      </div>

      {/* Middle section: Info grid */}
      <div className="grid grid-cols-3 gap-3 py-4 border-t border-b border-zinc-800/10 dark:border-zinc-900/50 mb-5">
        <div className="space-y-1.5 flex flex-col items-center">
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2 w-12" />
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-4 w-16" />
        </div>
        <div className="space-y-1.5 flex flex-col items-center border-l border-r border-zinc-800/10 dark:border-zinc-900/50">
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2 w-12" />
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-4 w-10" />
        </div>
        <div className="space-y-1.5 flex flex-col items-center">
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2 w-12" />
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-4 w-14" />
        </div>
      </div>

      {/* Route Addresses */}
      <div className="space-y-2.5 mb-5">
        <div className="flex items-center gap-2">
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="w-2.5 h-2.5 rounded-full" />
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-3 flex-1 max-w-[200px]" />
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="w-2.5 h-2.5 rounded" />
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-3 flex-1 max-w-[150px]" />
        </div>
      </div>

      {/* Button placeholder */}
      <ShimmerBlock 
        isHighContrastMode={isHighContrastMode} 
        className="h-12 w-full rounded-xl" 
      />
    </div>
  );
}

export function OrderTrackingSkeleton({ isHighContrastMode }: { isHighContrastMode?: boolean }) {
  const bgClass = isHighContrastMode 
    ? "bg-zinc-100 border-zinc-300 text-zinc-900" 
    : "bg-black text-white";

  return (
    <div className={cn("h-full flex flex-col pt-4", bgClass)}>
      {/* Back button and title */}
      <div className="px-6 mb-6 space-y-4">
        <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-4 w-24 rounded" />
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-7 w-48 rounded" />
            <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-3.5 w-32 rounded" />
          </div>
          <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* Map placeholder */}
      <div className="relative flex-1 min-h-[300px] border-t border-b border-zinc-800/10 dark:border-zinc-900 mx-6 rounded-2xl overflow-hidden mb-6">
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          isHighContrastMode ? "bg-zinc-200" : "bg-zinc-900"
        )}>
          {/* Scanner ping loader in background card */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 border border-[#f59e0b]/20 rounded-full animate-ping" />
            <div className="absolute w-16 h-16 border border-[#f59e0b]/40 rounded-full animate-pulse" />
            <ShimmerBlock isHighContrastMode={isHighContrastMode} className="w-12 h-12 rounded-xl relative z-10" />
          </div>
        </div>
      </div>

      {/* Carrier Info Card Header */}
      <div className="px-6 pb-6 space-y-5">
        <div className={cn(
          "p-5 rounded-2xl border",
          isHighContrastMode ? "bg-white border-zinc-300" : "bg-zinc-950 border-zinc-900"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShimmerBlock isHighContrastMode={isHighContrastMode} className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-3.5 w-24 rounded" />
                <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-3 w-16 rounded" />
              </div>
            </div>
            <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-8 w-24 rounded-lg" />
          </div>
          {/* Progress bar placeholder */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2.5 w-12" />
              <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2.5 w-8" />
            </div>
            <ShimmerBlock isHighContrastMode={isHighContrastMode} className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple CN join utility to bypass extra import dependencies safely
function cn(...classes: (string | undefined | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}
