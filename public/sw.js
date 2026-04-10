// Faith Notebook Service Worker
// Minimal SW — required for Chrome PWA installability criteria.
// No aggressive caching; all requests go to network as normal.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
