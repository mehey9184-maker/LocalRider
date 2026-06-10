import React, { useEffect, useState } from 'react';
import { errorBus } from '../lib/errorHandling';
import { AlertOctagon, X, RefreshCcw } from 'lucide-react';

export function ErrorNotificationOverlay() {
  const [error, setError] = useState<{ message: string; description?: string; onRetry?: () => void } | null>(null);

  useEffect(() => {
    return errorBus.subscribe((payload) => {
      setError(payload);
      
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    });
  }, []);

  if (!error) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-zinc-900 border border-[#FF5A36]/40 p-4 rounded-xl shadow-2xl flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-[#FF5A36]/10 p-2 rounded-full">
            <AlertOctagon size={24} className="text-[#FF5A36]" />
          </div>
          <div className="flex-1 mt-1">
            <h3 className="font-black text-white text-sm mb-1 tracking-wide">
               Eish! We hit a snag.
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              {error.message}
            </p>
            {error.description && (
              <p className="text-zinc-500 text-[10px] mt-1">{error.description}</p>
            )}
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-zinc-500 hover:text-white p-2 -mr-2 -mt-2"
          >
            <X size={16} />
          </button>
        </div>
        
        {error.onRetry && (
          <div className="flex justify-end pt-2 border-t border-zinc-800">
            <button 
              onClick={() => {
                error.onRetry?.();
                setError(null);
              }}
              className="flex items-center gap-2 bg-[#FF5A36] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#ff401a] transition-colors"
            >
              <RefreshCcw size={14} />
              Retry Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
