/* PTS — Service Worker: يخزّن النظام على الجهاز ليعمل (عرض بيانات المصيدة وتسجيل القراءات) بدون إنترنت */
const CACHE = 'pts-v1';
const CDN = ['cdn.tailwindcss.com','cdnjs.cloudflare.com','unpkg.com','www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./','./index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الصفحة نفسها (حتى مع ?trap=...): الشبكة أولاً ثم النسخة المخزنة
  if (url.origin === location.origin && req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), timeout(4000)])
        .then(r => { const c = r.clone(); caches.open(CACHE).then(ch => ch.put('./index.html', c)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // ملفات النظام والمكتبات: من التخزين أولاً مع تحديث في الخلفية
  if (url.origin === location.origin || CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(r => {
          if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
