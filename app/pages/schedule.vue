<!-- pages/schedule.vue -->
<!-- Halaman jadwal publik. Tema sama dengan structure.vue, data langsung dari Supabase (tabel `schedules`). -->
<script setup>
useHead({
  title: 'Jadwal Kelas | Siscverse',
  meta: [{ name: 'description', content: 'Jadwal kuliah kelas Siscverse.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
  ]
})

/* ===== NAMA KOLOM (samakan dengan halaman admin) ===== */
const COLS = {
  day: 'day_of_week',
  time: 'start_time',
  subject: 'subject',
  room: 'room'
}

const DAYS = [
  { value: 'MONDAY', label: 'Senin', color: '#f59e0b' },
  { value: 'TUESDAY', label: 'Selasa', color: '#f43f5e' },
  { value: 'WEDNESDAY', label: 'Rabu', color: '#10b981' },
  { value: 'THURSDAY', label: 'Kamis', color: '#38bdf8' },
  { value: 'FRIDAY', label: 'Jumat', color: '#8b5cf6' }
]

/* ===== AMBIL DATA DARI SUPABASE ===== */
const supabase = useSupabaseClient()

const { data: rows, pending, error } = useAsyncData(
  'schedules-public',
  async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order(COLS.time, { ascending: true })
    if (error) throw error
    return data ?? []
  },
  { lazy: true, default: () => [] }
)

watch(error, (e) => { if (e) console.error('[schedules] gagal:', e) }, { immediate: true })

/* ===== HARI INI (diisi di browser supaya tidak beda dengan hasil server) ===== */
const todayValue = ref('')
onMounted(() => {
  const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  todayValue.value = map[new Date().getDay()]
})

/* ===== MAPPING DATA KE UI ===== */
const clean = (v) => String(v ?? '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
const hhmm = (t) => (t ? String(t).slice(0, 5) : '--:--')

const allClasses = computed(() => {
  const list = Array.isArray(rows.value) ? rows.value : []
  return list.map((row, index) => ({
    id: row.id ?? index,
    day: String(row[COLS.day] || '').toUpperCase(),
    time: hhmm(row[COLS.time]),
    subject: clean(row[COLS.subject]) || 'Tanpa nama',
    room: clean(row[COLS.room])
  }))
})

/* ===== PENCARIAN & FILTER ===== */
const searchQuery = ref('')
const selectedDay = ref('Semua')
const tabs = computed(() => [
  { value: 'Semua', label: 'Semua' },
  ...(todayValue.value && DAYS.some(d => d.value === todayValue.value)
    ? [{ value: 'TODAY', label: 'Hari ini' }]
    : []),
  ...DAYS.map(d => ({ value: d.value, label: d.label }))
])

const filteredClasses = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allClasses.value.filter(c => {
    const matchesSearch = !q || c.subject.toLowerCase().includes(q) || c.room.toLowerCase().includes(q)
    const matchesDay =
      selectedDay.value === 'Semua' ||
      (selectedDay.value === 'TODAY' ? c.day === todayValue.value : c.day === selectedDay.value)
    return matchesSearch && matchesDay
  })
})

const groups = computed(() => {
  const known = DAYS.map(d => ({
    ...d,
    items: filteredClasses.value.filter(c => c.day === d.value)
  }))
  const other = filteredClasses.value.filter(c => !DAYS.some(d => d.value === c.day))
  if (other.length) known.push({ value: 'OTHER', label: 'Lainnya', color: '#64748b', items: other })

  // Tanpa pencarian, hari kosong tetap tampil sebagai "hari bebas". Saat mencari, hanya yang cocok.
  const searching = !!searchQuery.value.trim()
  const picked = selectedDay.value === 'TODAY' ? todayValue.value : selectedDay.value
  return known.filter(g =>
    g.items.length ||
    (!searching && (picked === 'Semua' ? g.value !== 'OTHER' : g.value === picked))
  )
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
        <div class="badge-glass">JADWAL SERVER SISCVERSE</div>
        <h1 class="title">Jadwal<br/><span class="text-gradient">Perkuliahan</span></h1>
        <p class="subtitle">Rute harian kelas Siscverse, tersinkronisasi dengan dashboard. Cek jam dan ruangan sebelum berangkat.</p>
      </header>

      <!-- PENCARIAN & FILTER -->
      <div class="filter-section">
        <div class="search-box">
          <svg class="icon-search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Cari mata kuliah atau ruangan..." class="search-input" />
        </div>

        <div class="tabs">
          <button v-for="t in tabs" :key="t.value" @click="selectedDay = t.value" :class="['tab-btn', { active: selectedDay === t.value }]">
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- LOADER -->
      <div v-if="pending" class="loading-state">
        <div class="spinner"></div>
        <p>Memuat jadwal dari Dashboard...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="empty-state">
        <div class="empty-icon">!</div>
        <p>Gagal memuat jadwal: {{ error.message }}</p>
      </div>

      <!-- KOSONG TOTAL -->
      <div v-else-if="allClasses.length === 0" class="empty-state">
        <div class="empty-icon">!</div>
        <p>Belum ada jadwal di database.</p>
      </div>

      <!-- JADWAL PER HARI -->
      <div v-else>
        <section v-if="groups.length === 0" class="empty-state">
          <div class="empty-icon">!</div>
          <p>Tidak ada jadwal yang cocok.</p>
        </section>

        <div v-else class="days-grid">
          <section
            v-for="g in groups" :key="g.value"
            :class="['day-panel', { today: g.value === todayValue }]"
            :style="{ '--accent': g.color }"
          >
            <div class="day-head">
              <h2 class="day-name">{{ g.label }}</h2>
              <span v-if="g.value === todayValue" class="today-badge">Hari ini</span>
              <span class="count-badge">{{ g.items.length }} kelas</span>
            </div>

            <ol v-if="g.items.length" class="timeline">
              <li v-for="c in g.items" :key="c.id" class="class-item">
                <span class="class-time">{{ c.time }}</span>
                <div class="class-body">
                  <h3 class="class-subject">{{ c.subject }}</h3>
                  <p class="class-room">{{ c.room || 'Ruangan belum ditentukan' }}</p>
                </div>
              </li>
            </ol>

            <p v-else class="free-day">Tidak ada jadwal, hari bebas.</p>
          </section>
        </div>
      </div>

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

.main-layout { max-width: 1100px; margin: 0 auto; padding: 5rem 1.5rem; position: relative; z-index: 10; }

/* ================= HEADER ================= */
.header-section { margin-bottom: 4rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
.badge-glass {
  display: inline-block; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;
  font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.2em;
  background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; backdrop-filter: blur(10px);
}
.title { font-family: 'Outfit', sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.02em; }
.text-gradient { background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; line-height: 1.6; }

/* ================= LOADING STATE ================= */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; gap: 1rem; color: var(--text-secondary); }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ================= FILTER & SEARCH ================= */
.filter-section { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-bottom: 4rem; }
.search-box { position: relative; width: 100%; max-width: 600px; }
.icon-search { position: absolute; top: 50%; left: 1.5rem; transform: translateY(-50%); color: var(--text-secondary); }
.search-input {
  width: 100%; padding: 1.25rem 1.5rem 1.25rem 3.5rem;
  background: var(--glass-bg); backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  font-size: 1.05rem; color: #fff; transition: all 0.3s; outline: none;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
.search-input:focus { border-color: #3b82f6; box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }

.tabs { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; }
.tab-btn {
  padding: 0.6rem 1.5rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.tab-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.tab-btn.active { background: #fff; color: #000; border-color: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.3); }

/* ================= PANEL PER HARI ================= */
.days-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; align-items: start; }

.day-panel {
  background: var(--glass-bg); backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: 24px;
  padding: 1.5rem; transition: border-color 0.3s, box-shadow 0.3s;
}
.day-panel:hover { border-color: var(--accent); box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
.day-panel.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 30px color-mix(in srgb, var(--accent) 35%, transparent);
}

.day-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--glass-border); }
.day-name { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 700; color: var(--accent); letter-spacing: 0.02em; margin-right: auto; }
.today-badge {
  padding: 0.25rem 0.7rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700;
  background: var(--accent); color: #05050a;
}
.count-badge { padding: 0.3rem 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 100px; font-size: 0.8rem; color: var(--text-secondary); }

/* ================= TIMELINE KELAS ================= */
.timeline { list-style: none; display: flex; flex-direction: column; gap: 1rem; position: relative; }
.timeline::before {
  content: ''; position: absolute; left: 4.6rem; top: 0.5rem; bottom: 0.5rem; width: 1px;
  background: linear-gradient(to bottom, var(--accent), transparent);
  opacity: 0.5;
}

.class-item { display: flex; align-items: flex-start; gap: 1.25rem; position: relative; }
.class-time {
  flex-shrink: 0; width: 3.4rem; padding-top: 0.15rem;
  font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums;
}
.class-body {
  flex: 1; min-width: 0; padding: 0.85rem 1rem; margin-left: 0.6rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px;
  transition: background 0.2s, border-color 0.2s;
}
.class-body::before {
  content: ''; position: absolute; left: 4.6rem; top: 1rem; width: 9px; height: 9px; margin-left: -4px;
  border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent);
}
.class-item:hover .class-body { background: rgba(255,255,255,0.08); border-color: var(--accent); }

.class-subject { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 600; color: #fff; line-height: 1.3; overflow-wrap: anywhere; }
.class-room { margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-secondary); }

.free-day { padding: 1rem 0 0.25rem; text-align: center; font-size: 0.95rem; color: var(--text-secondary); }

/* ================= EMPTY STATE ================= */
.empty-state { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); text-align: center; }
.empty-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

/* ================= KEYFRAMES ================= */
@keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

@media (prefers-reduced-motion: reduce) {
  .aurora-blob, .spinner { animation: none; }
}

/* ================= RESPONSIVE ================= */
@media (max-width: 480px) {
  .title { font-size: 2.2rem; }
  .days-grid { grid-template-columns: 1fr; }
  .day-panel { padding: 1.25rem; }
}
</style>