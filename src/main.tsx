import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timeout')) {
    console.warn('Network or fetch error suppressed:', msg);
    event.preventDefault();
    return;
  }

  if (msg.includes('Refresh Token Not Found')) {
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
  const msg = event.message || '';

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timeout')) {
    console.warn('Network or fetch error suppressed:', msg);
    event.preventDefault();
    return;
  }

  if (msg.includes('Refresh Token Not Found')) {
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
