// sw.js — Cache-busting service worker
// Increment CACHE_VERSION whenever you deploy new code.
// This instantly clears all old cached files for every user on next visit.
const CACHE_VERSION = 'ki-v1';

// On install — claim clients immediately
self.addEventListener('install', () => self.skipWaiting());

// On activate — delete ALL old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — never cache HTML, always go to network
// Static assets (images, fonts) can be cached
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch HTML fresh from server — never serve from cache
  if (event.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '/dashboard') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Everything else — network first, fall back to cache
  event.respondWith(
    fetch(event.request).then(response => {
      // Cache successful responses for static assets
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
