// Eden 54 Portal — Service Worker
// Caches Firebase SDKs, fonts, and static assets so the PWA loads fast from home screen.
const CACHE = 'eden54-sw-v1';

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

  // Never intercept Firebase backend calls — let Firebase SDK handle these directly
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com')
  ) return;

  // Cache-first: Firebase SDKs and Google Fonts
  // These URLs are version-pinned or stable — safe to serve from cache indefinitely
  if (
    url.hostname === 'www.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Cache-first: images (already have 1-year Netlify headers)
  if (request.destination === 'image') {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Network-first: all portal pages and assets
  // Tries network so updates always apply; falls back to cache when offline
  if (url.hostname === self.location.hostname) {
    e.respondWith(networkFirst(request));
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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
