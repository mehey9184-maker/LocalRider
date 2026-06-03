// LocalEats Map Offline Cache Service Worker
const CACHE_NAME = 'localeats-map-tiles-v1';
const ALLOWED_TILE_HOSTS = [
  'basemaps.cartocdn.com',
  'a.basemaps.cartocdn.com',
  'b.basemaps.cartocdn.com',
  'c.basemaps.cartocdn.com',
  'd.basemaps.cartocdn.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if it's a CARTO map tile request
  const isTileRequest = ALLOWED_TILE_HOSTS.some(host => url.hostname.includes(host)) && 
                        (url.pathname.includes('/rastertiles/') || url.pathname.includes('.png'));

  if (isTileRequest) {
    const forceOffline = url.searchParams.get('force_offline') === 'true';
    
    if (forceOffline) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
          return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Return 404 for missing tiles in offline mode so MapLibre handles it gracefully
            return new Response(null, { 
              status: 404, 
              statusText: 'Offline Cache Miss',
              headers: { 'Access-Control-Allow-Origin': '*' }
            });
          });
        })
      );
      return;
    }

    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          // Keep a backup fetch promise
          const networkFetch = fetch(event.request.clone()).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('SV: Tile fetch failed, returning cached or empty tile', err);
            return null;
          });

          // Cache First / Stale-While-Revalidate Strategy
          if (cachedResponse) {
            // Return cached tile instantly (makes the map feel blazing fast)
            // Trigger background fetch to keep cache warm and updated
            event.waitUntil(networkFetch);
            return cachedResponse;
          }

          // If not in cache, wait for network
          return networkFetch.then(res => {
            if (res) return res;
            // Fallback 404 in case of complete offline failure without cache
            return new Response(null, { 
              status: 404, 
              statusText: 'Offline Cache Miss',
              headers: { 'Access-Control-Allow-Origin': '*' }
            });
          });
        });
      })
    );
    return;
  }

  // Intercept OSRM router fetches to make routing offline-first if pre-visited
  if (url.hostname.includes('router.project-osrm.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const networkFetch = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => null);

          if (cachedResponse) {
            // Keep background fetch to update if necessary
            event.waitUntil(networkFetch);
            return cachedResponse;
          }

          return networkFetch;
        });
      })
    );
    return;
  }
});
