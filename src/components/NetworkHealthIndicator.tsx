import React, { useState, useEffect } from 'react';
import { Wifi, AlertTriangle, RefreshCw, X, ShieldCheck, Trash2, Database } from 'lucide-react';
import { 
  getRecentErrorLogs, 
  subscribeNetworkErrors, 
  clearNetworkErrorLogs, 
  forceCacheRevalidation, 
  NetworkErrorLog 
} from '../utils/appUtils';
import { toast } from 'sonner';

interface NetworkHealthIndicatorProps {
  onRefreshOrders?: () => void;
  className?: string;
}

export const NetworkHealthIndicator: React.FC<NetworkHealthIndicatorProps> = ({
  onRefreshOrders,
  className = ''
}) => {
  const [logs, setLogs] = useState<NetworkErrorLog[]>(() => getRecentErrorLogs(5));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkErrors(() => {
      setLogs(getRecentErrorLogs(5));
    });
    return () => unsubscribe();
  }, []);

  const hasErrors = logs.length > 0;

  const handleForceRevalidation = () => {
    forceCacheRevalidation();
    if (onRefreshOrders) {
      onRefreshOrders();
    }
    toast.success('Force Cache Revalidation Executed', {
      description: 'Cleared local order caches (localeats_available_orders, localeats_active_orders) to purge ghost orders.',
      icon: <RefreshCw className="w-4 h-4 text-[#39FF14] animate-spin" />
    });
  };

  const handleClearLogs = () => {
    clearNetworkErrorLogs();
    setLogs([]);
    toast.info('Network diagnostic log history cleared.');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all active:scale-95 ${
          hasErrors 
            ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]' 
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
        } ${className}`}
        title={hasErrors ? `${logs.length} Network Error(s) Logged - Tap to Inspect` : 'Network Health OK'}
      >
        {hasErrors ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_#ef4444]"></span>
            </span>
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="text-[10px] font-black uppercase text-red-400 hidden sm:inline">Network ({logs.length})</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-black uppercase text-zinc-400 hidden sm:inline">Uplink OK</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-950 border-2 border-zinc-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-white relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl border ${hasErrors ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                  {hasErrors ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-headline font-black uppercase tracking-wider italic text-white flex items-center gap-2">
                    Network Health Diagnostics
                  </h3>
                  <p className="text-[10px] font-mono font-bold text-zinc-400">
                    {hasErrors ? `${logs.length} Recent Request Failure(s) Recorded` : 'Uplinks Operating Normally • Zero Errors'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Log Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Database className="w-3 h-3 text-[#f59e0b]" /> Recent Error Log (Last 5 Lines)
                </span>
                {hasErrors && (
                  <button
                    onClick={handleClearLogs}
                    className="text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear Logs
                  </button>
                )}
              </div>

              {hasErrors ? (
                <div className="bg-black/90 border border-zinc-800 rounded-2xl p-3 font-mono text-[11px] space-y-2 max-h-56 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="border-b border-zinc-900 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between text-[9px] text-red-400 font-bold mb-0.5">
                        <span>[{log.timestamp}] FAILURE</span>
                        {log.endpoint && <span className="text-zinc-500">{log.endpoint}</span>}
                      </div>
                      <p className="text-zinc-300 break-words leading-snug">{log.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-4 text-center space-y-1">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                  <p className="text-xs font-bold text-zinc-300">All Database & API Requests Healthy</p>
                  <p className="text-[10px] text-zinc-500">No network dropouts or database query rejections have been logged in this session.</p>
                </div>
              )}
            </div>

            {/* Ghost Order & Revalidation Helper Box */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-headline text-xs font-black uppercase tracking-wide">
                <RefreshCw className="w-3.5 h-3.5" /> Force Cache Revalidation
              </div>
              <p className="text-[10px] text-zinc-300 font-sans leading-relaxed">
                Clears cached available and active order lists from local storage (<code className="text-amber-300 font-mono">localeats_available_orders</code>, <code className="text-amber-300 font-mono">localeats_active_orders</code>) to prevent ghost or stale orders from popping up.
              </p>
              <button
                onClick={handleForceRevalidation}
                className="w-full py-2.5 px-4 bg-[#f59e0b] hover:bg-amber-400 text-black font-headline font-black uppercase tracking-wider text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Purge Stale Caches & Revalidate Orders
              </button>
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="py-2 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
