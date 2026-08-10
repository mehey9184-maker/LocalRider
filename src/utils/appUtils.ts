export interface NetworkErrorLog {
  id: string;
  timestamp: string;
  message: string;
  endpoint?: string;
}

const errorLogs: NetworkErrorLog[] = [];
const listeners = new Set<() => void>();

/**
 * Adds a network error log entry for diagnostics and HUD indicators.
 */
export function addNetworkErrorLog(message: string, endpoint?: string): void {
  const log: NetworkErrorLog = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    message,
    endpoint
  };
  errorLogs.unshift(log);
  if (errorLogs.length > 20) {
    errorLogs.pop();
  }
  listeners.forEach(cb => cb());
}

/**
 * Returns the most recent N lines from the network error log.
 */
export function getRecentErrorLogs(count = 5): NetworkErrorLog[] {
  return errorLogs.slice(0, count);
}

/**
 * Clears all stored network error logs.
 */
export function clearNetworkErrorLogs(): void {
  errorLogs.length = 0;
  listeners.forEach(cb => cb());
}

/**
 * Subscribes to network error log updates.
 */
export function subscribeNetworkErrors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clears localStorage keys for available, active, and simulated orders
 * to ensure the rider isn't seeing stale data or ghost orders from an expired session.
 */
export function forceCacheRevalidation(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('localeats_available_orders');
    localStorage.removeItem('localeats_active_orders');
    localStorage.removeItem('localeats_sim_orders');
    localStorage.removeItem('localeats_declined_orders');
    localStorage.removeItem('localeats_cached_tiles');
  }
  console.log('[forceCacheRevalidation] Cleared cached orders and stale session storage.');
}
