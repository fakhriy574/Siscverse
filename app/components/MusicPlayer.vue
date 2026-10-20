<!-- app/components/MusicPlayer.vue -->
<script setup>
/*
  Musik latar.
  - Saat halaman dibuka, komponen mencoba memutar lagu langsung (autoplay).
  - Semua browser melarang suara otomatis sebelum pengunjung menyentuh halaman.
    Kalau diblokir, muncul layar sambutan dengan tombol "Masuk dengan musik".
  - HANYA ADA SATU PEMUTAR, di dua tingkat:
      1) Dalam satu halaman: objek audio dibuat sekali dan dipakai bersama.
      2) Antar tab dan jendela (tab browser + aplikasi yang sudah dipasang): memakai
         "kunci" Web Locks. Jendela yang tidak memegang kunci tidak boleh memutar lagu.
         Autoplay tidak merebut kunci; menekan tombol putar merebutnya dan jendela
         yang lama berhenti.
  - Tombol bulat di pojok untuk jeda/putar. Jeda lewat tombol diingat. "Tanpa musik"
    di layar sambutan hanya berlaku selama tab itu terbuka.
  - Tidak diputar di halaman admin dan login.
*/
const SRC = '/audio/lit.mp3' // file ada di  public/audio/lit.mp3
const TITLE = 'Lay Zhang (Yixing) - LIT'
const VOLUME = 0.35
const KEY = 'siscverse-music'
const SKIP_KEY = 'siscverse-music-skip'
const LOCK = 'siscverse-music-player'

const route = useRoute()
const playing = ref(false)
const gate = ref(false)
const failed = ref(false)
const enterBtn = ref(null)

let pausedByUser = false
let starting = false
let lastFail = '' // 'busy' = jendela lain sedang memutar, 'blocked' = browser menolak autoplay
const cleanups = []

const hidden = computed(() => /^\/(admin|auth|login)(\/|$)/.test(route.path))

const store = (area) => ({
  get: (k) => { try { return window[area].getItem(k) } catch { return null } },
  set: (k, v) => { try { window[area].setItem(k, v) } catch {} }
})

// Satu-satunya objek audio untuk seluruh halaman
const getAudio = () => {
  if (!window.__siscverseAudio) {
    const a = new Audio(SRC)
    a.loop = true
    a.preload = 'auto'
    window.__siscverseAudio = a
  }
  return window.__siscverseAudio
}

/* ===== kunci antar tab/jendela ===== */
const releaseLock = () => {
  const r = window.__siscverseRelease
  if (r) { window.__siscverseRelease = null; r() }
}

const takeLock = (steal) => {
  if (!('locks' in navigator)) return Promise.resolve(true) // browser lama: tanpa pengaman lintas jendela
  if (window.__siscverseRelease) return Promise.resolve(true) // halaman ini sudah memegang kunci
  return new Promise((resolve) => {
    navigator.locks
      .request(LOCK, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) { resolve(false); return null }
        resolve(true)
        return new Promise((release) => { window.__siscverseRelease = release }) // tahan kunci selama memutar
      })
      .then(() => { window.__siscverseRelease = null })
      .catch(() => {
        // kunci direbut jendela lain: berhenti di sini
        window.__siscverseRelease = null
        const a = getAudio()
        clearInterval(a.__fade)
        a.pause()
        playing.value = false
      })
  })
}

const fadeIn = () => {
  const a = getAudio()
  clearInterval(a.__fade)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { a.volume = VOLUME; return }
  a.volume = 0
  const step = VOLUME / 30
  a.__fade = setInterval(() => {
    a.volume = Math.min(a.volume + step, VOLUME)
    if (a.volume >= VOLUME) clearInterval(a.__fade)
  }, 50)
}

// steal = true hanya untuk tindakan pengunjung (tombol putar / masuk dengan musik)
const start = async (steal = false) => {
  const a = getAudio()
  lastFail = ''
  if (hidden.value || starting) return !a.paused
  if (!a.paused) { playing.value = true; return true } // sudah berbunyi, jangan dimulai lagi
  starting = true
  try {
    if (!(await takeLock(steal))) { lastFail = 'busy'; return false }
    a.volume = 0
    await a.play()
    playing.value = true
    fadeIn()
    return true
  } catch {
    releaseLock()
    lastFail = 'blocked'
    playing.value = false
    return false
  } finally {
    starting = false
  }
}

const stop = () => {
  const a = getAudio()
  clearInterval(a.__fade)
  a.pause()
  releaseLock()
  playing.value = false
}

// Tombol di pojok
const toggle = async () => {
  if (playing.value) {
    pausedByUser = true
    store('localStorage').set(KEY, 'off')
    stop()
  } else {
    pausedByUser = false
    store('localStorage').set(KEY, 'on')
    await start(true)
  }
}

// Layar sambutan
const enter = async () => {
  pausedByUser = false
  store('localStorage').set(KEY, 'on')
  gate.value = false // ketukan ini yang memberi izin suara dari browser
  await start(true)
}
const skip = () => {
  store('sessionStorage').set(SKIP_KEY, '1')
  gate.value = false
}

onMounted(async () => {
  const a = getAudio()
  playing.value = !a.paused

  const onError = () => { failed.value = true }
  a.addEventListener('error', onError)
  cleanups.push(() => a.removeEventListener('error', onError))
  if (a.error) failed.value = true

  pausedByUser = store('localStorage').get(KEY) === 'off'
  if (pausedByUser || hidden.value || !a.paused) return
  const ok = await start(false) // autoplay tidak merebut kunci dari jendela lain
  if (ok || failed.value) return
  if (lastFail === 'busy') return // jendela lain sudah memutar; di sini diam, tombol tetap bisa dipakai
  if (store('sessionStorage').get(SKIP_KEY) !== '1') gate.value = true
})

// Kunci gulir selama layar sambutan tampil, dan fokuskan tombol utamanya
watch(gate, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    await nextTick()
    enterBtn.value?.focus()
  }
})

// Masuk ke halaman admin: hentikan. Kembali ke halaman publik: lanjutkan.
watch(hidden, async (h) => {
  if (h) { stop(); gate.value = false; return }
  if (!pausedByUser) await start(false)
})

onBeforeUnmount(() => {
  cleanups.forEach((fn) => fn())
  document.body.style.overflow = ''
  if (window.__siscverseAudio) stop() // lagu berhenti saat meninggalkan halaman ini; objek audionya tetap satu
})
</script>

<template>
  <div>
    <!-- Layar sambutan: hanya muncul kalau browser memblokir suara otomatis -->
    <Transition name="gate">
      <div
        v-if="gate && !hidden && !failed"
        class="gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        @keydown.esc="skip"
      >
        <div class="gate-card">
          <p class="gate-note" aria-hidden="true">&#9835;</p>
          <h2 id="gate-title" class="gate-title">Siscverse</h2>
          <p class="gate-text">Halaman ini ditemani musik. Ketuk tombol di bawah untuk masuk.</p>
          <button ref="enterBtn" type="button" class="gate-btn gate-primary" @click="enter">Masuk dengan musik</button>
          <button type="button" class="gate-btn gate-ghost" @click="skip">Tanpa musik</button>
          <p class="gate-track">{{ TITLE }}</p>
        </div>
      </div>
    </Transition>

    <div v-if="!hidden && !failed" class="music">
      <button
        type="button"
        class="music-btn"
        :class="{ on: playing }"
        :aria-pressed="playing"
        :aria-label="playing ? 'Jeda musik latar' : 'Putar musik latar'"
        :title="(playing ? 'Jeda: ' : 'Putar: ') + TITLE"
        @click="toggle"
      >
        <span v-if="playing" class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
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
/* ===== layar sambutan ===== */
.gate {
  position: fixed; inset: 0; z-index: 9500; padding: 1.25rem;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(90% 70% at 50% 0%, rgba(74, 140, 255, 0.18), transparent 60%), rgba(3, 4, 10, 0.88);
  backdrop-filter: blur(14px);
  font-family: 'Inter', system-ui, sans-serif; color: #fff;
}
.gate-card { width: 100%; max-width: 360px; text-align: center; display: flex; flex-direction: column; align-items: stretch; gap: 0.7rem; }
.gate-note { font-size: 2.2rem; line-height: 1; color: #f2b84b; }
.gate-title { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: clamp(2.6rem, 12vw, 3.6rem); line-height: 1; letter-spacing: -0.02em; }
.gate-text { color: #b9bfd6; line-height: 1.6; margin: 0.4rem 0 1rem; }
.gate-btn { padding: 0.95rem 1.4rem; border-radius: 12px; font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s; }
.gate-primary { background: #f2b84b; color: #1a1204; border: 1px solid transparent; }
.gate-primary:hover { background: #ffc95f; transform: translateY(-1px); box-shadow: 0 8px 28px -6px rgba(242, 184, 75, 0.55); }
.gate-ghost { background: transparent; color: #eceef5; border: 1px solid rgba(255, 255, 255, 0.22); }
.gate-ghost:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.35); }
.gate-btn:focus-visible { outline: 2px solid #f2b84b; outline-offset: 3px; }
.gate-track { margin-top: 0.6rem; font-size: 0.8rem; color: #7d86a3; }
.gate-enter-active, .gate-leave-active { transition: opacity 0.35s; }
.gate-enter-from, .gate-leave-to { opacity: 0; }

/* ===== tombol di pojok ===== */
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
@keyframes eq { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }

@media (prefers-reduced-motion: reduce) {
  .bars i { animation: none; transform: scaleY(0.7); }
  .gate-enter-active, .gate-leave-active, .gate-btn, .music-btn { transition: none; }
}
</style>