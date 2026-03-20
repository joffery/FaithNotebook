// Faith Notebook Service Worker
// Minimal SW — required for Chrome PWA installability criteria.
// No aggressive caching; all requests go to network as normal.

const CACHE_NAME = 'faith-notebook-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Pass-through fetch — do not cache API/Supabase/Gemini calls
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
