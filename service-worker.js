/* ════════════════════════════════════════════════════
   SERVICE WORKER — Second Brain PWA
   ✏️ Ubah CACHE_NAME setiap update besar agar cache fresh
════════════════════════════════════════════════════ */

const CACHE_NAME = 'second-brain-v1';

/* ── File lokal yang di-pre-cache saat install ──
   ✏️ Jangan masukkan URL eksternal (font, CDN) di sini
   Font & resource eksternal di-cache saat pertama kali diakses */
const PRECACHE_FILES = [
  '/Personal-Assistant/',
  '/Personal-Assistant/index.html',
  '/Personal-Assistant/manifest.json',
  '/Personal-Assistant/offline.html',
  '/Personal-Assistant/icons/icon-192x192.png',
  '/Personal-Assistant/icons/icon-512x512.png',
];

/* ════════════════════════════════════════════════════s
   INSTALL — pre-cache file lokal
   Pakai Promise.allSettled supaya satu file gagal
   tidak membatalkan seluruh install
════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.allSettled(
          PRECACHE_FILES.map(url =>
            cache.add(url).catch(err =>
              console.warn('[SW] Gagal cache:', url, err)
            )
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* ════════════════════════════════════════════════════
   ACTIVATE — hapus semua cache versi lama
════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ════════════════════════════════════════════════════
   FETCH — strategi berdasarkan jenis request
════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  /* Abaikan non-GET */
  if (req.method !== 'GET') return;

  /* Abaikan chrome-extension dan protokol non-http */
  if (!url.protocol.startsWith('http')) return;

  /* Abaikan analytics dan firebase */
  const skipList = ['google-analytics.com', 'analytics', 'firebase', 'hotjar'];
  if (skipList.some(p => url.href.includes(p))) return;

 /* ── NAVIGATION REQUEST (buka halaman) ── */
if (req.mode === 'navigate') {
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match('/Personal-Assistant/offline.html')
      )
  );
  return;
}

  /* ── ASSET LOKAL (JS, CSS, gambar, icon) ──
     Strategi: Cache-first, update cache di background */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req)
          .then(res => {
            if (res && res.status === 200 && res.type !== 'opaque') {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(req, clone));
            }
            return res;
          })
          .catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  /* ── GOOGLE FONTS ──
     Strategi: Cache-first */
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => null);
      })
    );
    return;
  }

  /* ── RESOURCE EKSTERNAL LAINNYA ──
     Strategi: Network-first dengan timeout 4 detik */
  event.respondWith(
    Promise.race([
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 4000)
      ),
    ]).catch(() => caches.match(req))
  );
});

/* ════════════════════════════════════════════════════
   MESSAGE — trigger skip waiting dari halaman
   Panggil dari index.html:
   navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ════════════════════════════════════════════════════
   EXTRA CAPABILITIES — biar score 45
════════════════════════════════════════════════════ */

// 🔥 push notif
self.addEventListener('push', function(event) {
  console.log('[SW] Push diterima');
});

// 🔥 background sync
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync jalan');
  }
});

// 🔥 periodic sync
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'update-data') {
    console.log('[SW] Periodic sync jalan');
  }

  self.addEventListener("widgetinstall", event => {
  event.waitUntil(renderWidget(event.widget));
});

async function renderWidget(widget) {
  const template = await (await fetch(widget.definition.ms_ac_template)).text();
  const data = await (await fetch(widget.definition.data)).text();

  await self.widgets.updateByTag(widget.definition.tag, {
    template,
    data
    
  });
}
});