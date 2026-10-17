<!-- app/components/InstallApp.vue -->
<script setup>
/*
  Tombol "Pasang aplikasi".
  - Android/Chrome/Edge: muncul saat browser menyatakan web ini bisa dipasang.
  - iPhone/iPad (Safari): tidak ada tombol pemasangan dari browser, jadi tampil petunjuk singkat.
  - Tidak muncul kalau sudah dibuka sebagai aplikasi, dan disembunyikan 7 hari setelah ditutup.
*/
const KEY = 'siscverse-install-dismissed'
const DAY = 24 * 60 * 60 * 1000

const show = ref(false)
const ios = ref(false)
let deferred = null

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const onPrompt = (e) => {
  e.preventDefault()
  deferred = e
  ios.value = false
  show.value = true
}
const onInstalled = () => { show.value = false; deferred = null }

const dismiss = () => {
  show.value = false
  try { localStorage.setItem(KEY, String(Date.now())) } catch {}
}

const install = async () => {
  if (!deferred) return
  deferred.prompt()
  await deferred.userChoice.catch(() => null)
  deferred = null
  show.value = false
}

onMounted(() => {
  if (isStandalone()) return
  try {
    if (Date.now() - Number(localStorage.getItem(KEY) || 0) < 7 * DAY) return
  } catch {}

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)

  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos) { ios.value = true; show.value = true }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onPrompt)
  window.removeEventListener('appinstalled', onInstalled)
})
</script>

<template>
  <Transition name="inst">
    <div v-if="show" class="inst" role="region" aria-label="Pasang aplikasi">
      <span class="inst-icon" aria-hidden="true">📲</span>
      <p v-if="ios" class="inst-text">
        Pasang di iPhone: ketuk <strong>Bagikan</strong>, lalu <strong>Tambahkan ke Layar Utama</strong>.
      </p>
      <p v-else class="inst-text">Pasang <strong>Siscverse</strong> di HP-mu supaya bisa dibuka seperti aplikasi.</p>
      <button v-if="!ios" type="button" class="inst-btn" @click="install">Pasang</button>
      <button type="button" class="inst-close" aria-label="Tutup" @click="dismiss">&times;</button>
    </div>
  </Transition>
</template>

<style scoped>
.inst {
  position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%); z-index: 8900;
  display: flex; align-items: center; gap: 0.75rem; width: max-content; max-width: calc(100vw - 2rem);
  padding: 0.6rem 0.6rem 0.6rem 1rem; color: #eceef5; font-family: 'Inter', system-ui, sans-serif;
  background: rgba(10, 13, 22, 0.92); backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 18px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}
.inst-icon { font-size: 1.3rem; }
.inst-text { font-size: 0.85rem; line-height: 1.4; }
.inst-btn {
  flex: none; padding: 0.55rem 1.1rem; border: 0; border-radius: 12px; cursor: pointer;
  background: #f2b84b; color: #1a1204; font-family: inherit; font-size: 0.85rem; font-weight: 700;
}
.inst-btn:hover { background: #ffc95f; }
.inst-close {
  flex: none; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; color: #9ba2ba;
  background: transparent; border: 0; border-radius: 50%; font-size: 1.3rem; line-height: 1;
}
.inst-close:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.inst-enter-active, .inst-leave-active { transition: opacity 0.3s, transform 0.3s; }
.inst-enter-from, .inst-leave-to { opacity: 0; transform: translate(-50%, 12px); }
@media (prefers-reduced-motion: reduce) { .inst-enter-active, .inst-leave-active { transition: none; } }
</style>