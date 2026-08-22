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
import { getSupabase, getFreshChannel, isSupabaseMocked } from '../lib/supabase';
import { formatOrderItem } from '../lib/appUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

function generateMessageId(prefix: string = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Strict Message Deduplicator
function dedupeMessages(msgs: OrderChatMessage[]): OrderChatMessage[] {
  const seen = new Set<string>();
  const result: OrderChatMessage[] = [];
  for (const m of msgs) {
    if (!m || !m.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    result.push(m);
  }
  return result;
}

// Universal Schema Normalizer to resolve field dissonance across Client and Rider payloads
function normalizeChatMessage(raw: Record<string, unknown> | null | undefined, fallbackOrderId: string): OrderChatMessage {
  if (!raw) {
    return {
      id: generateMessageId('msg'),
      order_id: fallbackOrderId,
      sender_role: 'system',
      sender_id: 'system',
      sender_name: 'LocalEats Relay',
      message: '',
      created_at: new Date().toISOString(),
      is_read: true,
      is_delivered: true
    };
  }

  const messageText = 
    (raw.message as string) || 
    (raw.message_text as string) || 
    (raw.content as string) || 
    (raw.text as string) || 
    '';

  const rawRole = String(
    raw.sender_role || 
    raw.sender_type || 
    raw.role || 
    raw.user_role || 
    ''
  ).toLowerCase().trim();

  let senderRole: 'rider' | 'customer' | 'merchant' | 'system';
  if (rawRole === 'customer' || rawRole === 'client' || rawRole === 'user') {
    senderRole = 'customer';
  } else if (rawRole === 'rider' || rawRole === 'driver') {
    senderRole = 'rider';
  } else if (rawRole === 'shop' || rawRole === 'merchant' || rawRole === 'store') {
    senderRole = 'merchant';
  } else if (rawRole === 'system') {
    senderRole = 'system';
  } else {
    // Default to customer if missing
    senderRole = 'customer';
  }

  const senderId = 
    (raw.sender_id as string) || 
    (raw.user_id as string) || 
    (raw.author_id as string) || 
    'unknown';

  const senderName = 
    (raw.sender_name as string) || 
    (raw.user_name as string) || 
    (raw.author_name as string) || 
    (senderRole === 'rider' ? 'Rider' : senderRole === 'customer' ? 'Customer' : senderRole === 'merchant' ? 'Shop' : 'System');

  return {
    id: String(raw.id || generateMessageId('msg')),
    order_id: String(raw.order_id || raw.orderId || fallbackOrderId),
    sender_role: senderRole,
    sender_id: String(senderId),
    sender_name: senderName,
    message: String(messageText),
    created_at: (raw.created_at as string) || (raw.createdAt as string) || (raw.timestamp as string) || new Date().toISOString(),
    is_quick_reply: Boolean(raw.is_quick_reply || raw.isQuickReply),
    is_read: Boolean(raw.is_read || raw.isRead),
    is_delivered: raw.is_delivered !== undefined ? Boolean(raw.is_delivered) : true
  };
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
  const [isCounterpartTyping, setIsCounterpartTyping] = useState(false);
  const counterpartTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Refresh messages manually or on mount with universal normalization & deduplication across both chat_messages and order_messages
  const handleRefreshMessages = useCallback(async () => {
    setIsRefreshing(true);
    let loadedFromDb = false;

    if (!isSupabaseMocked()) {
      try {
        const supabase = getSupabase();
        
        const fetchChat = async () => {
          try {
            const res = await supabase
              .from('chat_messages')
              .select('*')
              .eq('order_id', order.id)
              .order('created_at', { ascending: true });
            return (res.data || []) as Record<string, unknown>[];
          } catch {
            return [] as Record<string, unknown>[];
          }
        };

        const fetchOrderMsg = async () => {
          try {
            const res = await supabase
              .from('order_messages')
              .select('*')
              .eq('order_id', order.id)
              .order('created_at', { ascending: true });
            return (res.data || []) as Record<string, unknown>[];
          } catch {
            return [] as Record<string, unknown>[];
          }
        };

        const fetchRiderChatMsg = async () => {
          try {
            const res = await supabase
              .from('rider_chat_messages')
              .select('*')
              .eq('order_id', order.id)
              .order('created_at', { ascending: true });
            return (res.data || []) as Record<string, unknown>[];
          } catch {
            return [] as Record<string, unknown>[];
          }
        };

        const [chatRows, orderMsgRows, riderChatRows] = await Promise.all([fetchChat(), fetchOrderMsg(), fetchRiderChatMsg()]);
        const allRows = [...chatRows, ...orderMsgRows, ...riderChatRows];

        if (allRows.length > 0) {
          loadedFromDb = true;
          setMessages(prev => {
            const combined = [...prev];
            allRows.forEach((item: Record<string, unknown>) => {
              const norm = normalizeChatMessage(item, order.id);
              const idx = combined.findIndex(m => m.id === norm.id);
              if (idx === -1) {
                combined.push({ ...norm, is_read: true, is_delivered: true });
              } else {
                combined[idx] = { ...combined[idx], ...norm, is_read: true, is_delivered: true };
              }
            });
            combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return markMessagesAsRead(dedupeMessages(combined));
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
          const normalized = parsed.map((m: Record<string, unknown>) => normalizeChatMessage(m, order.id));
          setMessages(markMessagesAsRead(dedupeMessages(normalized)));
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

  // Flush offline pending queue when connection restores
  const flushPendingQueue = useCallback(async () => {
    const queueKey = `localeats_pending_chat_queue_${order.id}`;
    try {
      const storedQueue = localStorage.getItem(queueKey);
      if (!storedQueue) return;
      const pendingMsgs: OrderChatMessage[] = JSON.parse(storedQueue);
      if (!pendingMsgs || pendingMsgs.length === 0) return;

      const remaining: OrderChatMessage[] = [];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const msg of pendingMsgs) {
        let sent = false;
        if (!isSupabaseMocked()) {
          try {
            const chatPayload: Record<string, unknown> = {
              order_id: msg.order_id,
              sender_id: msg.sender_id,
              sender_type: msg.sender_role,
              content: msg.message,
              message_text: msg.message,
              created_at: msg.created_at,
              is_read: false
            };
            if (uuidRegex.test(msg.sender_id)) {
              chatPayload.user_id = msg.sender_id;
            }

            const { error: err1 } = await getSupabase().from('chat_messages').insert(chatPayload);
            let err2 = null;
            try {
              const res2 = await getSupabase().from('order_messages').insert({
                id: msg.id,
                order_id: msg.order_id,
                sender_role: msg.sender_role,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                message: msg.message,
                created_at: msg.created_at
              });
              err2 = res2.error;
            } catch {
              err2 = { message: 'order_messages insert failed' };
            }

            let err3 = null;
            try {
              const res3 = await getSupabase().from('rider_chat_messages').insert({
                id: msg.id,
                order_id: msg.order_id,
                sender_type: msg.sender_role,
                sender_id: msg.sender_id,
                sender_name: msg.sender_name,
                message: msg.message,
                created_at: msg.created_at
              });
              err3 = res3.error;
            } catch {
              err3 = { message: 'rider_chat_messages insert failed' };
            }

            if (!err1 || !err2 || !err3) sent = true;
          } catch {
            /* ignore */
          }
        } else {
          sent = true;
        }

        if (!sent) {
          remaining.push(msg);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(queueKey, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(queueKey);
      }
    } catch {
      /* ignore */
    }
  }, [order.id]);

  // Sync Supabase messages, subscribe to Realtime channel & localStorage storage events
  useEffect(() => {
    if (!isOpen) return;

    // Helper to add normalized incoming message with strict deduplication
    const processIncomingRawMessage = (raw: unknown) => {
      const norm = normalizeChatMessage(raw as Record<string, unknown>, order.id);
      if (!norm.message) return;

      setMessages(prev => {
        // Deduplicate by ID
        if (prev.some(m => m.id === norm.id)) return prev;

        const updated = dedupeMessages([...prev, {
          ...norm,
          is_read: true,
          is_delivered: true
        }]);
        updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
    };

    // Local Storage & Custom Multi-Tab/Same-Window listener
    const syncFromLocalStorage = () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: Record<string, unknown>[] = JSON.parse(stored);
          const normalized = parsed.map(m => normalizeChatMessage(m, order.id));
          setMessages(prev => {
            if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
            return markMessagesAsRead(normalized);
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
      flushPendingQueue();
    });

    // Setup Realtime Broadcast & Postgres Subscriptions on BOTH channel naming conventions (`order_chat_${order.id}` and `order-chat-${order.id}`)
    const supabase = getSupabase();
    const primaryChannelName = `order_chat_${order.id}`;
    const fallbackChannelName = `order-chat-${order.id}`;

    if (isSupabaseMocked()) {
      const timer = setTimeout(() => setConnectionStatus('online'), 200);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        window.removeEventListener('storage', syncFromLocalStorage);
        window.removeEventListener('localeats_chat_update', syncFromLocalStorage);
      };
    }
    
    const realtimeChannel = getFreshChannel(primaryChannelName)
      .on('broadcast', { event: 'new_message' }, (payload) => processIncomingRawMessage(payload.payload))
      .on('broadcast', { event: 'message' }, (payload) => processIncomingRawMessage(payload.payload))
      .on('broadcast', { event: 'chat_message' }, (payload) => processIncomingRawMessage(payload.payload))
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender_role !== currentUserRole && payload.payload.order_id === order.id) {
          setIsCounterpartTyping(true);
          if (counterpartTypingTimeoutRef.current) clearTimeout(counterpartTypingTimeoutRef.current);
          counterpartTypingTimeoutRef.current = setTimeout(() => setIsCounterpartTyping(false), 3000);
          scrollToBottom();
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `order_id=eq.${order.id}`
      }, (payload) => processIncomingRawMessage(payload.new))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${order.id}`
      }, (payload) => processIncomingRawMessage(payload.new))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rider_chat_messages',
        filter: `order_id=eq.${order.id}`
      }, (payload) => processIncomingRawMessage(payload.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('online');
          flushPendingQueue();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('offline');
        } else {
          setConnectionStatus('connecting');
        }
      });

    // Secondary listener for hyphenated channel format
    const secondaryChannel = getFreshChannel(fallbackChannelName)
      .on('broadcast', { event: 'new_message' }, (payload) => processIncomingRawMessage(payload.payload))
      .on('broadcast', { event: 'message' }, (payload) => processIncomingRawMessage(payload.payload))
      .subscribe();

    channelRef.current = realtimeChannel;

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', syncFromLocalStorage);
      window.removeEventListener('localeats_chat_update', syncFromLocalStorage);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      supabase.removeChannel(secondaryChannel);
    };
  }, [isOpen, order.id, storageKey, markMessagesAsRead, handleRefreshMessages, flushPendingQueue, scrollToBottom, currentUserRole]);

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
      is_delivered: connectionStatus === 'online',
      is_read: false
    };

    // Optimistic UI Update & Storage Dispatch
    setMessages(prev => {
      const updated = dedupeMessages([...prev, newMsg]);
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

    // Try DB Insert with multi-field fallback schema across chat_messages and order_messages
    if (!isSupabaseMocked()) {
      try {
        const supabase = getSupabase();
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(newMsg.sender_id);

        const chatPayload: Record<string, unknown> = {
          order_id: newMsg.order_id,
          sender_id: newMsg.sender_id,
          sender_type: newMsg.sender_role,
          content: newMsg.message,
          message_text: newMsg.message,
          created_at: newMsg.created_at,
          is_read: false
        };
        if (isValidUuid) {
          chatPayload.user_id = newMsg.sender_id;
        }

        const { error: chatErr } = await supabase.from('chat_messages').insert(chatPayload);

        let orderMsgErr = null;
        try {
          const res = await supabase.from('order_messages').insert({
            id: newMsg.id,
            order_id: newMsg.order_id,
            sender_role: newMsg.sender_role,
            sender_id: newMsg.sender_id,
            sender_name: newMsg.sender_name,
            message: newMsg.message,
            created_at: newMsg.created_at
          });
          orderMsgErr = res.error;
        } catch {
          orderMsgErr = { message: 'order_messages insert failed' };
        }

        let riderChatErr = null;
        try {
          const res = await supabase.from('rider_chat_messages').insert({
            id: newMsg.id,
            order_id: newMsg.order_id,
            sender_type: newMsg.sender_role,
            sender_id: newMsg.sender_id,
            sender_name: newMsg.sender_name,
            message: newMsg.message,
            created_at: newMsg.created_at
          });
          riderChatErr = res.error;
        } catch {
          riderChatErr = { message: 'rider_chat_messages insert failed' };
        }

        if (chatErr && orderMsgErr && riderChatErr) {
          // Store in offline pending queue if both fail
          const queueKey = `localeats_pending_chat_queue_${order.id}`;
          const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
          currentQueue.push(newMsg);
          localStorage.setItem(queueKey, JSON.stringify(currentQueue));
        }
      } catch (err) {
        console.info('DB save info:', err);
        const queueKey = `localeats_pending_chat_queue_${order.id}`;
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        currentQueue.push(newMsg);
        localStorage.setItem(queueKey, JSON.stringify(currentQueue));
      }
    }
  };

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
                  Order #{order.id.slice(-6).toUpperCase()} • {formatOrderItem(order.product_name || (order.items && order.items[0])) || 'Delivery Payload'}
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
            {dedupeMessages(messages).map((msg, idx) => {
              const isSelf = msg.sender_role === currentUserRole;
              const isSystem = msg.sender_role === 'system';

              if (isSystem) {
                return (
                  <div key={`${msg.id}-${idx}`} className="flex justify-center my-2 pointer-events-auto">
                    <div className="max-w-[90%] bg-zinc-900/80 border border-zinc-800 rounded-2xl px-3 py-1.5 text-[10px] text-zinc-400 text-center font-mono flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#f59e0b] shrink-0" />
                      <span>{msg.message}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`${msg.id}-${idx}`}
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
            {isCounterpartTyping && (
              <div className="flex justify-start mb-2 animate-in fade-in zoom-in duration-300">
                <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-2 rounded-2xl rounded-tl-none text-[10px] flex items-center gap-1.5 w-fit">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}
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
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
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
