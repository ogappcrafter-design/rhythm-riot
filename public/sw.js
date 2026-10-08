/* Rhythm Riot service worker — makes the installed web app load instantly and work offline.
 * Runtime caching only (no build-time precache list, so it survives hashed asset names):
 *  - navigations: network-first, fall back to the cached shell when offline
 *  - same-origin GET assets: cache-first, then network (and cache it for next time)
 *  - cross-origin (e.g. the Supabase leaderboard): always go to the network, never cached
 */
const CACHE = 'rr-cache-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase & other hosts to the network

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        // Bypass the HTTP cache so the newest index.html (and thus the newest hashed
        // bundle) is picked up on the very next launch when online — no stale shell.
        const net = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch {
        const c = await caches.open(CACHE);
        return (await c.match(req)) || (await c.match('./')) || (await c.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net.ok) c.put(req, net.clone());
      return net;
    } catch {
      return hit || Response.error();
    }
  })());
});
