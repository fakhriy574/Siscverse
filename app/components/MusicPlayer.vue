<!-- app/components/MusicPlayer.vue -->
<script setup>
/*
  Musik latar.
  - Saat halaman dibuka, mencoba memutar dengan suara (berhasil kalau browser mengizinkan).
  - Kalau diblokir, lagu tetap jalan dalam keadaan muted (selalu diizinkan browser),
    lalu suara menyala otomatis pada interaksi pertama (klik / ketuk / tombol keyboard).
  - Scroll dan hover tidak dihitung interaksi oleh browser.
  - Tombol bulat di pojok untuk jeda/putar. Jeda lewat tombol diingat
    (tidak diputar otomatis lagi sampai ditekan putar).
  - Tidak diputar di halaman admin dan login.
*/
const SRC = '/audio/lit.mp3' // file ada di  public/audio/lit.mp3
const TITLE = 'Lay Zhang (Yixing) - LIT'
const VOLUME = 0.35
const KEY = 'siscverse-music'
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchstart', 'touchend', 'keydown']

const route = useRoute()
const audio = ref(null)
const playing = ref(false)
const silent = ref(false) // berjalan tapi masih muted (menunggu interaksi)
const failed = ref(false)

let pausedByUser = false
let starting = false
let fadeTimer

const hidden = computed(() => /^\/(admin|auth|login)(\/|$)/.test(route.path))

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch {} }
}

const fadeIn = () => {
  const a = audio.value
  if (!a) return
  clearInterval(fadeTimer)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { a.volume = VOLUME; return }
  a.volume = 0
  const step = VOLUME / 30
  fadeTimer = setInterval(() => {
    a.volume = Math.min(a.volume + step, VOLUME)
    if (a.volume >= VOLUME) clearInterval(fadeTimer)
  }, 50)
}

// Putar dengan suara (butuh izin browser)
const start = async () => {
  const a = audio.value
  if (!a || hidden.value || starting || playing.value) return playing.value && !silent.value
  starting = true
  try {
    a.muted = false
    a.volume = 0
    await a.play()
    playing.value = true
    silent.value = false
    fadeIn()
    return true
  } catch {
    return false
  } finally {
    starting = false
  }
}

// Cadangan: putar muted (selalu diizinkan browser)
const startMuted = async () => {
  const a = audio.value
  if (!a || hidden.value) return false
  try {
    a.muted = true
    a.volume = VOLUME
    await a.play()
    playing.value = true
    silent.value = true
    return true
  } catch {
    return false
  }
}

// Nyalakan suara dari mode muted (harus dipanggil dari gestur pengunjung)
const unmute = () => {
  const a = audio.value
  if (!a) return
  a.muted = false
  silent.value = false
  fadeIn()
}

const stop = () => {
  clearInterval(fadeTimer)
  audio.value?.pause()
  if (audio.value) audio.value.muted = false
  playing.value = false
  silent.value = false
}

// Interaksi pertama pengunjung
const unlock = async () => {
  if (pausedByUser || hidden.value || failed.value) return
  if (silent.value) { unmute(); removeUnlock(); return }
  if (await start()) removeUnlock()
}
const addUnlock = () => UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock, { passive: true }))
const removeUnlock = () => UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock))

// Tombol di pojok
const toggle = async () => {
  if (playing.value && silent.value) { // masih muted: ketukan pertama = nyalakan suara
    pausedByUser = false
    store.set(KEY, 'on')
    unmute()
    removeUnlock()
    return
  }
  if (playing.value) {
    pausedByUser = true
    store.set(KEY, 'off')
    stop()
  } else {
    pausedByUser = false
    store.set(KEY, 'on')
    await start()
  }
}

const boot = async () => {
  if (await start()) return // 1. langsung berbunyi kalau browser mengizinkan
  await startMuted()        // 2. kalau tidak, jalan muted dulu
  addUnlock()               // 3. suara menyala di interaksi pertama
}

onMounted(async () => {
  pausedByUser = store.get(KEY) === 'off'
  if (pausedByUser || hidden.value) return
  await boot()
})

// Masuk ke halaman admin: hentikan. Kembali ke halaman publik: lanjutkan.
watch(hidden, async (h) => {
  if (h) { stop(); removeUnlock(); return }
  if (!pausedByUser) await boot()
})

onBeforeUnmount(() => {
  clearInterval(fadeTimer)
  removeUnlock()
  audio.value?.pause()
})
</script>

<template>
  <div>
    <!-- Elemen audio selalu ada supaya tidak terputus saat tombol disembunyikan -->
    <audio ref="audio" :src="SRC" loop preload="auto" @error="failed = true"></audio>

    <div v-if="!hidden && !failed" class="music">
      <button
        type="button"
        class="music-btn"
        :class="{ on: playing && !silent }"
        :aria-pressed="playing && !silent"
        :aria-label="silent ? 'Nyalakan suara musik latar' : playing ? 'Jeda musik latar' : 'Putar musik latar'"
        :title="(silent ? 'Nyalakan suara: ' : playing ? 'Jeda: ' : 'Putar: ') + TITLE"
        @click="toggle"
      >
        <span v-if="playing" class="bars" :class="{ muted: silent }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Pindahkan tombol dengan mengubah left/bottom (atau ganti ke right) di sini */
.music { position: fixed; left: 1rem; bottom: 1rem; z-index: 9000; }
.music-btn {
  width: 46px; height: 46px; display: grid; place-items: center; cursor: pointer; color: #fff;
  background: rgba(20, 25, 40, 0.65); backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 50%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); transition: transform 0.2s, background 0.2s, border-color 0.2s;
}
.music-btn:hover { transform: scale(1.08); background: rgba(40, 50, 80, 0.75); }
.music-btn:focus-visible { outline: 2px solid #f2b84b; outline-offset: 3px; }
.music-btn.on { border-color: rgba(242, 184, 75, 0.7); box-shadow: 0 0 22px rgba(242, 184, 75, 0.35); }

.bars { display: flex; align-items: flex-end; gap: 3px; height: 18px; }
.bars i { display: block; width: 3px; height: 100%; background: #f2b84b; border-radius: 2px; transform-origin: bottom; animation: eq 0.9s ease-in-out infinite; }
.bars i:nth-child(2) { animation-delay: -0.3s; }
.bars i:nth-child(3) { animation-delay: -0.6s; }
.bars i:nth-child(4) { animation-delay: -0.15s; }
.bars.muted i { background: rgba(255, 255, 255, 0.55); } /* muted: menunggu ketukan */
@keyframes eq { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }

@media (prefers-reduced-motion: reduce) {
  .bars i { animation: none; transform: scaleY(0.7); }
  .music-btn { transition: none; }
}
</style>