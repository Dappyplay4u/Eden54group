// Eden 54 Portal — Service Worker
const CACHE = 'eden54-sw-v3';

// Pre-fetched on install — loaded on every portal page
const PRECACHE = [
  '/portal/portal.css',
  '/portal/firebase-init.js',
  '/manifest.json',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept Firebase backend calls
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com')
  ) return;

  // Cache-first: Firebase SDKs and Google Fonts (version-pinned / stable)
  if (
    url.hostname === 'www.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Cache-first: images (1-year Netlify headers)
  if (request.destination === 'image') {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Stale-while-revalidate: portal HTML pages
  // Serves from cache instantly so nav between pages feels immediate,
  // fetches fresh copy in the background so next visit gets any updates.
  if (request.destination === 'document' && url.hostname === self.location.hostname) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Stale-while-revalidate: portal CSS and JS
  // Serves cached version instantly, fetches fresh copy in background so
  // any update (e.g. new nav links) takes effect on the very next visit.
  if (url.hostname === self.location.hostname) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network unavailable', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE);
  const cached = await cache.match(request);
  // Fetch fresh in the background — updates cache for next visit
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}
