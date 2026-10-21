const CACHE_NAME = 'fitmate-compact-v1-cache';
const APP_SHELL = [
  './',
  './index.html',
  './css/index.css',
  './css/tokens.css',
  './css/themes.css',
  './css/components.css',
  './css/fitmate.css',
  './js/store.js',
  './js/prescription.js',
  './js/ui.js',
  './js/app.js',
  './exercises.csv',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).catch(() => caches.match('./index.html'))
    )
  );
});
