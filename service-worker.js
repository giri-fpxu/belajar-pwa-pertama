/* ════════════════════════════════════════════════════
   SERVICE WORKER — Second Brain PWA
   ✏️ Ubah CACHE_NAME setiap update besar agar cache fresh
════════════════════════════════════════════════════ */

// ✏️ Nama cache — increment versi saat update (misal: v2, v3, dst)
const CACHE_NAME = 'second-brain-v1';

// ✏️ Daftar file yang di-cache saat install
// Tambahkan file baru yang penting di sini
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

/* ── INSTALL: cache file statis ── */
self.addEventListener('install', event => {
  console.log('[SW] Install — cache:', CACHE_NAME);
  // skipWaiting agar service worker langsung aktif tanpa reload manual
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES).catch(err => {
        console.warn('[SW] Sebagian file gagal di-cache:', err);
      });
    })
  );
});

/* ── ACTIVATE: hapus cache lama ── */
self.addEventListener('activate', event => {
  console.log('[SW] Aktif — hapus cache lama');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Hapus cache lama:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH: strategi cache-first untuk asset statis,
           network-first untuk request dinamis ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Abaikan non-GET dan chrome-extension
  if (event.request.method !== 'GET') return;
  if (url.protocol.startsWith('chrome-extension')) return;

  // ✏️ URL yang tidak perlu di-cache (tambahkan di sini jika perlu)
  const noCachePatterns = [
    'google-analytics.com',
    'analytics',
    'firebase',
  ];
  if (noCachePatterns.some(p => url.href.includes(p))) return;

  // Strategi: Cache-First untuk file lokal & Google Fonts
  if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Tidak ada di cache → fetch dari network lalu simpan
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => {
          // Offline fallback — kembalikan index.html untuk navigation request
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  // Strategi: Network-First untuk resource eksternal lainnya
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
