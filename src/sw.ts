/* eslint-disable @typescript-eslint/no-explicit-any */
import { precacheAndRoute } from 'workbox-precaching';

declare const self: any;

// Precache resources handled by Vite PWA
precacheAndRoute(self.__WB_MANIFEST);

// Handle push events
self.addEventListener('push', (event: any) => {
  let data: Record<string, string> = {};
  try {
    data = event.data?.json() ?? {};
  } catch (e) {
    console.warn("Error parsing push payload", e);
  }

  const title = data.title || 'LocalEats Request';
  const options = {
    body: data.body || 'You have a new mission available.',
    icon: '/app-icon.svg',
    badge: '/app-icon.svg',
    data: data.url || '/',
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click 
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  if (event.notification.data) {
     event.waitUntil(self.clients.openWindow(event.notification.data));
  }
});
