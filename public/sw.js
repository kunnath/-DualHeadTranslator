const CACHE_NAME = 'dual-headset-translator-v1';
const urlsToCache = [
  '/dual-headset',
  '/dual-headset.html',
  '/dual-headset.css',
  '/dual-headset.js',
  '/socket.io/socket.io.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});
