<!-- pages/index.vue -->
<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'

useHead({
  title: 'Siscverse | Arsip komunitas kelas',
  meta: [{ name: 'description', content: 'Siscverse: semesta kecil untuk satu kelas. Anggota, jadwal, menfess, dan kas kelas dalam satu tempat.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap' }
  ]
})

const supabase = useSupabaseClient()

/* ===== DATA DARI SUPABASE (tidak ada data dummy) =====
   null  = belum termuat / gagal dimuat
   Tiap bagian gagal sendiri-sendiri, jadi satu tabel bermasalah tidak merusak yang lain. */
const { data: home, pending } = useAsyncData(
  'home-summary',
  async () => {
    const [m, s, k, f] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*').order('start_time', { ascending: true }),
      supabase.from('kas_transactions').select('transaction_type, amount, transaction_date, created_at')
        .order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('menfess').select('sender_name, message, created_at')
        .order('created_at', { ascending: false }).limit(1)
    ])
    for (const [name, r] of [['members', m], ['schedules', s], ['kas', k], ['menfess', f]]) {
      if (r.error) console.error(`[home] ${name} gagal:`, r.error)
    }
    return {
      members: m.error ? null : (m.count ?? 0),
      schedules: s.error ? null : (s.data ?? []),
      kas: k.error ? null : (k.data ?? []),
      menfess: f.error ? null : (f.data?.[0] ?? false)
    }
  },
  { lazy: true, default: () => ({ members: null, schedules: null, kas: null, menfess: null }) }
)

/* ===== HELPER ===== */
const fmt = (n) => Number(n || 0).toLocaleString('id-ID')
const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + fmt(Math.abs(n))
const hhmm = (t) => String(t || '').slice(0, 5)
const toMin = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m }
const trunc = (t, n = 90) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n).trimEnd() + '...' : s
}
const fmtDate = (v) => new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

// Waktu sekarang di WIB (dihitung di browser setelah halaman tampil, supaya tidak beda dengan server)
const DAYS_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const wibNow = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  )
  return { day: DAYS_EN[p.weekday], minutes: (Number(p.hour) % 24) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` }
}
const nowInfo = ref(null)

/* ===== ARSIP ===== */
const ARCHIVE_LINKS = [
  { to: '/structure', orb: 'earth', title: 'Anggota', desc: 'Nama, foto, dan peran seluruh anggota kelas dalam satu daftar.' },
  { to: '/schedule', orb: 'lava', title: 'Jadwal', desc: 'Jam pelajaran dan kegiatan harian, biar tidak ada yang telat.' },
  { to: '/menfess', orb: 'ice', title: 'Menfess', desc: 'Pesan tanpa nama untuk hal yang sulit dibilang langsung.' },
  { to: '/kas', orb: 'gas', title: 'Kas', desc: 'Catatan iuran masuk dan pengeluaran kelas, terbuka untuk semua.' }
]

/* ===== KAS ===== */
const kasRows = computed(() => home.value.kas)
const balance = computed(() =>
  (kasRows.value || []).reduce((s, t) => (t.transaction_type === 'INCOME' ? s + Number(t.amount) : s - Number(t.amount)), 0)
)
const balanceText = computed(() => (kasRows.value === null ? '–' : rp(balance.value)))
const kasNote = computed(() => {
  const rows = kasRows.value
  if (rows === null) return null
  if (!rows.length) return { text: 'Belum ada catatan kas', dir: '' }
  const last = rows[0].transaction_date
  if (nowInfo.value && last === nowInfo.value.date) {
    const net = rows
      .filter((r) => r.transaction_date === last)
      .reduce((s, r) => (r.transaction_type === 'INCOME' ? s + Number(r.amount) : s - Number(r.amount)), 0)
    if (net > 0) return { text: `Naik ${rp(net)} hari ini`, dir: 'up' }
    if (net < 0) return { text: `Turun ${rp(-net)} hari ini`, dir: 'down' }
    return { text: 'Tidak berubah hari ini', dir: '' }
  }
  return { text: `Terakhir diperbarui ${fmtDate(last)}`, dir: '' }
})

/* ===== JADWAL ===== */
const DAY_IDX = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
const DAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// Urut dari yang paling dekat dengan sekarang. Sebelum waktu tersedia, urut Senin sampai Jumat.
const upcoming = computed(() => {
  const list = (home.value.schedules || []).filter(
    (s) => s.day_of_week in DAY_IDX && /^\d{1,2}:\d{2}/.test(String(s.start_time))
  )
  const n = nowInfo.value
  return list
    .map((s) => {
      const day = DAY_IDX[s.day_of_week]
      const min = toMin(s.start_time)
      let diff = n ? (day - n.day + 7) % 7 : (day - 1 + 7) % 7
      if (n && diff === 0 && min <= n.minutes) diff = 7
      return { id: s.id, subject: s.subject, time: hhmm(s.start_time), dayName: DAY_ID[day], diff, order: diff * 1440 + min }
    })
    .sort((a, b) => a.order - b.order)
})
const nextClass = computed(() => (nowInfo.value ? upcoming.value[0] || null : null))
const whenLabel = (a) => {
  if (!nowInfo.value) return a.dayName
  return a.diff === 0 ? 'Hari ini' : a.diff === 1 ? 'Besok' : a.dayName
}
const nextMain = computed(() => {
  if (home.value.schedules === null) return pending.value ? 'Memuat...' : 'Data belum tersedia'
  if (!home.value.schedules.length) return 'Belum ada jadwal'
  return nextClass.value ? nextClass.value.subject : 'Memuat...'
})
const nextNote = computed(() => (nextClass.value ? `${whenLabel(nextClass.value)}, ${nextClass.value.time} WIB` : ''))

/* ===== MENFESS TERBARU ===== */
const menfessText = computed(() => {
  const f = home.value.menfess
  if (f === null) return pending.value ? 'Memuat...' : 'Data belum tersedia'
  if (f === false) return 'Belum ada pesan masuk.'
  return `"${trunc(f.message)}"`
})

/* ===== TEKS DINAMIS ===== */
const membersText = computed(() => (home.value.members === null ? 'satu kelas' : `${home.value.members} orang`))
const archives = computed(() =>
  ARCHIVE_LINKS.map((a) => {
    let meta = ''
    if (a.to === '/structure' && home.value.members !== null) meta = `${home.value.members} orang`
    if (a.to === '/schedule' && home.value.schedules !== null) meta = `${home.value.schedules.length} kelas pekan ini`
    if (a.to === '/menfess') meta = 'Tanpa nama'
    if (a.to === '/kas' && kasRows.value !== null) meta = rp(balance.value)
    return { ...a, meta }
  })
)

/* ===== KONTEN TETAP (teks, bukan data) ===== */
const pillars = [
  { title: 'Saling kenal', desc: 'Profil dan peran tiap anggota tercatat, jadi tidak ada yang terasa asing di kelas sendiri.' },
  { title: 'Terbuka dan rapi', desc: 'Jadwal dan kas dicatat jelas supaya semua orang tahu tanpa perlu bertanya-tanya.' },
  { title: 'Bebas bersuara', desc: 'Menfess memberi ruang untuk menyampaikan sesuatu tanpa harus menyebut nama.' }
]
const rules = [
  { title: 'Saling menghargai', text: 'Boleh beda pendapat, tidak boleh merendahkan.' },
  { title: 'Anonim bukan tanpa etika', text: 'Menfess tidak dipakai untuk menyerang atau membuka aib orang.' },
  { title: 'Jaga privasi anggota', text: 'Data di arsip hanya untuk keperluan kelas.' },
  { title: 'Bayar kas tepat waktu', text: 'Catatan iuran terbuka supaya adil untuk semua.' },
  { title: 'Laporkan yang janggal', text: 'Ada info keliru di arsip? Sampaikan ke pengurus.' }
]
const year = new Date().getFullYear()
const letters = 'Siscverse'.split('')

/* ===== ANGKA STATISTIK (hitung naik saat terlihat) ===== */
const stats = reactive({ members: 0, rooms: 0, classes: 0, balance: 0 })
const statsSeen = ref(false)
const target = computed(() => ({
  members: home.value.members ?? 0,
  rooms: ARCHIVE_LINKS.length,
  classes: (home.value.schedules || []).length,
  balance: balance.value
}))

/* state */
const ready = ref(false)
const progress = ref(0)
const statsEl = ref(null)
let io, so, raf, clock
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function animateTo(t) {
  raf && cancelAnimationFrame(raf)
  if (reduced()) { Object.assign(stats, t); return }
  const from = { ...stats }, start = performance.now(), D = 1200
  const tick = (now) => {
    const p = Math.min((now - start) / D, 1), e = 1 - Math.pow(1 - p, 3)
    for (const k in t) stats[k] = Math.round(from[k] + (t[k] - from[k]) * e)
    if (p < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}
watch([statsSeen, target], ([seen, t]) => { if (seen) animateTo(t) })

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(window.scrollY / max, 1) : 0
}
function onTile(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', e.clientX - r.left + 'px')
  e.currentTarget.style.setProperty('--my', e.clientY - r.top + 'px')
}

onMounted(() => {
  ready.value = true
  nowInfo.value = wibNow()
  clock = setInterval(() => { nowInfo.value = wibNow() }, 60000)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  const items = document.querySelectorAll('[data-reveal]')
  if (!('IntersectionObserver' in window) || reduced()) {
    items.forEach((el) => el.classList.add('is-in'))
    statsSeen.value = true
    return
  }
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) } })
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
  items.forEach((el) => io.observe(el))

  so = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { statsSeen.value = true; so.disconnect() }
  }, { threshold: 0.4 })
  statsEl.value && so.observe(statsEl.value)
})
onBeforeUnmount(() => {
  io && io.disconnect(); so && so.disconnect(); raf && cancelAnimationFrame(raf)
  clock && clearInterval(clock)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="page" :class="{ js: ready }">
    <div class="progress" aria-hidden="true" :style="{ transform: `scaleX(${progress})` }"></div>
    <SpaceSky />
    <AppNavbar />

    <main class="content">
      <!-- HERO -->
      <section id="hero" class="hero wrap">
        <div class="hero-copy">
          <h1 class="title" aria-label="Siscverse"><span v-for="(c, i) in letters" :key="i" class="ch" aria-hidden="true" :style="{ '--i': i }">{{ c }}</span></h1>
          <p class="lede">Semesta kecil untuk {{ membersText }} yang saling terhubung. Anggota, jadwal, pesan anonim, dan kas kelas, semuanya tersimpan di satu tempat.</p>
          <div class="actions">
            <a href="#archive" class="btn btn-primary">Jelajahi arsip</a>
            <NuxtLink to="/menfess" class="btn btn-ghost">Kirim menfess</NuxtLink>
          </div>
        </div>

        <aside class="hero-card" aria-label="Sekilas">
          <p class="hc-label">Kelas berikutnya</p>
          <p class="hc-main">{{ nextMain }}</p>
          <p v-if="nextNote" class="hc-note">{{ nextNote }}</p>
          <div class="hc-row"><span>Saldo kas</span><strong>{{ balanceText }}</strong></div>
        </aside>

        <a class="cue" href="#about" aria-label="Gulir ke bawah"><span></span></a>
      </section>

      <!-- STATISTIK -->
      <section class="wrap stats-wrap">
        <dl ref="statsEl" class="stats" data-reveal>
          <div><dt>Anggota</dt><dd>{{ home.members === null ? '–' : stats.members }}</dd></div>
          <div><dt>Ruang arsip</dt><dd>{{ stats.rooms }}</dd></div>
          <div><dt>Kelas pekan ini</dt><dd>{{ home.schedules === null ? '–' : stats.classes }}</dd></div>
          <div class="stat-wide"><dt>Saldo kas</dt><dd>{{ kasRows === null ? '–' : rp(stats.balance) }}</dd></div>
        </dl>
      </section>

      <!-- TENTANG -->
      <section id="about" class="section wrap">
        <div class="about-grid">
          <h2 class="h2" data-reveal>Apa itu Siscverse?</h2>
          <div class="prose" data-reveal style="--d: 80ms">
            <p>Siscverse adalah ruang digital tempat semua hal penting di kelas kami berkumpul. Bukan cuma tempat melihat data, tapi juga tempat kami saling mengenal lewat cerita kecil yang terjadi setiap hari.</p>
            <p>Setiap orang punya profilnya, setiap hari punya jadwalnya, setiap pesan punya ceritanya. Dilihat sendiri-sendiri terasa kecil, tapi digabung jadilah satu semesta.</p>
          </div>
        </div>
        <div class="pillars">
          <div v-for="(p, i) in pillars" :key="p.title" class="pillar" data-reveal :style="{ '--d': i * 90 + 'ms' }">
            <h3 class="pillar-title">{{ p.title }}</h3>
            <p class="pillar-desc">{{ p.desc }}</p>
          </div>
        </div>
      </section>

      <!-- ARSIP -->
      <section id="archive" class="section wrap">
        <header class="section-head" data-reveal>
          <h2 class="h2">Jelajahi arsip</h2>
          <p class="lead">Empat ruang yang bisa dibuka kapan saja. Masing-masing punya planetnya sendiri.</p>
        </header>
        <div class="tiles">
          <NuxtLink v-for="(a, i) in archives" :key="a.to" :to="a.to" class="tile" :class="'tile--' + i" data-reveal :style="{ '--d': i * 90 + 'ms' }" @pointermove="onTile">
            <span class="orb" :class="'orb--' + a.orb" aria-hidden="true"><i></i></span>
            <h3 class="tile-title">{{ a.title }}</h3>
            <p class="tile-desc">{{ a.desc }}</p>
            <span v-if="a.meta" class="tile-meta">{{ a.meta }}</span>
            <span class="tile-cta">Buka arsip
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </span>
          </NuxtLink>
        </div>
      </section>

      <!-- SEKILAS -->
      <section id="today" class="section wrap">
        <header class="section-head" data-reveal>
          <h2 class="h2">Sekilas hari ini</h2>
          <p class="lead">Ringkasan cepat sebelum membuka arsip lengkapnya.</p>
        </header>
        <div class="today-grid">
          <div class="panel" data-reveal>
            <dl class="facts">
              <div class="fact">
                <dt>Saldo kas</dt>
                <dd class="fact-value">{{ balanceText }}</dd>
                <dd v-if="kasNote" class="fact-note" :class="kasNote.dir">
                  <svg v-if="kasNote.dir" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" :style="{ transform: kasNote.dir === 'down' ? 'rotate(180deg)' : 'none' }"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                  {{ kasNote.text }}
                </dd>
              </div>
              <div class="fact">
                <dt>Kelas berikutnya</dt>
                <dd class="fact-main">{{ nextMain }}</dd>
                <dd v-if="nextNote" class="fact-note">{{ nextNote }}</dd>
              </div>
              <div class="fact">
                <dt>Pesan terbaru</dt>
                <dd class="quote">{{ menfessText }}</dd>
              </div>
            </dl>
          </div>
          <div class="panel" data-reveal style="--d: 90ms">
            <h3 class="panel-title">Agenda minggu ini</h3>
            <p v-if="home.schedules === null" class="empty">{{ pending ? 'Memuat jadwal...' : 'Jadwal belum bisa dimuat.' }}</p>
            <p v-else-if="!upcoming.length" class="empty">Belum ada jadwal yang tercatat.</p>
            <template v-else>
              <ol class="agenda">
                <li v-for="(a, i) in upcoming.slice(0, 6)" :key="a.id" :class="{ next: nowInfo && i === 0 }">
                  <span class="day">{{ whenLabel(a) }}</span>
                  <span class="time">{{ a.time }}</span>
                  <span class="subject">{{ a.subject }}</span>
                  <span v-if="nowInfo && i === 0" class="badge">Berikutnya</span>
                </li>
              </ol>
              <NuxtLink to="/schedule" class="more-link">Lihat semua jadwal</NuxtLink>
            </template>
          </div>
        </div>
      </section>

      <!-- ATURAN MAIN -->
      <section id="rules" class="section wrap">
        <header class="section-head" data-reveal>
          <h2 class="h2">Aturan main</h2>
          <p class="lead">Lima kesepakatan sederhana supaya semesta ini tetap nyaman untuk semua.</p>
        </header>
        <ul class="rules">
          <li v-for="(r, i) in rules" :key="r.title" class="rule" data-reveal :style="{ '--d': (i % 2) * 90 + 'ms' }">
            <span class="rule-title">{{ r.title }}</span>
            <span class="rule-text">{{ r.text }}</span>
          </li>
        </ul>
      </section>

      <!-- CTA -->
      <section class="section wrap">
        <div class="cta" data-reveal>
          <div>
            <h2 class="h2">Ada yang ingin kamu sampaikan?</h2>
            <p class="lead">Tulis lewat menfess. Tidak perlu menyebut nama, cukup jujur dan sopan.</p>
          </div>
          <div class="actions">
            <NuxtLink to="/menfess" class="btn btn-primary">Tulis menfess</NuxtLink>
            <NuxtLink to="/kas" class="btn btn-ghost">Cek kas</NuxtLink>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap footer-grid">
        <div>
          <p class="footer-logo">Siscverse</p>
          <p class="footer-text">Arsip komunitas kelas kami. Cerita-cerita kecil yang terjadi setiap hari, tersimpan di satu tempat.</p>
        </div>
        <nav aria-label="Halaman">
          <h3 class="footer-title">Halaman</h3>
          <ul>
            <li><NuxtLink to="/">Beranda</NuxtLink></li>
            <li><NuxtLink to="/structure">Anggota</NuxtLink></li>
            <li><NuxtLink to="/schedule">Jadwal</NuxtLink></li>
            <li><NuxtLink to="/menfess">Menfess</NuxtLink></li>
            <li><NuxtLink to="/kas">Kas</NuxtLink></li>
          </ul>
        </nav>
        <nav aria-label="Di halaman ini">
          <h3 class="footer-title">Di halaman ini</h3>
          <ul>
            <li><a href="#about">Tentang</a></li>
            <li><a href="#archive">Arsip</a></li>
            <li><a href="#today">Sekilas hari ini</a></li>
            <li><a href="#rules">Aturan main</a></li>
          </ul>
        </nav>
      </div>
      <div class="wrap footer-bottom">
        <p>&copy; {{ year }} Siscverse</p>
        <a href="#hero">Kembali ke atas</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
:global(html) { scroll-behavior: smooth; }
* { box-sizing: border-box; }

.page { --bg: #05060b; --line: rgba(255,255,255,.09); --line-strong: rgba(255,255,255,.16); --text: #eceef5; --muted: #9ba2ba;
  --accent: #f2b84b; --display: 'Fraunces', Georgia, serif; --nav-h: 64px;
  position: relative; min-height: 100vh; overflow-x: clip; background: var(--bg); color: var(--text);
  font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.content { position: relative; z-index: 1; }
.wrap { width: 100%; max-width: 72rem; margin-inline: auto; padding-inline: clamp(1.25rem, 4vw, 2rem); }
section[id] { scroll-margin-top: calc(var(--nav-h) + 1rem); }
.progress { position: fixed; inset: 0 0 auto; z-index: 60; height: 2px; transform-origin: 0 50%; background: linear-gradient(90deg, #4aa8ff, var(--accent), #ff6e3c); }

/* reveal */
.js [data-reveal]:not(.is-in) { opacity: 0; }
.js [data-reveal].is-in { animation: reveal .8s cubic-bezier(.2,.7,.2,1) var(--d, 0s) backwards; }
@keyframes reveal { from { opacity: 0; transform: translateY(22px); } }

/* type + buttons */
.h2 { font-family: var(--display); font-weight: 600; font-size: clamp(1.9rem, 4.2vw, 2.7rem); line-height: 1.1; letter-spacing: -.015em; }
.lead { color: var(--muted); max-width: 34rem; margin-top: .9rem; }
.section { padding-block: clamp(4rem, 9vw, 7rem); }
.section-head { margin-bottom: clamp(2rem, 5vw, 3.25rem); }
.actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.btn { display: inline-flex; align-items: center; padding: .85rem 1.4rem; border-radius: 10px; font-size: .95rem; font-weight: 600; text-decoration: none;
  transition: transform .2s, background-color .2s, border-color .2s, box-shadow .2s; }
.btn:focus-visible, .tile:focus-visible, .footer a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.btn-primary { background: var(--accent); color: #1a1204; box-shadow: 0 0 0 0 rgba(242,184,75,.4); }
.btn-primary:hover { background: #ffc95f; transform: translateY(-1px); box-shadow: 0 8px 28px -6px rgba(242,184,75,.55); }
.btn-ghost { color: var(--text); border: 1px solid var(--line-strong); backdrop-filter: blur(6px); }
.btn-ghost:hover { border-color: rgba(255,255,255,.35); background: rgba(255,255,255,.05); }

/* hero */
.hero { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 2rem; min-height: calc(100vh - var(--nav-h)); min-height: calc(100svh - var(--nav-h)); padding-block: 3rem 5rem; }
.hero-copy { min-width: 0; max-width: 40rem; animation: reveal .9s cubic-bezier(.2,.7,.2,1) both; }
.title { font-family: var(--display); font-weight: 600; font-size: clamp(3.6rem, 13vw, 8.5rem); line-height: 1; letter-spacing: -.025em;
  }
.ch { display: inline-block; background: linear-gradient(180deg, #fff 30%, #a9b2d6); -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: rise 1s cubic-bezier(.2,.7,.2,1) calc(var(--i) * 70ms + 200ms) backwards; }
@keyframes rise { from { opacity: 0; transform: translateY(.45em); filter: blur(10px); } }
.lede { max-width: 34rem; margin: 1.5rem 0 2rem; color: #b9bfd6; font-size: clamp(1.05rem, 1.6vw, 1.2rem); }

/* hero card + cue */
.hero-card { display: none; width: 17.5rem; flex: none; align-self: flex-end; margin-bottom: 1rem; padding: 1.4rem 1.5rem; border: 1px solid var(--line-strong); border-radius: 20px;
  background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02)), rgba(10,13,22,.6); backdrop-filter: blur(14px); box-shadow: 0 24px 60px -24px rgba(0,0,0,.8);
  animation: reveal 1s .7s cubic-bezier(.2,.7,.2,1) backwards; }
.hc-label { color: var(--muted); font-size: .85rem; }
.hc-main { margin-top: .2rem; font-family: var(--display); font-size: 1.4rem; line-height: 1.2; }
.hc-note { color: var(--accent); font-size: .92rem; }
.hc-row { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.1rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: .9rem; }
.hc-row span { color: var(--muted); }
.hc-row strong { font-variant-numeric: tabular-nums; }
.cue { position: absolute; left: 50%; bottom: 1.25rem; display: none; width: 22px; height: 36px; margin-left: -11px; border: 1.5px solid var(--line-strong); border-radius: 12px; }
.cue span { position: absolute; top: 7px; left: 50%; width: 3px; height: 7px; margin-left: -1.5px; border-radius: 2px; background: var(--accent); animation: cue 1.8s ease-in-out infinite; }
.cue:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
@keyframes cue { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(12px); } }

/* stats */
.stats-wrap { position: relative; }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin: 0; overflow: hidden; border: 1px solid var(--line-strong); border-radius: 18px;
  background: var(--line); backdrop-filter: blur(10px); }
.stats > div { display: flex; flex-direction: column; gap: .25rem; min-width: 0; padding: 1.25rem clamp(1rem, 3vw, 1.5rem); background: rgba(9,12,20,.82); }
.stat-wide { grid-column: span 2; }
.stats dd { margin: 0; font-family: var(--display); font-weight: 600; font-size: clamp(1.5rem, 3.2vw, 2rem); line-height: 1.1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.stats dt { color: var(--muted); font-size: .88rem; }

/* about */
.about-grid { display: grid; gap: 1.5rem 4rem; }
.prose p { max-width: 36rem; margin-bottom: 1.1rem; color: #b9bfd6; }
.pillars { display: grid; gap: 2rem; margin-top: clamp(2.5rem, 6vw, 4rem); }
.pillar { position: relative; padding-top: 1.25rem; border-top: 1px solid var(--line-strong); }
.pillar::before { content: ''; position: absolute; top: -1px; left: 0; width: 2.5rem; height: 2px; background: var(--accent); }
.pillar-title { font-family: var(--display); font-size: 1.3rem; margin: .2rem 0 .4rem; }
.pillar-desc { color: var(--muted); font-size: .95rem; }

/* archive tiles (bento) */
.tiles { display: grid; gap: 1.25rem; }
.tile { position: relative; display: flex; flex-direction: column; min-height: 15rem; padding: 1.75rem; overflow: hidden; border: 1px solid var(--line); border-radius: 20px;
  background: rgba(12,15,24,.78); color: inherit; text-decoration: none; transition: border-color .25s, background-color .25s, transform .25s; }
.tile::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 0%), rgba(242,184,75,.14), transparent 62%); }
.tile:hover { border-color: rgba(242,184,75,.45); background: rgba(18,23,38,.92); transform: translateY(-3px); }
.tile:hover::before { opacity: 1; }
.tile-title { font-family: var(--display); font-weight: 600; font-size: 1.7rem; margin: 3.5rem 0 .5rem; }
.tile-desc { color: var(--muted); max-width: 26rem; }
.tile-meta { align-self: flex-start; margin-top: 1.25rem; padding: .2rem .7rem; border: 1px solid var(--line-strong); border-radius: 999px; color: #c9cfe4; font-size: .8rem; font-variant-numeric: tabular-nums; }
.tile-cta { display: inline-flex; align-items: center; gap: .4rem; margin-top: auto; padding-top: 1.25rem; font-size: .92rem; font-weight: 600; transition: color .25s; }
.tile-cta svg { width: 16px; height: 16px; transition: transform .25s; }
.tile:hover .tile-cta { color: var(--accent); }
.tile:hover .tile-cta svg { transform: translate(3px, -3px); }
.tile .orb { position: absolute; top: 1.5rem; right: 1.5rem; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
.tile:hover .orb { transform: scale(1.18) rotate(-8deg); }

.orb { width: 58px; height: 58px; }
.orb i { position: relative; display: block; width: 100%; height: 100%; border-radius: 50%; background: var(--o);
  box-shadow: inset -9px -9px 16px rgba(0,0,0,.55), 0 0 26px var(--g); }
.orb--earth { --o: radial-gradient(circle at 34% 30%, #8fd6ff, #1f78bd 52%, #0a2947 92%); --g: rgba(80,170,255,.3); }
.orb--lava { --o: radial-gradient(circle at 34% 30%, #ffb08a, #e2532a 52%, #4f1406 92%); --g: rgba(255,110,60,.3); }
.orb--ice { --o: radial-gradient(circle at 34% 30%, #c9f3f7, #2aa5b8 52%, #08404a 92%); --g: rgba(60,200,220,.28); }
.orb--gas { --g: rgba(242,184,75,.3);
  --o: radial-gradient(circle at 34% 30%, rgba(255,255,255,.3), transparent 42%), repeating-linear-gradient(10deg, #f4c66d 0 6px, #d98f30 6px 11px, #f1b752 11px 16px); }
.tile .orb--gas { width: 50px; height: 50px; }
.orb--gas::before, .orb--gas::after { content: ''; position: absolute; left: -40%; right: -40%; top: 50%; height: 52%; margin-top: -26%;
  border: 2px solid rgba(242,208,140,.6); border-radius: 50%; transform: rotate(-18deg); }
.orb--gas::after { clip-path: inset(50% 0 0 0); }

/* today */
.today-grid { display: grid; gap: 1.25rem; }
.panel { padding: 1.75rem; border: 1px solid var(--line); border-radius: 20px; background: rgba(12,15,24,.78); backdrop-filter: blur(8px); }
.panel-title { font-family: var(--display); font-size: 1.25rem; margin-bottom: 1rem; }
.facts { margin: 0; }
.fact { padding-block: 1.1rem; border-top: 1px solid var(--line); }
.fact:first-child { padding-top: 0; border-top: 0; }
.fact:last-child { padding-bottom: 0; }
.fact dt { margin-bottom: .25rem; color: var(--muted); font-size: .88rem; }
.fact dd { margin: 0; }
.fact-value { font-family: var(--display); font-size: 2rem; font-weight: 600; line-height: 1.1; }
.fact-main { font-family: var(--display); font-size: 1.35rem; }
.fact-note { margin-top: .2rem; color: var(--muted); font-size: .92rem; }
.fact-note.up { display: flex; align-items: center; gap: .3rem; color: #63d99a; }
.fact-note.down { display: flex; align-items: center; gap: .3rem; color: #ff7a8a; }
.quote { color: #d3d8ea; font-style: italic; overflow-wrap: anywhere; }
.empty { color: var(--muted); font-size: .95rem; }
.more-link { display: inline-block; margin-top: 1rem; color: var(--accent); font-size: .92rem; font-weight: 600; text-decoration: none; }
.more-link:hover { text-decoration: underline; }
.agenda { margin: 0; padding: 0; list-style: none; }
.agenda li { display: grid; grid-template-columns: 4.5rem 3.5rem 1fr; align-items: center; gap: .25rem .75rem; padding: .85rem 0; border-top: 1px solid var(--line); font-size: .95rem; }
.agenda li:first-child { border-top: 0; }
.day, .time { color: var(--muted); font-variant-numeric: tabular-nums; }
.subject { font-weight: 500; }
.next .subject { color: var(--accent); }
.badge { grid-column: 3; justify-self: start; padding: .15rem .55rem; border-radius: 999px; background: rgba(242,184,75,.14); color: var(--accent); font-size: .75rem; font-weight: 600; }

/* rules */
.rules { display: grid; gap: 0 3rem; margin: 0; padding: 0; list-style: none; }
.rule { position: relative; display: grid; gap: .25rem; padding: 1.4rem 0 1.4rem 1.6rem; border-top: 1px solid var(--line-strong); }
.rule::before { content: ''; position: absolute; left: 0; top: 1.85rem; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px rgba(242,184,75,.7); }
.rule-title { font-weight: 600; }
.rule-text { color: var(--muted); font-size: .95rem; }

/* cta */
.cta { display: grid; gap: 1.5rem; align-items: center; padding: clamp(1.75rem, 5vw, 3.25rem); border: 1px solid var(--line-strong); border-radius: 24px;
  background: radial-gradient(120% 140% at 100% 0%, rgba(242,184,75,.2), transparent 55%), radial-gradient(90% 120% at 0% 100%, rgba(74,140,255,.12), transparent 60%), rgba(12,15,24,.88); }

/* footer */
.footer { position: relative; z-index: 1; padding-top: 3.5rem; border-top: 1px solid var(--line); background: rgba(3,4,8,.92); }
.footer-grid { display: grid; gap: 2.5rem; }
.footer-logo { font-family: var(--display); font-size: 1.5rem; font-weight: 600; }
.footer-text { max-width: 24rem; margin-top: .6rem; color: var(--muted); font-size: .95rem; }
.footer-title { margin-bottom: .8rem; font-size: .9rem; font-weight: 600; }
.footer ul { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }
.footer a { color: var(--muted); font-size: .95rem; text-decoration: none; transition: color .2s; }
.footer a:hover { color: var(--text); }
.footer-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; margin-top: 3rem; padding-block: 1.5rem; border-top: 1px solid var(--line); color: #6f7690; font-size: .88rem; }

@media (min-width: 720px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 768px) { .pillars { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 800px) { .rules { grid-template-columns: 1fr 1fr; } .cta { grid-template-columns: 1fr auto; } .footer-grid { grid-template-columns: 2fr 1fr 1fr; } }
@media (min-width: 860px) { .about-grid { grid-template-columns: 5fr 7fr; } }
@media (min-width: 900px) { .today-grid { grid-template-columns: 5fr 6fr; } .hero-card { display: block; } }
@media (min-width: 720px) and (min-height: 640px) { .cue { display: block; } }
@media (min-width: 960px) { .stats { grid-template-columns: repeat(4, 1fr); } .stat-wide { grid-column: auto; } }
@media (max-width: 520px) { .agenda li { grid-template-columns: 4.2rem 3.2rem 1fr; } }

@media (prefers-reduced-motion: reduce) {
  .js [data-reveal]:not(.is-in) { opacity: 1; }
  .js [data-reveal].is-in, .hero-copy, .ch, .hero-card, .cue span { animation: none; }
  .tile, .btn, .tile .orb { transition: none; }
}
</style>