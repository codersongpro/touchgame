// sw.js - Service worker for offline support
const CACHE_NAME = 'jjamjjami-gyosil-v3';

// Install: pre-cache the launcher
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        './',
        './index.html',
        './shared/style.css',
        './shared/engine.js',
        './games/registry.json',
        './favicon.svg',
        './og-image.svg',
        './manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first strategy
self.addEventListener('fetch', function(event) {
  // Only handle GET requests for same-origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Cache successful responses for game files
        if (response.ok && (event.request.url.includes('/games/') || event.request.url.includes('/shared/'))) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        // Network failed and not in cache
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
