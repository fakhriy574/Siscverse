<!-- app/components/AdminSidebar.vue -->
<script setup>
/*
  Sidebar bersama untuk semua halaman admin.
  Menambah halaman admin baru cukup menambah satu baris di daftar `links`
  di bawah ini. Semua halaman admin ikut berubah, tanpa mengedit satu per satu.
*/
const supabase = useSupabaseClient()
const route = useRoute()

const links = [
  { to: '/admin', icon: '🏠', label: 'Dashboard' },
  { to: '/admin/structure', icon: '✨', label: 'Directory' },
  { to: '/admin/schedule', icon: '📅', label: 'Schedule' },
  { to: '/admin/uts', icon: '📝', label: 'UTS' },
  { to: '/admin/menfess', icon: '💌', label: 'Menfess' },
  { to: '/admin/kas', icon: '💸', label: 'Treasury' },
  { to: '/admin/gallery', icon: '🖼️', label: 'Gallery' }
]

const isActive = (to) => {
  const path = route.path.replace(/\/$/, '') || '/'
  return to === '/admin' ? path === '/admin' : path.startsWith(to)
}

const loggingOut = ref(false)
const handleLogout = async () => {
  loggingOut.value = true
  const { error } = await supabase.auth.signOut()
  loggingOut.value = false
  if (error) {
    alert('Gagal logout: ' + error.message)
    return
  }
  await navigateTo('/auth/login')
}
</script>

<template>
  <aside class="w-64 bg-white border-r border-slate-100 flex-col justify-between hidden md:flex shrink-0 shadow-sm z-10">
    <div>
      <div class="h-20 flex items-center px-8">
        <div class="w-8 h-8 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md mr-3">S</div>
        <span class="font-black text-slate-800 tracking-tight text-xl">Siscverse</span>
      </div>

      <nav class="p-4 space-y-1">
        <NuxtLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="flex items-center px-4 py-3 text-sm rounded-2xl transition-all"
          :class="isActive(l.to) ? 'font-bold bg-violet-50 text-violet-700' : 'font-medium text-slate-500 hover:bg-slate-50'"
          :aria-current="isActive(l.to) ? 'page' : undefined"
        >
          {{ l.icon }} {{ l.label }}
        </NuxtLink>
      </nav>
    </div>

    <div class="p-6 flex flex-col gap-3">
      <div class="bg-emerald-50 rounded-2xl p-4 flex items-center gap-3 border border-emerald-100">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <div>
          <p class="text-xs font-bold text-emerald-800">System Online</p>
          <p class="text-[10px] font-medium text-emerald-600">Database Connected</p>
        </div>
      </div>

      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-2xl transition-colors group disabled:opacity-60"
        :disabled="loggingOut"
        @click="handleLogout"
      >
        <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {{ loggingOut ? 'Keluar...' : 'Keluar Akses' }}
      </button>
    </div>
  </aside>
</template>