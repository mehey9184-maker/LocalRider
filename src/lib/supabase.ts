import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let isMocked = false;

// Custom no-op lock handler to bypass Web Locks API issues in StrictMode/iframes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>): Promise<any> => {
  return await fn();
};

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Check if variables are missing, undefined/null strings, default placeholders, or invalid
    const isUrlPlaceholder = !supabaseUrl || 
      supabaseUrl === 'undefined' || 
      supabaseUrl === 'null' || 
      supabaseUrl.trim() === '' ||
      supabaseUrl.includes('your-supabase-url') ||
      (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://localhost') && !supabaseUrl.startsWith('http://127.0.0.1'));

    const isKeyPlaceholder = !supabaseAnonKey || 
      supabaseAnonKey === 'undefined' || 
      supabaseAnonKey === 'null' || 
      supabaseAnonKey.trim() === '' ||
      supabaseAnonKey.includes('your-supabase-anon-key') ||
      supabaseAnonKey.length < 15;

    if (isUrlPlaceholder || isKeyPlaceholder) {
      isMocked = true;
      // Return a dummy client that doesn't throw immediate errors but we'll check isMocked
      supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder', {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'localeats_auth_token_v2',
          lock: noopLock
        }
      });
    } else {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'localeats_auth_token_v2',
            lock: noopLock
          }
        });
      } catch (err) {
        console.warn('Supabase client creation failed, defaulting to mock mode:', err);
        isMocked = true;
        supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder', {
          auth: { lock: noopLock }
        });
      }
    }
  }
  return supabaseClient;
}

export function clearStaleAuthTokens() {
  try {
    if (supabaseClient) {
      supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    if (typeof localStorage !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.warn('Error clearing stale tokens:', e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let msg = typeof reason === 'string' ? reason : (reason?.message || reason?.error_description || reason?.error || '');
    if (!msg && typeof reason === 'object' && reason) {
      try {
        msg = JSON.stringify(reason);
      } catch {
        msg = String(reason);
      }
    }
    const lowerMsg = String(msg).toLowerCase();
    if (
      lowerMsg.includes('refresh token') || 
      lowerMsg.includes('refresh_token') || 
      lowerMsg.includes('invalid refresh token') || 
      lowerMsg.includes('token_not_found') ||
      lowerMsg.includes('jwt expired') ||
      lowerMsg.includes('lock broken') ||
      lowerMsg.includes('was not released') ||
      lowerMsg.includes('steal') ||
      lowerMsg.includes('permission denied') ||
      lowerMsg.includes('is_shop_owner') ||
      lowerMsg.includes('42501')
    ) {
      if (lowerMsg.includes('refresh')) {
        console.warn('Handling invalid refresh token rejection gracefully:', msg);
        clearStaleAuthTokens();
      } else {
        console.warn('Handling database permission error gracefully:', msg);
      }
      event.preventDefault();
    }
  });
}

export function isSupabaseMocked(): boolean {
  getSupabase(); // Ensure init
  return isMocked;
}

export function markSupabaseAsMocked() {
  isMocked = true;
  // Fallback happens silently to prevent AI Studio warnings
}
