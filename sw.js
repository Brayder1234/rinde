// Service worker: guarda la app para que abra sin internet.
const CACHE = 'rinde-v2';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/ui.js', './js/logic.js', './js/store.js', './js/parser.js', './js/catalog.js', './js/money.js', './js/charts.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero internet (para recibir actualizaciones); si no hay conexión o tarda, la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Fuentes de Google: se guardan la primera vez para que la app se vea igual sin internet.
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch { /* sin conexión */ }
    const cached = await cache.match(e.request, { ignoreSearch: true });
    return cached || network;
  })());
});
