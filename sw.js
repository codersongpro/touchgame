// sw.js - Service worker for offline support
//
// 전략 A: Network-First for 디렉토리 파일
// - index.html (메인 런처) + games/registry.json → 항상 네트워크 우선 (오프라인 시 캐시 폴백)
//   → 새 게임 추가 시 사용자에게 즉시 표시됨
// - 그 외 게임 파일들 (game.js, style.css 등) → 캐시 우선 (빠른 로딩 + 오프라인 지원)

const CACHE_NAME = 'jjamjjami-gyosil-v13';

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

// "디렉토리 파일" 판별: 게임 목록을 결정하는 파일들
// - 메인 런처 index.html (게임 카드 그리드 포함)
// - games/registry.json (게임 폴더 목록)
// - manifest.json (앱 메타데이터)
// 게임 폴더 안의 index.html은 제외 (그건 게임 자체이므로 캐시 우선)
function isDirectoryFile(url) {
  var pathname = new URL(url).pathname;

  // 메인 런처: '/', '/index.html' (단, '/games/xxx/index.html'은 제외)
  if (pathname === '/' ||
      pathname.endsWith('/index.html') && !pathname.includes('/games/')) {
    return true;
  }
  // registry.json
  if (pathname.endsWith('/games/registry.json')) return true;
  // manifest.json
  if (pathname.endsWith('/manifest.json')) return true;

  return false;
}

// Fetch: 디렉토리 파일은 network-first, 나머지는 cache-first
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (isDirectoryFile(event.request.url)) {
    // Network-First: 항상 최신 가져오기, 실패 시 캐시 폴백
    event.respondWith(
      fetch(event.request).then(function(response) {
        // 성공 시 캐시 갱신 (오프라인 폴백용)
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // 네트워크 실패 → 캐시에서 시도
        return caches.match(event.request).then(function(cached) {
          return cached || new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Cache-First: 게임 파일들 (빠른 로딩 + 오프라인 지원)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        if (response.ok && (event.request.url.includes('/games/') || event.request.url.includes('/shared/'))) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function() {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
