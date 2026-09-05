import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { DeliveryStatus } from '../types';

interface StatusBadgeProps {
  status: DeliveryStatus;
}

export const StatusBadge = React.memo(({ status }: StatusBadgeProps) => {
  const styles: Record<DeliveryStatus, string> = {
    finding_rider: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    rider_assigned: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    accepted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    picked_up: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    delivering: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    delivered: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    none: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.span 
        key={status}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border italic inline-block", 
          styles[status] || styles.none
        )}
      >
        {(status || '').replace('_', ' ')}
      </motion.span>
    </AnimatePresence>
  );
});

StatusBadge.displayName = 'StatusBadge';
