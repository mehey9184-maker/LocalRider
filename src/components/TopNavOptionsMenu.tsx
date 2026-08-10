import React, { useState, useRef, useEffect } from 'react';
import { Menu, Globe, Clock, Battery } from 'lucide-react';
import { NetworkHealthIndicator } from './NetworkHealthIndicator';
import { cn } from '../lib/utils';
import { ShopConnection, AppView } from '../types';

interface TopNavOptionsMenuProps {
  connections: ShopConnection[];
  now: number;
  batteryLevel: number | null;
  batteryCharging: boolean;
  onClearCache: () => void;
  setView: (v: AppView) => void;
}

export const TopNavOptionsMenu: React.FC<TopNavOptionsMenuProps> = ({
  connections,
  now,
  batteryLevel,
  batteryCharging,
  onClearCache,
  setView
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const hasConnections = connections && connections.length > 0;
  const activeConn = hasConnections ? connections[0] : null;
  const shopName = activeConn?.shop_name || 'Merchant Store';
  const connectionCode = activeConn?.connection_code;

  const expiryMs = hasConnections ? new Date(connections[0].expires_at).getTime() - now : 0;
  const isExpired = !hasConnections || expiryMs <= 0;
  const isNearingExpiry = hasConnections && expiryMs > 0 && expiryMs <= 2 * 60 * 60 * 1000;
  const hours = hasConnections ? Math.max(0, Math.floor(expiryMs / (1000 * 60 * 60))) : 0;
  const mins = hasConnections ? Math.max(0, Math.floor((expiryMs % (1000 * 60 * 60)) / (1000 * 60))) : 0;
  const secs = hasConnections ? Math.max(0, Math.floor((expiryMs % (1000 * 60)) / 1000)) : 0;

  const statusTextColor = !hasConnections ? "text-zinc-500" : activeConn?.status === 'revoked' ? "text-red-500" : "text-emerald-400";
  const statusLabel = !hasConnections ? "UNLINKED" : activeConn?.status === 'revoked' ? "REVOKED" : "CONNECTED";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#f59e0b]/50 transition-colors active:scale-95"
        title="Options"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-[100] flex flex-col gap-1.5 animate-fadeIn">
          
          {/* Store Connection Status */}
          {hasConnections && (
            <div 
              onClick={() => { setView('pair'); setIsOpen(false); }}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className={cn("w-4 h-4", statusTextColor)} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Linked Shop</span>
                </div>
                <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded border border-current", statusTextColor)}>
                  {statusLabel}
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#f59e0b] transition-colors">{shopName}</h4>
                  {connectionCode && (
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Code: <span className="text-white font-bold">{connectionCode}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-800 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                    Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Device Status */}
          <div className="flex gap-1.5">
            {batteryLevel !== null && (
              <div className={cn(
                "flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3 flex flex-col gap-1.5 justify-center items-center",
                batteryLevel < 20 && !batteryCharging && "border-red-500/30 bg-red-500/5"
              )}>
                <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Battery</span>
                <div className="flex items-center gap-1.5">
                  <Battery className={cn("w-4 h-4", batteryCharging ? "text-emerald-400" : batteryLevel < 20 ? "text-red-500" : "text-zinc-400")} />
                  <span className={cn("text-xs font-mono font-bold", batteryLevel < 20 && !batteryCharging ? "text-red-500" : "text-zinc-300")}>
                    {Math.round(batteryLevel)}% {batteryCharging && '⚡'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-2 flex flex-col justify-center items-center gap-1.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Network</span>
              <NetworkHealthIndicator onRefreshOrders={onClearCache} className="w-full justify-center !py-1 !text-[10px]" />
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
