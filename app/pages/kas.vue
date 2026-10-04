<!-- pages/kas.vue -->
<script setup>
useHead({
  title: 'Kas Kelas | Siscverse',
  meta: [{ name: 'description', content: 'Catatan iuran masuk dan pengeluaran kas kelas Siscverse, terbuka untuk semua.' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap' }
  ]
})

/* ===== AMBIL DATA DARI SUPABASE (hanya baca) ===== */
const supabase = useSupabaseClient()

const { data: rows, pending, error } = useAsyncData(
  'kas-public',
  async () => {
    const { data, error } = await supabase
      .from('kas_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  { server: false, lazy: true, default: () => [] }
)

// Error fetch tampil di console browser (F12) supaya tidak tertelan diam-diam
watch(error, (e) => { if (e) console.error('[kas] gagal:', e) }, { immediate: true })

const transactions = computed(() => (Array.isArray(rows.value) ? rows.value : []))
const isIncome = (tx) => tx.transaction_type === 'INCOME'

/* ===== KATEGORI (ikon otomatis dari isi keterangan, sama seperti dashboard) ===== */
const EXPENSE_CATS = [
  { icon: '🧹', label: 'Kebersihan', keys: ['sapu', 'pel', 'kemoceng', 'sabun', 'sampah', 'pembersih', 'kebersihan'] },
  { icon: '✏️', label: 'ATK', keys: ['spidol', 'kapur', 'kertas', 'pulpen', 'penghapus', 'lakban', 'isolasi', 'atk'] },
  { icon: '🖨️', label: 'Print & fotokopi', keys: ['print', 'fotokopi', 'cetak', 'jilid', 'foto copy'] },
  { icon: '🍱', label: 'Konsumsi', keys: ['makan', 'minum', 'snack', 'konsumsi', 'galon', 'jajan', 'kue'] },
  { icon: '🎉', label: 'Acara', keys: ['acara', 'dekorasi', 'perpisahan', 'kado', 'hadiah', 'lomba', 'kegiatan', 'ulang tahun'] },
  { icon: '🔧', label: 'Perlengkapan kelas', keys: ['kipas', 'lampu', 'kabel', 'stopkontak', 'tirai', 'taplak', 'hiasan', 'tanaman', 'poster', 'perlengkapan'] },
  { icon: '🚌', label: 'Transport', keys: ['bensin', 'transport', 'ojek', 'angkot', 'parkir', 'ongkos'] },
  { icon: '📦', label: 'Lainnya', keys: [] }
]
const INCOME_CATS = [
  { icon: '💰', label: 'Kas mingguan', keys: ['kas', 'iuran', 'mingguan', 'bulanan'] },
  { icon: '🤝', label: 'Donasi', keys: ['donasi', 'sumbangan'] },
  { icon: '🛍️', label: 'Hasil jualan', keys: ['jualan', 'jual', 'bazar', 'penjualan'] },
  { icon: '📦', label: 'Lainnya', keys: [] }
]

const categoryOf = (tx) => {
  const cats = isIncome(tx) ? INCOME_CATS : EXPENSE_CATS
  const desc = (tx.description || '').toLowerCase()
  const words = desc.match(/[a-z0-9]+/g) || []
  const hit = cats.find(c =>
    desc.startsWith(c.label.toLowerCase() + ':') ||
    c.keys.some(k => (k.includes(' ') ? desc.includes(k) : words.includes(k)))
  )
  return hit || (isIncome(tx) ? cats[0] : cats[cats.length - 1])
}

// Buang awalan "Kategori: " dari keterangan karena kategorinya sudah tampil terpisah
const displayDesc = (tx) => {
  const desc = (tx.description || '').trim()
  const prefix = categoryOf(tx).label.toLowerCase() + ':'
  if (desc.toLowerCase().startsWith(prefix)) return desc.slice(prefix.length).trim() || desc
  return desc
}

/* ===== RINGKASAN ===== */
const totalIncome = computed(() => transactions.value.filter(isIncome).reduce((s, tx) => s + Number(tx.amount), 0))
const totalExpense = computed(() => transactions.value.filter(tx => !isIncome(tx)).reduce((s, tx) => s + Number(tx.amount), 0))
const balance = computed(() => totalIncome.value - totalExpense.value)
const incomeCount = computed(() => transactions.value.filter(isIncome).length)
const expenseCount = computed(() => transactions.value.length - incomeCount.value)
const latestDate = computed(() => transactions.value[0]?.transaction_date || '')

/* ===== FORMAT ===== */
const formatRupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

/* ===== FILTER, CARI, DAN TAMPILKAN LEBIH BANYAK ===== */
const tab = ref('ALL')
const search = ref('')
const tabs = [
  { key: 'ALL', label: 'Semua' },
  { key: 'INCOME', label: 'Pemasukan' },
  { key: 'EXPENSE', label: 'Pengeluaran' }
]
const PAGE = 30
const visible = ref(PAGE)

watch([tab, search], () => { visible.value = PAGE })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return transactions.value.filter(tx => {
    if (tab.value === 'INCOME' && !isIncome(tx)) return false
    if (tab.value === 'EXPENSE' && isIncome(tx)) return false
    if (q && !(tx.description || '').toLowerCase().includes(q)) return false
    return true
  })
})

const grouped = computed(() => {
  const map = new Map()
  filtered.value.slice(0, visible.value).forEach(tx => {
    const key = tx.transaction_date
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(tx)
  })
  return [...map.entries()].map(([date, items]) => ({ date, items }))
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
    <main class="main-layout">

      <!-- HEADER -->
      <header class="header-section">
        <div class="badge-glass">KAS KELAS SISCVERSE</div>
        <h1 class="title">Keuangan yang<br/><span class="text-gradient">Terbuka untuk Semua</span></h1>
        <p class="subtitle">Catatan iuran masuk dan pengeluaran kelas yang tersinkronisasi dengan dashboard, supaya semua orang bisa melihat ke mana uang kas dipakai.</p>
      </header>

      <!-- LOADER -->
      <div v-if="pending" class="loading-state">
        <div class="spinner"></div>
        <p>Memuat data kas...</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="error" class="state-box">
        <div class="state-icon">!</div>
        <p>Gagal memuat data kas: {{ error.message }}</p>
      </div>

      <template v-else>
        <!-- RINGKASAN -->
        <section class="summary">
          <div class="balance-card">
            <p class="s-label">Saldo kas saat ini</p>
            <p class="balance-value" :class="{ negative: balance < 0 }">{{ formatRupiah(balance) }}</p>
            <p class="s-note">
              {{ transactions.length }} catatan transaksi<template v-if="latestDate">, terakhir {{ formatDate(latestDate) }}</template>
            </p>
          </div>

          <div class="stat-card">
            <div class="stat-head">
              <span class="stat-arrow in">&darr;</span>
              <p class="s-label">Total pemasukan</p>
            </div>
            <p class="stat-value in">{{ formatRupiah(totalIncome) }}</p>
            <p class="s-note">{{ incomeCount }} kali masuk</p>
          </div>

          <div class="stat-card">
            <div class="stat-head">
              <span class="stat-arrow out">&uarr;</span>
              <p class="s-label">Total pengeluaran</p>
            </div>
            <p class="stat-value out">{{ formatRupiah(totalExpense) }}</p>
            <p class="s-note">{{ expenseCount }} kali keluar</p>
          </div>
        </section>

        <!-- PENCARIAN & FILTER -->
        <div class="filter-section">
          <div class="search-box">
            <svg class="icon-search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input v-model="search" type="text" placeholder="Cari keterangan, misal: sapu, spidol..." class="search-input" />
          </div>

          <div class="tabs">
            <button v-for="t in tabs" :key="t.key" @click="tab = t.key" :class="['tab-btn', { active: tab === t.key }]">
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- RIWAYAT -->
        <section class="ledger">
          <div class="title-row">
            <h2 class="group-title">Riwayat Kas</h2>
            <span class="count-badge">{{ filtered.length }} Catatan</span>
          </div>

          <div v-for="g in grouped" :key="g.date" class="day-group">
            <h3 class="day-title">{{ formatDate(g.date) }}</h3>

            <div class="tx-list">
              <article v-for="tx in g.items" :key="tx.id" :class="['tx', isIncome(tx) ? 'is-in' : 'is-out']">
                <div class="tx-icon">{{ categoryOf(tx).icon }}</div>

                <div class="tx-body">
                  <p class="tx-desc">{{ displayDesc(tx) }}</p>
                  <p class="tx-meta">{{ categoryOf(tx).label }} &middot; {{ isIncome(tx) ? 'Pemasukan' : 'Pengeluaran' }}</p>
                </div>

                <p class="tx-amount">{{ isIncome(tx) ? '+' : '\u2212' }} {{ formatRupiah(tx.amount) }}</p>
              </article>
            </div>
          </div>

          <div v-if="filtered.length > visible" class="more-wrap">
            <button class="more-btn" @click="visible += PAGE">Tampilkan lebih banyak</button>
          </div>

          <div v-if="filtered.length === 0" class="empty-state">
            <div class="empty-icon">!</div>
            <p>{{ search || tab !== 'ALL' ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan kas.' }}</p>
          </div>
        </section>
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
  --text-primary: #ffffff;
  --text-secondary: #94a3b8;
  --in: #10b981;
  --out: #f43f5e;

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
.subtitle { font-size: 1.1rem; color: var(--text-secondary); max-width: 620px; line-height: 1.6; }

/* ================= LOADING & ERROR ================= */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0; gap: 1rem; color: var(--text-secondary); }
.spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.state-box, .empty-state { padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-secondary); text-align: center; }
.state-icon, .empty-icon { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--text-secondary); display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; }

/* ================= RINGKASAN ================= */
.summary { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 1.25rem; margin-bottom: 4rem; }
.balance-card, .stat-card {
  background: var(--glass-bg); backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: 24px; padding: 1.75rem;
  display: flex; flex-direction: column; gap: 0.6rem; min-width: 0;
}
.balance-card {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(139, 92, 246, 0.28));
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 20px 50px rgba(59, 130, 246, 0.15);
}
.s-label { font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-secondary); }
.balance-card .s-label { color: rgba(255, 255, 255, 0.75); }
.balance-value { font-family: 'Outfit', sans-serif; font-size: clamp(1.9rem, 4vw, 2.8rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; overflow-wrap: anywhere; }
.balance-value.negative { color: #fda4af; }
.s-note { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; }
.balance-card .s-note { color: rgba(255, 255, 255, 0.7); }

.stat-head { display: flex; align-items: center; gap: 0.6rem; }
.stat-arrow { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; font-weight: 800; }
.stat-arrow.in { background: rgba(16, 185, 129, 0.15); color: var(--in); }
.stat-arrow.out { background: rgba(244, 63, 94, 0.15); color: var(--out); }
.stat-value { font-family: 'Outfit', sans-serif; font-size: clamp(1.4rem, 3vw, 1.9rem); font-weight: 700; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.stat-value.in { color: var(--in); }
.stat-value.out { color: var(--out); }

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

/* ================= RIWAYAT ================= */
.title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; }
.group-title { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 700; color: #fff; letter-spacing: 0.05em; text-transform: uppercase; }
.count-badge { padding: 0.3rem 0.8rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 100px; font-size: 0.85rem; color: var(--text-secondary); }

.day-group { margin-bottom: 2rem; }
.day-title { font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.9rem; padding-left: 0.25rem; }
.tx-list { display: flex; flex-direction: column; gap: 0.75rem; }

.tx {
  display: flex; align-items: center; gap: 1.1rem; padding: 1rem 1.25rem;
  background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 20px;
  transition: all 0.3s;
}
.tx:hover { background: rgba(30, 40, 60, 0.6); transform: translateX(6px); box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
.tx.is-in:hover { border-color: var(--in); }
.tx.is-out:hover { border-color: var(--out); }

.tx-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 1.4rem; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.05); }
.is-in .tx-icon { background: rgba(16, 185, 129, 0.12); }
.is-out .tx-icon { background: rgba(244, 63, 94, 0.12); }

.tx-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.tx-desc { font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 600; color: #fff; overflow-wrap: anywhere; }
.tx-meta { font-size: 0.8rem; color: var(--text-secondary); }

.tx-amount { font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.is-in .tx-amount { color: var(--in); }
.is-out .tx-amount { color: var(--out); }

.more-wrap { display: flex; justify-content: center; margin-top: 1rem; }
.more-btn {
  padding: 0.8rem 2rem; background: var(--glass-bg); backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border); border-radius: 100px;
  color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.more-btn:hover { background: rgba(255,255,255,0.1); }

/* ================= KEYFRAMES ================= */
@keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 30px) scale(1.1); } }

/* ================= RESPONSIVE ================= */
@media (max-width: 900px) {
  .summary { grid-template-columns: 1fr 1fr; }
  .balance-card { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .summary { grid-template-columns: 1fr; }
  .title { font-size: 2.2rem; }
  .tx { flex-wrap: wrap; padding: 0.9rem 1rem; }
  .tx-amount { width: 100%; padding-left: calc(48px + 1.1rem); }
}
@media (prefers-reduced-motion: reduce) {
  .aurora-blob, .spinner { animation: none; }
}
</style>