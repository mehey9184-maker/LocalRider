import * as React from 'react';
import { Mic } from 'lucide-react';
import { cn } from '../lib/utils';

interface VoiceDashboardCardProps {
  isListening: boolean;
  onStart: () => void;
}

export const VoiceDashboardCard = ({ isListening, onStart }: VoiceDashboardCardProps) => {
  return (
    <button 
      onClick={onStart}
      className={cn(
        "p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-center relative overflow-hidden h-full min-h-[92px] group w-full",
        isListening 
          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse" 
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:bg-zinc-900/80"
      )}
    >
      {isListening ? (
        <>
          <div className="flex gap-0.5 items-end justify-center h-6 mb-1 z-10">
            {/* Elegant bouncing voice lines */}
            <div className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-0.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            <div className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.5s]" />
            <div className="w-0.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
          <div className="flex flex-col items-center z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b] font-mono">VOICE: ACTIVE</span>
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Listening to command...</span>
          </div>
        </>
      ) : (
        <>
          <Mic className="w-6 h-6 text-zinc-500 group-hover:text-amber-500 transition-colors z-10" />
          <div className="flex flex-col items-center z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 font-mono">VOICE COMMANDS</span>
            <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Tap to activate</span>
          </div>
        </>
      )}
    </button>
  );
};

VoiceDashboardCard.displayName = 'VoiceDashboardCard';
