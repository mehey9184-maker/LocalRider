import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Refresh Token Not Found')) {
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
  }
});

window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Refresh Token Not Found')) {
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
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
