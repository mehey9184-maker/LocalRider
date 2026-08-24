import { toast } from 'sonner';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, setLogLevel, Firestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';
// Lazy getter for supabase to prevent circular dependency at module load
async function getSupabaseClient() {
  const { getSupabase, isSupabaseMocked } = await import('./supabase');
  return { supabase: getSupabase(), isMocked: isSupabaseMocked() };
}
import { fetchWithRetry } from './appUtils';

// Silence benign internal WebChannel streaming reconnection warnings
try {
  setLogLevel('error');
} catch {
  // Ignore if already configured
}

// Firebase configuration with lazy defaults
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyBuX3QvWFTWSLoaEsMPE7TsQLEodAaFS1M",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "localeats-5e26e.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "localeats-5e26e",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "localeats-5e26e.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "281496568360",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:281496568360:web:45557127bbd2a352bfeb1d"
};

const initApp = () => {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
};

const app = initApp();
let appInstance: FirebaseApp | null = app;
let messagingInstance: Messaging | null = null;
const DB_NAME = "ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe";

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, DB_NAME);
} catch {
  firestoreDb = getFirestore(app, DB_NAME);
}

export const db = firestoreDb;

export function getFirebaseApp(): FirebaseApp | null {
  if (!appInstance) {
    try {
      if (getApps().length > 0) {
        appInstance = getApp();
      } else {
        appInstance = initializeApp(firebaseConfig);
      }
    } catch (err) {
      console.warn('Firebase initialization postponed/skipped:', err);
      return null;
    }
  }
  return appInstance;
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }
  if (!messagingInstance) {
    const app = getFirebaseApp();
    if (app) {
      try {
        messagingInstance = getMessaging(app);
      } catch (err) {
        console.warn('Firebase Messaging not supported in this browser context:', err);
        return null;
      }
    }
  }
  return messagingInstance;
}

/**
  Requests browser notification permission, registers service worker if needed,
  and retrieves the FCM registration token.
 */
export async function requestNotificationPermissionAndGetToken(customVapidKey?: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Push notifications not supported on this browser/platform.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission status:', permission);
      if (permission === 'denied') {
         toast.error('Push Notifications Denied', {
           description: 'Notifications are critical for receiving immediate order dispatch alerts. Please enable them in your browser settings to avoid missing deliveries.',
           duration: 8000,
         });
      }
      return null;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn('Firebase messaging instance unavailable.');
      return null;
    }

    // Register or retrieve service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const vapidKey = customVapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    const token = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: swRegistration
    });

    if (token) {
      console.log('FCM Push Registration Token retrieved:', token.slice(0, 10) + '...');
      return token;
    } else {
      console.warn('No FCM registration token received.');
      return null;
    }
  } catch (err) {
    console.warn('Error retrieving FCM push token:', err);
    return null;
  }
}

/**
  Upserts the FCM token into public.user_push_tokens on Supabase.
 */
export async function syncPushTokenToSupabase(userId: string, token: string): Promise<boolean> {
  const { supabase, isMocked } = await getSupabaseClient();
  if (!userId || !token || isMocked) return false;

  try {
    const payload = {
      user_id: userId,
      token: token,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await fetchWithRetry(async () => {
      return await supabase
        .from('user_push_tokens')
        .upsert(payload, { onConflict: 'user_id' });
    }, 2, 1000, 5000);

    if (error) {
      // Fallback for schema variations
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        console.warn('Retrying token sync with minimal column layout:', error.message);
        await fetchWithRetry(async () => {
          return await supabase
            .from('user_push_tokens')
            .upsert({ user_id: userId, token }, { onConflict: 'user_id' });
        }, 2, 1000, 5000);
      } else {
        console.warn('Push token sync warning (non-blocking):', error.message);
      }
    } else {
      console.log('Push token synced to Supabase successfully.');
    }
    return true;
  } catch (err) {
    console.warn('Failed to sync push token to Supabase (handled gracefully):', err);
    return false;
  }
}

/**
  Combines permission/token request and Supabase token sync in one step.
 */
export async function registerAndSyncPushToken(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const token = await requestNotificationPermissionAndGetToken();
    if (token) {
      await syncPushTokenToSupabase(userId, token);
    }
    return token;
  } catch (err) {
    console.warn('registerAndSyncPushToken caught non-fatal exception:', err);
    return null;
  }
}

/**
  Listens for foreground messages when the app tab is active.
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): (() => void) | void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  try {
    return onMessage(messaging, (payload) => {
      console.log('FCM Foreground message received:', payload);
      callback(payload);
    });
  } catch (err) {
    console.warn('Failed to subscribe to foreground messages:', err);
  }
}

/**
  Dispatches a push notification via the Supabase Edge Function send-alert endpoint.
 */
export async function sendPushNotification(payload: {
  user_id: string;
  token?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<boolean> {
  const edgeFunctionUrl = 'https://qnwjkwlhmreenqotufvw.supabase.co/functions/v1/send-alert';
  
  try {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { 'Authorization': `Bearer ${anonKey}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn('Push notification dispatcher response status:', res.status, await res.text().catch(() => ''));
      return false;
    }

    console.log('Push notification dispatched successfully to user:', payload.user_id);
    return true;
  } catch (err) {
    console.warn('Push notification dispatch failed (handled):', err);
    return false;
  }
}
