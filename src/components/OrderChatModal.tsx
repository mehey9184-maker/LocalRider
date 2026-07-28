import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  X, 
  Phone, 
  Lock, 
  ShieldCheck,
  Zap,
  User,
  Bike,
  Check,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import { DeliveryOrder, OrderChatMessage } from '../types';
import { getSupabase, isSupabaseMocked } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface OrderChatModalProps {
  order: DeliveryOrder;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: 'rider' | 'customer' | 'merchant';
  currentUserId?: string;
  currentUserName?: string;
  currentRiderId?: string;
  currentRiderName?: string;
  isHighContrastMode?: boolean;
}

const RIDER_QUICK_REPLIES = [
  "🛵 I'm outside your gate / house!",
  "🏪 Arrived at shop, picking up your order.",
  "🚀 Food picked up! Navigating to you now.",
  "⏳ Heavy traffic nearby, ETA ~5 mins.",
  "🔔 Please come out to collect your order.",
  "📞 Tried calling, please check your phone!"
];

const CUSTOMER_QUICK_REPLIES = [
  "📍 I'm waiting outside!",
  "🚪 It's the house with the red gate.",
  "📍 Call me when you're at the landmark.",
  "🔔 Please ring doorbell upon arrival.",
  "📦 Please leave at security guard post."
];

const SIMULATED_CUSTOMER_REPLIES = [
  "Awesome, thanks! Gate code is #4092.",
  "I see you on the live map! Coming outside now.",
  "Please leave it at the security guard post.",
  "Could you please ring the doorbell when you arrive?",
  "Got it! Thanks for the update."
];

const SIMULATED_RIDER_REPLIES = [
  "Just arrived at the merchant! Getting your food now.",
  "Order picked up! On my way to your location.",
  "Almost there! I'm about 2 minutes away.",
  "I'm at your building entrance now.",
  "Thanks! See you outside."
];

function generateMessageId(prefix: string = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export const OrderChatModal: React.FC<OrderChatModalProps> = ({
  order,
  isOpen,
  onClose,
  currentUserRole = 'rider',
  currentUserId: propUserId,
  currentUserName: propUserName,
  currentRiderId,
  currentRiderName
}) => {
  const currentUserId = propUserId || currentRiderId || (currentUserRole === 'customer' ? 'cust-1' : 'rider-1');
  const currentUserName = propUserName || currentRiderName;
  const storageKey = `localeats_chat_${order.id}`;

  const resolvedUserName = currentUserName || (currentUserRole === 'rider' ? (order.rider_name || 'Rider') : (order.customer_name || 'Customer'));

  const [messages, setMessages] = useState<OrderChatMessage[]>(() => {
    let cached: OrderChatMessage[] = [];
    try {
      const stored = localStorage.getItem(`localeats_chat_${order.id}`);
      if (stored) {
        cached = JSON.parse(stored);
      }
    } catch {
      /* ignore */
    }
    if (cached.length === 0) {
      const counterpart = currentUserRole === 'customer' ? (order.rider_name || 'Rider') : (order.customer_name || 'Customer');
      return [{
        id: `sys-welcome-${order.id}`,
        order_id: order.id,
        sender_role: 'system',
        sender_id: 'system',
        sender_name: 'LocalEats Secure Relay',
        message: `🔒 Secure Direct Link Established with ${counterpart}. Chat session active during order delivery.`,
        created_at: new Date().toISOString(),
        is_read: true,
        is_delivered: true
      }];
    }
    return cached;
  });

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Active session check: chat is live only during active delivery stages
  const isActiveSession = 
    order.status !== 'completed' && 
    order.status !== 'cancelled' && 
    order.delivery_status !== 'delivered' &&
    order.delivery_status !== 'cancelled';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Mark unread incoming messages as read when modal is open
  const markMessagesAsRead = useCallback((msgArray: OrderChatMessage[]) => {
    let hasUnread = false;
    const updated = msgArray.map(m => {
      if (m.sender_role !== currentUserRole && m.sender_role !== 'system' && !m.is_read) {
        hasUnread = true;
        return { ...m, is_read: true };
      }
      return m;
    });

    if (hasUnread) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
    }
    return updated;
  }, [currentUserRole, storageKey]);

  // Refresh messages manually or on mount
  const handleRefreshMessages = useCallback(async () => {
    setIsRefreshing(true);
    let loadedFromDb = false;

    if (!isSupabaseMocked()) {
      try {
        const { data, error } = await getSupabase()
          .from('order_messages')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          loadedFromDb = true;
          setMessages(prev => {
            const combined = [...prev];
            data.forEach((item: OrderChatMessage) => {
              const idx = combined.findIndex(m => m.id === item.id);
              if (idx === -1) {
                combined.push({ ...item, is_read: true, is_delivered: true });
              } else {
                combined[idx] = { ...combined[idx], ...item, is_read: true };
              }
            });
            combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const marked = markMessagesAsRead(combined);
            return marked;
          });
        }
      } catch (err) {
        console.warn('Refresh error:', err);
      }
    }

    if (!loadedFromDb) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          const marked = markMessagesAsRead(parsed);
          setMessages(marked);
        }
      } catch {
        /* ignore */
      }
    }

    setTimeout(() => {
      setIsRefreshing(false);
      scrollToBottom();
    }, 300);
  }, [order.id, storageKey, markMessagesAsRead, scrollToBottom]);

  // Sync Supabase messages, subscribe to Realtime channel & localStorage storage events
  useEffect(() => {
    if (!isOpen) return;

    // Local Storage & Custom Multi-Tab/Same-Window listener
    const syncFromLocalStorage = () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: OrderChatMessage[] = JSON.parse(stored);
          setMessages(prev => {
            if (JSON.stringify(prev) === stored) return prev;
            return markMessagesAsRead(parsed);
          });
          setTimeout(scrollToBottom, 50);
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('storage', syncFromLocalStorage);
    window.addEventListener('localeats_chat_update', syncFromLocalStorage);

    // Periodic check interval while modal is open (guarantees real-time sync across client/rider apps)
    const interval = setInterval(syncFromLocalStorage, 1500);

    // Async setup microtask
    queueMicrotask(() => {
      setConnectionStatus('connecting');
      setMessages(prev => markMessagesAsRead(prev));
      handleRefreshMessages();
    });

    // Setup Realtime Broadcast & Postgres Subscriptions with status tracking
    const supabase = getSupabase();
    const channelName = `order_chat_${order.id}`;

    if (isSupabaseMocked()) {
      const timer = setTimeout(() => setConnectionStatus('online'), 200);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        window.removeEventListener('storage', syncFromLocalStorage);
        window.removeEventListener('localeats_chat_update', syncFromLocalStorage);
      };
    }
    
    const realtimeChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const incomingMsg = payload.payload as OrderChatMessage;
        if (incomingMsg && incomingMsg.order_id === order.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === incomingMsg.id)) return prev;
            const updated = [...prev, {
              ...incomingMsg,
              is_read: true,
              is_delivered: true
            }];
            try {
              localStorage.setItem(storageKey, JSON.stringify(updated));
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('localeats_chat_update', { detail: { orderId: order.id } }));
            } catch {
              /* ignore */
            }
            return updated;
          });
          setTimeout(scrollToBottom, 100);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${order.id}`
      }, (payload) => {
        const incomingMsg = payload.new as OrderChatMessage;
        if (incomingMsg && incomingMsg.order_id === order.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === incomingMsg.id)) return prev;
            const updated = [...prev, {
              ...incomingMsg,
              is_read: true,
              is_delivered: true
            }];
            try {
              localStorage.setItem(storageKey, JSON.stringify(updated));
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('localeats_chat_update', { detail: { orderId: order.id } }));
            } catch {
              /* ignore */
            }
            return updated;
          });
          setTimeout(scrollToBottom, 100);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('online');
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('offline');
        } else {
          setConnectionStatus('connecting');
        }
      });

    channelRef.current = realtimeChannel;

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', syncFromLocalStorage);
      window.removeEventListener('localeats_chat_update', syncFromLocalStorage);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOpen, order.id, storageKey, markMessagesAsRead, handleRefreshMessages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || !isActiveSession) return;

    setIsSending(true);
    const isQuick = Boolean(textToSend);

    const newMsg: OrderChatMessage = {
      id: generateMessageId('msg'),
      order_id: order.id,
      sender_role: currentUserRole as 'rider' | 'customer' | 'merchant',
      sender_id: currentUserId,
      sender_name: resolvedUserName,
      message: content,
      created_at: new Date().toISOString(),
      is_quick_reply: isQuick,
      is_delivered: true,
      is_read: false
    };

    // Optimistic UI Update & Storage Dispatch
    setMessages(prev => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('localeats_chat_update', { detail: { orderId: order.id, message: newMsg } }));
      } catch {
        /* ignore */
      }
      return updated;
    });

    if (!textToSend) setInputText('');
    setIsSending(false);
    setTimeout(scrollToBottom, 50);

    // 1. Broadcast Realtime Message via Subscribed Channel
    try {
      const ch = channelRef.current || getSupabase().channel(`order_chat_${order.id}`);
      ch.send({
        type: 'broadcast',
        event: 'new_message',
        payload: newMsg
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    // 2. Try DB Insert
    if (!isSupabaseMocked()) {
      try {
        await getSupabase().from('order_messages').insert({
          id: newMsg.id,
          order_id: newMsg.order_id,
          sender_role: newMsg.sender_role,
          sender_id: newMsg.sender_id,
          sender_name: newMsg.sender_name,
          message: newMsg.message,
          created_at: newMsg.created_at
        });
      } catch (err) {
        console.info('DB save info:', err);
      }
    }

    // Auto-Simulate polite customer/rider response after short delay if in single tab/demo mode
    setTimeout(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsedArr: OrderChatMessage[] = JSON.parse(stored);
          const lastMsg = parsedArr[parsedArr.length - 1];
          // If the last message is still our message (meaning counterpart hasn't replied yet), trigger automated counterpart response
          if (lastMsg && lastMsg.id === newMsg.id) {
            handleSimulateReply();
          }
        }
      } catch {
        /* ignore */
      }
    }, 2200);
  };

  const handleSimulateReply = useCallback(() => {
    const isTargetingRider = currentUserRole === 'customer';
    const repliesList = isTargetingRider ? SIMULATED_RIDER_REPLIES : SIMULATED_CUSTOMER_REPLIES;
    const randomIndex = Math.floor(Math.random() * repliesList.length);
    const randomReply = repliesList[randomIndex];
    
    const simRole: 'rider' | 'customer' = isTargetingRider ? 'rider' : 'customer';
    const simName = isTargetingRider ? (order.rider_name || 'Rider') : (order.customer_name || 'Customer');

    const simMsg: OrderChatMessage = {
      id: generateMessageId('sim-msg'),
      order_id: order.id,
      sender_role: simRole,
      sender_id: `sim-${simRole}`,
      sender_name: simName,
      message: randomReply,
      created_at: new Date().toISOString(),
      is_delivered: true,
      is_read: true
    };

    setMessages(prev => {
      // Mark all sent messages before this reply as read by the other party!
      const updated = prev.map(m => m.sender_role === currentUserRole ? { ...m, is_read: true } : m);
      updated.push(simMsg);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('localeats_chat_update', { detail: { orderId: order.id, message: simMsg } }));
      } catch {
        /* ignore */
      }
      return updated;
    });

    // Broadcast to realtime channel
    try {
      const ch = channelRef.current || getSupabase().channel(`order_chat_${order.id}`);
      ch.send({
        type: 'broadcast',
        event: 'new_message',
        payload: simMsg
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    toast.info(`Message from ${simName}: "${randomReply}"`);
    setTimeout(scrollToBottom, 100);
  }, [currentUserRole, order.rider_name, order.customer_name, order.id, storageKey, scrollToBottom]);

  if (!isOpen) return null;

  const quickReplies = currentUserRole === 'customer' ? CUSTOMER_QUICK_REPLIES : RIDER_QUICK_REPLIES;
  const headerTitle = currentUserRole === 'customer' 
    ? (order.rider_name ? `Rider ${order.rider_name}` : 'Assigned Rider')
    : (order.customer_name || 'Customer');

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md pointer-events-auto relative"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="w-full sm:max-w-lg h-[92vh] sm:h-[650px] bg-zinc-950 border border-zinc-800/80 rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden font-sans pointer-events-auto relative z-10"
        >
          {/* Header Bar */}
          <div 
            className="p-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0 pointer-events-auto relative z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center shrink-0">
                {currentUserRole === 'customer' ? (
                  <Bike className="w-5 h-5 text-[#f59e0b]" />
                ) : (
                  <User className="w-5 h-5 text-[#f59e0b]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white truncate">
                    {headerTitle}
                  </h3>

                  {/* Connection Status Badge */}
                  {connectionStatus === 'online' ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/30 text-[8px] font-black text-[#39FF14] uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                      Online
                    </span>
                  ) : connectionStatus === 'connecting' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[8px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      Connecting...
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-[8px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Offline
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 font-mono truncate">
                  Order #{order.id.slice(-6).toUpperCase()} • {order.product_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto relative z-30">
              {/* Refresh Messages Fallback Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshMessages();
                }}
                disabled={isRefreshing}
                className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/60 transition-colors flex items-center justify-center cursor-pointer pointer-events-auto"
                title="Refresh Messages Sync"
              >
                <RefreshCw className={`w-4 h-4 text-[#f59e0b] ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {order.phone && currentUserRole === 'rider' && (
                <a
                  href={`tel:${order.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/60 transition-colors flex items-center justify-center pointer-events-auto"
                  title="Call Customer"
                >
                  <Phone className="w-4 h-4 text-[#f59e0b]" />
                </a>
              )}
              {order.rider_phone && currentUserRole === 'customer' && (
                <a
                  href={`tel:${order.rider_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/60 transition-colors flex items-center justify-center pointer-events-auto"
                  title="Call Rider"
                >
                  <Phone className="w-4 h-4 text-[#f59e0b]" />
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl border border-zinc-700/60 transition-colors cursor-pointer pointer-events-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Archived Warning Banner if completed */}
          {!isActiveSession && (
            <div className="bg-amber-950/40 border-b border-amber-900/50 px-4 py-2 flex items-center gap-2 text-[10px] text-amber-300 font-mono pointer-events-auto relative z-20 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Order completed. This session is locked for privacy.</span>
            </div>
          )}

          {/* Messages Feed */}
          <div 
            className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#08080a] pointer-events-auto relative z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {messages.map((msg) => {
              const isSelf = msg.sender_role === currentUserRole;
              const isSystem = msg.sender_role === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2 pointer-events-auto">
                    <div className="max-w-[90%] bg-zinc-900/80 border border-zinc-800 rounded-2xl px-3 py-1.5 text-[10px] text-zinc-400 text-center font-mono flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#f59e0b] shrink-0" />
                      <span>{msg.message}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} pointer-events-auto`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                      {isSelf ? 'You' : (msg.sender_name || (msg.sender_role === 'rider' ? 'Rider' : 'Customer'))}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed relative ${
                      isSelf
                        ? 'bg-[#f59e0b] text-zinc-950 font-medium rounded-tr-none shadow-md shadow-[#f59e0b]/10'
                        : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none'
                    }`}
                  >
                    <span>{msg.message}</span>

                    {/* Read / Delivered Status Indicator for Sent Messages */}
                    {isSelf && (
                      <span className="inline-flex items-center ml-1.5 text-zinc-900/80 align-bottom" title={msg.is_read ? 'Read' : 'Delivered'}>
                        {msg.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-900 font-bold" />
                        ) : msg.is_delivered ? (
                          <CheckCheck className="w-3.5 h-3.5 text-zinc-800/80" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-zinc-800/80" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Bar (Only when active) */}
          {isActiveSession && (
            <div 
              className="p-2 bg-zinc-950 border-t border-zinc-900 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2 pointer-events-auto relative z-20 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider pl-2 shrink-0 flex items-center gap-1 font-mono">
                <Zap className="w-3 h-3 text-[#f59e0b]" /> Quick Tap:
              </span>
              {quickReplies.map((replyText, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    sendMessage(replyText);
                  }}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 hover:text-white text-[11px] font-medium rounded-xl border border-zinc-800 transition-all shrink-0 cursor-pointer pointer-events-auto"
                >
                  {replyText}
                </button>
              ))}
            </div>
          )}

          {/* Input Controls */}
          {isActiveSession ? (
            <div 
              className="p-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-2 shrink-0 pointer-events-auto relative z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') sendMessage();
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder={currentUserRole === 'customer' ? "Message rider..." : "Message customer..."}
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-[#f59e0b] text-white placeholder-zinc-500 text-xs px-4 py-3 rounded-xl outline-none transition-colors pointer-events-auto relative z-30 cursor-text select-text"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage();
                }}
                disabled={!inputText.trim() || isSending}
                className="p-3 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-40 disabled:hover:bg-[#f59e0b] text-zinc-950 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 pointer-events-auto relative z-30"
              >
                <Send className="w-4 h-4" />
              </button>

              {/* Simulation Helper for Demo / Testing */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSimulateReply();
                }}
                title={currentUserRole === 'customer' ? "Simulate Rider Reply" : "Simulate Customer Reply"}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-[#f59e0b] rounded-xl border border-zinc-700/60 transition-colors text-[10px] font-black uppercase font-mono shrink-0 cursor-pointer pointer-events-auto relative z-30"
              >
                {currentUserRole === 'customer' ? 'Sim Rider' : 'Sim Customer'}
              </button>
            </div>
          ) : (
            <div className="p-4 bg-zinc-950 border-t border-zinc-900 text-center pointer-events-auto relative z-20">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                Chat closed • Order session ended
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
