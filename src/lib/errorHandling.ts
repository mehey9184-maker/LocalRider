export type ErrorEventPayload = {
  message: string;
  description?: string;
  onRetry?: () => void;
};

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

export function dispatchError(message: string, description?: string, onRetry?: () => void) {
  errorBus.emit({ message, description, onRetry });
}

// Global error handlers
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    dispatchError(
      'An unexpected error occurred.',
      event.message || 'System fault detected.',
      () => window.location.reload()
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    dispatchError(
      'Network or process failure.',
      event.reason?.message || 'A background task failed.',
      () => window.location.reload()
    );
  });
}
