// Network-only: never persist authenticated responses or private application data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
