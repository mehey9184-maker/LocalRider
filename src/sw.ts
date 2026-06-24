/* eslint-disable @typescript-eslint/no-explicit-any */
import { precacheAndRoute } from 'workbox-precaching';

declare const self: any;

// Precache resources handled by Vite PWA
precacheAndRoute(self.__WB_MANIFEST);

// Normalize map subdomains for maximum cache match rates
function matchNormalizedTile(cache: Cache, requestUrl: string): Promise<Response | undefined> {
  const urlObj = new URL(requestUrl);
  if (!urlObj.hostname.includes('basemaps.cartocdn.com')) {
    return cache.match(requestUrl);
  }
  
  const normalizedPath = urlObj.pathname; // e.g., /dark_all/15/19321/10243@2x.png
  const normalizedUrlA = `https://a.basemaps.cartocdn.com${normalizedPath}`;
  const normalizedUrlB = `https://b.basemaps.cartocdn.com${normalizedPath}`;
  const normalizedUrlC = `https://c.basemaps.cartocdn.com${normalizedPath}`;
  const normalizedUrlD = `https://d.basemaps.cartocdn.com${normalizedPath}`;

  return cache.match(normalizedUrlA)
    .then(r => r || cache.match(normalizedUrlB))
    .then(r => r || cache.match(normalizedUrlC))
    .then(r => r || cache.match(normalizedUrlD))
    .then(r => r || cache.match(requestUrl));
}

// Intercept network requests for tiles and routing to allow zero-data offline mode
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  // 1. Intercept Map Tiles (basemaps.cartocdn.com)
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open('localeats-map-tiles-v1').then((cache) => {
        const cleanUrl = new URL(event.request.url);
        const isForceOffline = cleanUrl.searchParams.get('force_offline') === 'true';
        cleanUrl.searchParams.delete('force_offline');

        return matchNormalizedTile(cache, cleanUrl.toString()).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          if (isForceOffline) {
            // EXPLICITLY BLOCK network request to guarantee zero data usage in low-signal areas!
            // Return a 1x1 transparent PNG to prevent broken tile icons on the map
            return new Response(
              new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
                0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
                0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
              ]),
              { headers: { 'Content-Type': 'image/png' } }
            );
          }

          // In hybrid mode, try to fetch from network and cache it for subsequent offline use
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(cleanUrl.toString(), networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // If completely offline and not cached, fail gracefully
            return new Response(new Uint8Array([]), { status: 404 });
          });
        });
      })
    );
    return;
  }

  // 2. Intercept OSRM Routing (router.project-osrm.org)
  if (url.hostname.includes('router.project-osrm.org')) {
    const isForceOffline = url.searchParams.get('force_offline') === 'true';
    if (isForceOffline) {
      event.respondWith(
        new Response(
          JSON.stringify({ error: "Offline routing active - cellular bypassed" }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      );
      return;
    }
  }
});

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
