/*
  Service worker Siscverse (sederhana, sengaja tidak menyimpan data).
  - Membuat web bisa dipasang sebagai aplikasi di HP.
  - Data (jadwal, kas, foto, dst.) SELALU diambil langsung dari internet,
    jadi tidak ada risiko menampilkan data lama.
  - Kalau HP sedang offline saat membuka halaman, tampil halaman offline.html.
  Naikkan angka VERSION kalau offline.html diubah.
*/
const VERSION = 'v1'
const CACHE = 'siscverse-' + VERSION
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('siscverse-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return // selain pindah halaman: biarkan langsung ke internet
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
})