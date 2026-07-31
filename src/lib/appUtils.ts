import { useState, useEffect } from 'react';

// --- Types & Interfaces ---

export interface HeartbeatStatus {
  status: 'live' | 'quiet' | 'offline' | 'recent';
  colorClass: string;
  dotColorClass: string;
  durationText: string;
  isOver48h: boolean;
}

export interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: () => void;
  onlevelchange: () => void;
}

export interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

// --- Utilities ---

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) *
            Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Parses JSON safely without throwing errors.
 */
export function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Checks if a date string is from the current calendar day in local time.
 */
export function isTodayLocal(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  } catch {
    return false;
  }
}

/**
 * Simple promise with timeout wrapper.
 */
export function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Operation timed out'));
      }
    }, timeoutMs);

    promise.then(
      res => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(res);
        }
      },
      err => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    );
  });
}

/**
 * Network request retry runner with exponential backoff and timeout thresholds.
 */
import { toast } from 'sonner';
import { getErrorMessage } from './errorHandling';
import { clearStaleAuthTokens } from './supabase';

export async function fetchWithRetry<T>(
  fn: () => Promise<T>, 
  retries = 5, 
  delay = 1000, 
  timeoutMs = 15000
): Promise<T> {
  try {
    return await promiseWithTimeout(fn(), timeoutMs);
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err, 'Network or database operation failed');
    const error = err instanceof Error ? err : new Error(errorMsg);
    const msg = error.message.toLowerCase();
    
    // Check if error is due to expired auth token / JWT
    if (/jwt expired|refresh token|invalid refresh token|token_not_found/i.test(msg)) {
      clearStaleAuthTokens();
      throw error;
    }

    // Distinguish between transient (network/timeout) and fatal errors
    const isTransientErr = /fetch|network|offline|connection|failed|changed|cors|disconnected|abort|timeout|timed out/i.test(msg);
    const isFatalDbErr = /relation.*does not exist|syntax error|permission denied|row-level security|duplicate key/i.test(msg);

    if (retries > 0 && isTransientErr && !isFatalDbErr) {
      const nextDelay = delay * 1.5; 
      const errMessage = error instanceof Error ? error.message : 'Network sequence interrupted';
      console.log(`[RETRYING] ${errMessage.toUpperCase()} | Attempts remaining: ${retries}`);
      if (retries === 5 || retries === 3) {
        toast.warning('Network unstable, retrying...', { id: 'network-retry', duration: 3000 });
      }
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, nextDelay, timeoutMs);
    }
    
    // Throw error so it can be handled or swallowed quietly by caller
    throw error;
  }
}

/**
 * React hook to retrieve live device battery metrics and charging status.
 */
export const useBatteryStatus = () => {
  const [level, setLevel] = useState<number | null>(75); 
  const [charging, setCharging] = useState<boolean>(false);
  const [isSupported] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'getBattery' in navigator;
  });

  useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (typeof window === 'undefined' || !nav.getBattery) {
      const interval = setInterval(() => {
        setLevel(prev => {
          if (prev === null) return 85;
          if (prev <= 15) return 25;
          return Number((prev - 0.2).toFixed(1));
        });
      }, 30000);
      return () => clearInterval(interval);
    }

    let battery: BatteryManager | null = null;

    const updateBattery = () => {
      if (battery) {
        setLevel(Math.round(battery.level * 100));
        setCharging(battery.charging);
      }
    };

    nav.getBattery().then((bat: BatteryManager) => {
      battery = bat;
      updateBattery();
      bat.addEventListener('chargingchange', updateBattery);
      bat.addEventListener('levelchange', updateBattery);
    }).catch(() => {
      // safe fallback
    });

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBattery);
        battery.removeEventListener('levelchange', updateBattery);
      }
    };
  }, []);

  return { level, charging, isSupported };
};

/**
 * Determines merchant heartbeat activity levels from ISO update timestamps.
 */
export const getMerchantHeartbeatStatus = (updatedAtStr?: string): HeartbeatStatus => {
  if (!updatedAtStr) {
    return {
      status: 'offline',
      colorClass: 'text-zinc-500',
      dotColorClass: 'bg-zinc-500 shadow-[0_0_6px_#71717a]',
      durationText: 'Merchant Offline: Unknown',
      isOver48h: false,
    };
  }
  
  try {
    const updatedAt = new Date(updatedAtStr).getTime();
    const now = Date.now();
    const diffMs = now - updatedAt;
    
    if (isNaN(updatedAt)) {
      throw new Error('Invalid Date parsed');
    }
    
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let durationText = '';
    if (diffMinutes < 60) {
      durationText = `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`;
    } else if (diffHours < 24) {
      durationText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      durationText = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    
    const isWithin2h = diffHours < 2;
    const isOver24h = diffHours >= 24;
    const isOver48h = diffHours >= 48;
    
    if (isWithin2h) {
      return {
        status: 'live',
        colorClass: 'text-emerald-400',
        dotColorClass: 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse',
        durationText: `Merchant Live: ${durationText}`,
        isOver48h: false,
      };
    } else if (isOver24h) {
      return {
        status: 'quiet',
        colorClass: 'text-amber-500',
        dotColorClass: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
        durationText: `Merchant Quiet: ${durationText}`,
        isOver48h,
      };
    } else {
      return {
        status: 'recent',
        colorClass: 'text-zinc-400',
        dotColorClass: 'bg-zinc-500 shadow-[0_0_6px_#71717a]',
        durationText: `Merchant Offline: ${durationText}`,
        isOver48h: false,
      };
    }
  } catch (error) {
    console.error('Error calculating heartbeat status', error);
    return {
      status: 'offline',
      colorClass: 'text-zinc-500',
      dotColorClass: 'bg-zinc-500',
      durationText: 'Merchant Offline',
      isOver48h: false,
    };
  }
};

/**
 * Returns a randomized tile host string for basemap caching systems.
 */
export const getRandomHost = () => {
  const hosts = ['a', 'b', 'c', 'd'];
  return hosts[Math.floor(Math.random() * hosts.length)];
};

/**
 * Calculates tile coordinate ranges (x, y, z) for custom offline tile caching.
 */
export const getTilesForCoordinate = (lat: number, lng: number, extent: number = 0.015) => {
  const minLat = lat - extent;
  const maxLat = lat + extent;
  const minLng = lng - extent;
  const maxLng = lng + extent;

  const latToY = (la: number, z: number) => {
    return Math.floor((1 - Math.log(Math.tan(la * Math.PI / 180) + 1 / Math.cos(la * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
  };

  const lngToX = (ln: number, z: number) => {
    return Math.floor((ln + 180) / 360 * Math.pow(2, z));
  };

  const tiles = [];
  const zooms = [14, 15, 16];

  for (const z of zooms) {
    const minX = lngToX(minLng, z);
    const maxX = lngToX(maxLng, z);
    const minY = latToY(maxLat, z);
    const maxY = latToY(minLat, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z });
      }
    }
  }
  return tiles;
};

/**
 * Fuzzy matches search query with multiple target fields.
 */
export const fuzzyMatch = (query: string, target: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  return t.includes(q) || q.split(/\s+/).every(word => t.includes(word));
};
