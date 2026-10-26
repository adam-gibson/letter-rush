// Service worker: caches the app shell for offline use.
// Bump CACHE_VERSION whenever you deploy changes so players get the update.
const CACHE_VERSION = 'v6';
const CACHE = `letter-rush-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/categories.js',
  './js/config.js',
  './js/game.js',
  './js/wake-lock.js',
  './js/data/store.js',
  './js/data/local-store.js',
  './js/data/supabase-store.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('letter-rush-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first for our own files, so a new version is always used together
// (never new HTML with old CSS/JS); the cache is the offline fallback.
// Everything else (e.g. Supabase) goes straight to the network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) return cached;
      if (request.mode === 'navigate') return (await cache.match('./index.html')) ?? Response.error();
      return Response.error();
    }
  })());
});
