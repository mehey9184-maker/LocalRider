export type ErrorEventPayload = {
  message: string;
  description?: string;
  onRetry?: () => void;
};

export function getErrorMessage(err: unknown, fallback = 'System fault detected.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') {
    return err === '[object Object]' ? fallback : err;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description;
    if (typeof obj.details === 'string' && obj.details) return obj.details;
    if (typeof obj.msg === 'string' && obj.msg) return obj.msg;
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}' && json !== '[]' && !json.includes('[object Object]')) {
        return json;
      }
    } catch {
      /* ignore */
    }
  }
  const str = String(err);
  return (!str || str === '[object Object]') ? fallback : str;
}

class ErrorEventEmitter {
  private listeners: ((payload: ErrorEventPayload) => void)[] = [];

  subscribe(listener: (payload: ErrorEventPayload) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(payload: ErrorEventPayload) {
    this.listeners.forEach((listener) => listener(payload));
    
    // Centralized remote logging simulated output
    console.warn("[Remote Error Service - Logged]:", payload.message, payload.description);
  }
}

export const errorBus = new ErrorEventEmitter();

export const isTransientError = (msg: string): boolean => {
  if (!msg) return false;
  return /fetch|network|timeout|timed out|operation timed out|operation timeout|abort|connection|lock broken|refresh token|invalid refresh token|token_not_found|jwt expired/i.test(msg);
};

export function dispatchError(message: string, description?: string, onRetry?: () => void) {
  const cleanMsg = getErrorMessage(message, 'An unexpected error occurred.');
  const cleanDesc = description ? getErrorMessage(description, 'System fault detected.') : undefined;
  
  if (isTransientError(cleanMsg) || (cleanDesc && isTransientError(cleanDesc))) {
    console.warn('Transient error suppressed by dispatchError:', cleanMsg, cleanDesc);
    return;
  }

  if (cleanDesc === 'System fault detected.' && cleanMsg !== 'An unexpected error occurred.') {
    errorBus.emit({ message: cleanMsg, description: undefined, onRetry });
  } else {
    errorBus.emit({ message: cleanMsg, description: cleanDesc, onRetry });
  }
}

// Global error handlers
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const rawMsg = event.message || (event.error ? getErrorMessage(event.error) : '');
    const msg = getErrorMessage(rawMsg, 'System fault detected.');
    if (isTransientError(msg)) {
      event.preventDefault();
      return;
    }
    dispatchError(
      'An unexpected error occurred.',
      msg,
      () => window.location.reload()
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const rawMsg = event.reason ? getErrorMessage(event.reason) : '';
    const msg = getErrorMessage(rawMsg, 'A background task failed.');
    if (isTransientError(msg)) {
      event.preventDefault();
      return;
    }
    dispatchError(
      'Network or process failure.',
      msg,
      () => window.location.reload()
    );
  });
}

