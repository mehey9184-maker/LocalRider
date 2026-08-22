import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Globe, 
  Flame, 
  CheckCircle, 
  Plus,
  MessageSquare
} from 'lucide-react';
import { DeliveryOrder } from '../types';
import { cn } from '../lib/utils';
import { formatOrderItem } from '../lib/appUtils';
import { BentoCard } from './BentoCard';
import { OrderChatModal } from './OrderChatModal';

interface CustomerViewProps {
  simulatedOrders: DeliveryOrder[];
  dispatchLog: string[];
  dispatchState: Record<string, {
    stage: 'idle' | 'notifying_rider1' | 'rider1_deciding' | 'rider1_declined' | 'notifying_rider2' | 'rider2_deciding' | 'accepted' | 'preparing';
    rider1Timer: number;
    rider2Timer: number;
  }>;
  onPlaceOrder: (type: 'kota' | 'braai') => void;
  onForceDeclineRider1: (orderId: string) => void;
  onForceAcceptRider1: (orderId: string) => void;
  onForceAcceptRider2: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
}

export const CustomerView = ({
  simulatedOrders,
  dispatchLog,
  dispatchState,
  onPlaceOrder,
  onForceDeclineRider1,
  onForceAcceptRider1,
  onForceAcceptRider2,
  onCancelOrder
}: CustomerViewProps) => {
  const [activeChatOrder, setActiveChatOrder] = useState<DeliveryOrder | null>(null);
  const activeFindingOrder = simulatedOrders.find(o => o.delivery_status === 'finding_rider');
  const activePreparingOrder = simulatedOrders.find(o => o.status === 'preparing' || o.status === 'accepted');

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 pb-24">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black italic uppercase text-white tracking-tight">
            LocalEats SA Customer Portal
          </h2>
          <p className="text-xs text-zinc-400 font-medium">Place real-time orders & witness automated logistics routing</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
          <Globe className="w-3.5 h-3.5 animate-spin" /> Live Network
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hand: Menu Grid */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Traditional Ivory Park Menu</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kota Menu Item */}
            <BentoCard className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 p-5 flex flex-col justify-between" glow>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1 px-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider">
                    Most Popular
                  </span>
                  <span className="text-lg font-headline font-black text-white">R65.00</span>
                </div>
                <h4 className="text-base font-black text-white uppercase tracking-tight">Classic Tembisa Kota</h4>
                <p className="text-[11px] text-zinc-400 font-sans mt-2 leading-relaxed">
                  The ultimate local street food. Quarter loaf hollowed out and layered with hot golden chips, melted cheddar cheese, fried polony, egg, and our signature sweet-tangy house sauce.
                </p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-full">🔥 Hot & Fresh</span>
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-full">⚡ Street Food</span>
                </div>
              </div>
              
              <button
                onClick={() => onPlaceOrder('kota')}
                disabled={!!activeFindingOrder}
                className={cn(
                  "w-full min-h-[44px] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-transparent text-black font-black uppercase tracking-widest text-fluid-xs rounded-xl mt-6 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-target",
                  activeFindingOrder && "cursor-not-allowed"
                )}
              >
                <Plus className="icon-responsive-sm" /> Order Kota
              </button>
            </BentoCard>

            {/* Braai Menu Item */}
            <BentoCard className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 p-5 flex flex-col justify-between" glow>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="p-1 px-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-black uppercase tracking-wider">
                    Premium Cut
                  </span>
                  <span className="text-lg font-headline font-black text-white">R120.00</span>
                </div>
                <h4 className="text-base font-black text-white uppercase tracking-tight">Shisanyama Braai Plate</h4>
                <p className="text-[11px] text-zinc-400 font-sans mt-2 leading-relaxed">
                  Authentic flame-grilled feast. Sizzling beef brisket, juicy boerewors sausage, traditional chakalaka relish, hot pap porridge, and a fresh side salad, topped with local garlic-herb sauce.
                </p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-full">🥩 Flame Grilled</span>
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded-full">🥗 Feast</span>
                </div>
              </div>
              
              <button
                onClick={() => onPlaceOrder('braai')}
                disabled={!!activeFindingOrder}
                className={cn(
                  "w-full min-h-[44px] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-transparent text-black font-black uppercase tracking-widest text-fluid-xs rounded-xl mt-6 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-target",
                  activeFindingOrder && "cursor-not-allowed"
                )}
              >
                <Plus className="icon-responsive-sm" /> Order Braai Plate
              </button>
            </BentoCard>
          </div>

          {/* Active Orders List */}
          {simulatedOrders.length > 0 && (
            <div className="space-y-3 mt-6">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Order History</h4>
              <div className="space-y-2">
                {simulatedOrders.map(order => {
                  const prodTitle = formatOrderItem(order.product_name || (order.items && order.items[0])) || 'Order Payload';
                  return (
                  <div key={order.id} className="bg-zinc-900 border border-zinc-800/60 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-lg border border-zinc-800">
                        {prodTitle.includes('Kota') ? '🍔' : '🥩'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white uppercase">{prodTitle}</span>
                          <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono",
                            order.status === 'preparing' ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                            order.delivery_status === 'finding_rider' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          )}>
                            {order.status === 'preparing' ? 'In Kitchen (Preparing)' :
                             order.delivery_status === 'finding_rider' ? 'Finding Rider' :
                             'Delivered'}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">
                          Ordered at {new Date(order.created_at).toLocaleTimeString()} • {order.restaurant_name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="text-xs font-black text-white">R{order.total_price.toFixed(2)}</p>
                      
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => setActiveChatOrder(order)}
                          className="px-2.5 py-1 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-[#f59e0b]/20"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Chat with Rider
                        </button>
                      )}

                      {order.delivery_status === 'finding_rider' && (
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase mt-0.5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {activeChatOrder && (
            <OrderChatModal
              order={activeChatOrder}
              isOpen={Boolean(activeChatOrder)}
              onClose={() => setActiveChatOrder(null)}
              currentUserRole="customer"
              currentUserName={activeChatOrder.customer_name || 'Customer'}
            />
          )}
        </div>

        {/* Right Hand: Real-time Dispatch Logistics Terminal */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">System Backend Dispatch Logs</h3>
          
          <BentoCard className="bg-zinc-950 border-zinc-850 p-5 flex flex-col justify-between h-[450px]">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-[9px] font-mono font-black text-zinc-400 uppercase tracking-widest">
                      LOGISTICS TELEMETRY FEED
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600">Ivory Park Core v4.1</span>
                </div>

                {/* Dispatch Stages & Timers Visual */}
                {activeFindingOrder && (
                  <div className="mb-4 bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-400 uppercase">Routing Status</span>
                      <span className="text-[9px] font-black uppercase text-[#f59e0b] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        DISPATCHING RIDER
                      </span>
                    </div>

                    {/* Steps visual flow */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[8px] font-mono font-bold uppercase">
                      <div className={cn(
                        "p-1.5 rounded border transition-all",
                        dispatchState[activeFindingOrder.id]?.stage === 'notifying_rider1' || dispatchState[activeFindingOrder.id]?.stage === 'rider1_deciding'
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : dispatchState[activeFindingOrder.id]?.stage === 'rider1_declined' || dispatchState[activeFindingOrder.id]?.rider1Timer === 0
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : "bg-zinc-900 border-zinc-850 text-zinc-600"
                      )}>
                        Rider 1 (Thabo)
                        {dispatchState[activeFindingOrder.id]?.stage === 'rider1_deciding' && ` (${dispatchState[activeFindingOrder.id].rider1Timer}s)`}
                      </div>
                      <div className={cn(
                        "p-1.5 rounded border transition-all",
                        dispatchState[activeFindingOrder.id]?.stage === 'notifying_rider2' || dispatchState[activeFindingOrder.id]?.stage === 'rider2_deciding'
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse"
                          : "bg-zinc-900 border-zinc-850 text-zinc-600"
                      )}>
                        Rider 2 (You)
                        {dispatchState[activeFindingOrder.id]?.stage === 'rider2_deciding' && ` (${dispatchState[activeFindingOrder.id].rider2Timer}s)`}
                      </div>
                      <div className={cn(
                        "p-1.5 rounded border transition-all",
                        dispatchState[activeFindingOrder.id]?.stage === 'accepted' || dispatchState[activeFindingOrder.id]?.stage === 'preparing'
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-zinc-900 border-zinc-850 text-zinc-600"
                      )}>
                        Sipho / Final
                      </div>
                    </div>

                    {/* Action Panel within log to test declination instantly */}
                    {dispatchState[activeFindingOrder.id]?.stage === 'rider1_deciding' && (
                      <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5">
                        <p className="text-[9px] text-zinc-400 font-sans text-center">
                          Rider 1 (Thabo - 0.8km away) has received the push notification. You can wait for him to time out, or force a decline.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onForceDeclineRider1(activeFindingOrder.id)}
                            className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-black text-[8px] uppercase tracking-wider rounded-md cursor-pointer"
                          >
                            Force Rider 1 Decline
                          </button>
                          <button
                            onClick={() => onForceAcceptRider1(activeFindingOrder.id)}
                            className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-black text-[8px] uppercase tracking-wider rounded-md cursor-pointer"
                          >
                            Force Rider 1 Accept
                          </button>
                        </div>
                      </div>
                    )}

                    {dispatchState[activeFindingOrder.id]?.stage === 'rider2_deciding' && (
                      <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5">
                        <p className="text-[9px] text-zinc-400 font-sans text-center">
                          Ping has bypassed Rider 1! It is now waiting for You (Logged-in Rider) to accept from the main feed, or you can force Sipho (next closest) to accept.
                        </p>
                        <button
                          onClick={() => onForceAcceptRider2(activeFindingOrder.id)}
                          className="w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-black text-[8px] uppercase tracking-wider rounded-md cursor-pointer"
                        >
                          Simulate Sipho (Rider 2) Accept
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AnimatedSkillet showing when meal is being prepared */}
                {activePreparingOrder && (
                  <div className="mb-4 bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl text-center space-y-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Flame className="w-5 h-5 text-emerald-400 animate-bounce" />
                      <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Chef is preparing order #{activePreparingOrder.id.slice(-4)}!</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                      Rider <strong>{activePreparingOrder.rider_name || "Sipho"}</strong> has accepted the order and is heading to the store. The kitchen has begun preparing the meal!
                    </p>
                  </div>
                )}
              </div>

              {/* Log Feed */}
              <div className="flex-1 overflow-y-auto mt-2 max-h-[220px] scrollbar-thin bg-zinc-900/50 rounded-xl p-3 border border-zinc-900 text-left font-mono text-[9.5px] leading-relaxed text-zinc-400 space-y-1.5">
                {dispatchLog.map((log, index) => (
                  <div key={index} className="border-b border-zinc-950/50 pb-1 last:border-0">
                    <span className="text-zinc-650">{log.substring(0, 10)}</span>
                    <span className="text-zinc-300">{log.substring(10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
};


interface MerchantDashboardProps {
  simulatedOrders: DeliveryOrder[];
  inHouseToggles: Record<string, boolean>;
  onToggleInHouse: (orderId: string, enabled: boolean) => void;
  onUpdateStatus: (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'completed') => void;
}

export const MerchantDashboard = ({
  simulatedOrders,
  inHouseToggles,
  onToggleInHouse,
  onUpdateStatus
}: MerchantDashboardProps) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 pb-24">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black italic uppercase text-white tracking-tight">
            LocalEats SA Merchant Dashboard
          </h2>
          <p className="text-xs text-zinc-400 font-medium font-sans">Sizwe Kota House & Traditional Kitchen Management</p>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full text-[10px] text-blue-400 font-bold uppercase tracking-widest">
          <ShoppingBag className="w-3.5 h-3.5" /> Merchant Portal
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Core Order Prep & Dispatch Panel */}
        <BentoCard className="bg-zinc-950 border-zinc-850 p-6">
          <div className="flex items-center justify-between mb-6 border-b border-zinc-900 pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Kitchen Order Dispatch Queue</h3>
              <p className="text-[11px] text-zinc-500 font-sans mt-1">Mark orders for In-House Shop Delivery to bypass public rider dispatching</p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              Active Store ID: <strong className="text-white font-black">s1</strong>
            </span>
          </div>

          {simulatedOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto text-[#f59e0b]">
                🍳
              </div>
              <h4 className="text-sm font-black text-white uppercase font-mono tracking-widest">Kitchen is Empty</h4>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                No orders are active right now. Switch to the <strong>Customer UI</strong> tab to place a Kota or Braai order!
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              {simulatedOrders.map(order => {
                const isInHouse = inHouseToggles[order.id] || false;
                
                return (
                  <div 
                    key={order.id} 
                    className="bg-zinc-900/60 border border-zinc-850 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
                  >
                    {/* Item and details */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white uppercase">{formatOrderItem(order.product_name || (order.items && order.items[0])) || 'Order Items'}</span>
                        <span className="text-[9px] font-mono font-bold text-zinc-500">#{order.id.slice(-4).toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-sans">
                        <span>Customer: {order.customer_name}</span>
                        <span>•</span>
                        <span>R{order.total_price.toFixed(2)}</span>
                      </div>
                      <div className="text-[9px] text-zinc-500 font-mono mt-1">
                        Ordered: {new Date(order.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    {/* In-house toggle */}
                    <div className="md:col-span-4 bg-zinc-950 p-3 rounded-xl border border-zinc-850 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                          🏪 In-House Delivery
                        </span>
                        <p className="text-[8px] text-zinc-550 leading-tight font-sans">
                          Assign private shop driver. Blocks public riders from intercepting.
                        </p>
                      </div>
                      
                      <button
                        onClick={() => onToggleInHouse(order.id, !isInHouse)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                          isInHouse 
                            ? "bg-[#f59e0b] border-[#f59e0b] text-black shadow-[0_0_10px_rgba(245,158,11,0.25)]" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {isInHouse ? "In-House ON" : "In-House OFF"}
                      </button>
                    </div>

                    {/* Dispatch status & control action */}
                    <div className="md:col-span-4 flex flex-col md:items-end gap-2 text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-medium">Status:</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded border font-mono",
                          order.status === 'preparing' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                          order.delivery_status === 'finding_rider' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}>
                          {order.status === 'preparing' ? 'Preparing (Kitchen)' :
                           order.delivery_status === 'finding_rider' ? 'Finding Rider' :
                           'Ready for Pickup'}
                        </span>
                      </div>

                      <div className="flex gap-1.5 w-full md:w-auto">
                        {order.delivery_status === 'finding_rider' && !isInHouse && (
                          <div className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
                            📡 Dispatching active riders...
                          </div>
                        )}

                        {order.status === 'preparing' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'ready')}
                            className="w-full md:w-auto px-4 py-2 bg-emerald-500 text-black font-black uppercase tracking-widest text-[8px] rounded-lg cursor-pointer hover:bg-emerald-600 transition-all"
                          >
                            Mark as Ready for Pickup
                          </button>
                        )}

                        {order.status === 'ready' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'completed')}
                            className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white font-black uppercase tracking-widest text-[8px] rounded-lg cursor-pointer hover:bg-blue-700 transition-all flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Complete Delivery
                          </button>
                        )}
                      </div>

                      {order.rider_name && (
                        <div className="text-[9px] text-zinc-500 font-sans mt-0.5">
                          Rider assigned: <strong className="text-zinc-350">{order.rider_name}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  );
};
