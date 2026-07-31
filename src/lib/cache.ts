/**
 * Upgraded Cache & Cookie Storage Utility for LocalEats Rider App
 * Implements:
 * 1. Versioned LocalStorage & SessionStorage with TTL (Time-To-Live) support
 * 2. Automatic eviction of stale cache entries
 * 3. Safe fallback parsing to prevent crashes from corrupted cache data
 * 4. Helper utilities for cookies, auth tokens, and full cache purging
 */

export const CACHE_VERSION = 'v2_2026';

export interface CacheEnvelope<T> {
  v: string;
  ts: number;
  ttl?: number; // ms
  data: T;
}

// Cookie Helper Utilities with SameSite, Secure & Partitioned options
export function setCookie(name: string, value: string, days = 7, options?: { sameSite?: 'Lax' | 'Strict' | 'None'; secure?: boolean; partitioned?: boolean }) {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const sameSite = options?.sameSite || 'Lax';
    const secure = options?.secure ?? (location.protocol === 'https:');
    const partitioned = options?.partitioned ? '; Partitioned' : '';
    const cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=${sameSite}${secure ? '; Secure' : ''}${partitioned}`;
    document.cookie = cookieStr;
  } catch (err) {
    console.warn('[CacheManager] Error writing cookie:', err);
  }
}

export function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const matches = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
    return matches ? decodeURIComponent(matches[1]) : null;
  } catch (err) {
    console.warn('[CacheManager] Error reading cookie:', err);
    return null;
  }
}

export function eraseCookie(name: string) {
  setCookie(name, '', -1);
}

// Versioned Cache Get
export function getCacheItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage === 'undefined') return defaultValue;
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    const parsed: CacheEnvelope<T> = JSON.parse(raw);
    
    // Validate envelope structure and version
    if (!parsed || typeof parsed !== 'object' || !parsed.v) {
      // Legacy raw JSON format fallback
      return (parsed as unknown as T) ?? defaultValue;
    }

    if (parsed.v !== CACHE_VERSION) {
      console.log(`[CacheManager] Evicting outdated cache version "${parsed.v}" for key "${key}"`);
      localStorage.removeItem(key);
      return defaultValue;
    }

    // Check TTL expiry
    if (parsed.ttl && parsed.ts) {
      const now = Date.now();
      if (now - parsed.ts > parsed.ttl) {
        console.log(`[CacheManager] Evicting expired cache for key "${key}" (TTL: ${parsed.ttl}ms)`);
        localStorage.removeItem(key);
        return defaultValue;
      }
    }

    return parsed.data ?? defaultValue;
  } catch (err) {
    console.warn(`[CacheManager] Failed to read cache key "${key}", purging corrupted entry:`, err);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[CacheManager] Could not remove key "${key}":`, e);
    }
    return defaultValue;
  }
}

// Versioned Cache Set
export function setCacheItem<T>(key: string, value: T, ttlMs?: number): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const envelope: CacheEnvelope<T> = {
      v: CACHE_VERSION,
      ts: Date.now(),
      ttl: ttlMs,
      data: value,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[CacheManager] Failed to write cache key "${key}":`, err);
  }
}

// Clear all LocalEats cache entries
export function clearAppCache(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('localeats_') || k.startsWith('sb-') || k.includes('supabase'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log(`[CacheManager] Successfully purged ${keysToRemove.length} cached keys.`);
  } catch (err) {
    console.warn('[CacheManager] Error purging app cache:', err);
  }
}
