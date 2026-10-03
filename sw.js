/* sw.js — Robin's Bobins offline cache (covers the platform AND every app).
   Bump VERSION on every release. Network first, so updates arrive; cache as offline fallback. */
const VERSION = 'rb-v0.2.9';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'shared/rb.js', 'shared/robin.js', 'shared/rb-theme.css', 'shared/guest.js', 'gast/index.html', 'gast/manifest.webmanifest',
  'shared/fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'shared/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'platform/app.js', 'apps/registry.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  // Deutschland & Hessen
  'apps/geo/index.html','apps/geo/geo.css','apps/geo/data/content.js','apps/geo/data/maps.js','apps/geo/js/geo.js','apps/geo/js/kartenkunde.js','apps/geo/js/questions.js','apps/geo/js/adaptive.js','apps/geo/js/store.js','apps/geo/js/session.js','apps/geo/js/ui.js','apps/geo/js/mapview.js','apps/geo/js/quiz.js','apps/geo/js/games.js','apps/geo/js/learn.js','apps/geo/js/app.js','apps/geo/js/rb-bridge.js','apps/geo/wappen/bb.svg','apps/geo/wappen/be.svg','apps/geo/wappen/bw.svg','apps/geo/wappen/by.svg','apps/geo/wappen/hb.svg','apps/geo/wappen/he.svg','apps/geo/wappen/hh.svg','apps/geo/wappen/mv.svg','apps/geo/wappen/ni.svg','apps/geo/wappen/nw.svg','apps/geo/wappen/rp.svg','apps/geo/wappen/sh.svg','apps/geo/wappen/sl.svg','apps/geo/wappen/sn.svg','apps/geo/wappen/st.svg','apps/geo/wappen/th.svg',
  // Diktat Trainer
  'apps/diktat/js/rb-bridge.js', 'apps/diktat/index.html','apps/diktat/styles.css','apps/diktat/manifest.webmanifest','apps/diktat/js/compare.js','apps/diktat/js/sentences.js','apps/diktat/js/store.js','apps/diktat/js/speech.js','apps/diktat/js/practice.js','apps/diktat/js/app.js','apps/diktat/fonts/atkinson-hyperlegible-latin-400-normal.woff2','apps/diktat/fonts/atkinson-hyperlegible-latin-700-normal.woff2','apps/diktat/fonts/OpenDyslexic-Regular.woff','apps/diktat/fonts/OpenDyslexic-Bold.woff','apps/diktat/icons/icon.svg','apps/diktat/icons/icon-192.png','apps/diktat/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
