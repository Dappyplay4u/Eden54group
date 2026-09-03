/* Kill switch — the old Eden 54 portal service worker is retired.
   Browsers that installed it will fetch this on their next update check:
   it wipes every cache, unregisters itself, and reloads open tabs so no
   stale /portal/ pages are served. Safe to delete once traffic has drained. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.navigate(client.url);
    }
  })());
});
