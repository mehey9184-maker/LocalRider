import * as React from 'react';
import { cn } from '../lib/utils';

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const BentoCard = React.memo(({ children, className, glow = false, ...props }: BentoCardProps) => (
  <div 
    {...props} 
    className={cn(
      "bg-[#0a0a0c]/90 border border-zinc-800/80 rounded-2xl xs:rounded-3xl p-3.5 xs:p-4.5 sm:p-6 relative overflow-hidden group transition-all duration-300",
      glow && "shadow-[0_0_50px_rgba(245,158,11,0.08)] border-[#f59e0b]/25 bg-[#0e0e11]",
      className
    )}
  >
    {glow && (
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#f59e0b]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#f59e0b]/10 transition-all duration-700" />
    )}
    <div className="relative z-10">{children}</div>
  </div>
));

BentoCard.displayName = 'BentoCard';
