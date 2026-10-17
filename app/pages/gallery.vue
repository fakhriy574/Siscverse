<!-- pages/gallery.vue -->
<script setup>
useHead({
  title: 'Galeri | Siscverse',
  meta: [{ name: 'description', content: 'Galeri foto kegiatan kelas Siscverse.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
  ]
})

const supabase = useSupabaseClient()

/* ===== AMBIL DATA DARI SUPABASE (hanya baca) ===== */
const { data: rows, pending, error } = useAsyncData(
  'gallery-public',
  async () => {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('taken_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  { server: false, lazy: true, default: () => [] }
)

// Error fetch tampil di console browser (F12) supaya tidak tertelan diam-diam
watch(error, (e) => { if (e) console.error('[gallery] gagal:', e) }, { immediate: true })

// Foto yang gagal dimuat disembunyikan, bukan ditampilkan rusak
const broken = reactive(new Set())
const photos = computed(() =>
  (Array.isArray(rows.value) ? rows.value : []).filter((p) => p.image_url && !broken.has(p.id))
)

/* ===== FILTER ALBUM ===== */
const album = ref('Semua')
const albums = computed(() => {
  const counts = new Map()
  photos.value.forEach((p) => {
    const a = (p.album || '').trim()
    if (a) counts.set(a, (counts.get(a) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'id'))
    .map(([name, count]) => ({ name, count }))
})
const filtered = computed(() =>
  album.value === 'Semua' ? photos.value : photos.value.filter((p) => (p.album || '').trim() === album.value)
)

// Kalau album yang dipilih sudah tidak ada, kembali ke "Semua"
watch(albums, (list) => {
  if (album.value !== 'Semua' && !list.some((a) => a.name === album.value)) album.value = 'Semua'
})

/* ===== TAMPILKAN LEBIH BANYAK ===== */
const PAGE = 24
const visible = ref(PAGE)
watch(album, () => { visible.value = PAGE })
const shown = computed(() => filtered.value.slice(0, visible.value))

/* ===== FORMAT TANGGAL ===== */
const formatDate = (v) => {
  if (!v) return ''
  return new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
const dayOf = (v) => (v ? new Date(v + 'T00:00:00').getDate() : '')
const monOf = (v) => (v ? new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' }).toUpperCase() : '')
const yearOf = (v) => (v ? new Date(v + 'T00:00:00').getFullYear() : '')

/* ===== WARNA PER ALBUM (planet di jalur) ===== */
const PALETTE = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#22d3ee']
const albumColor = (name) => {
  const s = (name || '').trim()
  if (!s) return '#94a3b8'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/* ===== KELOMPOK PER BULAN (linimasa) ===== */
const monthLabel = (key) => {
  if (key === 'none') return 'Tanpa tanggal'
  const d = new Date(key + '-01T00:00:00')
  if (isNaN(d.getTime())) return key
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
const groups = computed(() => {
  const map = new Map()
  let idx = 0
  shown.value.forEach((p) => {
    const key = (p.taken_at || p.created_at || '').slice(0, 7) || 'none'
    if (!map.has(key)) map.set(key, { key, label: monthLabel(key), items: [] })
    map.get(key).items.push({ p, side: idx % 2 === 0 ? 'left' : 'right' })
    idx++
  })
  return [...map.values()]
})

/* ===== MUNCUL SAAT DI-SCROLL ===== */
const trail = ref(null)
const seen = reactive(new Set())
let io = null

const observe = async () => {
  await nextTick()
  if (!trail.value || typeof window === 'undefined') return
  const els = trail.value.querySelectorAll('.entry[data-id]')
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => seen.add(el.dataset.id))
    return
  }
  if (!io) {
    io = new IntersectionObserver(
      (list) => {
        list.forEach((en) => {
          if (en.isIntersecting) {
            seen.add(en.target.dataset.id)
            io.unobserve(en.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
  }
  els.forEach((el) => { if (!seen.has(el.dataset.id)) io.observe(el) })
}
watch(groups, observe, { flush: 'post' })

/* ===== LIGHTBOX ===== */
const openIndex = ref(-1)
const current = computed(() => (openIndex.value >= 0 ? filtered.value[openIndex.value] || null : null))

const open = (id) => { openIndex.value = filtered.value.findIndex((p) => p.id === id) }
const close = () => { openIndex.value = -1 }
const step = (d) => {
  const n = filtered.value.length
  if (!n || openIndex.value < 0) return
  openIndex.value = (openIndex.value + d + n) % n
}

const onKey = (e) => {
  if (openIndex.value < 0) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') step(-1)
  else if (e.key === 'ArrowRight') step(1)
}

// Geser jari di layar sentuh
let touchX = 0
const onTouchStart = (e) => { touchX = e.changedTouches[0].clientX }
const onTouchEnd = (e) => {
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
}

// Muat foto tetangga lebih dulu supaya pindah foto terasa cepat
watch(openIndex, (i) => {
  if (typeof document !== 'undefined') document.body.style.overflow = i >= 0 ? 'hidden' : ''
  if (i < 0) return
  const n = filtered.value.length
  ;[-1, 1].forEach((d) => {
    const p = filtered.value[(i + d + n) % n]
    if (p) new Image().src = p.image_url
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  observe()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  if (io) io.disconnect()
})
</script>

<template>
  <div class="glass-aurora-page">

    <!-- Latar Belakang Aurora Glow -->
    <div class="aurora-bg">
      <div class="aurora-blob blob-1"></div>
      <div class="aurora-blob blob-2"></div>
      <div class="aurora-blob blob-3"></div>
    </div>

    <div class="noise-overlay"></div>
    <SpaceSky />
    <AppNavbar />

    <main class="main-layout">

      <!-- HEADER -->
      <header class="header-section">
        <div class="badge-glass">GALERI SISCVERSE</div>
        <h1 class="title">Momen yang<br/><span class="text-gradient">Kami Simpan</span></h1>
        <p class="subtitle">Foto-foto kegiatan kelas, dari yang serius sampai yang tidak sengaja lucu. Klik foto untuk memperbesar.</p>
      </header>

      <!-- LOADER -->
      <div v-if="pending" class="loading-state">
        <div class="spinner"></div>
        <p>Memuat foto...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <div class="state-icon">!</div>
        <p>Gagal memuat galeri: {{ error.message }}</p>
      </div>

      <template v-else>
        <!-- FILTER ALBUM -->
        <div v-if="albums.length" class="tabs">
          <button :class="['tab-btn', { active: album === 'Semua' }]" @click="album = 'Semua'">
            Semua <span class="tab-count">{{ photos.length }}</span>
          </button>
          <button v-for="a in albums" :key="a.name" :class="['tab-btn', { active: album === a.name }]" @click="album = a.name">
            <span class="tab-dot" :style="{ background: albumColor(a.name) }"></span>
            {{ a.name }} <span class="tab-count">{{ a.count }}</span>
          </button>
        </div>

        <!-- KOSONG -->
        <div v-if="filtered.length === 0" class="state-box">
          <div class="state-icon">!</div>
          <p>Belum ada foto di galeri.</p>
        </div>

        <!-- LINIMASA PERJALANAN -->
        <section v-else ref="trail" class="trail" aria-label="Foto galeri">
          <p class="end-mark end-top"><span>Terbaru</span></p>

          <template v-for="g in groups" :key="g.key">
            <h2 class="month"><span>{{ g.label }}</span></h2>

            <article
              v-for="item in g.items"
              :key="item.p.id"
              :data-id="String(item.p.id)"
              :class="['entry', item.side, { in: seen.has(String(item.p.id)) }]"
              :style="{ '--c': albumColor(item.p.album) }"
            >
              <span class="node" aria-hidden="true"></span>

              <div v-if="item.p.taken_at" class="when" aria-hidden="true">
                <b>{{ dayOf(item.p.taken_at) }}</b>
                <span>{{ monOf(item.p.taken_at) }} {{ yearOf(item.p.taken_at) }}</span>
              </div>

              <button
                type="button"
                class="card"
                :aria-label="'Buka foto' + (item.p.caption ? ': ' + item.p.caption : '')"
                @click="open(item.p.id)"
              >
                <span class="card-img">
                  <img
                    :src="item.p.image_url"
                    :alt="item.p.caption || 'Foto kegiatan kelas'"
                    loading="lazy"
                    decoding="async"
                    @error="broken.add(item.p.id)"
                  />
                </span>
                <span class="card-body">
                  <span class="card-title">{{ item.p.caption || 'Momen kelas' }}</span>
                  <span v-if="item.p.album || item.p.taken_at" class="card-meta">
                    <span v-if="item.p.album" class="chip">{{ item.p.album }}</span>
                    <span v-if="item.p.taken_at" class="card-date">{{ formatDate(item.p.taken_at) }}</span>
                  </span>
                </span>
              </button>
            </article>
          </template>

          <p class="end-mark end-bottom"><span>Awal perjalanan</span></p>
        </section>

        <div v-if="filtered.length > visible" class="more-wrap">
          <button class="more-btn" @click="visible += PAGE">Tampilkan lebih banyak</button>
        </div>
      </template>

    </main>

    <!-- LIGHTBOX -->
    <Transition name="lb">
      <div
        v-if="current"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Pratinjau foto"
        @click.self="close"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <button class="lb-close" type="button" aria-label="Tutup" @click="close">&times;</button>
        <p class="lb-count">{{ openIndex + 1 }} / {{ filtered.length }}</p>

        <button v-if="filtered.length > 1" class="lb-nav lb-prev" type="button" aria-label="Foto sebelumnya" @click="step(-1)">&#8249;</button>

        <figure class="lb-figure" @click.self="close">
          <img :key="current.id" :src="current.image_url" :alt="current.caption || 'Foto kegiatan kelas'" class="lb-img" />
          <figcaption v-if="current.caption || current.album || current.taken_at" class="lb-cap">
            <span v-if="current.caption" class="lb-cap-text">{{ current.caption }}</span>
            <span class="lb-meta">
              <template v-if="current.album">{{ current.album }}</template>
              <template v-if="current.album && current.taken_at"> &middot; </template>
              <template v-if="current.taken_at">{{ formatDate(current.taken_at) }}</template>
            </span>
          </figcaption>
        </figure>

        <button v-if="filtered.length > 1" class="lb-nav lb-next" type="button" aria-label="Foto berikutnya" @click="step(1)">&#8250;</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ================= GLOBAL SETTINGS ================= */
* { box-sizing: border-box; margin: 0; padding: 0; }

.glass-aurora-page {
  --bg: #05050a;
  --glass-bg: rgba(20, 25, 40, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-secondary: #94a3b8;

  font-family: 'Inter', -apple-system, sans-serif;
  background-color: var(--bg);
  color: var(--text-primary);
  min-height: 100vh;
  padding-bottom: 6rem;
  position: relative;
  overflow-x: hidden;
}

/* ================= BACKGROUND AURORA & NOISE ================= */
.aurora-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.aurora-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; animation: float 20s ease-in-out infinite alternate; }
.blob-1 { top: -10%; left: -10%; width: 500px; height: 500px; background: #3b82f6; }
.blob-2 { top: 40%; right: -10%; width: 400px; height: 400px; background: #8b5cf6; animation-delay: -5s; }
.blob-3 { bottom: -20%; left: 20%; width: 600px; height: 600px; background: #0ea5e9; animation-delay: -10s; }

.noise-overlay {
  position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0.03;
  background-image: url('data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
}

.main-layout { max-width: 1200px; margin: 0 auto; padding: 5rem 1.5rem; position: relative; z-index: 10; }

/* ================= HEADER ================= */
.header-section { margin-bottom: 3.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
.badge-glass {
  display: inline-block; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;
  font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.2em;
  background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; backdrop-filter: blur(10px);
}
.title { font-family: 'Outfit', sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.02em; }
.text-gradient { background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; line-height: 1.6; }

/* ================= STATES ================= */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; gap: 1rem; color: var(--text-secondary); }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.state-box { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); text-align: center; }
.state-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

/* ================= FILTER ALBUM ================= */
.tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; margin-bottom: 3rem; }
.tab-btn {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1.4rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.tab-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.tab-btn.active { background: #fff; color: #000; border-color: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.3); }
.tab-count { font-size: 0.75rem; font-weight: 600; opacity: 0.6; }
.tab-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }

/* ================= LINIMASA ================= */
.trail { position: relative; max-width: 1040px; margin: 0 auto; padding: 0.5rem 0 1rem; }

/* Jalur cahaya */
.trail::before {
  content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; transform: translateX(-1px);
  background: linear-gradient(180deg, transparent, rgba(147, 197, 253, 0.55) 6%, rgba(167, 139, 250, 0.45) 94%, transparent);
}
/* Kilau yang meluncur di sepanjang jalur */
.trail::after {
  content: ''; position: absolute; top: 0; left: 50%; width: 4px; height: 90px; margin-left: -2px; border-radius: 4px;
  background: linear-gradient(180deg, transparent, #bfdbfe, transparent); filter: blur(1px);
  animation: comet 7s ease-in-out infinite; pointer-events: none;
}
@keyframes comet { 0% { transform: translateY(-90px); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(calc(100vh + 400px)); opacity: 0; } }

.end-mark { position: relative; z-index: 2; display: flex; justify-content: center; }
.end-mark span {
  padding: 0.4rem 1.1rem; font-family: 'Outfit', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--text-secondary); background: rgba(10, 12, 22, 0.85); border: 1px solid var(--glass-border); border-radius: 100px;
}
.end-top { margin-bottom: 1.5rem; }
.end-bottom { margin-top: 1rem; }

/* Penanda bulan */
.month { position: relative; z-index: 2; display: flex; justify-content: center; margin: 1.5rem 0 2rem; }
.month span {
  padding: 0.55rem 1.4rem; font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
  color: #fff; background: rgba(20, 25, 40, 0.85); border: 1px solid rgba(147, 197, 253, 0.35); border-radius: 100px;
  backdrop-filter: blur(10px); box-shadow: 0 0 24px rgba(96, 165, 250, 0.25);
}

/* Satu momen */
.entry {
  position: relative; display: grid; grid-template-columns: 1fr 72px 1fr; align-items: center;
  margin-bottom: 3rem;
  opacity: 0; transition: opacity 0.7s ease, transform 0.7s cubic-bezier(.2, .8, .2, 1);
}
.entry.left { transform: translateX(-32px); }
.entry.right { transform: translateX(32px); }
.entry.in { opacity: 1; transform: none; }

.node {
  grid-column: 2; grid-row: 1; justify-self: center; position: relative; z-index: 2;
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, var(--c) 62%);
  box-shadow: 0 0 0 6px rgba(255,255,255,0.06), 0 0 24px 5px var(--c);
}

/* Tanggal besar di sisi seberang */
.when { grid-row: 1; display: flex; flex-direction: column; gap: 0.1rem; }
.when b { font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 800; line-height: 1; color: rgba(255,255,255,0.9); }
.when span { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.16em; color: var(--c); }
.entry.left .when { grid-column: 3; justify-self: start; padding-left: 0.5rem; }
.entry.right .when { grid-column: 1; justify-self: end; text-align: right; padding-right: 0.5rem; }

/* Kartu foto */
.card {
  grid-row: 1; width: 100%; max-width: 440px; padding: 0; overflow: hidden; text-align: left; cursor: zoom-in; color: inherit;
  background: var(--glass-bg); backdrop-filter: blur(14px);
  border: 1px solid var(--glass-border); border-radius: 22px;
  box-shadow: 0 18px 44px rgba(0,0,0,0.45);
  transition: transform 0.35s, border-color 0.35s, box-shadow 0.35s;
}
.entry.left .card { grid-column: 1; justify-self: end; }
.entry.right .card { grid-column: 3; justify-self: start; }
.card:hover, .card:focus-visible {
  transform: translateY(-6px); border-color: var(--c);
  box-shadow: 0 26px 56px rgba(0,0,0,0.55), 0 0 34px -6px var(--c);
}
.card:focus-visible { outline: 2px solid #3b82f6; outline-offset: 4px; }

.card-img { display: block; aspect-ratio: 16 / 10; overflow: hidden; background: #131726; }
.card-img img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s ease; }
.card:hover .card-img img { transform: scale(1.06); }

.card-body { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem 1.2rem 1.2rem; }
.card-title {
  font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 600; line-height: 1.4; color: #fff;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.25rem 0.7rem;
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c);
  background: rgba(255,255,255,0.05); border: 1px solid var(--c); border-radius: 100px;
}
.card-date { font-size: 0.78rem; color: var(--text-secondary); }

.more-wrap { display: flex; justify-content: center; margin-top: 2rem; }
.more-btn {
  padding: 0.8rem 2rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.more-btn:hover { background: rgba(255,255,255,0.1); }

/* ================= LIGHTBOX ================= */
.lightbox {
  position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
  padding: 3.5rem 4rem; background: rgba(3, 4, 10, 0.92); backdrop-filter: blur(14px);
}
.lb-figure { display: flex; flex-direction: column; align-items: center; gap: 1rem; max-width: 100%; max-height: 100%; }
.lb-img { display: block; max-width: 100%; max-height: calc(100vh - 12rem); object-fit: contain; border-radius: 14px; box-shadow: 0 30px 80px rgba(0,0,0,0.7); animation: lbIn 0.3s ease; }
@keyframes lbIn { from { opacity: 0; transform: scale(0.97); } }
.lb-cap { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; max-width: 640px; text-align: center; }
.lb-cap-text { font-size: 1.05rem; line-height: 1.5; color: #fff; }
.lb-meta { font-size: 0.85rem; color: var(--text-secondary); }

.lb-close, .lb-nav {
  position: absolute; display: grid; place-items: center; cursor: pointer; color: #fff;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.14); border-radius: 50%;
  transition: background 0.2s, transform 0.2s;
}
.lb-close:hover, .lb-nav:hover { background: rgba(255,255,255,0.22); }
.lb-close { top: 1rem; right: 1rem; width: 44px; height: 44px; font-size: 1.7rem; line-height: 1; }
.lb-nav { top: 50%; width: 48px; height: 48px; margin-top: -24px; font-size: 2rem; line-height: 1; }
.lb-prev { left: 1rem; }
.lb-next { right: 1rem; }
.lb-count { position: absolute; top: 1.4rem; left: 50%; transform: translateX(-50%); font-size: 0.85rem; color: var(--text-secondary); }

.lb-enter-active, .lb-leave-active { transition: opacity 0.25s; }
.lb-enter-from, .lb-leave-to { opacity: 0; }

/* ================= KEYFRAMES ================= */
@keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

/* ================= RESPONSIVE ================= */
@media (min-width: 821px) {
  /* Di layar lebar tanggal sudah tampil besar di samping, jadi tidak diulang di kartu */
  .card-date { display: none; }
}

@media (max-width: 820px) {
  .title { font-size: 2.2rem; }

  .trail::before { left: 20px; }
  .trail::after { left: 20px; }
  .end-mark, .month { justify-content: flex-start; padding-left: 40px; }

  .entry { grid-template-columns: 40px 1fr; align-items: start; margin-bottom: 2rem; }
  .entry.left { transform: translateY(24px); }
  .entry.right { transform: translateY(24px); }
  .entry.in { transform: none; }

  .node { grid-column: 1; margin-top: 1.1rem; width: 16px; height: 16px; }
  .when { display: none; }
  .entry.left .card, .entry.right .card { grid-column: 2; justify-self: stretch; max-width: none; }
  .card { border-radius: 18px; }

  .lightbox { padding: 3.5rem 0.75rem 1.5rem; }
  .lb-nav { top: auto; bottom: 1rem; margin-top: 0; width: 44px; height: 44px; }
  .lb-prev { left: 1rem; }
  .lb-next { right: 1rem; }
  .lb-img { max-height: calc(100vh - 14rem); }
}

@media (prefers-reduced-motion: reduce) {
  .aurora-blob, .spinner, .lb-img, .trail::after { animation: none; }
  .entry { opacity: 1; transform: none; transition: none; }
  .card, .card-img img { transition: none; }
}
</style>