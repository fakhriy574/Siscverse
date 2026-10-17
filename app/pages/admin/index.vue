<!-- pages/admin/index.vue -->
<script setup>
const supabase = useSupabaseClient()

// Penjaga Pintu Langsung (Inline Middleware) agar tidak error 500
definePageMeta({
  middleware: [
    function (to, from) {
      const user = useSupabaseUser()
      if (!user.value) {
        return navigateTo('/auth/login')
      }
    }
  ]
})

// Semua data diambil dari browser (server: false) dengan nilai awal, supaya halaman tidak
// bergantung pada koneksi server Vercel ke Supabase.

const wibToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const countOf = async (table) => {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count || 0
}

// Total anggota, sesi kuliah, dan foto
const { data: memberCount } = await useAsyncData('dash_members', () => countOf('members'), { server: false, default: () => 0 })
const { data: scheduleCount } = await useAsyncData('dash_schedules', () => countOf('schedules'), { server: false, default: () => 0 })
const { data: photoCount } = await useAsyncData('dash_photos', () => countOf('gallery'), { server: false, default: () => 0 })

// Saldo kas
const { data: totalKas } = await useAsyncData('dash_kas', async () => {
  const { data } = await supabase.from('kas_transactions').select('transaction_type, amount')
  if (!data) return 0
  return data.reduce((total, trx) => {
    const nominal = Number(trx.amount)
    return trx.transaction_type === 'INCOME' ? total + nominal : total - nominal
  }, 0)
}, { server: false, default: () => 0 })

// Ringkasan UTS: jumlah ujian dan tanggal ujian berikutnya
const { data: uts } = await useAsyncData('dash_uts', async () => {
  const { data } = await supabase.from('exams').select('exam_date, subject').order('exam_date', { ascending: true })
  const rows = data || []
  const today = wibToday()
  const nextDate = rows.find((r) => r.exam_date >= today)?.exam_date || null
  return {
    total: rows.length,
    nextDate,
    nextSubjects: nextDate ? rows.filter((r) => r.exam_date === nextDate).map((r) => r.subject) : [],
    done: rows.length > 0 && !nextDate
  }
}, { server: false, default: () => ({ total: 0, nextDate: null, nextSubjects: [], done: false }) })

// Menfess: total dan tiga terbaru
const { data: menfess } = await useAsyncData('dash_menfess', async () => {
  const { data, count } = await supabase
    .from('menfess')
    .select('message, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(3)
  return { items: data || [], total: count || 0 }
}, { server: false, default: () => ({ items: [], total: 0 }) })

// Helper
const formatRupiah = (angka) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
const shortDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Kartu semua fitur. Nama kelas Tailwind ditulis utuh supaya terbaca saat build.
const cards = computed(() => [
  {
    to: '/admin/structure', icon: '🧑‍🚀', badge: 'Directory', label: 'Total Warga Kelas',
    value: String(memberCount.value), unit: 'Entitas', big: true,
    tone: { blob: 'bg-violet-500/10 group-hover:bg-violet-500/20', icon: 'bg-violet-100 text-violet-600', badge: 'bg-violet-50 text-violet-600' }
  },
  {
    to: '/admin/kas', icon: '💸', badge: 'Treasury', label: 'Total Saldo Kas',
    value: formatRupiah(totalKas.value),
    tone: { blob: 'bg-emerald-500/10 group-hover:bg-emerald-500/20', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-50 text-emerald-600' }
  },
  {
    to: '/admin/schedule', icon: '🗓️', badge: 'Schedule', label: 'Jadwal Kuliah Mingguan',
    value: String(scheduleCount.value), unit: 'Sesi', big: true,
    tone: { blob: 'bg-amber-500/10 group-hover:bg-amber-500/20', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-50 text-amber-600' }
  },
  {
    to: '/admin/uts', icon: '📝', badge: 'UTS', label: uts.value.nextDate ? 'Ujian Berikutnya' : 'Jadwal UTS',
    value: uts.value.nextDate ? shortDate(uts.value.nextDate) : uts.value.done ? 'Selesai' : 'Belum ada',
    sub: uts.value.nextDate
      ? uts.value.nextSubjects.join(', ')
      : uts.value.total ? `${uts.value.total} ujian tercatat` : 'Klik untuk menambah jadwal',
    tone: { blob: 'bg-rose-500/10 group-hover:bg-rose-500/20', icon: 'bg-rose-100 text-rose-600', badge: 'bg-rose-50 text-rose-600' }
  },
  {
    to: '/admin/gallery', icon: '🖼️', badge: 'Gallery', label: 'Total Foto',
    value: String(photoCount.value), unit: 'Foto', big: true,
    tone: { blob: 'bg-sky-500/10 group-hover:bg-sky-500/20', icon: 'bg-sky-100 text-sky-600', badge: 'bg-sky-50 text-sky-600' }
  },
  {
    to: '/admin/menfess', icon: '💌', badge: 'Menfess', label: 'Pesan Masuk',
    value: String(menfess.value.total), unit: 'Pesan', big: true,
    tone: { blob: 'bg-pink-500/10 group-hover:bg-pink-500/20', icon: 'bg-pink-100 text-pink-600', badge: 'bg-pink-50 text-pink-600' }
  }
])
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">

    <!-- SIDEBAR -->
    <AdminSidebar />

    <!-- MAIN CONTENT AREA -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-6xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Overview 🚀</h1>
            <p class="text-slate-500 text-sm mt-1">Pantau semua aktivitas kelas Siscverse. Klik kartu untuk mengelola.</p>
          </div>
          <div class="bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm text-sm font-bold text-slate-600 flex items-center gap-2">
            <span>📅</span> {{ new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) }}
          </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Kartu semua fitur -->
          <NuxtLink
            v-for="c in cards"
            :key="c.to"
            :to="c.to"
            class="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between h-48"
          >
            <div class="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-2xl transition-colors" :class="c.tone.blob"></div>
            <div class="flex justify-between items-start relative z-10">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner" :class="c.tone.icon">{{ c.icon }}</div>
              <span class="font-bold text-xs px-3 py-1.5 rounded-xl" :class="c.tone.badge">{{ c.badge }} ➔</span>
            </div>
            <div class="relative z-10 mt-auto min-w-0">
              <p class="text-slate-500 font-bold text-sm mb-1">{{ c.label }}</p>
              <h2 class="font-black text-slate-900 truncate" :class="c.big ? 'text-4xl' : 'text-3xl'">
                {{ c.value }} <span v-if="c.unit" class="text-lg text-slate-400 font-medium">{{ c.unit }}</span>
              </h2>
              <p v-if="c.sub" class="text-xs font-medium text-slate-400 mt-1 truncate">{{ c.sub }}</p>
            </div>
          </NuxtLink>

          <!-- Pesan terbaru -->
          <div class="lg:col-span-2 bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div class="flex justify-between items-center mb-6 relative z-10">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center text-xl">💌</div>
                <h3 class="text-lg font-black text-slate-900">Pesan Rahasia Masuk</h3>
              </div>
              <NuxtLink to="/admin/menfess" class="text-sm font-bold text-pink-600 hover:text-pink-700 hover:underline transition-all">Lihat Semua</NuxtLink>
            </div>

            <div class="space-y-4 flex-1 relative z-10">
              <div v-if="menfess.items.length === 0" class="h-full min-h-[100px] flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <span class="text-2xl mb-2">📭</span>
                <p class="text-slate-500 text-sm font-medium">Belum ada bisikan dari warga kelas.</p>
              </div>
              <div v-else v-for="(msg, index) in menfess.items" :key="index" class="p-4 bg-slate-50 hover:bg-pink-50/50 border border-slate-100 rounded-2xl transition-colors flex gap-4 items-start">
                <div class="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs">🕵️</div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-700 leading-relaxed mb-1 break-words">"{{ msg.message }}"</p>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    ANONYMOUS • {{ new Date(msg.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Kong AI -->
          <div class="bg-slate-900 rounded-[2rem] p-8 shadow-xl text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-pink-500/20 pointer-events-none"></div>
            <div class="text-5xl mb-4 relative z-10">🐒</div>
            <h3 class="text-xl font-black mb-2 relative z-10">Kong AI</h3>
            <p class="text-slate-300 text-sm font-medium mb-6 relative z-10">Sistem terintegrasi dengan mulus. Butuh bantuan untuk mengelola data?</p>
            <button class="bg-white text-slate-900 font-bold px-6 py-3 rounded-xl text-sm hover:scale-105 transition-transform relative z-10 shadow-lg shadow-white/10">Tanya Kong</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>