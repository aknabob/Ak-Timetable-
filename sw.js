/* Akeem Timetable (multi-page) — service worker for Chrome install / offline */
const CACHE = 'akeem-timetable-pages-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      const base = self.registration.scope;
      return Promise.allSettled([
        cache.add(base),
        cache.add(base + 'index.html'),
        cache.add(base + 'exam.html'),
        cache.add(base + 'study.html'),
        cache.add(base + 'css/app.css'),
        cache.add(base + 'js/app.js'),
        cache.add(base + 'manifest.json')
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => {
            if (hit) return hit;
            return caches.match('./index.html').then((h2) => h2 || caches.match('./'));
          }).then((hit) => {
            if (hit) return hit;
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui;padding:24px;text-align:center"><h1>Offline</h1><p>Open the site once while online, then the installed app can load.</p><p><a href="./">Retry</a></p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
    })
  );
});
