// Lets SwaraVeda open and record without internet. The page and its scripts
// are kept on the device; API calls always go to the network.
const CACHE = 'swaraveda-v2';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = await fetch('/', { cache: 'no-store' });
    const html = await page.clone().text();
    await cache.put('/', page);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll(assets);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages: the newest from the network, the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/', { ignoreVary: true })) ?? Response.error();
      }
    })());
    return;
  }

  // Built scripts and styles never change under the same name; fonts rarely do.
  const keep = (url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!keep) return;
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});
