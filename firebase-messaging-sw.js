// Eden 54 — Service Worker (PWA caching + FCM background messages)
// Increment CACHE_VER on each deploy to bust stale caches
const CACHE_VER = 'eden54-sw-v1';

const PRECACHE = [
  '/portal/',
  '/portal/portal.css',
  '/portal/firebase-init.js',
  '/logo/eden 54 logo.jpeg',
];

// ── Install: pre-cache shell assets ──────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VER).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
});

// ── Activate: purge old cache versions ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for HTML, cache-first for static assets ──────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only intercept same-origin requests
  if (url.origin !== location.origin) return;

  if (req.destination === 'document') {
    // Network-first for pages — always try to get fresh HTML
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VER).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // Cache-first for CSS, JS, images, fonts
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          const clone = res.clone();
          caches.open(CACHE_VER).then(c => c.put(req, clone));
          return res;
        });
      })
    );
  }
});

// ── FCM: Firebase Messaging for background push notifications ─────────────────
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAexUjhTx1iBiivwB8rUdK52ANleN1DFAg',
  authDomain:        'eden54.firebaseapp.com',
  projectId:         'eden54',
  storageBucket:     'eden54.firebasestorage.app',
  messagingSenderId: '643222824531',
  appId:             '1:643222824531:web:dc643654a672c1cd0d48a6',
});

const messaging = firebase.messaging();

// Handle messages received while app is in the background / closed
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Eden 54';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:             '/logo/eden 54 logo.jpeg',
    badge:            '/logo/eden 54 logo.jpeg',
    tag:              'eden54-tab',
    requireInteraction: true,
    data:             payload.data || {},
  });
});

// Notification click → focus or open the POS tab
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const pos = list.find(c => c.url.includes('/portal/pos'));
      if (pos) return pos.focus();
      return clients.openWindow('/portal/pos/');
    })
  );
});
