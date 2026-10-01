<!-- pages/admin/kas.vue -->
<script setup>
const supabase = useSupabaseClient()

// ---------- READ ----------
const { data: transactions, refresh, error: loadError } = await useAsyncData('admin_kas', async () => {
  const { data, error } = await supabase
    .from('kas_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
})

const isIncome = (tx) => tx.transaction_type === 'INCOME'

// ---------- KATEGORI (ikon otomatis dari isi keterangan, tanpa ubah database) ----------
const EXPENSE_CATS = [
  { icon: '🧹', label: 'Kebersihan', hint: 'Sapu lidi, kain pel, sabun', keys: ['sapu', 'pel', 'kemoceng', 'sabun', 'sampah', 'pembersih', 'kebersihan'] },
  { icon: '✏️', label: 'ATK', hint: 'Spidol, kapur, kertas', keys: ['spidol', 'kapur', 'kertas', 'pulpen', 'penghapus', 'lakban', 'isolasi', 'atk'] },
  { icon: '🖨️', label: 'Print & fotokopi', hint: 'Print jadwal piket', keys: ['print', 'fotokopi', 'cetak', 'jilid', 'foto copy'] },
  { icon: '🍱', label: 'Konsumsi', hint: 'Snack rapat, air galon', keys: ['makan', 'minum', 'snack', 'konsumsi', 'galon', 'jajan', 'kue'] },
  { icon: '🎉', label: 'Acara', hint: 'Dekorasi, kado, lomba', keys: ['acara', 'dekorasi', 'perpisahan', 'kado', 'hadiah', 'lomba', 'kegiatan', 'ulang tahun'] },
  { icon: '🔧', label: 'Perlengkapan kelas', hint: 'Lampu, kipas, kabel', keys: ['kipas', 'lampu', 'kabel', 'stopkontak', 'tirai', 'taplak', 'hiasan', 'tanaman', 'poster', 'perlengkapan'] },
  { icon: '🚌', label: 'Transport', hint: 'Bensin, ongkos', keys: ['bensin', 'transport', 'ojek', 'angkot', 'parkir', 'ongkos'] },
  { icon: '📦', label: 'Lainnya', hint: 'Keperluan lain', keys: [] },
]
const INCOME_CATS = [
  { icon: '💰', label: 'Kas mingguan', hint: 'Kas minggu ke-3', keys: ['kas', 'iuran', 'mingguan', 'bulanan'] },
  { icon: '🤝', label: 'Donasi', hint: 'Sumbangan wali kelas', keys: ['donasi', 'sumbangan'] },
  { icon: '🛍️', label: 'Hasil jualan', hint: 'Bazar, jual snack', keys: ['jualan', 'jual', 'bazar', 'penjualan'] },
  { icon: '📦', label: 'Lainnya', hint: 'Pemasukan lain', keys: [] },
]

const categoryOf = (tx) => {
  const cats = isIncome(tx) ? INCOME_CATS : EXPENSE_CATS
  const desc = (tx.description || '').toLowerCase()
  const words = desc.match(/[a-z0-9]+/g) || []
  const hit = cats.find(
    (c) =>
      desc.startsWith(c.label.toLowerCase() + ':') ||
      c.keys.some((k) => (k.includes(' ') ? desc.includes(k) : words.includes(k)))
  )
  return hit || (isIncome(tx) ? cats[0] : cats[cats.length - 1])
}

// ---------- RINGKASAN ----------
const totalIncome = computed(() =>
  (transactions.value || []).filter(isIncome).reduce((s, tx) => s + Number(tx.amount), 0)
)
const totalExpense = computed(() =>
  (transactions.value || []).filter((tx) => !isIncome(tx)).reduce((s, tx) => s + Number(tx.amount), 0)
)
const balance = computed(() => totalIncome.value - totalExpense.value)
const incomeCount = computed(() => (transactions.value || []).filter(isIncome).length)
const expenseCount = computed(() => (transactions.value || []).filter((tx) => !isIncome(tx)).length)

// ---------- FILTER ----------
const tab = ref('ALL') // ALL | INCOME | EXPENSE
const search = ref('')
const tabs = [
  { key: 'ALL', label: 'Semua' },
  { key: 'INCOME', label: 'Pemasukan' },
  { key: 'EXPENSE', label: 'Pengeluaran' },
]

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (transactions.value || []).filter((tx) => {
    if (tab.value === 'INCOME' && !isIncome(tx)) return false
    if (tab.value === 'EXPENSE' && isIncome(tx)) return false
    if (q && !(tx.description || '').toLowerCase().includes(q)) return false
    return true
  })
})

// Kelompokkan per tanggal supaya mudah dibaca
const grouped = computed(() => {
  const map = new Map()
  filtered.value.forEach((tx) => {
    const key = tx.transaction_date
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(tx)
  })
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

// ---------- FORMAT ----------
const formatRupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- TOAST ----------
const toast = ref('')
let toastTimer
const notify = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2800)
}

// ---------- FORM ----------
const emptyForm = () => ({ type: 'INCOME', amount: '', description: '', date: today() })
const showForm = ref(false)
const form = ref(emptyForm())
const saving = ref(false)
const formError = ref('')

const selectedCat = ref('')
const formCats = computed(() => (form.value.type === 'EXPENSE' ? EXPENSE_CATS : INCOME_CATS))
const selectedHint = computed(() => formCats.value.find((c) => c.label === selectedCat.value)?.hint)

const setType = (type) => {
  form.value.type = type
  selectedCat.value = ''
}

// Klik kategori: isi awal keterangan dengan nama kategori, tinggal lanjut ketik detailnya
const pickCat = (cat) => {
  const current = form.value.description.trim()
  const isPrefixOnly = [...EXPENSE_CATS, ...INCOME_CATS].some((c) => current === `${c.label}:`)
  if (!current || isPrefixOnly) form.value.description = `${cat.label}: `
  selectedCat.value = cat.label
}

const openForm = (type = 'INCOME') => {
  form.value = { ...emptyForm(), type }
  selectedCat.value = ''
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const save = async () => {
  formError.value = ''
  const amount = Number(form.value.amount)
  const description = form.value.description.trim()
  const type = form.value.type

  if (!amount || amount <= 0) {
    formError.value = 'Nominal harus lebih dari 0.'
    return
  }
  if (!description) {
    formError.value = type === 'EXPENSE' ? 'Isi dulu beli apa / untuk keperluan apa.' : 'Isi dulu keterangan pemasukan.'
    return
  }
  if (!form.value.date) {
    formError.value = 'Tanggal wajib diisi.'
    return
  }

  saving.value = true
  const { error } = await supabase.from('kas_transactions').insert([
    {
      transaction_type: type,
      amount,
      description,
      transaction_date: form.value.date,
    },
  ])
  saving.value = false

  if (error) {
    formError.value = `Gagal menyimpan: ${error.message}`
    return
  }

  showForm.value = false
  await refresh()
  notify(type === 'INCOME' ? 'Pemasukan dicatat.' : 'Pengeluaran dicatat.')
}

// ---------- DELETE ----------
const deleteTarget = ref(null)
const deleting = ref(false)

const remove = async () => {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  const { error } = await supabase.from('kas_transactions').delete().eq('id', target.id)
  deleting.value = false
  deleteTarget.value = null

  if (error) {
    notify(`Gagal menghapus: ${error.message}`)
    return
  }
  await refresh()
  notify('Catatan dihapus.')
}

onBeforeUnmount(() => clearTimeout(toastTimer))
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-100 flex-col justify-between hidden md:flex shrink-0 shadow-sm z-10">
      <div>
        <div class="h-20 flex items-center px-8">
          <div class="w-8 h-8 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md mr-3">S</div>
          <span class="font-black text-slate-800 tracking-tight text-xl">Siscverse</span>
        </div>

        <nav class="p-4 space-y-1">
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin">🏠 Dashboard</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/structure">✨ Directory</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/schedule">📅 Schedule</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/menfess">💌 Menfess</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-bold rounded-2xl bg-violet-50 text-violet-700 transition-all" to="/admin/kas">💸 Treasury</NuxtLink>
        </nav>
      </div>

      <div class="p-6">
        <div class="bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 border border-emerald-100">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <div>
            <p class="text-xs font-bold text-emerald-800">System Online</p>
            <p class="text-[10px] font-medium text-emerald-600">Database Connected</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-6xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Treasury 💸</h1>
            <p class="text-slate-500 text-sm mt-1">Pantau uang kas kelas: saldo, pemasukan, dan pengeluaran.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold text-sm px-6 py-3 rounded-2xl transition-colors"
              @click="openForm('EXPENSE')"
            >
              − Catat pengeluaran
            </button>
            <button
              type="button"
              class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-violet-200 transition-colors"
              @click="openForm('INCOME')"
            >
              + Catat pemasukan
            </button>
          </div>
        </header>

        <div v-if="loadError" class="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-sm font-medium">
          Gagal memuat data: {{ loadError.message }}
        </div>

        <template v-else>
          <!-- Ringkasan -->
          <section class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div class="md:col-span-1 bg-gradient-to-tr from-violet-600 to-pink-500 text-white rounded-3xl p-6 shadow-lg shadow-violet-200">
              <p class="text-xs font-bold uppercase tracking-wider text-white/80">Total kas saat ini</p>
              <p class="text-3xl font-black tracking-tight mt-2 truncate">{{ formatRupiah(balance) }}</p>
              <p class="text-xs font-medium text-white/80 mt-3">{{ (transactions || []).length }} catatan transaksi</p>
            </div>

            <div class="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">↓</span>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total pemasukan</p>
              </div>
              <p class="text-2xl font-black text-emerald-600 tracking-tight mt-3 truncate">{{ formatRupiah(totalIncome) }}</p>
              <p class="text-xs font-medium text-slate-400 mt-2">{{ incomeCount }} kali masuk</p>
            </div>

            <div class="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-black">↑</span>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total pengeluaran</p>
              </div>
              <p class="text-2xl font-black text-red-500 tracking-tight mt-3 truncate">{{ formatRupiah(totalExpense) }}</p>
              <p class="text-xs font-medium text-slate-400 mt-2">{{ expenseCount }} kali keluar</p>
            </div>
          </section>

          <!-- Filter + cari -->
          <div class="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div class="flex bg-white border border-slate-200 rounded-2xl p-1 w-fit">
              <button
                v-for="t in tabs"
                :key="t.key"
                type="button"
                class="text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                :class="tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'"
                @click="tab = t.key"
              >
                {{ t.label }}
              </button>
            </div>
            <input
              v-model="search"
              type="search"
              placeholder="Cari keterangan, misal: sapu, spidol..."
              class="w-full md:w-80 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <span class="text-xs font-bold text-slate-400">{{ filtered.length }} catatan</span>
          </div>

          <!-- Riwayat -->
          <div
            v-if="filtered.length === 0"
            class="min-h-[160px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center"
          >
            <span class="text-3xl mb-2">🫥</span>
            <p class="text-slate-500 text-sm font-medium">
              {{ search || tab !== 'ALL' ? 'Tidak ada catatan yang cocok.' : 'Belum ada pergerakan dana. Klik "Catat pemasukan" untuk mulai.' }}
            </p>
          </div>

          <div v-else class="space-y-6">
            <section v-for="g in grouped" :key="g.date">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">{{ formatDate(g.date) }}</h3>
              <div class="space-y-3">
                <article
                  v-for="tx in g.items"
                  :key="tx.id"
                  class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4"
                >
                  <div
                    class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    :class="isIncome(tx) ? 'bg-emerald-50' : 'bg-red-50'"
                  >
                    {{ categoryOf(tx).icon }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="font-black text-slate-900 truncate">{{ tx.description }}</p>
                    <p class="text-xs font-medium text-slate-400">
                      {{ categoryOf(tx).label }} · {{ isIncome(tx) ? 'Pemasukan' : 'Pengeluaran' }}
                    </p>
                  </div>

                  <p class="font-black text-right shrink-0" :class="isIncome(tx) ? 'text-emerald-600' : 'text-red-500'">
                    {{ isIncome(tx) ? '+' : '−' }} {{ formatRupiah(tx.amount) }}
                  </p>

                  <button
                    type="button"
                    class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors shrink-0"
                    @click="deleteTarget = tx"
                  >
                    Hapus
                  </button>
                </article>
              </div>
            </section>
          </div>
        </template>
      </div>
    </main>

    <!-- Form modal -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 class="text-xl font-black text-slate-900">Catat kas</h2>
          <button type="button" class="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Tutup" @click="closeForm">✕</button>
        </div>

        <div class="px-8 py-6 space-y-5">
          <div>
            <span class="block text-xs font-bold text-slate-500 mb-2">Jenis</span>
            <div class="flex bg-slate-50 border border-slate-200 rounded-2xl p-1">
              <button
                type="button"
                class="flex-1 text-sm font-bold py-2.5 rounded-xl transition-colors"
                :class="form.type === 'INCOME' ? 'bg-emerald-500 text-white' : 'text-slate-500'"
                @click="setType('INCOME')"
              >
                Pemasukan
              </button>
              <button
                type="button"
                class="flex-1 text-sm font-bold py-2.5 rounded-xl transition-colors"
                :class="form.type === 'EXPENSE' ? 'bg-red-500 text-white' : 'text-slate-500'"
                @click="setType('EXPENSE')"
              >
                Pengeluaran
              </button>
            </div>
          </div>

          <!-- Kategori -->
          <div>
            <span class="block text-xs font-bold text-slate-500 mb-2">Kategori</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in formCats"
                :key="c.label"
                type="button"
                class="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors"
                :class="selectedCat === c.label
                  ? (form.type === 'EXPENSE' ? 'bg-red-500 border-red-500 text-white' : 'bg-emerald-500 border-emerald-500 text-white')
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                @click="pickCat(c)"
              >
                <span class="text-base">{{ c.icon }}</span>
                {{ c.label }}
              </button>
            </div>
            <p v-if="selectedHint" class="text-xs text-slate-400 mt-2">Contoh: {{ selectedHint }}</p>
          </div>

          <div>
            <label for="k-amount" class="block text-xs font-bold text-slate-500 mb-2">Nominal (Rp)</label>
            <input
              id="k-amount"
              v-model="form.amount"
              type="number"
              min="0"
              placeholder="Contoh: 50000"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="k-desc" class="block text-xs font-bold text-slate-500 mb-2">
              {{ form.type === 'EXPENSE' ? 'Beli apa / untuk keperluan apa' : 'Keterangan pemasukan' }}
            </label>
            <input
              id="k-desc"
              v-model="form.description"
              type="text"
              :placeholder="form.type === 'EXPENSE' ? 'Contoh: Beli sapu lidi dan spidol' : 'Contoh: Kas minggu ke-3'"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <div>
            <label for="k-date" class="block text-xs font-bold text-slate-500 mb-2">Tanggal</label>
            <input
              id="k-date"
              v-model="form.date"
              type="date"
              class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          <p v-if="formError" class="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {{ formError }}
          </p>
        </div>

        <div class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="saving"
            @click="closeForm"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 transition-colors"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      @click.self="deleteTarget = null"
    >
      <div class="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
        <div class="text-4xl mb-3">🗑️</div>
        <h2 class="text-lg font-black text-slate-900 mb-2">Hapus catatan ini?</h2>
        <p class="text-sm text-slate-500 mb-6">
          "{{ deleteTarget.description }}" ({{ formatRupiah(deleteTarget.amount) }}) akan dihapus permanen dan saldo dihitung ulang.
        </p>
        <div class="flex gap-3 justify-center">
          <button
            type="button"
            class="text-sm font-bold px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            :disabled="deleting"
            @click="deleteTarget = null"
          >
            Batal
          </button>
          <button
            type="button"
            class="text-sm font-bold px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors"
            :disabled="deleting"
            @click="remove"
          >
            {{ deleting ? 'Menghapus...' : 'Ya, hapus' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl"
      role="status"
    >
      {{ toast }}
    </div>
  </div>
</template>