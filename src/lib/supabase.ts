import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let isMocked = false;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-supabase-url')) {
      isMocked = true;
      // Return a dummy client that doesn't throw immediate errors but we'll check isMocked
      supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder');
    } else {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabaseClient;
}

export function isSupabaseMocked(): boolean {
  getSupabase(); // Ensure init
  return isMocked;
}
