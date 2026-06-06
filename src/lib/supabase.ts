import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let isMocked = false;

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
      supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder');
    } else {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      } catch (err) {
        console.warn('Supabase client creation failed, defaulting to mock mode:', err);
        isMocked = true;
        supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder');
      }
    }
  }
  return supabaseClient;
}

export function isSupabaseMocked(): boolean {
  getSupabase(); // Ensure init
  return isMocked;
}

export function markSupabaseAsMocked() {
  isMocked = true;
  console.warn("SYSTEM AUTONOMOUS FAILSAFE ENGAGED: Dynamic failover to local mocked active mode triggered.");
}
