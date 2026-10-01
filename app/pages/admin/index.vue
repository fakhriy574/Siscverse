<script setup>
const supabase = useSupabaseClient()
const router = useRouter()

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

// Fungsi Logout
const handleLogout = async () => {
  const { error } = await supabase.auth.signOut()
  if (!error) {
    return navigateTo('/auth/login')
  } else {
    alert('Gagal logout: ' + error.message)
  }
}

// Tarik Data Total Member
const { data: memberCount } = await useAsyncData('member_count_v2', async () => {
  const { count } = await supabase.from('members').select('*', { count: 'exact', head: true })
  return count || 0
})

// Tarik Data Menfess Terbaru
const { data: recentMenfess } = await useAsyncData('recent_menfess_v2', async () => {
  const { data } = await supabase.from('menfess')
    .select('message, created_at')
    .order('created_at', { ascending: false })
    .limit(3)
  return data || []
})

// Tarik & Hitung Saldo Kas
const { data: totalKas } = await useAsyncData('total_kas_v2', async () => {
  const { data } = await supabase.from('kas_transactions').select('transaction_type, amount')
  if (!data) return 0
  return data.reduce((total, trx) => {
    const nominal = Number(trx.amount)
    return trx.transaction_type === 'INCOME' ? total + nominal : total - nominal
  }, 0)
})

// Helper Format Rupiah
const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden selection:bg-violet-200">
    
    <!-- SIDEBAR -->
    <aside class="w-64 bg-white border-r border-slate-100 flex flex-col justify-between hidden md:flex shrink-0 shadow-sm z-10">
      <div>
        <div class="h-20 flex items-center px-8">
          <div class="w-8 h-8 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md mr-3">S</div>
          <span class="font-black text-slate-800 tracking-tight text-xl">Siscverse</span>
        </div>
        
        <nav class="p-4 space-y-1">
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-bold rounded-2xl bg-violet-50 text-violet-700 transition-all" to="/admin">🏠 Dashboard</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/structure">✨ Directory</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/schedule">📅 Schedule</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/menfess">💌 Menfess</NuxtLink>
          <NuxtLink class="flex items-center px-4 py-3 text-sm font-medium rounded-2xl text-slate-500 hover:bg-slate-50 transition-all" to="/admin/kas">💸 Treasury</NuxtLink>
        </nav>
      </div>

      <!-- FOOTER SIDEBAR (Status & Logout) -->
      <div class="p-6 flex flex-col gap-3">
        <div class="bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 border border-emerald-100">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <div>
            <p class="text-xs font-bold text-emerald-800">System Online</p>
            <p class="text-[10px] font-medium text-emerald-600">Database Connected</p>
          </div>
        </div>
        
        <button @click="handleLogout" class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-2xl transition-colors group">
          <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Keluar Akses
        </button>
      </div>
    </aside>

    <!-- MAIN CONTENT AREA -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="max-w-6xl mx-auto p-6 md:p-10">
        <header class="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Overview 🚀</h1>
            <p class="text-slate-500 text-sm mt-1">Pantau semua aktivitas kelas Siscverse secara real-time.</p>
          </div>
          <div class="bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm text-sm font-bold text-slate-600 flex items-center gap-2">
            <span>📅</span> {{ new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) }}
          </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink to="/admin/structure" class="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between h-48">
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-colors"></div>
            <div class="flex justify-between items-start relative z-10">
              <div class="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🧑‍🚀</div>
              <span class="bg-violet-50 text-violet-600 font-bold text-xs px-3 py-1.5 rounded-xl">Directory ➔</span>
            </div>
            <div class="relative z-10 mt-auto">
              <p class="text-slate-500 font-bold text-sm mb-1">Total Warga Kelas</p>
              <h2 class="text-4xl font-black text-slate-900">{{ memberCount }} <span class="text-lg text-slate-400 font-medium">Entitas</span></h2>
            </div>
          </NuxtLink>

          <NuxtLink to="/admin/kas" class="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between h-48">
            <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
            <div class="flex justify-between items-start relative z-10">
              <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">💸</div>
              <span class="bg-emerald-50 text-emerald-600 font-bold text-xs px-3 py-1.5 rounded-xl">Treasury ➔</span>
            </div>
            <div class="relative z-10 mt-auto">
              <p class="text-slate-500 font-bold text-sm mb-1">Total Saldo Kas</p>
              <h2 class="text-3xl font-black text-slate-900 truncate">{{ formatRupiah(totalKas) }}</h2>
            </div>
          </NuxtLink>

          <NuxtLink to="/admin/schedule" class="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between h-48">
            <div class="absolute -left-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
            <div class="flex justify-between items-start relative z-10">
              <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🗓️</div>
              <span class="bg-amber-50 text-amber-600 font-bold text-xs px-3 py-1.5 rounded-xl">Schedule ➔</span>
            </div>
            <div class="relative z-10 mt-auto">
              <p class="text-slate-500 font-bold text-sm mb-1">Status Akademik</p>
              <h2 class="text-2xl font-black text-slate-900">Siap Tempur ⚡</h2>
            </div>
          </NuxtLink>

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
              <div v-if="recentMenfess.length === 0" class="h-full min-h-[100px] flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <span class="text-2xl mb-2">📭</span>
                <p class="text-slate-500 text-sm font-medium">Belum ada bisikan dari warga kelas.</p>
              </div>
              <div v-else v-for="(msg, index) in recentMenfess" :key="index" class="p-4 bg-slate-50 hover:bg-pink-50/50 border border-slate-100 rounded-2xl transition-colors flex gap-4 items-start">
                <div class="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs">🕵️</div>
                <div>
                  <p class="text-sm font-medium text-slate-700 leading-relaxed mb-1">"{{ msg.message }}"</p>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    ANONYMOUS • {{ new Date(msg.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

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