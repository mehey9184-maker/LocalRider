import React from 'react';
import { ShoppingBag, ShieldCheck, SlidersHorizontal, ArrowRight, Store } from 'lucide-react';
import { cn } from '../lib/utils';
import { DeliveryOrder } from '../types';

interface ToggleConfig {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  onToggle: () => void;
  activeLabel: string;
  inactiveLabel: string;
  activeTheme?: 'emerald' | 'cyan' | 'amber';
}

const UI_THEMES = {
  emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.15)] animate-pulse",
  amber: "bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  inactive: "bg-zinc-800/80 text-zinc-400 border-zinc-700/80 hover:bg-zinc-800",
  inactiveRed: "bg-red-500/15 text-red-400 border-red-500/30 w-full hover:bg-red-500/20"
};

// Pure Component Strategy for Setting Toggles (DRY Enforcement)
const PolicyToggle = React.memo(({ config }: { config: ToggleConfig }) => {
  const activeStyles = UI_THEMES[config.activeTheme || 'emerald'];
  // Custom inactive fallback if strictly enforcing Red-disabled polarity vs Neutral
  const inactiveStyles = config.activeTheme ? UI_THEMES.inactive : UI_THEMES.inactiveRed; 
  
  return (
    <div className="space-y-3 bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 transition-all hover:border-zinc-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-white font-mono">{config.title}</span>
          <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2 sm:line-clamp-none">{config.description}</p>
        </div>
        <button
          id={config.id}
          onClick={config.onToggle}
          className={cn(
            "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all font-mono whitespace-nowrap border active:scale-95",
            config.isActive ? activeStyles : inactiveStyles
          )}
        >
          {config.isActive ? config.activeLabel : config.inactiveLabel}
        </button>
      </div>
    </div>
  );
});

export interface MerchantPortalProps {
  allowExternal: boolean;
  onToggleAllowExternal: () => void;
  cashTrust: boolean;
  onToggleCashTrust: () => void;
  autoLook: boolean;
  onToggleAutoLook: () => void;
  dispatchToMarketplace: Record<string, boolean>;
  onToggleDispatch: (orderId: string) => void;
  regionGreeting?: string;
  mockOrders?: DeliveryOrder[];
}

export const MerchantPortal = React.memo(({
  allowExternal,
  onToggleAllowExternal,
  cashTrust,
  onToggleCashTrust,
  autoLook,
  onToggleAutoLook,
  dispatchToMarketplace,
  onToggleDispatch,
  regionGreeting = "Welcome, Merchant",
  mockOrders = []
}: MerchantPortalProps) => {

  const policyConfigs: ToggleConfig[] = React.useMemo(() => [
    {
      id: "toggle-external-riders-btn",
      title: "Allow Public Marketplace Riders",
      description: "When disabled, only matched private in-house fleets can deliver.",
      isActive: allowExternal,
      onToggle: onToggleAllowExternal,
      activeLabel: "ENABLED (Public)",
      inactiveLabel: "DISABLED (Private)"
    },
    {
      id: "toggle-cash-trust-btn",
      title: "Cash Trust (COD) Shield",
      description: "Force green COD warnings on public cards for cash-returning orders.",
      isActive: cashTrust,
      onToggle: onToggleCashTrust,
      activeLabel: "ACTIVE (FLAG ON)",
      inactiveLabel: "INACTIVE (FLAG OFF)",
      activeTheme: 'emerald'
    },
    {
      id: "toggle-auto-look-btn",
      title: "Auto-Look For Rider Signal",
      description: "Broadcast active pulsing visual beacons for instant public rider claims.",
      isActive: autoLook,
      onToggle: onToggleAutoLook,
      activeLabel: "ACTIVE (RADAR PULSING)",
      inactiveLabel: "INACTIVE",
      activeTheme: 'cyan'
    }
  ], [allowExternal, onToggleAllowExternal, cashTrust, onToggleCashTrust, autoLook, onToggleAutoLook]);

  return (
    <div className="px-3 xs:px-4 sm:px-6 py-4 xs:py-6 space-y-6 pb-28 xs:pb-32 sm:pb-36 max-w-5xl mx-auto w-full">
      <header className="flex flex-col gap-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.15)] animate-pulse">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f59e0b] mb-1">{regionGreeting}</span>
            <h1 className="text-4xl font-headline font-black italic uppercase tracking-tighter text-white font-headline -mt-1">Merchant Portal</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Simulate and coordinate storefront-to-rider dispatch protocols</p>
          </div>
        </div>
      </header>

      {/* Manual Storefront Coordination Protocol Banner */}
      <div className="bg-zinc-900/40 border border-zinc-850 rounded-[2rem] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 font-headline italic">Manual Storefront Coordination Protocol</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed font-semibold">
              If freelance dispatch matches are restricted, a rider's physical storefront presence allows them to instantly pair or link connection slots with merchant terminals.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Merchant Global Policies */}
        <section className="p-6 space-y-6 border border-zinc-900/50 bg-zinc-900/20 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-2 mb-2 relative">
            <SlidersHorizontal className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-headline font-black italic uppercase text-white font-headline">Global Dispatch Policies</h3>
          </div>

          <div className="space-y-4 relative">
             {policyConfigs.map(config => (
               <PolicyToggle key={config.id} config={config} />
             ))}
          </div>
        </section>

        {/* Section 2: Order-Level Marketplace Dispatch Override Controls */}
        <section className="p-6 space-y-6 border border-zinc-900/50 bg-zinc-900/20 rounded-3xl relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex items-start gap-2 mb-2 relative">
            <Store className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-headline font-black italic uppercase text-white font-headline">Storefront Orders (Pending)</h3>
              <p className="text-[10px] text-zinc-500 font-sans mt-1">
                Below are unassigned storefront orders. When global marketplace access is off, individually manual dispatch to marketplace as on-demand backup dispatch instantly:
              </p>
            </div>
          </div>

          <div className="space-y-3 relative">
            {mockOrders.length === 0 ? (
               <div className="p-6 text-center border border-dashed border-zinc-800 rounded-2xl">
                 <p className="text-lg font-black text-zinc-600">No Pending Orders</p>
               </div>
            ) : mockOrders.map(ord => (
              <div key={ord.id} className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white border border-zinc-800 font-black font-mono text-[10px]">
                    #{ord.id.slice(-4)}
                  </div>
                  <div>
                    <span className="text-xs font-black text-white font-mono">{ord.customer_name}</span>
                    <span className="text-[9px] text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded font-black tracking-widest ml-2 uppercase">Pending</span>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 opacity-80">{ord.address}</p>
                  </div>
                </div>
                
                <button
                  id={`toggle-dispatch-btn-${ord.id}`}
                  onClick={() => onToggleDispatch(ord.id)}
                  disabled={allowExternal}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border shrink-0 text-center flex sm:inline-flex items-center justify-center gap-2",
                    allowExternal ? "opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-600 border-zinc-800" :
                    dispatchToMarketplace[ord.id]
                      ? "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 active:scale-95"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750 active:scale-95"
                  )}
                >
                  {dispatchToMarketplace[ord.id] ? "ON MARKETPLACE" : (<>DISPATCH BACKUP ROUTE <ArrowRight className="w-3 h-3" /></>)}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
          Toggle the Global Policies or dispatch backups above to test immediate feed visibility logic!
        </p>
      </div>
    </div>
  );
});
