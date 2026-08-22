import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.tsx';
import './index.css';
import { getErrorMessage } from './lib/errorHandling';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  integrations: [],
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enabled: false,
});


const isTransient = (msg: string) => {
  return /fetch|network|timeout|timed out|operation timed out|abort|connection|lock broken|refresh token|invalid refresh token|token_not_found|jwt expired/i.test(msg);
};

window.addEventListener('unhandledrejection', (event) => {
  const rawMsg = event.reason ? getErrorMessage(event.reason, '') : '';
  const msg = rawMsg.toLowerCase();
  
  if (isTransient(msg)) {
    console.warn('Transient error suppressed:', rawMsg);
    event.preventDefault();
    return;
  }

  if (msg.includes('refresh token') || msg.includes('token_not_found') || msg.includes('jwt expired')) {
    event.preventDefault();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    if (!sessionStorage.getItem('auth_reloaded')) {
      sessionStorage.setItem('auth_reloaded', 'true');
      window.location.reload();
    }
    return;
  }
  
  // Implementation of Automated Failsafe for general crashes
  if (!document.cookie.includes('fatal_reload=true')) {
    console.error("App crashed. Initiating self-healing protocol...", event.reason);
    if (event.reason) {
      Sentry.captureException(event.reason);
    }
    document.cookie = "fatal_reload=true; max-age=10; path=/";
    
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      if ('caches' in window) {
        caches.keys().then((keys) => {
          Promise.all(keys.map(key => caches.delete(key))).catch(() => {});
        }).catch(() => {});
      }
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch {
      // safe fallback
    }
    
    setTimeout(() => { window.location.reload(); }, 500); 
  }
});

window.addEventListener('error', (event) => {
  const rawMsg = event.message || (event.error ? getErrorMessage(event.error, '') : '');
  const msg = rawMsg.toLowerCase();

  if (isTransient(msg)) {
    console.warn('Network or fetch error suppressed:', rawMsg);
    event.preventDefault();
    return;
  }

  if (msg.includes('refresh token') || msg.includes('token_not_found') || msg.includes('jwt expired')) {
    event.preventDefault();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    if (!sessionStorage.getItem('auth_reloaded')) {
      sessionStorage.setItem('auth_reloaded', 'true');
      window.location.reload();
    }
    return;
  }

  // Implementation of Automated Failsafe for general crashes
  const isSameOrigin = !event.filename || event.filename.includes(window.location.origin) || event.filename.includes('run.app');
  if (!document.cookie.includes('fatal_reload=true') && isSameOrigin) {
    console.error("App crashed. Initiating self-healing protocol...", event.error);
    if (event.error) {
      Sentry.captureException(event.error);
    }
    
    document.cookie = "fatal_reload=true; max-age=10; path=/";
    
    try {
      // 1. Clear LocalStorage and SessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // 2. Kill and purge all Cache Storage instances (forces fresh map tiles/code)
      if ('caches' in window) {
        caches.keys().then((keys) => {
          Promise.all(keys.map(key => caches.delete(key))).catch(() => {});
        }).catch(() => {});
      }
      
      // 3. Unregister Service Workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch {
      // safe fallback
    }

    // 4. Force a hard reload
    setTimeout(() => {
      window.location.reload();
    }, 500); 
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // @ts-expect-error PWA types not globally loaded
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(swUrl: string, r: ServiceWorkerRegistration) {
          console.log('LocalEats Cache SW registered scope:', r?.scope);
        },
        onRegisterError(err: Error) {
          console.warn('LocalEats Cache SW registration skipped or failed:', err);
        }
      });
    }).catch(() => {
      console.warn("Failed to load virtual:pwa-register");
    });
  });
}
