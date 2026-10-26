/* IsaZen service worker: lets the app install on a phone and open fast / offline.
   Strategy: network first (so you always get the newest version), cached copy when offline.
   Never touches Supabase or /api/ calls, so your data and the Peso chat are always live. */
const CACHE = 'isazen-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'companion.js', 'mascot.js', 'mascot.webp', 'offline.js', 'brand.js', 'theme.js', 'config.js', 'pwa.js', 'mark.png', 'logo-full.png', 'icon-192.png', 'manifest.webmanifest'];
const CDN = ['cdn.jsdelivr.net'];
const LIBS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})).concat(LIBS.map(u => fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  } else if (CDN.includes(url.hostname)) { // pinned library scripts: cache first, refresh in background
    e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => hit); return hit || net; }));
  }
});
