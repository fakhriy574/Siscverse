// app/plugins/pwa.ts
// Menambahkan tag PWA ke <head> dan mendaftarkan service worker.
// Tidak perlu mengubah nuxt.config.ts.
export default defineNuxtPlugin(() => {
  useHead({
    meta: [
      { name: 'theme-color', content: '#05060b' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Siscverse' }
    ],
    link: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/pwa-192x192.png' }
    ]
  })

  // Service worker hanya dipasang di versi produksi (hasil deploy), bukan saat npm run dev
  if (import.meta.client && !import.meta.dev && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
})