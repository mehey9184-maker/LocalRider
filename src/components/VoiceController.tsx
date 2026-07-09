import * as React from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface VoiceControllerProps {
  isListening: boolean;
  onStart: () => void;
}

export const VoiceController = ({ isListening, onStart }: VoiceControllerProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onStart}
      className={cn(
        "fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-50 border-2 transition-all duration-300",
        isListening 
          ? "bg-emerald-500 border-emerald-400 animate-pulse shadow-emerald-500/40" 
          : "bg-zinc-900 border-zinc-800 shadow-black/60"
      )}
      aria-label={isListening ? "Mute microphone" : "Activate microphone"}
    >
      {isListening ? (
        <Mic className="w-6 h-6 text-black" />
      ) : (
        <MicOff className="w-6 h-6 text-zinc-500" />
      )}
      
      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
        </span>
      )}
    </motion.button>
  );
};

VoiceController.displayName = 'VoiceController';
