<!-- pages/uts.vue -->
<script setup>
useHead({
  title: 'Jadwal UTS | Siscverse',
  meta: [{ name: 'description', content: 'Jadwal Ujian Tengah Semester kelas Siscverse.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
  ]
})

const supabase = useSupabaseClient()

/* ===== AMBIL DATA DARI SUPABASE (hanya baca) ===== */
const { data: rows, pending, error } = useAsyncData(
  'uts-public',
  async () => {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('exam_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },
  { server: false, lazy: true, default: () => [] }
)

watch(error, (e) => { if (e) console.error('[uts] gagal:', e) }, { immediate: true })

const exams = computed(() => (Array.isArray(rows.value) ? rows.value : []))

/* ===== TANGGAL (semua dihitung sebagai tanggal kalender, bukan jam perangkat) ===== */
const ms = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const addDays = (s, n) => new Date(ms(s) + n * 864e5).toISOString().slice(0, 10)
const diffDays = (a, b) => Math.round((ms(a) - ms(b)) / 864e5)
const dow = (s) => new Date(ms(s)).getUTCDay()
const fmtLong = (s) => new Date(ms(s)).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtShort = (s) => new Date(ms(s)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const hhmm = (t) => String(t || '').slice(0, 5)

// Hari ini menurut WIB; diisi setelah halaman tampil di browser
const today = ref('')
let clock
const wibToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
onMounted(() => {
  today.value = wibToday()
  clock = setInterval(() => { today.value = wibToday() }, 60000)
})
onBeforeUnmount(() => clearInterval(clock))

/* ===== SUSUNAN HARI ===== */
const first = computed(() => exams.value[0]?.exam_date || '')
const last = computed(() => exams.value[exams.value.length - 1]?.exam_date || '')

// Semua hari kerja dari ujian pertama sampai terakhir. Hari tanpa ujian tampil "Tidak ada ujian".
const days = computed(() => {
  if (!first.value) return []
  const map = new Map()
  exams.value.forEach((e) => {
    if (!map.has(e.exam_date)) map.set(e.exam_date, [])
    map.get(e.exam_date).push(e)
  })
  const out = []
  for (let d = first.value; d <= last.value; d = addDays(d, 1)) {
    const items = map.get(d) || []
    if (items.length || (dow(d) >= 1 && dow(d) <= 5)) out.push({ date: d, items })
  }
  return out
})

const stateOf = (date) => {
  if (!today.value) return ''
  if (date < today.value) return 'past'
  if (date === today.value) return 'today'
  return diffDays(date, today.value) === 1 ? 'tomorrow' : 'future'
}
const badgeOf = (date) => ({ today: 'Hari ini', tomorrow: 'Besok', past: 'Selesai' }[stateOf(date)] || '')

const timeText = (e) => {
  if (e.start_time && e.end_time) return `${hhmm(e.start_time)} – ${hhmm(e.end_time)}`
  if (e.start_time) return `${hhmm(e.start_time)} WIB`
  return 'Jam menyusul'
}
const modeLabel = (m) => (m === 'DARING' ? 'Daring' : 'Luring')

const anyTimeMissing = computed(() => exams.value.some((e) => !e.start_time))

/* ===== KARTU STATUS ===== */
const status = computed(() => {
  if (!today.value || !exams.value.length) return null
  const t = today.value
  if (t < first.value) {
    const n = diffDays(first.value, t)
    return { big: String(n), label: n === 1 ? 'hari lagi menuju UTS' : 'hari lagi menuju UTS', sub: `UTS dimulai ${fmtLong(first.value)}` }
  }
  if (t > last.value) {
    return { big: '✓', label: 'UTS sudah selesai', sub: 'Terima kasih sudah berjuang. Semoga hasilnya memuaskan.' }
  }
  const nextDate = exams.value.find((e) => e.exam_date >= t)?.exam_date
  const n = diffDays(nextDate, t)
  const names = exams.value.filter((e) => e.exam_date === nextDate).map((e) => e.subject).join(' dan ')
  return {
    big: n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : `${n} hari lagi`,
    label: 'ujian berikutnya',
    sub: `${names} (${fmtShort(nextDate)})`
  }
})

/* ===== BAGIKAN KE WHATSAPP ===== */
const shareText = () => {
  const lines = ['*Jadwal UTS Siscverse*', '']
  days.value.forEach((d) => {
    lines.push(fmtLong(d.date))
    if (!d.items.length) lines.push('- Tidak ada ujian')
    d.items.forEach((e) => {
      const t = e.start_time ? `, ${timeText(e)}` : ''
      lines.push(`- ${e.subject} (${modeLabel(e.mode).toLowerCase()}${t})`)
    })
    lines.push('')
  })
  lines.push(`${window.location.origin}/uts`)
  return lines.join('\n')
}
const shareWA = () => {
  window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener')
}
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
        <div class="badge-glass">UJIAN TENGAH SEMESTER</div>
        <h1 class="title">Jadwal<br/><span class="text-gradient">UTS</span></h1>
        <p v-if="first" class="subtitle">{{ fmtShort(first) }} sampai {{ fmtLong(last) }}. Semangat belajarnya!</p>
        <p v-else class="subtitle">Jadwal ujian tengah semester kelas Siscverse.</p>
      </header>

      <!-- LOADER -->
      <div v-if="pending" class="loading-state">
        <div class="spinner"></div>
        <p>Memuat jadwal...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <div class="state-icon">!</div>
        <p>Gagal memuat jadwal: {{ error.message }}</p>
      </div>

      <!-- KOSONG -->
      <div v-else-if="!exams.length" class="state-box">
        <div class="state-icon">!</div>
        <p>Jadwal UTS belum tersedia.</p>
      </div>

      <template v-else>
        <!-- KARTU STATUS -->
        <section v-if="status" class="status-card">
          <p class="s-big">{{ status.big }}</p>
          <div class="s-text">
            <p class="s-label">{{ status.label }}</p>
            <p class="s-sub">{{ status.sub }}</p>
          </div>
        </section>

        <!-- KETERANGAN -->
        <div class="legend">
          <span class="chip chip-luring">Luring</span><span class="legend-text">tatap muka di kampus</span>
          <span class="chip chip-daring">Daring</span><span class="legend-text">online dari rumah</span>
        </div>

        <!-- HARI-HARI UJIAN -->
        <section class="days" aria-label="Jadwal per hari">
          <article v-for="d in days" :key="d.date" class="day" :class="[stateOf(d.date), { empty: !d.items.length }]">
            <header class="day-head">
              <h2 class="day-title">{{ fmtLong(d.date) }}</h2>
              <span v-if="badgeOf(d.date)" class="day-badge" :class="stateOf(d.date)">{{ badgeOf(d.date) }}</span>
            </header>

            <p v-if="!d.items.length" class="day-empty">Tidak ada ujian. Waktunya belajar untuk hari berikutnya.</p>

            <ul v-else class="exam-list">
              <li v-for="e in d.items" :key="e.id" class="exam">
                <div class="exam-main">
                  <p class="exam-subject">{{ e.subject }}</p>
                  <p class="exam-meta">
                    <span :class="{ pending: !e.start_time }">{{ timeText(e) }}</span>
                    <template v-if="e.room"> &middot; {{ e.room }}</template>
                  </p>
                  <p v-if="e.notes" class="exam-notes">{{ e.notes }}</p>
                </div>
                <span class="chip" :class="e.mode === 'DARING' ? 'chip-daring' : 'chip-luring'">{{ modeLabel(e.mode) }}</span>
              </li>
            </ul>
          </article>
        </section>

        <p v-if="anyTimeMissing" class="note">Jam dan ruangan akan ditambahkan setelah diumumkan. Cek halaman ini lagi nanti.</p>

        <div class="share-wrap">
          <button type="button" class="share-btn" @click="shareWA">Bagikan ke WhatsApp</button>
        </div>
      </template>

    </main>
  </div>
</template>

<style scoped>
/* ================= GLOBAL SETTINGS ================= */
* { box-sizing: border-box; margin: 0; padding: 0; }

.glass-aurora-page {
  --bg: #05050a;
  --glass-bg: rgba(20, 25, 40, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-secondary: #94a3b8;
  --luring: #10b981;
  --daring: #38bdf8;

  font-family: 'Inter', -apple-system, sans-serif;
  background-color: var(--bg);
  color: #fff;
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

.main-layout { max-width: 760px; margin: 0 auto; padding: 5rem 1.5rem; position: relative; z-index: 10; }

/* ================= HEADER ================= */
.header-section { margin-bottom: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
.badge-glass {
  display: inline-block; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;
  font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.2em;
  background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; backdrop-filter: blur(10px);
}
.title { font-family: 'Outfit', sans-serif; font-size: clamp(2.8rem, 8vw, 5rem); font-weight: 800; line-height: 1.05; margin-bottom: 1rem; letter-spacing: -0.02em; }
.text-gradient { background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.05rem; color: var(--text-secondary); max-width: 560px; line-height: 1.6; }

/* ================= STATES ================= */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; gap: 1rem; color: var(--text-secondary); }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.state-box { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); text-align: center; }
.state-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

/* ================= KARTU STATUS ================= */
.status-card {
  display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding: 1.5rem 1.75rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(139, 92, 246, 0.28));
  border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 24px; box-shadow: 0 20px 50px rgba(59, 130, 246, 0.15);
}
.s-big { font-family: 'Outfit', sans-serif; font-size: clamp(2.2rem, 7vw, 3.2rem); font-weight: 800; line-height: 1; letter-spacing: -0.02em; white-space: nowrap; }
.s-text { min-width: 0; }
.s-label { font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.75); }
.s-sub { margin-top: 0.25rem; font-size: 0.95rem; line-height: 1.5; color: #e2e8f0; overflow-wrap: anywhere; }

/* ================= KETERANGAN & CHIP ================= */
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.6rem; margin-bottom: 2rem; font-size: 0.85rem; color: var(--text-secondary); }
.legend-text { margin-right: 0.8rem; }
.chip {
  display: inline-flex; align-items: center; flex-shrink: 0; padding: 0.25rem 0.75rem; border-radius: 100px;
  font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em;
}
.chip-luring { color: var(--luring); background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); }
.chip-daring { color: var(--daring); background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); }

/* ================= HARI ================= */
.days { display: flex; flex-direction: column; gap: 1rem; }
.day {
  padding: 1.25rem 1.4rem; background: var(--glass-bg); backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border); border-radius: 22px; transition: border-color 0.3s, opacity 0.3s;
}
.day.today { border-color: rgba(242, 184, 75, 0.7); box-shadow: 0 0 30px rgba(242, 184, 75, 0.16); }
.day.tomorrow { border-color: rgba(59, 130, 246, 0.55); }
.day.past { opacity: 0.55; }
.day.empty { background: rgba(20, 25, 40, 0.22); }

.day-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.day-title { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; }
.day-badge { padding: 0.2rem 0.7rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; background: rgba(255,255,255,0.08); color: var(--text-secondary); }
.day-badge.today { background: rgba(242, 184, 75, 0.18); color: #f2b84b; }
.day-badge.tomorrow { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
.day-empty { color: var(--text-secondary); font-size: 0.92rem; }

.exam-list { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.exam {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1rem;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
}
.exam-main { min-width: 0; }
.exam-subject { font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 600; overflow-wrap: anywhere; }
.exam-meta { margin-top: 0.15rem; font-size: 0.85rem; color: var(--text-secondary); }
.exam-meta .pending { font-style: italic; opacity: 0.8; }
.exam-notes { margin-top: 0.3rem; font-size: 0.82rem; color: #b6bfd6; line-height: 1.5; }

.note { margin-top: 1.5rem; text-align: center; font-size: 0.88rem; color: var(--text-secondary); }

.share-wrap { display: flex; justify-content: center; margin-top: 2rem; }
.share-btn {
  padding: 0.85rem 2rem; background: #fff; color: #000; border: none; border-radius: 100px; cursor: pointer;
  font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 700; transition: all 0.3s;
}
.share-btn:hover { background: #e2e8f0; transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,255,255,0.2); }

@keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

@media (max-width: 520px) {
  .status-card { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .exam { flex-direction: column; align-items: flex-start; gap: 0.6rem; }
}
@media (prefers-reduced-motion: reduce) {
  .aurora-blob, .spinner { animation: none; }
}
</style>