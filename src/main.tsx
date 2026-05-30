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
    localStorage.clear();
    sessionStorage.clear();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
            }
        });
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
  if (!document.cookie.includes('fatal_reload=true') && event.filename && event.filename.includes('localhost')) {
    // Only attempt to self-heal on same-origin script errors to avoid third-party script noise
    console.error("App crashed. Initiating self-healing protocol...", event.error);
    
    document.cookie = "fatal_reload=true; max-age=10; path=/";
    
    // 1. Clear LocalStorage and SessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Unregister Service Workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                registration.unregister();
            }
        });
    }

    // 3. Force a hard reload
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
