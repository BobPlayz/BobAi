// Jarvis service worker: only shows a friendly offline page when a page can't load. It never caches chats, API
// responses or anything personal, so nothing private is stored on the device by it.
const OFFLINE = "/offline.html";
const CACHE = "jarvis-offline-v1";
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
